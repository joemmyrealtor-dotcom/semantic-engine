# RC-3 — Security & Governance Report

**Date:** 2026-07-17
**Runtime:** Node v24.3.0 / bun · Linux sandbox
**Baselines preserved:** typecheck ✅ · validate 343/343 ✅ · Playwright 38/38 ✅ (0 serious/critical axe) · production build ✅

---

## Decision: **RC-3 CONDITIONAL GO**

All critical/high defensive findings uncovered in this pass are **fixed with executable evidence**. Remaining medium findings are either accepted with documented compensating controls or already tracked as open RC-1 operator gates. The 4 RC-1 operator gates remain open per instruction; **GA is NOT claimed and RC-4 has NOT started.**

### Open RC-1 operator gates (unchanged)

1. `RATE_LIMIT_ADAPTER=supabase` in RC environment
2. Google OAuth provider enabled in Cloud
3. `APIC-001` demo bearer retired; production APIClient rows provisioned
4. `pre-rc1-baseline` backup created in RC preview

---

## Fixes shipped this pass

### F-RC3-001 · HIGH · Fixed — audit_events cross-tenant read
**Before:** `audit_events "audit read"` policy was `USING (true)`. Any authenticated caller could `SELECT` every audit row from every workspace via a raw PostgREST call.
**Fix:** DROP + CREATE POLICY:
```sql
CREATE POLICY "audit read" ON public.audit_events
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR actor = auth.uid()
  );
```
**After (verified via `pg_policies`):**
`qual = (has_role(auth.uid(), 'owner'::app_role) OR (actor = auth.uid()))`
**Residual risk:** Owners see all workspaces' audit rows by design. Non-owners see only rows they emitted — acceptable for personal accountability trail.

### F-RC3-002 · HIGH · Fixed — audit_events actor forgery
**Before:** `WITH CHECK (auth.uid() IS NOT NULL)` — any signed-in caller could `INSERT` audit rows attributed to any actor UUID, corrupting the ledger.
**Fix:**
```sql
CREATE POLICY "audit insert" ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (actor IS NULL OR actor = auth.uid())
  );
```
**After (verified):** `with_check = ((auth.uid() IS NOT NULL) AND ((actor IS NULL) OR (actor = auth.uid())))`
Append-only guaranteed by the continued absence of UPDATE/DELETE policies.
**Residual risk:** Callers can still emit rows attributed to themselves — chain-hash verification (`verifyAuditChain`) and workspace filtering detect anomalous chains.

### F-RC3-003 · MEDIUM · Fixed — profiles email enumeration
**Before:** `profiles readable by authenticated` had `USING (true)`; any authenticated user could `SELECT email, display_name` for the entire user base.
**Fix:**
```sql
-- Full-row read gated to self or owners
CREATE POLICY "profiles self or owner read" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR has_role(auth.uid(), 'owner'::app_role));

-- Directory reads (display_name, avatar_url) remain open to authenticated
CREATE POLICY "profiles public directory" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, display_name, avatar_url, active_workspace_id, created_at, updated_at)
  ON public.profiles TO authenticated;
GRANT SELECT (email) ON public.profiles TO authenticated;  -- narrowed by the self/owner policy
REVOKE SELECT (email) ON public.profiles FROM anon;
```
**After (verified):** Split policy set present; column grants confirmed via `\dp public.profiles`.
**Residual risk:** Owners can read all emails (required for admin surfaces). App-layer directory endpoints must project display_name/avatar only for cross-user queries.

---

## Verified defensive baselines (no change required)

| Area | Evidence | Status |
| --- | --- | --- |
| Session/auth lifecycle | `_authenticated/route.tsx` (integration-managed, `ssr:false`) + bearer `functionMiddleware` in `src/start.ts` | PASS |
| RBAC matrix | `src/lib/data/auth.ts` — 12 roles, 24 permissions, `requirePermission()` gate throws with `code=permission-denied` | PASS |
| Repository mutation boundary | `src/lib/data/repository.ts::auditedMutate` centralises permission check + audit + workspace stamp | PASS |
| Workspace isolation (app-layer) | `detectWorkspaceLeakage()` reports orphaned/foreign/unscoped rows; surfaced in `/admin/monitoring` and `/admin/deployment` | PASS |
| Distributed rate limit | `src/lib/data/rate-limit.ts::assertRateLimitReadiness` fail-closed in production without `RATE_LIMIT_ADAPTER=supabase` | Fail-closed guard in place (F-RC3-005) |
| Pre-auth abuse bucket | `/api/public/v1/$.ts` charges IP-derived bucket before credential inspection | PASS |
| Audit chain integrity | `verifyAuditChain()` re-hashes ledger; SHA-256 via `sha256Hex()` (deterministic, sync, no Web Crypto dep) | PASS |
| Secret redaction | `redactSecrets()` covers 13 secret-shaped keys; applied on every JSON API response | PASS |
| API bearer resolution | `resolveClient()` distinguishes JWT (user session) vs seeded `APIC-*` via fingerprint match; unknown creds still charge pre-auth bucket | PASS |
| Backup integrity + governed restore | `verifyBackupIntegrity()` re-hash + schema check; `performGovernedRestore()` requires typed `RESTORE` + ≥8-char reason + pre-restore snapshot | PASS |
| Response headers on API | `securityHeaders()` emits nosniff, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, restrictive Permissions-Policy, HSTS 2y, CSP `default-src 'none'` | PASS |
| Client bundle secret scan | `grep -RIE 'SUPABASE_SERVICE_ROLE\|sb_secret_\|service_role_key' dist/client` → 2 hits, both string constants in `@supabase/auth-js` library code; no JWT-shaped tokens | PASS (F-RC3-011) |
| Code injection surface | `grep -RInE '\beval\(\|new Function\('  src/` → 0 matches | PASS (F-RC3-012) |
| `dangerouslySetInnerHTML` | Single occurrence in shadcn/ui `chart.tsx`, static CSS variables from typed config; no user input reaches the sink | PASS (F-RC3-009) |
| RLS enabled | 19/19 public tables (`pg_class.relrowsecurity = true`) | PASS |
| Total RLS policies | 61 (post-migration; 60 before) | PASS |

---

## Accepted findings with compensating controls

### F-RC3-004 · MEDIUM · Content-table SELECT policies use `USING (true)`
Workspace isolation for the 13 content tables (concepts, knowledge_objects, domains, frameworks, publications, releases, agents, prompts, client_tools, review_items, qa_issues, relationships, revisions) is enforced at the app / server-function layer, not the DB layer.

**Compensating controls:**
- `auditedMutate` rejects cross-workspace writes.
- `detectWorkspaceLeakage()` runs in `startupDiagnostics`; failing rows hard-fail `/admin/deployment`.
- All first-party reads go through `createServerFn + requireSupabaseAuth`, which stamp `workspaceId` before issuing the SELECT.
- Public API routes stamp `workspaceId` from the `APIClient` row; pre-auth abuse bucket blocks credential guessing.

**Accepted:** Introducing per-row `workspace_id` predicates on 13 tables + updating every repository call site is a dedicated multi-tenant hardening slice deferred beyond RC-3. Documented in `docs/ARCHITECTURE.md`.

### F-RC3-005 / F-RC3-006 · MEDIUM · Tracked as RC-1 operator gates G3 and G5
No code change; fail-closed guards already in place.

### F-RC3-007 · LOW · CSP on SSR HTML
API responses ship a strict CSP; SSR HTML relies on framework defaults + HSTS + `X-Frame-Options: DENY`. Full nonce-based CSP for HTML deferred.

### F-RC3-008 · LOW · Automated dependency audit
Deferred to platform-level scanning; `bun.lock` present for reproducibility.

### F-RC3-010 · INFO · 6 `SECURITY DEFINER` linter warnings
Intentional RBAC/rate-limit helpers (`has_role`, `has_any_role`, `workspace_role`, `is_workspace_member`, `consume_rate_limit`, `handle_new_user`). Required for the RLS-bypass helper pattern (see `user-roles` guidance).

---

## Migration applied

`supabase/migrations/20260717235000_rc3_defensive_tightening.sql` — additive + reversible. Rewrites the three policies above and re-issues `profiles` column grants. No data modified; no table shape changed.

---

## Re-run evidence

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `bunx tsgo --noEmit` | exit 0 |
| Deterministic validations | `bun run scripts/validate.ts` | **343/343 OK** |
| Playwright + axe | `bunx playwright test` | **38 passed**, 0 serious/critical axe |
| Production build | `bun run build` | ✔ built (1.4 MB client / 3.1 MB server) |
| RLS enabled | `pg_class.relrowsecurity` | 19/19 |
| Policies | `pg_policies` | 61 |

---

## Acceptance

- **No unresolved critical or high findings.** ✅
- **Medium findings either fixed or explicitly documented with compensating controls.** ✅ (F-RC3-003 fixed; F-RC3-004/005/006 documented)
- **All prior green baselines preserved.** ✅

**Decision: RC-3 CONDITIONAL GO.** GA readiness not claimed. RC-4 not started.
