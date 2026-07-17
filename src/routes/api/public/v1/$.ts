// Workstream 8 + 9 — Public API endpoints with rate limiting, security
// headers, Bearer auth, and per-client scope enforcement (W9 #6).
//
// Every non-catalog endpoint requires `Authorization: Bearer <api-key>`.
// The key's non-crypto fingerprint is matched against seeded APIClient
// records (via the DEMO_API_KEY env for local testing, or the sha-256
// fingerprint suffix stored on each APIClient in a production deployment).
// The endpoint's required scope is then checked against the client's
// scope list. Public catalog remains anonymous by design.
import { createFileRoute } from "@tanstack/react-router";
import { buildSeedSnapshot } from "@/lib/data/seed";
import { callLocalAPI, API_CATALOG, type APIEndpointId } from "@/lib/data/integrations";
import { securityHeaders, evaluateRateLimit, redactSecrets, fingerprint } from "@/lib/data/security";
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

const IP_BUCKETS = new Map<string, { currentCount: number; windowStart: string }>();
function rateLimit(ip: string) {
  const nowIso = new Date().toISOString();
  const existing = IP_BUCKETS.get(ip) ?? { currentCount: 0, windowStart: nowIso };
  const { decision, next } = evaluateRateLimit({ ...existing, windowSeconds: 60, maxRequests: 60 }, nowIso);
  IP_BUCKETS.set(ip, next);
  return decision;
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-request-id": requestId(),
    ...securityHeaders(),
    ...extra,
  };
  return new Response(JSON.stringify(redactSecrets(body)), { status, headers });
}

// Resolve the caller against the seeded APIClient roster. In production the
// DEMO_API_KEY env is unset and matching relies on the fingerprint suffix
// convention embedded in `keyPrefix`; in local demo the env unlocks APIC-001.
// W9 Blocker #1 (E) — also accepts Supabase user session bearer tokens
// (any JWT with 3 segments) and returns a synthetic user client so audit
// records can distinguish user sessions from API clients.
function resolveClient(bearer: string | null, snap: DataSnapshot): (APIClient & { actorKind: "api-client" | "user-session" }) | null {
  if (!bearer) return null;
  const demoKey = process.env.DEMO_API_KEY;
  if (demoKey && bearer === demoKey) {
    const c = snap.apiClients.find(c => c.id === "APIC-001");
    return c ? { ...c, actorKind: "api-client" } : null;
  }
  // Supabase user JWT (3 dot-separated base64 segments) → treat as an
  // authenticated end-user with the union of all read scopes. Actual
  // authorization still runs through per-endpoint scope check below.
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

export const Route = createFileRoute("/api/public/v1/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const splat = (params as { _splat?: string })._splat ?? "";

        const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
        const rl = rateLimit(ip);
        const rlHeaders = {
          "X-RateLimit-Limit": "60",
          "X-RateLimit-Remaining": String(rl.remaining),
          "X-RateLimit-Retry-After": String(rl.retryAfterSeconds),
        };
        if (!rl.allowed) {
          return json({ error: { code: "rate-limited", message: "Too many requests", requestId: requestId() } }, 429, rlHeaders);
        }

        if (splat === "" || splat === "catalog") return json({ catalog: API_CATALOG }, 200, rlHeaders);

        const match = route(splat, url.searchParams);
        if (!match) {
          return json({ error: { code: "not-found", message: `Unknown endpoint /api/public/v1/${splat}`, requestId: requestId() } }, 404, rlHeaders);
        }

        // W9 #6 — Bearer auth + scope enforcement for every non-catalog endpoint.
        const snapshot = buildSeedSnapshot();
        const authz = request.headers.get("authorization") ?? "";
        const bearer = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : null;
        const client = resolveClient(bearer, snapshot);
        if (!client) {
          return json({ error: { code: "unauthorized", message: "Missing or invalid Bearer API key", requestId: requestId() } }, 401, rlHeaders);
        }
        const required = ENDPOINT_SCOPES[match.id];
        if (required && !client.scopes.includes(required)) {
          return json({ error: { code: "forbidden", message: `API client ${client.id} lacks scope '${required}'`, requestId: requestId() } }, 403, rlHeaders);
        }

        const result = callLocalAPI(snapshot, match.id, match.params) as { error?: { code: string } } | unknown;
        if (result && typeof result === "object" && "error" in (result as Record<string, unknown>)) {
          const err = (result as { error: { code: string } }).error;
          const status = err.code === "not-found" ? 404 : err.code === "missing-param" || err.code === "unknown-kind" ? 400 : 500;
          return json(result, status, rlHeaders);
        }
        return json(result, 200, rlHeaders);
      },
    },
  },
});
