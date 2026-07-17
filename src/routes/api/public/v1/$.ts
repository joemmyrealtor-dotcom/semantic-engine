// Workstream 8 + 9 — Public API endpoints.
//
// Rate limiting (RC-1 Blocker #4): every non-catalog endpoint routes through
// the centralized `enforceRateLimit()` in `src/lib/data/rate-limit.ts`. The
// adapter is chosen from env at request time — in-memory for dev, Supabase
// (Postgres RPC + `public.rate_limit_buckets`) for production. Invalid or
// missing credentials still consume the pre-auth abuse bucket (IP-derived),
// so credential-guessing cannot bypass abuse protection. Successful
// requests carry `X-RateLimit-*` headers; 429s carry `Retry-After`.
//
// Auth: Bearer API key (matched against seeded APIClient records) OR a
// Supabase user JWT. Scope enforcement is per-endpoint via ENDPOINT_SCOPES.
import { createFileRoute } from "@tanstack/react-router";
import { buildSeedSnapshot } from "@/lib/data/seed";
import { callLocalAPI, API_CATALOG, type APIEndpointId } from "@/lib/data/integrations";
import { securityHeaders, redactSecrets, fingerprint } from "@/lib/data/security";
import {
  selectRateLimitStore, enforceRateLimit, ipFingerprint,
  currentRateLimitAdapterKind, decisionToDiagnostic, composeRateLimitKey,
  type PolicyKey, type RateLimitDimensions,
} from "@/lib/data/rate-limit";
import type { APIClient, APIClientScope, DataSnapshot } from "@/lib/data/schema";

function route(splat: string, search: URLSearchParams): { id: APIEndpointId; params: Record<string, string> } | null {
  const parts = splat.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  if (parts[0] === "registry" && parts[1]) {
    const params: Record<string, string> = { kind: parts[1] };
    const limit = search.get("limit");
    if (limit) params.limit = limit;
    return { id: "registry.list", params };
  }
  if (parts[0] === "knowledge" && parts[1]) return { id: "knowledge.detail", params: { id: parts[1] } };
  if (parts[0] === "releases" && parts[1] && parts[2] === "manifest") return { id: "release.manifest", params: { id: parts[1] } };
  if (parts[0] === "publications" && parts[1] && parts[2] === "export") return { id: "publication.export", params: { id: parts[1] } };
  if (parts[0] === "toolkits" && parts[1] && parts[2] === "export") return { id: "toolkit.export", params: { id: parts[1] } };
  if (parts[0] === "ai-packs" && parts[1] && parts[2] === "export") return { id: "aipack.export", params: { id: parts[1] } };
  if (parts[0] === "agents" && parts[1] && parts[2] === "export") return { id: "agent.export", params: { id: parts[1] } };
  if (parts[0] === "automations" && parts[1] === "runs" && parts[2]) return { id: "automation.run.status", params: { id: parts[2] } };
  if (parts[0] === "imports" && parts[1]) return { id: "import.job.status", params: { id: parts[1] } };
  return null;
}

const ENDPOINT_SCOPES: Record<APIEndpointId, APIClientScope> = {
  "registry.list": "registry.read",
  "knowledge.detail": "knowledge.read",
  "release.manifest": "release.read",
  "publication.export": "publication.read",
  "toolkit.export": "toolkit.read",
  "aipack.export": "aipack.read",
  "agent.export": "agent.read",
  "automation.run.status": "automation.read",
  "import.job.status": "import.write",
};

function requestId() { return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }

function json(body: unknown, status = 200, extra: Record<string, string> = {}, reqId?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-request-id": reqId ?? requestId(),
    ...securityHeaders(),
    ...extra,
  };
  return new Response(JSON.stringify(redactSecrets(body)), { status, headers });
}

function resolveClient(bearer: string | null, snap: DataSnapshot): (APIClient & { actorKind: "api-client" | "user-session" }) | null {
  if (!bearer) return null;
  const demoKey = process.env.DEMO_API_KEY;
  if (demoKey && bearer === demoKey) {
    const c = snap.apiClients.find(c => c.id === "APIC-001");
    return c ? { ...c, actorKind: "api-client" } : null;
  }
  if (bearer.split(".").length === 3) {
    const userClient: APIClient & { actorKind: "user-session" } = {
      id: "USER-SESSION",
      label: "Supabase user session",
      keyPrefix: "usr_",
      enabled: true,
      scopes: [
        "registry.read","knowledge.read","release.read","publication.read",
        "toolkit.read","aipack.read","agent.read","automation.read",
      ] as APIClient["scopes"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastUsedAt: null,
      workspaceId: snap.activeWorkspaceId,
      ownerRole: "APIClient",
      actorKind: "user-session",
    } as unknown as APIClient & { actorKind: "user-session" };
    return userClient;
  }
  const fp = fingerprint(bearer);
  const client = snap.apiClients.find(c => c.enabled && c.keyPrefix.includes(fp.slice(-4)));
  return client ? { ...client, actorKind: "api-client" } : null;
}

// Lazy-bind the store based on runtime env (workers evaluate module top-level per isolate).
let STORE_INIT = false;
function ensureStore() {
  if (STORE_INIT) return;
  try { selectRateLimitStore(process.env as Record<string, string | undefined>); } catch { /* falls back to memory */ }
  STORE_INIT = true;
}

export const Route = createFileRoute("/api/public/v1/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        ensureStore();
        const url = new URL(request.url);
        const splat = (params as { _splat?: string })._splat ?? "";
        const rid = requestId();

        // Catalog is intentionally exempt from enforcement.
        if (splat === "" || splat === "catalog") {
          return json({ catalog: API_CATALOG }, 200, {
            "X-RateLimit-Adapter": currentRateLimitAdapterKind(),
            "X-RateLimit-Policy": "catalog",
          }, rid);
        }

        const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
        const ipHash = ipFingerprint(ip);
        const store = (await import("@/lib/data/rate-limit")).currentRateLimitStore();

        // Pre-auth abuse bucket — IP-derived, before any credential inspection,
        // so credential-guessing cannot bypass abuse protection.
        const preAuthDims: RateLimitDimensions = {
          actorKind: "anonymous", actorId: "anonymous",
          endpointId: "unauth", ipHash, scope: null, workspaceId: null,
        };
        const preAuth = await enforceRateLimit(store, "unauth", preAuthDims);
        if (!preAuth.decision.allowed) {
          return json(
            { error: { code: "rate-limited", message: "Too many unauthenticated requests", requestId: rid } },
            429, preAuth.headers, rid,
          );
        }

        const match = route(splat, url.searchParams);
        if (!match) {
          return json(
            { error: { code: "not-found", message: `Unknown endpoint /api/public/v1/${splat}`, requestId: rid } },
            404, preAuth.headers, rid,
          );
        }

        const snapshot = buildSeedSnapshot();
        const authz = request.headers.get("authorization") ?? "";
        const bearer = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : null;
        const client = resolveClient(bearer, snapshot);
        if (!client) {
          // Invalid credentials still consumed pre-auth bucket above.
          return json(
            { error: { code: "unauthorized", message: "Missing or invalid Bearer credential", requestId: rid } },
            401, preAuth.headers, rid,
          );
        }
        const required = ENDPOINT_SCOPES[match.id];
        if (required && !client.scopes.includes(required)) {
          return json(
            { error: { code: "forbidden", message: `Client ${client.id} lacks scope '${required}'`, requestId: rid } },
            403, preAuth.headers, rid,
          );
        }

        // Post-auth per-(client,endpoint,scope,workspace) bucket.
        const postDims: RateLimitDimensions = {
          workspaceId: client.workspaceId ?? snapshot.activeWorkspaceId ?? null,
          actorKind: client.actorKind,
          actorId: client.id,
          endpointId: match.id,
          scope: required ?? null,
          ipHash,
        };
        const postAuth = await enforceRateLimit(store, match.id as PolicyKey, postDims);

        // Structured, redacted diagnostic (never logs raw creds/keys).
        const diag = decisionToDiagnostic(postAuth.decision, composeRateLimitKey({ ...postDims, endpointId: match.id as PolicyKey }));
        // eslint-disable-next-line no-console
        console.info("[rate-limit]", { requestId: rid, path: `/api/public/v1/${splat}`, ...diag });

        if (!postAuth.decision.allowed) {
          return json(
            { error: { code: "rate-limited", message: "Rate limit exceeded", requestId: rid, degraded: postAuth.decision.degraded } },
            429, postAuth.headers, rid,
          );
        }

        const result = callLocalAPI(snapshot, match.id, match.params) as { error?: { code: string } } | unknown;
        if (result && typeof result === "object" && "error" in (result as Record<string, unknown>)) {
          const err = (result as { error: { code: string } }).error;
          const status = err.code === "not-found" ? 404 : err.code === "missing-param" || err.code === "unknown-kind" ? 400 : 500;
          return json(result, status, postAuth.headers, rid);
        }
        return json(result, 200, postAuth.headers, rid);
      },
    },
  },
});
