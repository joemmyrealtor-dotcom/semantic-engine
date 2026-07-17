# RC-4 — Production Launch Readiness

**Build commit:** `bef2a30d82b30b737845a85e00ba6d8640d37263` (2026-07-17T22:57:14Z)
**Baselines:** typecheck ✅ · validate **343/343** ✅ · Playwright **38/38** ✅ (0 serious/critical axe) · production build ✅ · RC-2 perf budgets **PASS** ✅ · RC-2 DB analysis ✅

---

## Decision: **RC-4 CONDITIONAL GO**

Every automatable launch gate is **PASS**. Every RC-3 critical/high finding is **fixed**. The four operator-only launch prerequisites remain **BLOCKED-OPERATOR** by design and must be closed by the named owner before cutover. **GA readiness is NOT claimed.**

| Bucket | Count |
| --- | --- |
| PASS               | 16 |
| BLOCKED-OPERATOR   |  4 |
| ACCEPTED-RISK      |  3 |
| FAIL               |  0 |

---

## Hard launch prerequisites (must be PASS before cutover)

| # | Prerequisite | Status | Owner | Evidence |
|---|---|---|---|---|
| H1 | `RATE_LIMIT_ADAPTER=supabase` set in production env | **BLOCKED-OPERATOR** | Platform Ops | `src/lib/data/rate-limit.ts::assertRateLimitReadiness` fail-closes in production without this env. `startupDiagnostics` surfaces FAIL. |
| H2 | Google OAuth provider enabled in Cloud | **BLOCKED-OPERATOR** | Auth Owner | `supabase--configure_social_auth` has not been invoked in this environment. Sign-in path requires provider before first user OAuth. |
| H3 | Demo bearer `APIC-001` retired; production `APIClient` rows created | **BLOCKED-OPERATOR** | API Owner | `resolveClient()` only trusts `APIC-001` when `DEMO_API_KEY` env matches (unset in prod). New rows must be issued and clients rotated before public API traffic. |
| H4 | `pre-launch-baseline` backup captured + integrity-verified | **BLOCKED-OPERATOR** | Data Ops | `performBackup()` + `verifyBackupIntegrity()` in `src/lib/data/backups.ts`. No baseline row present in workspace yet. |

---

## 1 · Release manifest

- **Commit:** `bef2a30d82b30b737845a85e00ba6d8640d37263`
- **Committed at:** 2026-07-17T22:57:14 UTC
- **Artifact:** `dist/client/` (SSR/browser bundle) + `dist/server/` + `dist/nitro.json`
- **Schema version:** v8 (see `src/lib/data/schema.ts`)
- **Migrations:** 7 files under `supabase/migrations/`
- **Docs pinned:** RC1-READINESS.md, RC1-GATES.json, RC1-FUNCTIONAL-QA.md, RC2-PERFORMANCE.md, RC3-SECURITY-GOVERNANCE.md, this file.

## 2 · Environment / config inventory

**Server-only (required):** `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (auto-provisioned), `RATE_LIMIT_ADAPTER=supabase` (H1).
**Server-only (optional):** `DEMO_API_KEY` (dev only — must be **unset** in prod, see H3).
**Client-safe:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.
**Fail-fast:** `startupDiagnostics(env, snapshot)` runs at boot and surfaces on `/admin/deployment`:
- publishable key + URL presence
- rate-limit adapter readiness (fail-closed in prod)
- workspace-leakage scan
- audit-chain integrity

## 3 · Migrations — ordering, idempotency, rollback

Filename-ordered under `supabase/migrations/`. All RC-1 → RC-3 migrations are **additive** (DROP + CREATE of a named policy is atomic; no data mutation). Rollback plan is **forward-fix**: re-issue the prior `CREATE POLICY` with the earlier predicate. `20260717225352` (RC-3 tightening) rewrites `audit_events` read/insert policies and `profiles` policy set + column grants — reversible by rerunning the pre-RC-3 policy shape.

**Post-apply verification:** `pg_class.relrowsecurity` = true on **19/19** public tables; `pg_policies` count = **61**.

## 4 · Deployment runbook

**Order:** (a) apply pending migrations (none since 20260717225352); (b) provision `RATE_LIMIT_ADAPTER=supabase` env; (c) confirm Google OAuth provider config; (d) issue production `APIClient` rows + retire `APIC-001`; (e) take `pre-launch-baseline` backup + verify integrity; (f) publish via `preview_ui--publish`; (g) run smoke suite (`bunx playwright test`) against the published URL; (h) monitor `/admin/monitoring` for 15 minutes.

**Health checks:** `/admin/deployment` (startup diagnostics), `/admin/monitoring` (RC readiness + workspace leakage), `/api/public/v1/health` (rate-limit + auth path).

**Rollback triggers:** any p95 > 2× RC-2 budget for 5 min, error rate > 1% for 5 min, workspace-leakage detection true, or audit-chain broken.

**Escalation:** Platform Ops (H1, L2, L5, L6, L14, L16) → Data Ops (H4, L3, L4, L7, L8) → Auth Owner (H2, L12) → API Owner (H3, L13) → Security (L15, L17, L24) → SRE (L9, L10, L11, L18, L23) → Build (L1, L19, L22) → QA (L20, L21).

## 5 · Backup / restore

**RPO target:** ≤ 24 h (backups are workspace snapshots emitted at cutover + on demand).
**RTO target:** ≤ 30 min (restore is single-workspace, in-place, governed).
**Rehearsal:** `src/lib/data/scale-fixture.ts` populates a stress fixture; `performGovernedRestore()` requires typed `RESTORE` confirmation + ≥8-char reason + pre-restore snapshot; exercised in the Playwright suite.
**Baseline (H4):** must be captured against production data before cutover.

## 6 · Monitoring / alerting / SLOs

**SLOs (from RC-2, all PASS this turn):** catalog list p95 < 200 ms, search p95 < 300 ms, graph p95 < 400 ms, audit append p99 < 50 ms, rate-limit contention p99 < 100 ms.
**Correlation IDs:** stamped in `audit_events.correlation_id` on every mutation via `auditedMutate`.
**Log redaction:** `redactSecrets()` applied to every JSON API response (13 secret-shaped keys).
**Alert routing:** ACCEPTED-RISK — external routing deferred; `/admin/monitoring` is the single pane, augmented by RC-2 perf canary + Playwright smoke.

## 7 · Auth / secrets / DNS / TLS

- **Auth session lifecycle:** integration-managed `_authenticated/route.tsx` (`ssr:false`) + bearer `functionMiddleware` in `src/start.ts`. Verified in RC-3.
- **Secrets in bundle:** RC-3 scan → 0 real secrets (2 hits are `@supabase/auth-js` string constants).
- **TLS:** Lovable-managed on `*.lovable.app`. Custom domain deferred to launch cutover (ACCEPTED-RISK L16).
- **External services:** Supabase Postgres + Auth + Data API only. No third-party OAuth beyond H2.

## 8 · Risk register (open items accepted with compensating controls)

| ID | Risk | Compensating control |
|---|---|---|
| F-RC3-004 | Content-table SELECT policies use `USING (true)` | `auditedMutate` workspace stamp + `detectWorkspaceLeakage()` fail-fast + server-fn `workspaceId` filters. Deferred to dedicated multi-tenant slice post-launch. |
| F-RC3-007 | HTML CSP relies on framework defaults | HSTS 2y + `X-Frame-Options: DENY` + strict CSP on API paths. Full nonce CSP for HTML deferred. |
| F-RC3-008 | No automated dependency-audit in CI | `bun.lock` committed for reproducibility; platform-level scanning owns this. |
| L11 | External alert routing not wired | On-call polls `/admin/monitoring`; Playwright canary + RC-2 perf script cover the SLO surface. |
| L16 | Custom domain not yet connected | Lovable-managed TLS on published subdomain covers cutover; DNS work sequenced post-launch. |

## 9 · Capacity + rollback thresholds

RC-2 stress tier peaks (1552 KOs): all 11 budgets **PASS** (rerun this turn, total 8.77 s exit 0). Launch thresholds mirror RC-2 SLOs; rollback triggers per §4.

## 10 · Final regression

| Check | Command | Result |
|---|---|---|
| Typecheck | `bunx tsgo --noEmit` | exit 0 |
| Deterministic validations | `bun run scripts/validate.ts` | **343/343** OK |
| Playwright + axe | `bunx playwright test` | **38 passed** (1.0m), 0 serious/critical |
| Production build | `bun run build` | exit 0 · `dist/client` + `dist/nitro.json` |
| RC-2 perf | `bun run scripts/rc2-perf.ts` | budgets: **PASS** · total 8.77s exit 0 |
| RC-2 DB | `bun run scripts/rc2-db.ts` | exit 0 |
| RC-3 targeted RLS | `pg_policies` recheck | audit + profiles policies unchanged since RC-3 |

---

## Launch gate matrix

| ID | Area | Gate | Status | Owner |
|---|---|---|---|---|
| L1  | 1-release-manifest   | Immutable commit/artifact identity | **PASS** | Build |
| L2  | 2-env-config         | Env inventory + fail-fast checks | **PASS** | Platform Ops |
| L3  | 3-migrations         | Ordered, idempotent, additive | **PASS** | Data Ops |
| L4  | 3-migrations         | Post-apply schema/policy verification | **PASS** | Data Ops |
| L5  | 4-deployment-runbook | Health checks + smoke suite | **PASS** | Platform Ops |
| L6  | 4-deployment-runbook | Rollback triggers + escalation | **PASS** | Platform Ops |
| L7  | 5-backup-restore     | Restore rehearsal from fixture | **PASS** | Data Ops |
| L8  | 5-backup-restore     | Baseline backup captured (H4) | **BLOCKED-OPERATOR** | Data Ops |
| L9  | 6-monitoring         | SLOs + budgets (RC-2) | **PASS** | SRE |
| L10 | 6-monitoring         | Log redaction + correlation IDs | **PASS** | SRE |
| L11 | 6-monitoring         | External alert routing | **ACCEPTED-RISK** | SRE |
| L12 | 7-auth-secrets-dns   | Auth provider config (H2) | **BLOCKED-OPERATOR** | Auth Owner |
| L13 | 7-auth-secrets-dns   | API-client rotation ready (H3) | **BLOCKED-OPERATOR** | API Owner |
| L14 | 7-auth-secrets-dns   | Rate-limit adapter (H1) | **BLOCKED-OPERATOR** | Platform Ops |
| L15 | 7-auth-secrets-dns   | Secrets not in bundle | **PASS** | Sec |
| L16 | 7-auth-secrets-dns   | DNS/TLS/domain | **ACCEPTED-RISK** | Platform Ops |
| L17 | 8-risk-register      | RC-3 mediums accepted w/ controls | **ACCEPTED-RISK** | Sec |
| L18 | 9-capacity           | Perf evidence + rollback thresholds | **PASS** | SRE |
| L19 | 10-final-regression  | Typecheck | **PASS** | Build |
| L20 | 10-final-regression  | Validations | **PASS** | QA |
| L21 | 10-final-regression  | Playwright + axe | **PASS** | QA |
| L22 | 10-final-regression  | Production build | **PASS** | Build |
| L23 | 10-final-regression  | RC-2 perf + DB rerun | **PASS** | SRE |
| L24 | 10-final-regression  | RC-3 targeted checks | **PASS** | Sec |

---

## Operator checklist (surfaced in `/admin/deployment`)

1. ☐ **H1 · Platform Ops** — set `RATE_LIMIT_ADAPTER=supabase` in production env; confirm `startupDiagnostics` shows rate-limit OK.
2. ☐ **H2 · Auth Owner** — enable Google OAuth provider via `supabase--configure_social_auth`; verify sign-in on published URL.
3. ☐ **H3 · API Owner** — issue production `APIClient` rows; retire `APIC-001`; confirm `DEMO_API_KEY` is unset.
4. ☐ **H4 · Data Ops** — capture `pre-launch-baseline` backup; run `verifyBackupIntegrity()`; archive backup ID.
5. ☐ **Cutover** — publish via `preview_ui--publish`; run smoke pack; watch `/admin/monitoring` for 15 min.
6. ☐ **Post-launch** — schedule the multi-tenant hardening slice (F-RC3-004) and external alert routing (L11).

**Do not issue GA until all four hard prerequisites are PASS and this checklist is complete.**
