# Launch Closure — Production Cutover Rehearsal

**Mode:** rehearsal — no production data mutated.
**Build commit:** `24361d269cd23e6579a839da03e7c631e917344f` (2026-07-17T23:04:59Z)
**Decision:** **CONDITIONAL GO** — every automatable check green; H1–H4 remain BLOCKED-OPERATOR pending real operator evidence. Production promotion is hard-locked in `/admin/deployment` until every hard gate is PASS. GA is **not** claimed.

---

## Regression re-run (this turn)

| Check | Command | Result |
|---|---|---|
| Typecheck | `bunx tsgo --noEmit` | exit 0 |
| Validations | `bun run scripts/validate.ts` | **343/343 OK** |
| Playwright + axe | `bunx playwright test` | **38 passed** (55.5s) · 0 serious/critical |
| Production build | `bun run build` | exit 0 · `dist/client` + `dist/nitro.json` |
| RC-2 perf | `bun run scripts/rc2-perf.ts` | budgets **PASS** · total 9.74s |
| RC-2 DB | `bun run scripts/rc2-db.ts` | exit 0 |
| RC-3 targeted RLS (audit_events, profiles) | `pg_policies` recheck | unchanged since RC-3 |

## Cutover sequence

1. **Freeze writes (optional)** · Platform Ops — enable maintenance mode on `/admin/deployment`.
2. **Apply migrations** · Data Ops — none pending; verify RLS on 19 tables and 61 policies.
3. **H1 · Rate-limit adapter** · Platform Ops — `RATE_LIMIT_ADAPTER=supabase` in prod env; startup diagnostics OK.
4. **H2 · Google OAuth** · Auth Owner — enable in Cloud Auth Settings; verify sign-in on published URL.
5. **H3 · API bearer rotation** · API Owner — disable/delete APIC-001; issue prod APIClient rows; bearers via Project Settings → Secrets only.
6. **H4 · Baseline backup** · Data Ops — `performBackup()`; `verifyBackupIntegrity()`; archive BKP id + SHA-256 hash.
7. **Publish RC build** · Platform Ops — publish via `preview_ui--publish` (operator action).
8. **Smoke suite** · QA — Playwright pack against published URL; require 38/38 + 0 serious/critical axe.
9. **Watch monitoring** · SRE — `/admin/monitoring` for 15 min; startup diagnostics OK; workspace leakage=false; audit chain intact.
10. **Unfreeze writes** · Platform Ops — disable maintenance mode.

## Health checks

- `/admin/deployment` — startup diagnostics + RC readiness + hard-gate panel
- `/admin/monitoring` — RC readiness · workspace leakage · audit chain
- `/api/public/v1/health` — rate-limit + auth path

## Rollback triggers

- Any RC-2 SLO p95 > 2× budget for 5 min
- Error rate > 1% for 5 min
- `detectWorkspaceLeakage()` returns true
- `verifyAuditChain()` reports broken chain
- Startup diagnostics rate-limit or Supabase key row FAIL post-cutover
- H4 baseline backup missing or hash mismatch

## Rollback procedure

1. Enable maintenance mode on `/admin/deployment`.
2. Revert last deploy via Lovable publish (previous build).
3. If a migration is involved, forward-fix via an additive migration (all RC migrations are additive DROP+CREATE of named policies).
4. If data corruption is suspected, `performGovernedRestore(BKP, reason≥8chars, typed 'RESTORE', workspace-bound)` from the H4 baseline.
5. Re-run smoke pack; watch monitoring 15 min; disable maintenance mode.

## Hard launch prerequisites — PASS evidence required

| # | Owner | Gate | Status | PASS evidence required | Blocking reason |
|---|---|---|---|---|---|
| H1 | Platform Ops | `RATE_LIMIT_ADAPTER=supabase` in production env | **BLOCKED-OPERATOR** | Startup diagnostics rate-limit row shows OK in prod env **AND** `env \| grep RATE_LIMIT_ADAPTER` returns `supabase` on the production runtime. | No production env attestation captured. |
| H2 | Auth Owner | Google OAuth enabled + callback verified | **BLOCKED-OPERATOR** | Google provider toggled ON in Cloud Auth Settings **AND** successful sign-in from the published URL, evidenced by an `auth.users` session row with `provider='google'` or a callback-landing screenshot. | Provider not toggled and callback not verified. |
| H3 | API Owner | APIC-001 disabled/deleted + fresh API clients provisioned as runtime secrets | **BLOCKED-OPERATOR** | APIC-001 row disabled/soft-deleted **AND** ≥1 new `APIClient` row exists **AND** each bearer stored in Project Settings → Secrets (never in code/commits/logs). | Demo bearer still present; no production APIClient rows issued. |
| H4 | Data Ops | `pre-rc1-baseline` backup + integrity + monitoring green | **BLOCKED-OPERATOR** | `performBackup()` returns BKP id (record here) **AND** `verifyBackupIntegrity()` returns matching SHA-256 (record here) **AND** `/admin/monitoring` shows all diagnostics green at the same timestamp. | No baseline BKP row present in workspace. |

## Rehearsal results

| Area | Status | Evidence |
|---|---|---|
| Deployment | **PASS** | `bun run build` exit 0; `dist/client` + `dist/nitro.json` emitted. |
| Health checks | **PASS** | `startupDiagnostics` + `releaseCandidateReadiness` render on `/admin/deployment`. |
| Rollback | **PASS** | Procedure documented; `performGovernedRestore` exercised in Playwright. |
| Migration verification | **PASS** | 19 tables RLS-enabled; 61 policies present; RC-3 tightening intact. |
| Backup verification | **PASS** | `performBackup` + `verifyBackupIntegrity` SHA-256 pipeline exercised via fixture. |
| Monitoring verification | **PASS** | `/admin/monitoring` renders RC readiness + workspace leakage + audit chain with no secrets/tenant data. |
| Post-deploy smoke | **PASS** | 38/38 Playwright + 0 serious/critical axe on RC build. |

## Accepted risks (unchanged from RC-3/RC-4)

| ID | Risk | Compensating control |
|---|---|---|
| F-RC3-004 | Content-table SELECT policies use `USING (true)` | `auditedMutate` workspace stamp + `detectWorkspaceLeakage()` fail-fast + server-fn `workspaceId` filters |
| F-RC3-007 | HTML CSP relies on framework defaults | HSTS 2y + `X-Frame-Options: DENY` + strict CSP on API paths |
| F-RC3-008 | No automated dependency-audit in CI | `bun.lock` committed; platform-level scanning owns this |
| L11 | External alert routing not wired | On-call polls `/admin/monitoring` + Playwright canary + RC-2 perf script |
| L16 | Custom domain not yet connected | Lovable-managed TLS on published subdomain covers cutover |

## Evidence checklist (operator fills at cutover)

- [ ] H1 · `RATE_LIMIT_ADAPTER` env value: `______`; diagnostics screenshot ID: `______`; timestamp: `______`
- [ ] H2 · Provider toggle screenshot ID: `______`; sign-in session row ID: `______`; timestamp: `______`
- [ ] H3 · APIC-001 disable timestamp: `______`; new APIClient IDs: `______`; secret names in Project Settings: `______`
- [ ] H4 · Baseline BKP id: `______`; SHA-256: `______`; monitoring green screenshot ID: `______`; timestamp: `______`
- [ ] Publish · commit `24361d26…` published; publisher: `______`; timestamp: `______`
- [ ] Smoke · Playwright 38/38 against published URL; report ID: `______`
- [ ] Monitoring · 15-min watch clean; on-call: `______`

## Production promotion lock

Enforced in `src/routes/admin.deployment.tsx` — the **Promote to production** button is `disabled` and labeled **LOCKED** while any hard gate is not PASS. No bypass flag exists; status transitions require a code/config change with operator evidence attached.

## Final decision

**CONDITIONAL GO** — the RC build is production-ready by every automatable measure. Cutover remains **blocked** until H1–H4 carry real operator evidence and the promotion lock unlocks. Stop here. Do not publish. Do not launch.
