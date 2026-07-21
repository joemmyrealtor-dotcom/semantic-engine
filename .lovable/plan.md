## Read-only production health verification

Scope: https://semantic-engine.lovable.app. No edits to code, schema, secrets, users, memberships, RLS, gate evidence, backup evidence, or publication state.

### Checks

1. **Route reachability** — HTTP GET each of `/`, `/concepts`, `/publications`, `/agents`, `/operations`, `/integrations`, `/admin/monitoring`, `/admin/deployment`; expect 200.
2. **Published/live** — confirm production URL serves the app (not a placeholder).
3. **Public API**
   - `GET /api/public/v1/catalog` → 200
   - `GET /api/public/v1/registry/concepts` (no bearer) → 401
   - `GET /api/public/v1/registry/concepts` with invalid bearer → 401
   - `GET /api/public/v1/knowledge/foo` (no bearer) → 401
   - `GET /api/public/v1/knowledge/foo` with invalid bearer → 401
4. **Authoritative fingerprint** — sign in as Owner via managed Supabase session (if `LOVABLE_BROWSER_AUTH_STATUS=injected`), load `/admin/deployment`, capture fingerprint; expect `srv-a0840ca6`.
5. **Launch gates** — on same page, verify H1 v7, H2 v4, H3 v3, H4 v3 all PASS on `srv-a0840ca6`.
6. **Production GO** — verify GO panel shows UNLOCKED.
7. **Monitoring** — load `/admin/monitoring`; classify any CRITICAL as server-authoritative vs. known client-local `MON-SEED-001` seed artifact.
8. **Security scan** — `security--get_scan_results`; expect 0 critical.
9. **Supabase linter** — `supabase--linter`; expect exactly 6 SECURITY DEFINER warnings, materially unchanged.

### Method

- Playwright (headless) + curl for HTTP checks (screenshots per admin route).
- Tool calls: `security--get_scan_results`, `supabase--linter`.
- If `LOVABLE_BROWSER_AUTH_STATUS` ≠ `injected`, mark checks 4–7 unverifiable and report the signed-out limitation instead of attempting sign-in.

### Output

Single report: each check with observed evidence (status codes, screenshot paths, fingerprint, gate versions, finding counts). Explicit notes on any unverifiable check. No file writes, no attestations, no state changes. Rollback baseline `BL-20260721T165326Z-postremediation` untouched.

### Incident triggers (report only, do not remediate)

Fingerprint drift; STALE/FAIL/BLOCKED gate; auth failure; route failure; bearer enforcement failure; critical monitoring alert; new critical security finding; change to the six accepted SECURITY DEFINER warnings.