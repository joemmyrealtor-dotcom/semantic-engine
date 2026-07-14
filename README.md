# Legacy Platform v2.0 — JM Advisory Press

The next-generation Legacy Project Digital Knowledge Platform. Canonical concepts, frameworks, publications, governed prompts, and release management for the Legacy Homebuyer body of work.

> **Local demo build.** All persistence is IndexedDB in the user's browser. No real AI provider, authentication, or cloud service is wired up. Every AI-generated artifact is produced by deterministic local templates and clearly labeled.

## Modules

1. **Executive Dashboard** — repository KPIs, release readiness, next actions, recent activity.
2. **Repository Explorer** — Domains, Concepts, Frameworks, Knowledge Objects, Client Tools, Publications, Prompts, Agents, Releases.
3. **Concept Editor** — enforces canonical fields, permanent ID pattern, and duplicate detection.
4. **Framework Workspace** — mission, decision, governing concepts, maturity, coverage meter, alignment warnings.
5. **Knowledge Object Factory** — deterministic local drafts from approved Concepts + Frameworks.
6. **Relationship Graph** — upstream/downstream focus mode, broken-reference detection.
7. **Publication Builder** — chapter blueprints CH-005, CH-006, CH-007, CH-015 under PL-101.
8. **Client Tool Generator** — Draft worksheets, checklists, decision aids with source traceability.
9. **Prompt & Agent Registry** — CRUD for governed prompts (7 families) and agent profiles.
10. **Release Manager** — gate checklist (LKS-001, LRC-001, RES-001, POL-001), stages, manifest, changelog.
11. **Governance Center** — standards summaries, compliance checklist, maturity model.
12. **Import / Export** — JSON backup/restore, seed reset, validation report.

## Entity Model (`src/lib/data/schema.ts`)

`Domain → Concept → Framework → KnowledgeObject → ClientTool → PublicationBlueprint → Release`

Plus `Prompt` and `Agent` registries. Every entity carries `id`, `status`, `version`, `steward`, timestamps. Permanent ID patterns are enforced (`DOM-###`, `CR-DDD-###`, `F-###`, `KO-######`, `W|C|DT-###`, `PL-###`, `CH-###`, `PR-###`, `AG-###`, `LKR-#.#.###`).

## Repository Layer

- `src/lib/data/db.ts` — IndexedDB wrapper (via `idb`), schema versioning, seed hydration.
- `src/lib/data/repository.ts` — typed `Repo` façade with `list / get / create / update / remove / replaceAll / reset` and subscription-based reactivity (`useSnapshot` hook).
- `src/lib/data/service.ts` — cross-entity operations: relationship graph, broken-reference detection, framework coverage, coverage-gap detection, draft KO / Client Tool generation, release gate evaluation, import/export.
- `src/lib/data/auth.ts` — centralized role stub (`Owner | Editor | Reviewer | Contributor | Viewer`) with `can(action)`. Future integration point for real auth.

Routes never touch `localStorage` or IndexedDB directly — they call the `Repo` façade or `useSnapshot()`.

## Seed Baseline

10 Domains · 25 canonical Concepts (Financial Readiness, Mortgage & Financing, Offer Strategy) · 10 Frameworks (F-010 reserved) · 60+ Knowledge Objects (canonical definitions + Offer Strategy teaching set) · 5 Client Tools (W-025, W-026, C-025, C-026, DT-014) · PL-101 with CH-005/006/007/015 · 10 Prompts · 5 Agents · release **LKR-1.0.001** (0 blocking errors, 5 alignment warnings).

## Future Supabase Migration Path

Because all data access flows through `Repo`, migrating to Supabase requires only two changes:

1. Replace `src/lib/data/db.ts` with Supabase client calls (one table per entity, mirroring `DataSnapshot` keys).
2. Convert `Repo` methods to `async` Supabase queries; the subscription bus already supports remote invalidation.

RLS policies should be authored against the `Role` enum in `auth.ts` — the `can()` matrix is the source of truth for allowed actions.

## AI Provider Adapter Points

Local drafts are produced by `generateDraftKnowledgeObjects` and `generateDraftClientTool` in `service.ts`. To wire in a real provider (e.g. Lovable AI Gateway):

1. Convert those functions to `createServerFn` handlers that call the gateway.
2. Preserve the `promptId` linkage — every generated artifact must record its prompt of record and source manifest (already enforced by the schema).
3. Keep `humanReviewRequired: true` and `status: "Draft"` on any AI output. Promotion to Canonical must remain gated by recorded human review under LKS-001 / POL-001.

## Security Expectations

- No secret should ever ship to the client. When migrating to real services, keep provider keys server-side and use signed webhook secrets for external callbacks.
- User roles must be stored in a dedicated table (not on profile records) with a `SECURITY DEFINER` `has_role()` function guarding RLS. See Lovable Cloud user-roles guidance.
- All AI-generated artifacts must remain labeled and traceable.

## Production-Hardening Checklist

- [ ] Replace IndexedDB layer with Supabase; author RLS policies matching `auth.ts` matrix.
- [ ] Enforce server-side ID uniqueness constraints on all `id` columns.
- [ ] Wire real authentication and replace the role stub.
- [ ] Move draft generation to server functions backed by a real provider; keep prompt-of-record and source manifest.
- [ ] Add audit log table capturing status transitions and steward on every change.
- [ ] Add scheduled review-cadence job that flags Canonical objects past their `reviewCadenceMonths`.
- [ ] Add automated release-gate CI (schema conformance, broken reference count, coverage gaps).
- [ ] Add SSO for Editorial Board and enforce Owner-only release promotion.
- [ ] Add per-environment export/import gating so production restores require confirmation.
- [ ] Add observability (error tracking, request logging) and rate limiting on all mutating endpoints.

## Development

```
bun install
bun run dev
```

Data persists in the IndexedDB database `legacy-platform-v2`. Use **Import / Export → Reset to seed** to restore the baseline at any time.
