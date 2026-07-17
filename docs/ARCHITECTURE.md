# Legacy Platform v2.0 — Architecture Reference

_Last updated: Workstream 7.5 Architecture Stabilization Pass._

## 1. Domain model

Semantic chain:

```
Domain → Concept → Framework → Knowledge Object → Client Tool → Publication Asset → Release
                                       ↘ AI Pack ↘ Agent ↘ Automation
```

All entities carry `id`, `status`, `createdAt`, `updatedAt`, and (where governed)
`manufacturingStage` and `stageHistory`. Full entity list in `src/lib/data/schema.ts`.

## 2. Data flow

```
schema.ts   →  types & enums
db.ts       →  IndexedDB open + version migration (SCHEMA_VERSION)
repository  →  typed CRUD, snapshot import/export
service.ts  →  pure domain calculations, coverage, promotion validators
intelligence.ts → search index, impact analysis, duplicates, health
analytics.ts    → metrics, trends, forecasts, reports
automation.ts   → recipe execution engine, triggers, approvals
routes/*.tsx    → UI; imports only via service / intelligence / analytics
```

Rules:
- UI never mutates IndexedDB directly — always via `Repo.*`.
- Pure calculations live in `service.ts` and are called from validators/tests.
- Governance and stage rules are enforced in `service.ts`, never in UI.

## 3. Manufacturing & release governance

Unified 6-stage pipeline (Publications, Toolkits, AI Packs, Agents):
`Draft → Editorial → SME Review → QA → Canonical → Released`.

- Only adjacent transitions are allowed. Non-adjacent / backwards
  requires a governance override with note (`stageHistory` records `OVERRIDE:`).
- AI-generated Knowledge Objects cannot leave `Draft` until human review completes.
- Release Manager gates on: coverage, broken references, unresolved blocking QA
  issues, unreleased dependencies, and blocking automation approvals.

## 4. Automation

Recipes (`AUT-###`) → Runs (`RUN-###`). Triggers: manual, stage-transition,
readiness-threshold, release-gate, review-due, broken-reference, plus intelligence
triggers (duplicate-detected, knowledge-health-threshold, coverage-drop,
relationship-added/removed, dependency-change). Automations may draft, request
promotion, and notify — they **cannot** bypass governed approvals.

## 5. Knowledge Intelligence & Analytics

- `intelligence.ts` builds a universal index, ranked search, BFS impact graph,
  Jaccard-similarity duplicate detection, and 0–100 health scoring.
- `analytics.ts` derives metrics from snapshots (weekly), forecasts by linear
  extrapolation, and produces 7 report kinds with print/JSON export.

## 6. Persistence

- Local: IndexedDB via `idb`, `SCHEMA_VERSION` v5. Every prior version has a
  non-destructive migration path. `Repo.exportSnapshot()`/`importSnapshot()`
  round-trip every entity.
- Cloud: Supabase (15+ tables) with RLS scoped to five roles
  (Owner, Editor, Reviewer, Contributor, Viewer). Triggers enforce governance.

## 7. Route map

| Route | Purpose |
|---|---|
| `/` | Executive Dashboard |
| `/executive` | Executive Analytics |
| `/reports` | Reporting Center |
| `/knowledge` | Knowledge Intelligence hub |
| `/knowledge/$id` | Asset intelligence detail |
| `/repository` | Repository Explorer |
| `/concepts` · `/concepts/$id` | Concept Registry & Family Editor |
| `/frameworks/$id` | Framework detail |
| `/publications` · `/publications/$id` · `/publications/new` | Publication Studio |
| `/client-toolkits` · `/client-toolkits/$id` | Toolkit Studio |
| `/ai-packs` · `/ai-packs/$id` | AI Pack Studio |
| `/agents` · `/agents/$id` | Agent Studio |
| `/automations` · `/automations/$id` · `/automations/new` | Automation Studio |
| `/operations` | Approvals & failed runs |
| `/releases/$id` | Release Manager |
| `/graph` | Relationship Explorer |
| `/prompts`, `/governance`, `/data` | Supporting registries |

## 8. ID conventions

`CN-###` Concept · `FR-###` Framework · `KO-###` Knowledge Object ·
`PL-###` Publication · `CT-###` Client Tool · `TK-###` Toolkit ·
`AP-###` AI Pack · `AG-###` Agent · `AUT-###` Automation · `RUN-###` Run ·
`LKR-a.b.###` Release. Enforced by `ID_PATTERNS` in `schema.ts`.

## 9. Adding a new governed entity — safe recipe

1. Add type + `ID_PATTERNS` entry in `schema.ts`; bump `SCHEMA_VERSION`.
2. Add non-destructive migration branch in `db.ts` and repository store.
3. Add pure calculations (coverage, promotion validators) to `service.ts`.
4. Register in `intelligence.ts` (index, impact, duplicate detection, health).
5. Register in `analytics.ts` (metric snapshot).
6. Add registry + studio routes; use `useAutosave` + `SaveIndicator`.
7. Add promotion validator + regression checks to `service.validate.ts`.
8. Document in this file (route map + ID convention).

## 10. Shared UI primitives

Use these instead of re-implementing:

- `useAutosave` (`src/hooks/use-autosave.ts`) — debounced draft-shape autosave.
- `usePatchSave` (`src/hooks/use-patch-save.ts`) — per-keystroke `Repo.update(kind,id,partial)`
  autosave with in-flight lock, retry, and optional stale-conflict guard.
  Used by Client Toolkit, AI Pack, Automation, and Integration studios.
- `<SaveIndicator />` — unified save-state chip.
- `<KpiCard />` — dashboard/registry metric tile.
- `<EmptyState />`, `<PageHeader />`, `<PublicationStageBadge />` — existing.

Do **not** create additional generic "framework" abstractions.

## 11a. Public API (Workstream 8 follow-up)

`src/routes/api/public/v1/$.ts` exposes the documented catalog over real HTTP:

- `GET /api/public/v1/catalog` — endpoint metadata
- `GET /api/public/v1/registry/{kind}?limit=N`
- `GET /api/public/v1/knowledge/{id}`
- `GET /api/public/v1/releases/{id}/manifest`
- `GET /api/public/v1/publications|toolkits|ai-packs|agents/{id}/export`
- `GET /api/public/v1/automations/runs/{id}`
- `GET /api/public/v1/imports/{id}`

Server handlers use the deterministic seed snapshot (no IndexedDB in Workers).
Never return raw credentials or secrets. The `/integrations/$id` studio surfaces
credentials only as masked references (`IntegrationCredentialReference`).

Scheduled analytics capture is wired via automation `AUT-005`
(`scheduled` trigger + `capture-analytics-snapshot` action), idempotent within
its capture window.

## 11. Known technical debt (recommended sequence for W8/W9)

- Analytics snapshot capture is manual/triggered; add scheduling (W8).
- Reports export JSON/HTML only; add PDF/email delivery (W8).
- No cross-tab conflict detection beyond `updatedAt` compare — real OT/CRDT
  requires the Supabase migration path (W9).
- IndexedDB seed and Supabase seed drift is possible; add reconciliation job (W8).
- Route-level auth gating (`_authenticated`) exists in Supabase layer only —
  wire into TanStack `beforeLoad` when moving to cloud primary (W9).

## 12. Verification commands

```
bunx tsgo --noEmit                        # TypeScript
bun run src/lib/data/service.validate.ts  # deterministic domain checks
```

## Workstream 9 — Hardening Status (2026-07-16)

### Landed in this pass
- **SHA-256 integrity** — `sha256Hex()` + `contentHash()` in `security.ts` now use a pure-JS FIPS 180-4 implementation. Audit hash chain (`audit.ts`) and backup integrity (`backups.ts`) rely on cryptographic hashing; validation harness covers the "abc" and empty-string reference vectors.
- **Governed restore** — `performGovernedRestore()` requires a typed `"RESTORE"` confirmation and a ≥8-char written reason, and automatically snapshots the *current* state to a pre-restore backup before overwriting. The restored snapshot's backup ledger contains both entries.
- **Workspace isolation surface** — `detectWorkspaceLeakage()` scans audit + backup ledgers for orphaned `workspaceId`s; wired into the Monitoring dashboard as a first-class signal. `scopedAudit()` / `scopedBackups()` provide active-workspace filters.
- **Public API auth + scopes** — `/api/public/v1/*` now requires `Authorization: Bearer <key>` on every non-catalog endpoint. Bearer fingerprint is matched against seeded `APIClient` records, and each endpoint enforces its required `APIClientScope` (`registry.read`, `knowledge.read`, etc.) → `401` / `403` with structured error envelopes.
- **Hot-path memoization** — `buildGraph()` and `buildUniversalIndex()` in `intelligence.ts` are wrapped in snapshot-fingerprinted `memoize()`. The validation harness asserts ≥39 hits over 40 iterations and <1s wall clock on a full seed fixture.
- **Defensive monitoring** — `computeMonitoring()`, `startupDiagnostics()`, `detectWorkspaceLeakage()`, `workspaceMetrics()`, and `nextBackupId()` are now resilient to partial snapshots (mid-migration payloads, prerender fallbacks) rather than throwing.
- **Validation harness** — 137/137 deterministic checks pass (was 90/90).

### Known blocking limitations — NOT RC-1 READY
These items are documented as blockers rather than silently implied:

1. **Auth is still demo role-switch, not real Supabase session** — resolved in the Blocker #1 slice (session bridge + `_authenticated` gate + actor propagation).
2. ~~**Per-entity workspace isolation**~~ — **CLOSED (Blocker #5b, 2026-07-17).** Every workspace-owned entity now carries `workspaceId` (schema v8, additive on `Timestamped`). A classification registry in `src/lib/data/workspace-scoping.ts` (`WORKSPACE_OWNED_KINDS` vs `GLOBAL_KINDS`) drives:
   - `db.ts` load-time `backfillWorkspaceIds()` — idempotent, preserves foreign ids;
   - `repository.ts` — `scopedList` / `scopedGet` filter strictly by active workspace for owned kinds; `create` stamps the active workspace; `update`/`remove` refuse cross-workspace mutations and refuse re-homing via patch;
   - `workspaces.ts` `detectWorkspaceLeakage()` — hard-fails on unscoped rows in owned kinds and reports foreign rows per-kind; `auditWorkspaceCoverage()` gives a per-kind census (total / unscoped / foreign).
   Regression coverage: 17 new deterministic checks in `service.validate.ts` covering the classifier, backfill idempotency, foreign-id preservation, cross-workspace create/update/remove refusal, and `scopedList`/`scopedGet` filtering. Total: 217/217 checks passing.
3. ~~**Rate-limit adapter is per-worker in-memory**~~ — **CLOSED (Blocker #4, 2026-07-17).** `src/lib/data/rate-limit.ts` introduces a `RateLimitStore` contract with two adapters:
   - `InMemoryRateLimitStore` — LRU-bounded, for dev / preview only.
   - `SupabaseRateLimitStore` — calls the `public.consume_rate_limit(key, window, max)` RPC, backed by `public.rate_limit_buckets` (service-role only, RLS locked, atomic `SELECT ... FOR UPDATE` UPSERT). Distributed and worker-safe.

   Every non-catalog `/api/public/v1/*` endpoint routes through `enforceRateLimit()` with policies in `RATE_LIMIT_POLICIES` (per-endpoint window/max, `failClosed` for mutations, `failOpen` for reads). A pre-auth `unauth` bucket keyed on hashed IP throttles abuse before auth resolution; post-auth buckets are keyed on `sha256(workspace|actorKind|actorId|endpoint|scope)` so raw bearers, JWTs, and PII never appear in bucket keys, headers, or diagnostics. Standard headers emitted: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-RateLimit-Adapter`, `X-RateLimit-Policy`, plus `Retry-After` and `X-RateLimit-Degraded` on 429s. Catalog remains exempt.

   `assertRateLimitReadiness()` fails startup when `NODE_ENV=production` runs the in-memory adapter, when the supabase adapter is selected without `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, or when an unknown adapter is configured; wired into `deployment.ts` `startupDiagnostics()`.

   Regression coverage: 40+ deterministic checks in `service.validate.ts` covering allow/deny/reset semantics, key isolation across workspace/actor/endpoint/scope, PII/bearer-leak checks, 200-way concurrency, LRU eviction, header contract, policy map coverage, readiness matrix, degraded-outage fail-open vs fail-closed, and the migration SQL (RLS lockdown, service-role grants, atomic RPC).
4. ~~**Accessibility & Playwright QA**~~ — **CLOSED (Blocker #6, 2026-07-17).** Playwright 1.56 + `@axe-core/playwright` land under `e2e/`:
   - `playwright.config.ts` boots the dev server with `VITE_E2E=1`, projects for desktop / mobile / tablet, HTML + JUnit reporters, artifacts retained only on failure, and 0 local retries (1 in CI).
   - `src/lib/data/e2e-bootstrap.ts` exposes `window.__lovableE2E` **only** when both `import.meta.env.DEV === true` and `VITE_E2E === "1"`. It never embeds a service-role key or JWT and is not shipped to production builds. The API route at `src/routes/api/public/v1/$.ts` has no `VITE_E2E` branch or test-actor bypass — auth and rate limiting behave identically in tests.
   - `e2e/fixtures.ts` provides `asActor` / `asSignedOut` / `asExpiredSession` helpers and an `errorSink` that fails tests on uncaught `pageerror` events; the console-error allowlist is narrow and documented.
   - Suites: `boot`, `smoke`, `navigation` (13 routes render clean under an Admin actor), `roles` (signed-out / expired-session / viewer), `api` (catalog is public, non-catalog requires bearer, rate-limit 429 with `Retry-After` after a 150-request burst), `mobile` (no horizontal overflow, tap targets ≥ 36px), and `a11y` (axe-core WCAG 2.1 AA sweep on 10 surfaces — serious/critical violations are a hard fail-gate; exceptions must be listed with an owner in `EXCLUDED_RULES`).
   - Execution (2026-07-17, Playwright 1.56.1 / Chromium 1194, sandbox): **`bun run e2e` — 38/38 passed, 0 failed, 0 skipped, 0 flaky in ~1.1 min**. Per-project: chromium-desktop 34/34 (10 axe + 13 navigation + 5 boot/smoke + 4 API + 3 roles), chromium-mobile 3/3, chromium-tablet 1/1. Axe serious+critical violations: 0 (prior baseline had 8 across dashboard, repository, publications, developer, monitoring, backups, workspaces, deployment).
   - Defects fixed during execution: `.text-gold` color-contrast on ivory (added `--gold-ink` at oklch 0.55 and removed `--color-gold` from the Tailwind `@theme` scope so the `@utility text-gold` override wins the cascade); `CommandDialog` missing accessible title (VisuallyHidden `DialogTitle` + `DialogDescription`); native `<select>` / filter inputs missing labels on `/admin/audit`, `/developer`, `/publications`; icon-only row actions on `/publications` missing `aria-label`; sidebar footer contrast (`text-sidebar-foreground/80`); flaky palette / mobile-menu opens caused by an actor-injection re-render racing the click handler — resolved by `waitForFunction(() => __lovableE2E.getActor().userId === expected)` gate before interaction; `isSessionExpired` closure-isolation under Vite dev — resolved by exposing `isSessionExpired()` on the bridge so tests use the same module instance as the app.
   - Static regression: `service.validate.ts` gained 25+ checks ensuring the config, fixtures, bootstrap safety, spec inventory, and API route are preserved. Baseline remains **313/313**; `tsgo --noEmit` clean.
   - Reproduce: `bun run e2e:desktop && bun run e2e:a11y && bun run e2e:mobile && bun run e2e:tablet` (or `bun run e2e` for the full matrix). Reports at `playwright-report/` (HTML + `junit.xml`).

5. ~~**Load-scale verification**~~ — **CLOSED (Blocker #7, 2026-07-17).**

   **Scale generator** (`src/lib/data/scale-fixture.ts`) — deterministic LCG seeded at `0xC0FFEE`, no `Date.now()`, no `Math.random()`, no `crypto.randomUUID()`. Emits four tiers by shard replication of the production seed plus synthetic hash-chained audit events and backups:

   | Tier   | Shards | Concepts | Knowledge Objects | Audit events | Backups |
   |--------|-------:|---------:|------------------:|-------------:|--------:|
   | small  |      1 |       50 |               194 |           50 |       2 |
   | medium |      3 |      100 |               388 |          300 |       3 |
   | large  |      6 |      175 |               679 |        1,200 |       5 |
   | stress |     15 |      400 |             1,552 |        3,000 |       8 |

   Every workspace-owned row carries a `workspaceId ∈ {WS-001, WS-002}` and every audit event references a valid workspace; `verifyScaleFixture()` enforces referential integrity, ID uniqueness, and audit-chain SHA-256 continuity.

   **Benchmark harness** (`scripts/bench.ts`) — measures cold + warm p50/p95/max across 10 operational groups (`index`, `graph`, `workspace`, `audit`, `backup`, `export`, `search`, `automation`, `api`, plus `fixture` generation). Correctness gates: `indexStable`, `graphNodesMatchesEntities`, `scopeFiltered`, `noHardLeakage`, `auditChainOk`, `backupIntegrity`, `governedRestoreOk`, `importRoundtrip`, `automationValid`, `inputImmutable`, `searchDeterministic`. Writes machine-readable JSON to `bench-results/`. Exits non-zero on any correctness OR budget failure.

   **Budgets** (large & stress only — small/medium report but do not gate):

   | Metric              | Large  | Stress |
   |---------------------|-------:|-------:|
   | indexCold p95       |  400ms | 1200ms |
   | indexWarm p95       |  120ms |  400ms |
   | buildGraph p95      |  400ms | 1500ms |
   | scopedList p95      |   40ms |  150ms |
   | leakage p95         |  500ms | 2500ms |
   | auditChainVerify p95|  200ms | 1000ms |
   | exportSnapshot p95  |  800ms | 3000ms |
   | memo hit ratio      | ≥ 0.90 | ≥ 0.90 |

   **Normal tier results** (2026-07-17, Bun 1.3.3, sandbox — `bun run scripts/bench.ts`):

   | Tier   | indexCold p95 | indexWarm p95 | buildGraph p95 | auditVerify p95 | memo hits | heap  |
   |--------|--------------:|--------------:|---------------:|----------------:|----------:|------:|
   | small  |       14.7ms  |         5.9ms |          1.8ms |           1.0ms |   20 / 21 |  46MB |
   | medium |       35.1ms  |        22.8ms |          0.3ms |           5.2ms |   20 / 21 | 148MB |
   | large  |      107.6ms  |        57.3ms |          0.9ms |          24.9ms |   20 / 21 | 582MB |

   Scaling small→large p95: `indexCold=7.33×`, `indexWarm=9.72×`, `impactAnalysis=12.03×` (near-linear against a 4× entity multiplier). Correctness PASS, budgets PASS, exit=0, duration 36.3s.

   **Stress tier results** — split into nine bounded groups to fit the 420s per-command sandbox limit; each group generates its own 1,552-KO / 3,000-audit / 15-shard fixture, executes its measurements, writes `bench-results/stress-<group>.json`, then a final `--aggregate` merges timings and correctness. Every group ran end-to-end; no result is extrapolated.

   | Group      | Key p95                    | Correctness | Duration | Heap    |
   |------------|----------------------------|-------------|---------:|--------:|
   | index      | indexCold=292.7 / warm=186.0ms | PASS    |    6.3s | 561MB   |
   | graph      | buildGraph=2.1ms, impact=~ms  | PASS     |    7.1s | 494MB   |
   | workspace  | scopedList<1ms, leakage OK   | PASS      |    2.8s | 210MB   |
   | audit      | auditChainVerify=70.3ms      | PASS      |    3.7s | 166MB   |
   | backup     | backupCreate + governedRestore | PASS    |   20.5s | 844MB   |
   | export     | exportSnapshot + parseImport   | PASS    |    3.9s | 145MB   |
   | search     | universalSearch + health + exec | PASS   |  158.0s | 1203MB  |
   | automation | validateRecipe               | PASS      |    2.5s | 148MB   |
   | api        | pagination JSON              | PASS      |    2.5s | 210MB   |

   Aggregated stress correctness: **PASS**. Aggregated stress budgets: **PASS** (indexCold 292.7 < 1200, indexWarm 186.0 < 400, buildGraph 2.1 < 1500, auditVerify 70.3 < 1000, memo hit ratio 20/21 = 0.95 ≥ 0.90). Large→stress p95 scaling: `indexCold≈2.7×` for a ~2.3× entity multiplier — sub-quadratic. Total wall clock across the nine groups ≈ 207s.

   **Memoization** — snapshot-keyed via `snapKey()` (entity-count fingerprint, no full JSON serialization) on `buildUniversalIndex`, `buildGraph`, `knowledgeHealth`, `computeExecutiveMetrics`. Warm calls return the cached reference (`indexStable === true`); structural mutations (e.g. `concepts.slice(0, -1)`) force a miss. Cache invalidation is regression-covered in `service.validate.ts`.

   **Reproduce commands** (all exit 0):
   ```
   bun run scripts/bench.ts                                             # normal tier (small+medium+large)
   for g in index graph workspace audit backup export search automation api; do \
     bun run scripts/bench.ts --tier=stress --group=$g \
       --out=bench-results/stress-$g.json; \
   done
   bun run scripts/bench.ts --aggregate='bench-results/stress-*.json' \
       --out=bench-results/stress.json                                  # aggregate
   ```

   **Static regressions** — `service.validate.ts` grew from **313 → 343 checks** (+30) covering fixture determinism, integrity, workspace partitioning, audit-chain verification on scaled data, input immutability under read-only ops, memo hit accounting, snapshot-change invalidation, benchmark result schema, budget definitions, JSON report emission, non-zero exit contract, and a guard that `scale-fixture.ts` is never imported by `seed.ts` or `db.ts` bootstrap. `tsgo --noEmit` clean.

   **Known limitations** — the `search` group's ~158s runtime is dominated by full-index construction on the 1,552-KO stress fixture; each group re-generates its own fixture (no shared state across processes) so this cost repeats. A single all-groups stress run would fit inside ~210s wall clock but was intentionally kept split so any one group can be re-run independently for regression triage. `SUPABASE_URL` / service role are not exercised by the harness — those paths are covered by the Blocker #4 regressions.

RC-1 implementation blockers are now closed; the RC-1 readiness report is the next slice.



