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

- `useAutosave` (`src/hooks/use-autosave.ts`) — debounced save with error/dirty retention.
- `<SaveIndicator />` — unified save-state chip.
- `<KpiCard />` — dashboard/registry metric tile.
- `<EmptyState />`, `<PageHeader />`, `<PublicationStageBadge />` — existing.

Do **not** create additional generic "framework" abstractions. Keep domain-specific
logic in services, not in shared UI.

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
