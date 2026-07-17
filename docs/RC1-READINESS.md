# Legacy Forge — RC-1 Readiness Report

_Report date: 2026-07-17. Scope: RC-1 **entry decision** for Functional QA. This
is NOT a production launch attestation._

---

## 1. Executive decision

**CONDITIONAL GO for RC-1 Functional QA.**

All in-sandbox implementation blockers (#1 auth, #2 mutation boundary, #3 audit
integrity, #4 distributed rate-limit adapter, #5 workspace isolation, #6 a11y &
Playwright, #7 load-scale) are closed with static, deterministic, and
executable evidence. Typecheck, deterministic validation harness, and the
normal-tier benchmark were re-executed for this report and pass cleanly. The
recorded stress-tier and Playwright results are used as evidence (they were
executed in the immediately-preceding slice and their artifacts / commands are
reproducible; re-running the 207 s stress split and the 38-test Playwright
suite here would only re-generate identical evidence).

The **CONDITIONAL** qualifier reflects items that can only be proven in a live
environment (see §5 Operator checklist and §7 residual risks):

- Supabase migrations exist in-repo but must be applied against the RC-1
  environment; RLS effectiveness must then be re-linted there.
- `RATE_LIMIT_ADAPTER=supabase` + `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
  must be set in RC-1 env; `assertRateLimitReadiness()` will fail startup if
  not.
- OAuth providers (Google), custom domain, backups schedule, and
  monitoring destinations are configured by the operator.

Functional QA may begin against RC-1 once §5 is satisfied.

---

## 2. Acceptance-criterion matrix

| # | Criterion | Status | Evidence |
|---|---|---|---|
| A1 | Clean typecheck | ✅ | `bunx tsgo --noEmit` → exit 0, no diagnostics |
| A2 | Deterministic validation harness | ✅ | `bun run scripts/validate.ts` → `OK 343 checks · TOTAL 343` |
| A3 | Playwright end-to-end + a11y | ✅ (recorded) | 38/38 pass; 0 failed / 0 skipped / 0 flaky; 0 axe serious+critical (Playwright 1.56.1, `@axe-core/playwright`) |
| A4 | Normal benchmark budgets | ✅ | Re-run this slice: correctness PASS, budgets PASS, exit=0, 32.9 s |
| A5 | Stress benchmark budgets (1,552 KO / 3,000 audit / 15 shards) | ✅ (recorded) | 9-group split, all groups PASS, aggregated exit=0, ≈207 s |
| A6 | Real Supabase auth + session actor propagation | ✅ | Blocker #1 landed: session bridge, `_authenticated/route.tsx`, `attachSupabaseAuth` in `src/start.ts` |
| A7 | Strict RBAC | ✅ | `has_role` / `has_any_role` security-definer fns; 60 RLS policies scoped by role across 19 tables (5 migrations) |
| A8 | Centralized audited mutation boundary | ✅ | All repo writes route through `auditedMutate` / `auditedTransaction`; validator asserts no untracked write paths |
| A9 | SHA-256 audit chain | ✅ | Pure-JS FIPS 180-4 impl in `security.ts`; validator covers "abc" / empty-string vectors + chain continuity on scaled fixtures |
| A10 | Backups + governed restore | ✅ | `performGovernedRestore()` requires typed `"RESTORE"` + ≥8-char reason, snapshots current state to pre-restore backup, ledger records both |
| A11 | Per-entity workspace isolation | ✅ | Schema v8 `workspaceId` on `Timestamped`; `WORKSPACE_OWNED_KINDS` classifier; `scopedList/scopedGet` filter; `detectWorkspaceLeakage()` hard-fails on unscoped owned rows; 17 dedicated checks |
| A12 | Distributed rate limiting | ✅ | `SupabaseRateLimitStore` via `public.consume_rate_limit()` RPC + `rate_limit_buckets` (RLS locked, atomic FOR UPDATE UPSERT); 40+ regression checks; `assertRateLimitReadiness()` gates startup |
| A13 | Public API auth + scopes | ✅ | `Bearer` required on non-catalog `/api/public/v1/*`; fingerprint match against `APIClient`; per-endpoint scope enforcement → 401/403 with structured envelopes |
| A14 | Monitoring + startup diagnostics | ✅ | `startupDiagnostics()` includes rate-limit readiness + workspace leakage; `/admin/monitoring` renders live signals |
| A15 | Feature flags + maintenance gating | ✅ | Present via deployment module; startup gate blocks unsafe combos |
| A16 | Migrations + RLS present in-repo | ✅ | 5 migrations, 19 public tables, 60 policies, GRANTs verified; **live-env `supabase--linter` re-run required post-apply** |
| A17 | Static guards (bypass, leakage, backdoors, secrets, unscoped) | ✅ | Validator asserts: no audit bypass, no cross-workspace mutate, `__lovableE2E` requires DEV+VITE_E2E, api route has no VITE_E2E branch, no service-role in test bridge |

---

## 3. Exact commands & re-executed results

```
$ bunx tsgo --noEmit
# exit 0, no output

$ bun run scripts/validate.ts
OK 343 checks
TOTAL 343
# exit 0

$ bun run scripts/bench.ts        # normal tier: small + medium + large
=== summary ===
  small   indexCold=13.94ms  indexWarm=5.36ms  graph=0.25ms  auditVerify=1.44ms  memoHits=20/21  mem=50.6MB
  medium  indexCold=35.66ms  indexWarm=23.13ms graph=0.40ms  auditVerify=5.93ms  memoHits=20/21  mem=116.5MB
  large   indexCold=82.51ms  indexWarm=52.34ms graph=0.36ms  auditVerify=26.73ms memoHits=20/21  mem=469.6MB
  scaling small→large p95: indexCold=5.92x indexWarm=9.77x buildGraph=1.46x impactAnalysis=7.18x
  correctness: PASS   budgets: PASS   total 32900.8ms   exit=0
```

Recorded (previous slice, deterministic + reproducible):

```
# Stress split — nine bounded groups, each writes bench-results/stress-<g>.json
for g in index graph workspace audit backup export search automation api; do
  bun run scripts/bench.ts --tier=stress --group=$g --out=bench-results/stress-$g.json
done
bun run scripts/bench.ts --aggregate='bench-results/stress-*.json' --out=bench-results/stress.json
# Aggregate: correctness PASS, budgets PASS, exit=0
#   indexCold p95=292.7ms   (<1200 budget)
#   indexWarm p95=186.0ms   (<400)
#   buildGraph p95=2.1ms    (<1500)
#   auditVerify p95=70.3ms  (<1000)
#   memo hit ratio 20/21 = 0.952  (≥0.90)
#   large→stress indexCold ≈2.7× for ≈2.3× entity multiplier (sub-quadratic)
#   total ≈207 s wall clock across nine groups

# Playwright 1.56.1  +  @axe-core/playwright
bun run e2e:desktop     # chromium-desktop, non-a11y
bun run e2e:a11y        # chromium-desktop a11y sweep (WCAG 2.1 AA)
bun run e2e:mobile      # chromium-mobile (Pixel 5) — mobile + smoke
bun run e2e:tablet      # chromium-tablet (iPad Mini) — smoke
# Totals: 38 tests, 38 passed, 0 failed, 0 skipped, 0 flaky
# Split: desktop 30 · mobile 3 · tablet 1 · desktop-a11y 4  (listing via `playwright test --list`)
# axe: 0 serious, 0 critical across all a11y assertions
```

---

## 4. Residual risks (severity × likelihood)

| Risk | Sev | Like | Mitigation / owner |
|---|---|---|---|
| Migrations applied to a DB with divergent schema drift | HIGH | MED | Operator runs `supabase--linter` after apply; RC-1 env must start from Cloud baseline |
| Rate-limit adapter falls back to `memory` in prod (misconfig) | HIGH | LOW | `assertRateLimitReadiness()` refuses to boot; `startupDiagnostics()` surfaces on `/admin/monitoring` |
| OAuth (Google) provider unenabled at first login → "Unsupported provider" | MED | MED | Operator enables via `supabase--configure_social_auth` before QA sign-in |
| Backups schedule not wired to real cron; only ad-hoc + governed restore proven | MED | MED | Wire cron/scheduled function post-QA entry; governed restore path is safe |
| Analytics snapshot capture idempotency depends on `AUT-005` scheduled trigger being enabled in target env | LOW | MED | Verify automation is `enabled=true` in RC-1 seed / migration; regression covers logic, not scheduler |
| Public API bearer keys are seeded — must be rotated before external QA | HIGH | HIGH | Rotate `APIClient` records in RC-1 env; existing seed keys are dev-only |
| Cross-tab conflict detection only via `updatedAt` compare (documented debt) | LOW | LOW | Accepted for RC-1; OT/CRDT deferred |
| Search group runtime (~158 s) dominates stress benchmark | LOW | LOW | Documented; per-group split lets triage re-run isolated groups |
| `supabase--linter` NOT executed against live env in this report | MED | HIGH | Mandatory in §5 |

---

## 5. Required pre-production operator checklist

Perform in order in the RC-1 environment before opening Functional QA:

1. **Apply migrations** — 5 files under `supabase/migrations/` (`20260714050201`, `20260714050227`, `20260717162250`, `20260717190003`, `20260717190045`). Confirm 19 public tables + 60 policies.
2. **Run linter** — `supabase--linter` against the RC-1 project; resolve any WARN/ERROR before opening QA.
3. **Env vars** (server, secrets):
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Cloud auto-injected)
   - `RATE_LIMIT_ADAPTER=supabase`
   - `NODE_ENV=production`
4. **Env vars** (client): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`. **Never** `VITE_E2E`.
5. **Auth providers** — enable Email/Password + Google via `supabase--configure_social_auth`; disable anonymous sign-up.
6. **Rotate API bearer keys** — regenerate `APIClient` records; retire seed values.
7. **Owner bootstrap** — first sign-in becomes Owner (see `handle_new_user`). Confirm via `/admin/workspaces`.
8. **Startup diagnostics green** — load `/admin/monitoring`; verify rate-limit adapter = `supabase`, workspace leakage = 0, audit chain OK.
9. **Backups** — take a manual `Repo.exportSnapshot()` baseline; store off-platform.
10. **Smoke** — run `bun run e2e:smoke` against the deployed preview URL (`E2E_BASE_URL=…`) as final gate.

---

## 6. Rollback & recovery readiness

- **Data**: `Repo.exportSnapshot()` round-trips every entity; `performGovernedRestore()` requires typed `"RESTORE"` + ≥8-char reason and auto-snapshots the current state into the backup ledger before overwrite. Regression: `governedRestoreOk` + `importRoundtrip` correctness gates in the benchmark harness.
- **Audit**: SHA-256 hash chain (`audit.ts`) is verifiable end-to-end via `verifyAuditChain()`; any tamper breaks continuity and surfaces on `/admin/audit` + `startupDiagnostics()`.
- **Rate-limit outage**: reads `failOpen`, mutations `failClosed`; degraded state emits `X-RateLimit-Degraded` header.
- **Schema migration rollback**: each migration is additive; roll-forward preferred. If required, restore from Cloud automated DB backup (Supabase native) — coordinate via operator.
- **App rollback**: redeploy previous Lovable published build. No client-only IndexedDB state is authoritative in cloud mode.

---

## 7. Recommendation

**Proceed with RC-1 Functional QA under the CONDITIONAL GO above.** All
in-sandbox gates are green; the remaining conditions are operational
configuration checks (§5) that cannot be proven inside the build sandbox. Do
NOT interpret this as a production launch attestation — a separate GA
readiness pass is required after Functional QA closes.

---

## Appendix A — Static guard inventory (validator-enforced)

- Audit bypass: every `Repo.*` write goes through `auditedMutate` / `auditedTransaction`; harness scans repository module for unwrapped calls.
- Workspace leakage: `detectWorkspaceLeakage()` hard-fails on unscoped rows in `WORKSPACE_OWNED_KINDS`; `scopedList`/`scopedGet` refuse cross-workspace fetch; `update`/`remove` refuse cross-workspace mutation and refuse re-homing via patch.
- Test backdoors: `window.__lovableE2E` gated on `import.meta.env.DEV === true && VITE_E2E === "1"`; validator asserts `src/routes/api/public/v1/$.ts` contains neither `VITE_E2E` nor `__lovableE2E`; playwright config activates `VITE_E2E=1` only for the dev webServer.
- Secrets: `IntegrationCredentialReference` masks credentials in API responses; validator asserts no service-role key referenced from client-reachable modules; `client.server.ts` imports only inside server handler bodies via `await import(...)`.
- Unscoped entities: `WORKSPACE_OWNED_KINDS` ∪ `GLOBAL_KINDS` exhaustively covers every entity kind; classifier gap fails validation.

## Appendix B — Known pre-existing lints & limitations

- Search group in stress benchmark runs ~158 s (full-index construction on 1,552-KO fixture); acceptable, documented, per-group re-runnable.
- Reports export JSON/HTML only (no PDF/email); documented tech debt.
- No cross-tab OT/CRDT; `updatedAt` compare is the current conflict signal.
- IndexedDB ↔ Supabase seed drift is possible without a reconciliation job; documented tech debt.

## Appendix C — Versions

- Node runtime: Bun 1.3.3 (sandbox)
- Playwright: 1.56.1
- `@axe-core/playwright`: bundled with Playwright suite
- TanStack Router 1.170.16, TanStack Start 1.168.26, React Query 5.101.1
- Supabase JS 2.110.2
- Schema version: v8 (workspace-scoped `Timestamped`)
