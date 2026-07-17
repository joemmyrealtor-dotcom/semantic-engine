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
3. **Rate-limit adapter is per-worker in-memory** — `bindRateLimiter()` provides the injection point; a Redis/Durable-Object/Supabase adapter must be supplied before public traffic.
4. **Accessibility & load-scale QA** — Playwright a11y sweep, virtualization of admin tables, and a 10× seed load test are not covered in this pass.

Do not claim RC-1 readiness while any of items 3–4 remain open.
