## Legacy Platform v2.0 — Build Plan

A production-ready TanStack Start + React + TypeScript app for JM Advisory Press, with a typed IndexedDB-backed repository layer, editorial design system, and 12 modules seeded with the specified baseline data.

### Design System
- Tokens in `src/styles.css` (oklch equivalents of Heritage Navy `#0B1F3A`, Champagne Gold `#C8A052`, Ivory `#F8F5EC`, Slate `#4E5A66`, Evergreen `#2F6B4F`).
- Serif display (Fraunces) + humanist sans (Inter) via `<link>` in `__root.tsx`.
- Custom shadcn variants: `heritage`, `gold`, `evergreen`; status/version/canonical badges; editorial card + section shells.

### Data Layer (`src/lib/data/`)
- `schema.ts` — typed entities: Domain, Concept, Framework, KnowledgeObject, ClientTool, PublicationBlueprint, Prompt, Agent, Release, plus enums (Status, ObjectType, PromptFamily, ReleaseStage, Role).
- `db.ts` — IndexedDB wrapper (idb) with schema version, stores per entity, migration hooks.
- `repository.ts` — generic `Repository<T>` (list/get/create/update/remove/query) + entity-specific repos with validators (ID format, duplicate canonical warn).
- `seed.ts` — full baseline: 10 Domains, 25 Concepts, 10 Frameworks, 60+ KOs, tools W-025/W-026/C-025/C-026/DT-014, PL-101 blueprints CH-005/6/7/15, PR-001..010, AG-001..005, release LKR-1.0.001.
- `service.ts` — cross-entity operations: relationship graph, broken-ref detection, KO factory (deterministic local generation), release gate evaluation, coverage-gap detector, import/export JSON, reset.
- `auth.ts` — role stub (`useCurrentRole`, `can(action, entity)`).

### Routes (`src/routes/`)
- `__root.tsx` — shell with sidebar nav, command palette (⌘K), global search, error boundary, head metadata (real title/desc/og).
- `index.tsx` — Executive Dashboard (KPIs, recent activity, next actions, release readiness).
- `repository.tsx` + tabs for `domains`, `concepts`, `frameworks`, `knowledge-objects`, `client-tools`, `publications`, `prompts`, `agents`, `releases` (sortable table + detail drawer).
- `concepts.$id.tsx` — Concept Editor with full field enforcement + duplicate warnings.
- `frameworks.$id.tsx` — Framework Workspace (maturity, coverage meter, alignment warnings).
- `knowledge-objects.new.tsx` — KO Factory (source pick → deterministic drafts → review).
- `graph.tsx` — Relationship Graph (SVG force-lite + list hybrid, focus mode, broken-refs).
- `publications.$id.tsx` — Publication Builder (assembly, coverage-gap, manifest).
- `client-tools.new.tsx` — Client Tool Generator.
- `prompts.tsx`, `agents.tsx` — Prompt & Agent Registry CRUD.
- `releases.$id.tsx` — Release Manager (manifest, changelog, gate checklist LKS-001/LRC-001/RES-001, stages).
- `governance.tsx` — Governance Center (LKS-001, LRC-001, RES-001, POL-001 summaries + maturity model).
- `data.tsx` — Import/Export JSON + validation + reset.

### Shared Components (`src/components/`)
- `app-shell.tsx`, `app-sidebar.tsx`, `command-palette.tsx`, `page-header.tsx`, `kpi-card.tsx`, `status-badge.tsx`, `entity-table.tsx`, `detail-drawer.tsx`, `empty-state.tsx`, `loading-state.tsx`, `error-state.tsx`, `relationship-list.tsx`.

### Quality
- Loading/empty/error states everywhere.
- All-local, no external calls; AI-generated content clearly labeled "Local demo draft".
- README (`README.md`) documenting entity model, repo interfaces, Supabase migration path, AI adapter points, security expectations, production checklist.
- tsgo typecheck pass before finishing.

### Not included / explicit assumptions
- No real AI, auth, or cloud persistence — labeled as local demo per spec.
- Graph is a lightweight SVG + adjacency list (not a heavy graph library) to keep bundle small and SSR-safe.
- Content beyond specified IDs (concept definitions, 60+ KOs) is written to be plausible editorial placeholder clearly styled as canonical seed content.
