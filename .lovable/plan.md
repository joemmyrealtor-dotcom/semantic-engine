
# Read-only diagnostic — Startup env vs Supabase config

No files, secrets, schema, gates, or runtime touched. Findings below are drawn from source only.

## 1. Environment variables the startup diagnostic checks

`startupDiagnostics(env, snap)` — `src/lib/data/deployment.ts:16-33` — calls `validateEnvironment(env)` from `src/lib/data/security.ts:155-169`, which walks `ENV_REQUIREMENTS` at `security.ts:141-146`:

| Key                              | Declared scope | Required |
|----------------------------------|----------------|----------|
| `VITE_SUPABASE_URL`              | client         | yes      |
| `VITE_SUPABASE_PUBLISHABLE_KEY`  | client         | yes      |
| `SUPABASE_URL`                   | server         | yes      |
| `SUPABASE_PUBLISHABLE_KEY`       | server         | yes      |

Additional readiness paths check more names:
- `assertRateLimitReadiness` — `src/lib/data/rate-limit.ts:299-300` — additionally requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` when `RATE_LIMIT_ADAPTER=supabase`.

Where the check is invoked in the app:
- `src/routes/admin.deployment.tsx:29-30` runs `startupDiagnostics(env, s)` where `env = import.meta.env`. This is a **browser-side** call; `import.meta.env` on Vite only contains keys prefixed `VITE_`. Non-`VITE_` keys (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`) are **always undefined** in that object by design.

## 2. Environment variables the Supabase clients actually read

- Browser client — `src/integrations/supabase/client.ts:33-34`:
  - `import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL`
  - `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY`
  (`process.env` fallback is inert in the browser; effectively client uses only the `VITE_*` pair.)
- Auth middleware (server) — `src/integrations/supabase/auth-middleware.ts:36-42, 75-79`:
  - `process.env.SUPABASE_URL`
  - `process.env.SUPABASE_PUBLISHABLE_KEY`
- Admin server client — `src/integrations/supabase/client.server.ts:33-46`:
  - `process.env.SUPABASE_URL`
  - `process.env.SUPABASE_SERVICE_ROLE_KEY` (not `PUBLISHABLE_KEY`)

## 3. What Lovable production is expected to expose

- Browser bundle: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` — inlined into the client build at compile time by Vite.
- Server (Cloudflare Worker) runtime: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — injected by the managed integration; both prefixes (`SUPABASE_` and `VITE_SUPABASE_`) are reserved (confirmed earlier when `set_secret` was rejected).
- There is no separate managed name pattern in the code; both the `VITE_*` and non-prefixed forms are the expected managed identifiers.

## 4. Failure classification: binding gap vs diagnostic-name mismatch

Most likely **diagnostic-name mismatch (false positive)**, not a true binding failure. Reasoning:

- The failing check runs at `admin.deployment.tsx:30` with `env = import.meta.env`. `import.meta.env` cannot contain `SUPABASE_URL` or `SUPABASE_PUBLISHABLE_KEY` under any Vite configuration — those are not `VITE_`-prefixed and are stripped from the client env by Vite.
- `ENV_REQUIREMENTS` marks those two as `scope: "server"` but `validateEnvironment` does not filter by scope; the client-side diagnostic evaluates server-scoped requirements against the client env and will always report them missing.
- If `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` were actually absent server-side, `requireSupabaseAuth`-gated server fns would throw the explicit error at `auth-middleware.ts:39-42` (`Missing Supabase server env: ...`) and every attested-fingerprint / gate-evidence call — which have been succeeding — would 500. Observed prior successes (H1–H4 attestations, `/api/public/v1/catalog` 200 during smoke) contradict a true server-side miss.
- A true binding failure would surface identically to a diagnostic-name mismatch in the browser widget but would additionally show as server-fn 500s and rate-limit adapter failure. We have not been shown those in the current session.

Caveat: this needs empirical confirmation on the production runtime — see remediation #1 below. It is a strong hypothesis, not a proof.

## 5. Smallest safe remediation options, ranked (no changes applied)

1. **Verify server-side env from server context (read-only proof) — smallest, no code change.**
   Invoke an existing server fn that goes through `requireSupabaseAuth` (any protected read) against the production URL. If it returns 200 (not `Missing Supabase server env: ...`), the server has `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` and the "missing" message is confirmed to be the client-widget false positive.

2. **Scope-filter the client diagnostic (one-line, code change, most correct fix).**
   In `src/routes/admin.deployment.tsx:30`, pass only client-scoped requirements to `startupDiagnostics`, or in `src/lib/data/security.ts:155-169` filter `ENV_REQUIREMENTS` by scope based on runtime (`typeof window !== 'undefined'` → client only). Server-scoped checks are then run only where they are meaningful.

3. **Move the full diagnostic to a `createServerFn` and render its result.**
   Adds a `startupDiagnostics.functions.ts` that reads `process.env` and returns the report; `admin.deployment.tsx` calls it via `useServerFn`. Larger change, but gives a single accurate report covering both scopes.

4. **Documentation-only clarification.**
   Note in `RC1-READINESS` / operator runbook that the "missing SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY" line in the client widget is a known scope-mismatch artefact when read from the browser panel, and that authoritative env state comes from server logs. Lowest risk; does not remove the misleading UI signal.

Ranked by ratio of clarity gained to risk introduced: **1 → 2 → 4 → 3**. Option 1 alone suffices to decide whether any code change is warranted; do it before any remediation edit.

## Files referenced

- `src/lib/data/deployment.ts:14-33`
- `src/lib/data/security.ts:139-169`
- `src/lib/data/rate-limit.ts:295-305`
- `src/integrations/supabase/client.ts:30-52`
- `src/integrations/supabase/client.server.ts:30-52`
- `src/integrations/supabase/auth-middleware.ts:34-82`
- `src/routes/admin.deployment.tsx:8-33`

Report only. Awaiting your direction; no remediation queued.
