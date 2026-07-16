// Workstream 8 + 9 — Public API endpoints with rate limiting & security headers.
//
// Nine read-only endpoints backed by the seed snapshot on the server. Under
// /api/public/* so external callers can hit them without auth on published
// sites; this route only exposes derived, non-sensitive views and never
// returns raw credentials or secrets. Workstream 9 hardens the surface with
// per-IP rate limiting, security headers, and secret redaction.
import { createFileRoute } from "@tanstack/react-router";
import { buildSeedSnapshot } from "@/lib/data/seed";
import { callLocalAPI, API_CATALOG, type APIEndpointId } from "@/lib/data/integrations";
import { securityHeaders, evaluateRateLimit, redactSecrets } from "@/lib/data/security";

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

function requestId() { return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }

// In-memory per-IP rate limiter (60 req / 60s). The Worker runtime is
// stateless across cold starts; this bounds a single worker instance and is
// paired with the snapshot-persisted bucket surfaced in the monitoring UI.
const IP_BUCKETS = new Map<string, { currentCount: number; windowStart: string }>();

function rateLimit(ip: string): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const nowIso = new Date().toISOString();
  const existing = IP_BUCKETS.get(ip) ?? { currentCount: 0, windowStart: nowIso };
  const { decision, next } = evaluateRateLimit(
    { ...existing, windowSeconds: 60, maxRequests: 60 }, nowIso,
  );
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
        const snapshot = buildSeedSnapshot();
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
