// Workstream 9 — RC-1 Blocker #4
// Distributed-capable rate-limit adapter for /api/public/v1/*.
//
// Contract
// --------
// `RateLimitStore.consume(key, policy, nowIso?)` MUST be atomic across all
// callers sharing the store: a horizontally-scaled deployment routes the same
// bucket key to the same durable row via the underlying primitive (Postgres
// row lock + UPSERT for the distributed adapter). The returned decision
// carries limit, remaining, retryAfter, reset, adapter kind, store health,
// and observed latency so the caller can emit headers and diagnostics
// without re-deriving anything.
//
// Adapter selection is explicit via `RATE_LIMIT_ADAPTER` env
// (`memory` | `supabase`). Production (NODE_ENV=production) refuses the
// in-memory adapter at startup — see `assertRateLimitReadiness()`.
//
// Key composition is a one-way SHA-256 fingerprint over
// (workspaceId | actorKind | actorId | endpointId | scope | ipHash). Raw
// bearer tokens, JWTs, and email addresses never enter the stored key,
// the audit trail, logs, or diagnostics.

import { sha256Hex } from "./security";

// ---------- Policy ----------
export interface RateLimitPolicy {
  windowSeconds: number;
  maxRequests: number;
  /** true → fail closed (deny) when the distributed store is unavailable. */
  failClosed: boolean;
}

export type PolicyKey =
  | "catalog"
  | "unauth"
  | "registry.list"
  | "knowledge.detail"
  | "release.manifest"
  | "publication.export"
  | "toolkit.export"
  | "aipack.export"
  | "agent.export"
  | "automation.run.status"
  | "import.job.status";

/** Centralized policy map — one place to tune every non-catalog endpoint. */
export const RATE_LIMIT_POLICIES: Record<PolicyKey, RateLimitPolicy> = {
  // Catalog is intentionally exempt at the enforcement layer (see route).
  catalog: { windowSeconds: 60, maxRequests: 600, failClosed: false },
  // Pre-auth abuse bucket — bounded and prominent.
  unauth: { windowSeconds: 60, maxRequests: 30, failClosed: true },
  "registry.list":          { windowSeconds: 60, maxRequests: 120, failClosed: false },
  "knowledge.detail":       { windowSeconds: 60, maxRequests: 120, failClosed: false },
  "release.manifest":       { windowSeconds: 60, maxRequests: 60,  failClosed: false },
  "publication.export":     { windowSeconds: 60, maxRequests: 30,  failClosed: false },
  "toolkit.export":         { windowSeconds: 60, maxRequests: 30,  failClosed: false },
  "aipack.export":          { windowSeconds: 60, maxRequests: 30,  failClosed: false },
  "agent.export":           { windowSeconds: 60, maxRequests: 30,  failClosed: false },
  "automation.run.status":  { windowSeconds: 60, maxRequests: 120, failClosed: false },
  // Mutation / high-risk endpoint — fail closed if the distributed store is down.
  "import.job.status":      { windowSeconds: 60, maxRequests: 20,  failClosed: true },
};

// ---------- Decision ----------
export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window resets. 0 when allowed and window fresh. */
  retryAfterSeconds: number;
  /** ISO timestamp for the window reset. */
  resetAt: string;
  adapter: RateLimitAdapterKind;
  storeHealthy: boolean;
  latencyMs: number;
  /** Policy key used, for diagnostics. */
  policyKey: string;
  /** Whether this decision came from the failure-fallback path. */
  degraded: boolean;
}

export type RateLimitAdapterKind = "memory" | "supabase";

// ---------- Store interface ----------
export interface RateLimitStore {
  readonly kind: RateLimitAdapterKind;
  consume(
    key: string,
    policy: RateLimitPolicy,
    nowIso?: string,
  ): Promise<Omit<RateLimitDecision, "policyKey" | "degraded">>;
  /** Best-effort health probe; may be a no-op for in-memory. */
  healthCheck(): Promise<{ ok: boolean; detail: string }>;
}

// ---------- Key composition ----------
export interface RateLimitDimensions {
  workspaceId?: string | null;
  actorKind: "api-client" | "user-session" | "anonymous";
  actorId: string;               // API client id, user id, or "anonymous"
  endpointId: string;            // policy key or "unauth"
  scope?: string | null;
  ipHash?: string | null;        // pre-hashed
}

/** Deterministic, one-way key. Never embeds raw credentials. */
export function composeRateLimitKey(d: RateLimitDimensions): string {
  const material = [
    d.workspaceId ?? "-",
    d.actorKind,
    d.actorId,
    d.endpointId,
    d.scope ?? "-",
    d.ipHash ?? "-",
  ].join("|");
  return `rl_${sha256Hex(material).slice(0, 40)}`;
}

/** Fingerprint an IP without persisting the raw value. */
export function ipFingerprint(ip: string | null | undefined): string {
  if (!ip) return sha256Hex("unknown-ip").slice(0, 16);
  return sha256Hex(`ip:${ip}`).slice(0, 16);
}

// ---------- In-memory adapter (dev/tests only) ----------
interface MemoryBucket { count: number; windowStartMs: number; lastTouchMs: number }

export class InMemoryRateLimitStore implements RateLimitStore {
  readonly kind = "memory" as const;
  private readonly buckets = new Map<string, MemoryBucket>();
  private readonly maxEntries: number;

  constructor(opts: { maxEntries?: number } = {}) {
    this.maxEntries = Math.max(64, opts.maxEntries ?? 10_000);
  }

  async consume(key: string, policy: RateLimitPolicy, nowIso: string = new Date().toISOString()) {
    const nowMs = Date.parse(nowIso);
    let b = this.buckets.get(key);
    if (!b || nowMs - b.windowStartMs >= policy.windowSeconds * 1000) {
      b = { count: 0, windowStartMs: nowMs, lastTouchMs: nowMs };
    }
    const allowed = b.count < policy.maxRequests;
    if (allowed) b.count += 1;
    b.lastTouchMs = nowMs;
    this.buckets.set(key, b);
    this.evictIfNeeded();
    const resetMs = b.windowStartMs + policy.windowSeconds * 1000;
    const remaining = Math.max(0, policy.maxRequests - b.count);
    return {
      allowed,
      limit: policy.maxRequests,
      remaining,
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((resetMs - nowMs) / 1000)),
      resetAt: new Date(resetMs).toISOString(),
      adapter: this.kind,
      storeHealthy: true,
      latencyMs: 0,
    };
  }

  async healthCheck() { return { ok: true, detail: `in-memory (${this.buckets.size} buckets)` }; }

  size(): number { return this.buckets.size; }
  reset(): void { this.buckets.clear(); }

  private evictIfNeeded() {
    if (this.buckets.size <= this.maxEntries) return;
    // Evict oldest-touched 10% to amortize cost.
    const target = Math.floor(this.maxEntries * 0.9);
    const entries = [...this.buckets.entries()].sort((a, b) => a[1].lastTouchMs - b[1].lastTouchMs);
    for (const [k] of entries) {
      if (this.buckets.size <= target) break;
      this.buckets.delete(k);
    }
  }
}

// ---------- Supabase (Postgres) adapter — distributed, atomic ----------
// Backed by `public.consume_rate_limit(p_key, p_window_seconds, p_max)` RPC
// (see migration). Uses the service-role admin client via a dynamic import
// so this module remains client-safe.
export class SupabaseRateLimitStore implements RateLimitStore {
  readonly kind = "supabase" as const;
  private lastHealthy = true;
  private lastError: string | null = null;

  async consume(key: string, policy: RateLimitPolicy, nowIso: string = new Date().toISOString()) {
    const startedAt = Date.now();
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin.rpc("consume_rate_limit", {
        p_key: key,
        p_window_seconds: policy.windowSeconds,
        p_max: policy.maxRequests,
      });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as {
        allowed: boolean; current_count: number; window_start: string; reset_at: string;
      };
      this.lastHealthy = true; this.lastError = null;
      const nowMs = Date.parse(nowIso);
      const resetMs = Date.parse(row.reset_at);
      const remaining = Math.max(0, policy.maxRequests - row.current_count);
      return {
        allowed: row.allowed,
        limit: policy.maxRequests,
        remaining,
        retryAfterSeconds: row.allowed ? 0 : Math.max(1, Math.ceil((resetMs - nowMs) / 1000)),
        resetAt: row.reset_at,
        adapter: this.kind,
        storeHealthy: true,
        latencyMs: Date.now() - startedAt,
      };
    } catch (err) {
      this.lastHealthy = false;
      this.lastError = err instanceof Error ? err.message : String(err);
      // Signal outage — caller applies fail-open/fail-closed per policy.
      const nowMs = Date.parse(nowIso);
      const resetMs = nowMs + policy.windowSeconds * 1000;
      return {
        allowed: !policy.failClosed,
        limit: policy.maxRequests,
        remaining: policy.failClosed ? 0 : policy.maxRequests,
        retryAfterSeconds: policy.failClosed ? policy.windowSeconds : 0,
        resetAt: new Date(resetMs).toISOString(),
        adapter: this.kind,
        storeHealthy: false,
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  async healthCheck() {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.rpc("consume_rate_limit", {
        p_key: "rl_healthcheck", p_window_seconds: 60, p_max: 1_000_000,
      });
      if (error) throw error;
      return { ok: true, detail: "supabase RPC reachable" };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }
  }

  get healthy(): boolean { return this.lastHealthy; }
  get lastErrorMessage(): string | null { return this.lastError; }
}

// ---------- Selection ----------
let STORE: RateLimitStore = new InMemoryRateLimitStore();
let SELECTED_KIND: RateLimitAdapterKind = "memory";

export function selectRateLimitStore(env: Record<string, string | undefined>): RateLimitStore {
  const choice = (env.RATE_LIMIT_ADAPTER ?? (env.NODE_ENV === "production" ? "supabase" : "memory")).toLowerCase();
  if (choice === "supabase") {
    STORE = new SupabaseRateLimitStore();
    SELECTED_KIND = "supabase";
  } else if (choice === "memory") {
    STORE = new InMemoryRateLimitStore();
    SELECTED_KIND = "memory";
  } else {
    throw new Error(`Invalid RATE_LIMIT_ADAPTER='${choice}' (expected 'memory' or 'supabase')`);
  }
  return STORE;
}

export function currentRateLimitStore(): RateLimitStore { return STORE; }
export function currentRateLimitAdapterKind(): RateLimitAdapterKind { return SELECTED_KIND; }

/** For tests. */
export function _bindRateLimitStoreForTests(store: RateLimitStore): void {
  STORE = store; SELECTED_KIND = store.kind;
}

// ---------- Startup validation ----------
export interface RateLimitReadiness { ok: boolean; adapter: RateLimitAdapterKind; detail: string }

export function assertRateLimitReadiness(env: Record<string, string | undefined>): RateLimitReadiness {
  const nodeEnv = (env.NODE_ENV ?? "").toLowerCase();
  const chosen = (env.RATE_LIMIT_ADAPTER ?? (nodeEnv === "production" ? "supabase" : "memory")).toLowerCase();
  if (nodeEnv === "production" && chosen === "memory") {
    return { ok: false, adapter: "memory", detail: "Production requires RATE_LIMIT_ADAPTER=supabase; in-memory is per-worker only." };
  }
  if (chosen !== "memory" && chosen !== "supabase") {
    return { ok: false, adapter: "memory", detail: `Invalid RATE_LIMIT_ADAPTER='${chosen}'` };
  }
  if (chosen === "supabase") {
    const missing: string[] = [];
    if (!env.SUPABASE_URL) missing.push("SUPABASE_URL");
    if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    if (missing.length) return { ok: false, adapter: "supabase", detail: `Missing env for distributed adapter: ${missing.join(", ")}` };
    return { ok: true, adapter: "supabase", detail: "supabase adapter configured" };
  }
  return { ok: true, adapter: "memory", detail: "in-memory adapter (development/tests only)" };
}

// ---------- Enforcement ----------
export interface EnforceResult {
  decision: RateLimitDecision;
  headers: Record<string, string>;
}

export async function enforceRateLimit(
  store: RateLimitStore,
  policyKey: PolicyKey,
  dimensions: RateLimitDimensions,
  nowIso?: string,
): Promise<EnforceResult> {
  const policy = RATE_LIMIT_POLICIES[policyKey];
  const key = composeRateLimitKey({ ...dimensions, endpointId: policyKey });
  const raw = await store.consume(key, policy, nowIso);
  const decision: RateLimitDecision = { ...raw, policyKey, degraded: !raw.storeHealthy };
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(decision.limit),
    "X-RateLimit-Remaining": String(decision.remaining),
    "X-RateLimit-Reset": decision.resetAt,
    "X-RateLimit-Adapter": decision.adapter,
    "X-RateLimit-Policy": policyKey,
  };
  if (!decision.allowed) headers["Retry-After"] = String(decision.retryAfterSeconds);
  if (decision.degraded) headers["X-RateLimit-Degraded"] = "1";
  return { decision, headers };
}

// ---------- Redacted diagnostic record ----------
export interface RateLimitDiagnostic {
  adapter: RateLimitAdapterKind;
  policyKey: string;
  allowed: boolean;
  limit: number;
  remaining: number;
  latencyMs: number;
  storeHealthy: boolean;
  degraded: boolean;
  keyDigest: string;   // last 8 chars of composed key — never raw
}

export function decisionToDiagnostic(d: RateLimitDecision, key: string): RateLimitDiagnostic {
  return {
    adapter: d.adapter, policyKey: d.policyKey, allowed: d.allowed,
    limit: d.limit, remaining: d.remaining, latencyMs: d.latencyMs,
    storeHealthy: d.storeHealthy, degraded: d.degraded,
    keyDigest: key.slice(-8),
  };
}
