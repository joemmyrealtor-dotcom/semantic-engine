// Workstream 9 — Security hardening primitives
//
// - Environment validation (declared invariants + presence checks)
// - Secret redaction (never emit secret values in snapshots, logs, exports, UI)
// - Deterministic hashing (djb2-based) for API-key fingerprints and content hashes
// - In-memory rate-limit engine (deterministic, tick-based)
// - Session validity checks and security header composition
//
// This module is pure: no side-effects at import time, no browser APIs.

const SECRET_KEYS = [
  "password","secret","token","apikey","api_key","authorization","bearer",
  "cookie","private_key","service_role","publishable_key","anon_key",
];

/** Case-insensitive check for known secret-shaped field names. */
export function isSecretKey(key: string): boolean {
  const k = key.toLowerCase();
  return SECRET_KEYS.some(s => k.includes(s));
}

/** Recursively redact secret-shaped fields in objects/arrays. */
export function redactSecrets<T>(value: T): T {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(v => redactSecrets(v)) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSecretKey(k) ? "[REDACTED]" : redactSecrets(v);
    }
    return out as unknown as T;
  }
  return value;
}

/** Deterministic djb2 hash → base36 string. Not cryptographic — used for
 *  content fingerprints and API-key non-reversible identifiers. */
export function hashString(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Content hash for arbitrary JSON value (stable key ordering). */
export function contentHash(value: unknown): string {
  return hashString(stableStringify(value));
}

function stableStringify(v: unknown): string {
  if (v == null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringify((v as Record<string, unknown>)[k])).join(",") + "}";
}

/** Never expose raw API keys — display only fingerprint + last 4. */
export function apiKeyFingerprint(rawKey: string): { fingerprint: string; last4: string } {
  return { fingerprint: hashString(rawKey), last4: rawKey.slice(-4).padStart(4, "•") };
}

// ---------- Environment validation ----------
export type EnvRequirement = { key: string; scope: "server" | "client"; required: boolean };

export const ENV_REQUIREMENTS: EnvRequirement[] = [
  { key: "VITE_SUPABASE_URL", scope: "client", required: true },
  { key: "VITE_SUPABASE_PUBLISHABLE_KEY", scope: "client", required: true },
  { key: "SUPABASE_URL", scope: "server", required: true },
  { key: "SUPABASE_PUBLISHABLE_KEY", scope: "server", required: true },
];

export interface EnvValidationResult {
  ok: boolean;
  missing: string[];
  present: string[];
  warnings: string[];
}

export function validateEnvironment(env: Record<string, string | undefined>): EnvValidationResult {
  const missing: string[] = [];
  const present: string[] = [];
  const warnings: string[] = [];
  for (const req of ENV_REQUIREMENTS) {
    const v = env[req.key];
    if (!v && req.required) missing.push(req.key); else if (v) present.push(req.key);
  }
  // Warn (never fail) when service-role keys ever appear in client-scoped context.
  for (const k of Object.keys(env)) {
    if (k.startsWith("VITE_") && k.toLowerCase().includes("service_role")) {
      warnings.push(`Suspicious client-scoped secret: ${k}`);
    }
  }
  return { ok: missing.length === 0, missing, present, warnings };
}

// ---------- Rate limiter ----------
export interface RateLimitDecision { allowed: boolean; remaining: number; retryAfterSeconds: number }

export function evaluateRateLimit(
  bucket: { currentCount: number; windowStart: string; windowSeconds: number; maxRequests: number },
  nowIso: string,
): { decision: RateLimitDecision; next: { currentCount: number; windowStart: string } } {
  const now = Date.parse(nowIso);
  const start = Date.parse(bucket.windowStart);
  const elapsed = Math.max(0, (now - start) / 1000);
  if (elapsed >= bucket.windowSeconds) {
    return {
      decision: { allowed: true, remaining: bucket.maxRequests - 1, retryAfterSeconds: 0 },
      next: { currentCount: 1, windowStart: nowIso },
    };
  }
  if (bucket.currentCount >= bucket.maxRequests) {
    return {
      decision: { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil(bucket.windowSeconds - elapsed) },
      next: { currentCount: bucket.currentCount, windowStart: bucket.windowStart },
    };
  }
  return {
    decision: { allowed: true, remaining: bucket.maxRequests - bucket.currentCount - 1, retryAfterSeconds: 0 },
    next: { currentCount: bucket.currentCount + 1, windowStart: bucket.windowStart },
  };
}

// ---------- Session validation ----------
export interface SessionClaims { userId: string; role: string; issuedAt: number; expiresAt: number }
export function isSessionValid(claims: SessionClaims | null, nowMs = Date.now()): boolean {
  if (!claims) return false;
  return claims.expiresAt > nowMs && claims.issuedAt <= nowMs;
}

// ---------- Security headers ----------
export function securityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  };
}
