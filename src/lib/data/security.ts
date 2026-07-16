// Workstream 9 — Security hardening primitives
//
// - Environment validation (declared invariants + presence checks)
// - Secret redaction (never emit secret values in snapshots, logs, exports, UI)
// - Hashing:
//    * `fingerprint()` — fast, non-cryptographic djb2 (API-key display, cache keys)
//    * `contentHash()` / `sha256Hex()` — cryptographic SHA-256 for audit chain
//      and backup integrity. Pure JS, synchronous, no Web Crypto dependency
//      (audit/backup verification runs in deterministic pure code paths).
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

// ---------- Fast fingerprint (non-cryptographic) ----------
/** djb2 → base36. Use ONLY for cache keys and last-4 display, never integrity. */
export function fingerprint(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Backwards-compatible alias — many call sites still import `hashString`.
// New code should call `fingerprint()` (non-crypto) or `sha256Hex()` (crypto).
export const hashString = fingerprint;

// ---------- Cryptographic SHA-256 (pure JS, sync) ----------
// Implements FIPS 180-4. Chosen over Web Crypto because the audit-chain and
// backup-integrity paths run in pure deterministic code (validation harness,
// SSR, workers) where async is undesirable.
const K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);

function rotr(x: number, n: number): number { return (x >>> n) | (x << (32 - n)); }

export function sha256Hex(msg: string): string {
  // UTF-8 encode
  const bytes: number[] = [];
  for (let i = 0; i < msg.length; i++) {
    let c = msg.charCodeAt(i);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) { bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
    else if ((c & 0xfc00) === 0xd800 && i + 1 < msg.length && (msg.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
      c = 0x10000 + ((c & 0x3ff) << 10) + (msg.charCodeAt(++i) & 0x3ff);
      bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    } else { bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
  }
  const l = bytes.length;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  const bitLen = l * 8;
  // 64-bit big-endian length; JS numbers handle up to 2^53
  bytes.push(0, 0, 0, 0, (bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);

  const H = new Uint32Array([
    0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19,
  ]);
  const W = new Uint32Array(64);
  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      W[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = [H[0], H[1], H[2], H[3], H[4], H[5], H[6], H[7]];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  let hex = "";
  for (let i = 0; i < 8; i++) hex += H[i].toString(16).padStart(8, "0");
  return hex;
}

/** Cryptographic content hash for arbitrary JSON value (stable key ordering). */
export function contentHash(value: unknown): string {
  return sha256Hex(stableStringify(value));
}

function stableStringify(v: unknown): string {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(x => stableStringify(x === undefined ? null : x)).join(",") + "]";
  const src = v as Record<string, unknown>;
  const keys = Object.keys(src).filter(k => src[k] !== undefined).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringify(src[k])).join(",") + "}";
}

/** Never expose raw API keys — display only non-crypto fingerprint + last 4. */
export function apiKeyFingerprint(rawKey: string): { fingerprint: string; last4: string } {
  return { fingerprint: fingerprint(rawKey), last4: rawKey.slice(-4).padStart(4, "•") };
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

// ---------- Rate-limiter adapter boundary (W9 #6) ----------
// Production deployments MUST inject a persistent adapter (Redis, Durable
// Object, Supabase table). The default in-memory adapter is per-worker and
// only suitable for local demo. `bindRateLimiter()` swaps the runtime impl.
export interface RateLimiterAdapter {
  hit(key: string, opts: { windowSeconds: number; maxRequests: number }, nowIso?: string): RateLimitDecision;
  kind: "in-memory" | "distributed";
}
const IN_MEMORY = new Map<string, { currentCount: number; windowStart: string }>();
let RATE_LIMITER: RateLimiterAdapter = {
  kind: "in-memory",
  hit(key, opts, nowIso = new Date().toISOString()) {
    const existing = IN_MEMORY.get(key) ?? { currentCount: 0, windowStart: nowIso };
    const { decision, next } = evaluateRateLimit({ ...existing, ...opts }, nowIso);
    IN_MEMORY.set(key, next);
    return decision;
  },
};
export function bindRateLimiter(adapter: RateLimiterAdapter): void { RATE_LIMITER = adapter; }
export function currentRateLimiter(): RateLimiterAdapter { return RATE_LIMITER; }

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
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  };
}
