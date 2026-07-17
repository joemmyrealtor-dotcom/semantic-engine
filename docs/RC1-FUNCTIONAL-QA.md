# Legacy Forge — RC-1 Functional QA Report

_Report date: 2026-07-17. Scope: automated RC-1 Functional QA against the
current build. **This is not a production launch attestation.**_

Machine-readable companion: `docs/RC1-FUNCTIONAL-QA.json`.

---

## 1. Executive decision

**CONDITIONAL GO** — every automatable RC-1 functional workflow is green
(38/38 Playwright, 343/343 deterministic validation, normal benchmark
correctness + budgets PASS, 0 serious/critical axe violations). One defect
was found and fixed this slice (worker-contention flake under sandbox
parallelism). Four gates remain **BLOCKED-OPERATOR** and must be closed in
the RC-1 runtime environment before QA sessions with real users start:

- `RATE_LIMIT_ADAPTER=supabase` set in the RC-1 environment (sandbox is
  `<unset>`; code path is enforced).
- Google OAuth provider enabled in Cloud auth settings.
- Seed API bearer `APIC-001` retired; fresh production `APIClient` rows
  provisioned.
- Pre-RC1 baseline backup created and monitoring surface all-green in the
  RC-1 runtime.

Do not advance to RC-2 automatically.

---

## 2. Result totals

| Signal | Result |
|---|---|
| `bunx tsgo --noEmit` | exit 0, no diagnostics |
| `bun run scripts/validate.ts` | **343/343 PASS**, exit 0 |
| Playwright — total | **38 passed / 0 failed / 0 skipped / 0 flaky** |
| Playwright — chromium-desktop (boot + smoke + navigation + roles + api) | 24 passed |
| Playwright — chromium-desktop a11y | 10 passed |
| Playwright — chromium-mobile (Pixel 5) | 3 passed |
| Playwright — chromium-tablet (iPad Mini) | 1 passed |
| axe-core serious violations | **0** |
| axe-core critical violations | **0** |
| A11y surfaces covered | 10 (`/`, `/repository`, `/admin/audit`, `/admin/backups`, `/admin/monitoring`, `/admin/workspaces`, `/admin/deployment`, `/auth`, +2) |
| Normal benchmark | correctness PASS, budgets PASS, exit 0, 35.8 s |
| Defects fixed this slice | 1 (D-QA-001 — worker-contention flake) |
| Unresolved failures | 0 |
| BLOCKED-OPERATOR gates | 4 |

Benchmark highlights (large tier, p95 vs budget):

- `indexCold` 85.7 ms < 400 ms
- `indexWarm` 56.0 ms < 200 ms
- `buildGraph` 0.35 ms < 1500 ms
- `auditVerify` 38.3 ms < 500 ms
- memo hits 20/21 (95.2 %)

---

## 3. Workflow matrix (34 requirements)

`docs/RC1-FUNCTIONAL-QA.json::workflows` is the authoritative list, including
evidence pointer and reproduction command per workflow. Summary:

| Bucket | Requirements | PASS | BLOCKED-OPERATOR | FAIL |
|---|---:|---:|---:|---:|
| Boot / rendering / a11y | W01–W07, W13–W15 | 10 | 0 | 0 |
| API + rate limiting | W08–W12 | 5 | 0 | 0 |
| Governance / CRUD / release | W16–W17 | 2 | 0 | 0 |
| Automation / integration / backup / restore | W18–W22 | 5 | 0 | 0 |
| Workspace isolation + audit | W23–W24 | 2 | 0 | 0 |
| Monitoring / deployment / maintenance / flags | W25–W28 | 4 | 0 | 0 |
| Static + runtime hardening | W29–W30 | 2 | 0 | 0 |
| Operator-dependent gates | W31–W34 | 0 | 4 | 0 |

No requirement is classified NOT-APPLICABLE. No requirement failed.

---

## 4. Exact commands and results

```bash
# Typecheck
$ bunx tsgo --noEmit
# exit 0

# Deterministic validation harness
$ bun run scripts/validate.ts
OK 343 checks
TOTAL 343
# exit 0

# Playwright — desktop (24 tests: boot + smoke + navigation + roles + api)
$ PLAYWRIGHT_BROWSERS_PATH=/ bunx playwright test \
    --project=chromium-desktop --grep-invert=@a11y \
    e2e/boot.spec.ts e2e/smoke.spec.ts e2e/navigation.spec.ts \
    e2e/roles.spec.ts e2e/api.spec.ts
# 24 passed (38.6 s), exit 0

# Playwright — a11y sweep (10 tests, axe-core WCAG 2.1 AA)
$ PLAYWRIGHT_BROWSERS_PATH=/ bunx playwright test \
    --project=chromium-desktop e2e/a11y.spec.ts
# 10 passed (31.4 s), exit 0

# Playwright — mobile (Pixel 5)
$ PLAYWRIGHT_BROWSERS_PATH=/ bunx playwright test --project=chromium-mobile
# 3 passed (15.1 s), exit 0

# Playwright — tablet (iPad Mini)
$ PLAYWRIGHT_BROWSERS_PATH=/ bunx playwright test --project=chromium-tablet
# 1 passed (10.5 s), exit 0

# Normal benchmark
$ bun run perf
# correctness PASS, budgets PASS, exit 0, 35.8 s
```

Versions: Playwright 1.56.1, `@axe-core/playwright` bundled, Bun 1.3.3,
TanStack Router 1.170.16, Supabase JS 2.110.2.

---

## 5. Defect fixed this slice

**D-QA-001 — Worker-contention flake under sandbox Playwright parallelism.**

- Symptom: `boot.spec.ts::command palette can be opened` timed out at 10 s
  waiting for the `__lovableE2E` bridge to inject the admin actor;
  `navigation.spec.ts` sporadically failed on the same run when workers ≥ 3.
- Root cause: `playwright.config.ts::workers` defaulted to `undefined`
  (Playwright picks CPU-derived count). The shared sandbox dev-server
  saturates and the actor-notify → re-render race exceeds the 10 s poll.
- Fix (this slice): `workers` defaults to `2` outside CI (overridable via
  `E2E_WORKERS`); `boot.spec.ts` adds `waitForLoadState('networkidle')`
  before the bridge poll and extends the poll to 20 s.
- Verification: full matrix re-ran with all 38 tests PASS single-shot,
  0 retries, 0 flakes.

---

## 6. Operator-only remaining work (unchanged from RC1-READINESS.md §5)

1. Set `RATE_LIMIT_ADAPTER=supabase` in the RC-1 environment (W31 / G3).
2. Enable Google OAuth in Cloud auth settings (W32 / G4).
3. Provision fresh `APIClient` rows and retire `APIC-001` (W33 / G5).
4. Take `pre-rc1-baseline` backup via `/admin/backups`; verify
   `/admin/monitoring` and `/admin/deployment` all-green (W34 / G6).

These four gates are the ONLY conditions between "CONDITIONAL GO" and "GO".
The application code, tests, and gates are ready.

---

## 7. Rollback readiness (unchanged from RC1-READINESS.md §6)

- Data: `Repo.exportSnapshot` / `performGovernedRestore` covered by
  harness (W20, W22).
- Audit: SHA-256 hash chain verifiable end-to-end (W24).
- Rate-limit outage: reads `failOpen`, mutations `failClosed`; degraded
  header emitted.
- App rollback: redeploy previous Lovable published build.

---

## 8. Recommendation

**Begin RC-1 Functional QA sessions in CONDITIONAL mode.** All automated
functional checks are green with 0 unresolved failures. Manual/user-driven
QA can proceed against the current build for everything that does NOT
depend on Google OAuth, real external API callers, or the pre-RC1 baseline
backup. Close the four BLOCKED-OPERATOR items above before promoting from
CONDITIONAL GO to GO. Do not treat this report as production launch
attestation, and do not advance to RC-2 without a separate readiness pass.

---

## Appendix — Files touched this slice

- `playwright.config.ts` — `workers` default lowered outside CI (test
  stability, no product behaviour change).
- `e2e/boot.spec.ts` — added `waitForLoadState('networkidle')` and 20 s
  bridge poll (test stability only).
- `docs/RC1-FUNCTIONAL-QA.md` — this report.
- `docs/RC1-FUNCTIONAL-QA.json` — machine-readable results.
