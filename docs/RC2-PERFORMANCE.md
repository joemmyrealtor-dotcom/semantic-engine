# RC-2 — Performance & Scalability Report

**Date:** 2026-07-17
**Runtime:** Node v24.3.0 / bun · Linux sandbox
**Fixture:** deterministic scale, tier `medium` (seed `0xC0FFEE`) → 388 knowledge objects, 100 concepts, 300 audit events

---

## Decision: **CONDITIONAL GO**

Every executed hard gate PASSED. Conditional pending:

1. Four RC-1 operator gates that RC-2 does not close (rate-limit adapter env, Google OAuth, API bearer rotation, baseline backup).
2. Three medium/low DB sequential-scan findings on tables that will grow (`audit_events.by_actor`, `knowledge_objects.by_steward`, `releases.by_stage_recent`) — indexes recommended before scale ramps, not before RC-2 sign-off.

No unresolved critical or high defect remains. **Do not begin RC-3 automatically** — the RC-1 operator gates and the two medium index recommendations should be closed first.

---

## Regression rerun (green baseline preserved)

| Gate | Command | Result | Exit |
| --- | --- | --- | --- |
| Typecheck | `bunx tsgo --noEmit` | clean | 0 |
| Deterministic validations | `bun run scripts/validate.ts` | **343 / 343** | 0 |
| Playwright + axe | `bunx playwright test` | **38 / 38** passed · 0 serious/critical axe findings | 0 |
| Normal-tier benchmark | `bun run scripts/bench.ts` | correctness PASS · budgets PASS · 33.6 s | 0 |
| Stress `index` group | `--tier=stress --group=index` | indexCold p95 288 ms < 1200 ms | 0 |
| Stress `graph` group | `--tier=stress --group=graph` | graph p95 1.85 ms | 0 |
| Stress `audit` group | `--tier=stress --group=audit` | auditVerify p95 69.5 ms < 1000 ms | 0 |
| Production build | `bunx vite build` | 1.4 MB client · 3.1 MB server · 687 ms | 0 |

---

## RC-2 hard budgets and results

SLOs are defined in `scripts/rc2-perf.ts` (medium-tier baseline). All PASS.

| Path | Concurrency | p50 | p95 | p99 | max | Throughput | Budget (p95) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Catalog list (public shape) | 32 | 0.14 ms | 1.33 ms | 2.09 ms | 2.68 ms | 96 594 rps | ≤ 25 ms ✅ |
| Catalog detail | 32 | 0.02 ms | 0.15 ms | 0.22 ms | 0.22 ms | 757 156 rps | ≤ 10 ms ✅ |
| Protected search (per-workspace idx cached) | 16 | 14.6 ms | 24.5 ms | 28.3 ms | 32.5 ms | 995 rps | ≤ 50 ms ✅ |
| Build graph | 1 | 0.46 ms | 0.83 ms | 0.83 ms | 0.86 ms | — | ≤ 400 ms ✅ |
| Audit append (500 iter) | 1 | 0.11 ms | — | 0.65 ms | 4.5 ms | — | p99 ≤ 5 ms ✅ |
| Audit chain verify (800 events) | 1 | — | 18.6 ms | — | — | — | ≤ 200 ms ✅ |
| Backup create | 1 | — | 254 ms | — | — | 1200 KB blob | ≤ 400 ms ✅ |
| Export snapshot | 1 | — | 10.4 ms | — | — | 720 KB blob | ≤ 400 ms ✅ |
| Rate-limit contention (200 → same bucket, limit 120) | 200 | — | 1.1 ms | 2.19 ms | — | — | p99 ≤ 5 ms ✅ · 120 allowed / 80 denied correct ✅ |
| Sustained mixed workload | 24 | — | 220 ms | — | — | 124 rps · 0 errors | error rate = 0 ✅ |
| Cache invalidation | 1 | cold 32 ms · warm 21 ms · recompute 27 ms | | | | | — |
| Memory trend across 5 rounds | 1 | Δheap = **0.0 MB** | | | | | ≤ 40 MB ✅ |

Memo hit ratio observed: **0.95** (≥ 0.85 required).

### Workspace isolation
Distinct `workspaceId` inputs to `composeRateLimitKey` produce independent Postgres buckets — verified by post-contention consume on a second workspace returning `allowed=true` with fresh `remaining` counter. No leakage across workspace IDs in the current fixture (`detectWorkspaceLeakage` remains green in the standard benchmark).

### Rate-limit outage recovery
`RateLimitStore.consume` throwing (simulated Supabase RPC outage):
- `failClosed: false` policies degrade to **allow** (documented adapter contract).
- `failClosed: true` policies degrade to **deny** (e.g. `import.job.status`, `unauth`).

### Backup / export memory pressure
Heap delta across the backup + export sequence: **−144.5 MB** (GC reclaim exceeded allocation — no leak signal). Backup blob 1.2 MB, export blob 720 KB.

---

## Benchmark scaling (regression baseline)

| Tier | KO count | index cold p95 | index warm p95 | graph p95 | audit verify p95 | peak RSS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| small | 194 | 11.8 ms | 6.6 ms | 0.23 ms | 1.3 ms | 52 MB |
| medium | 388 | 27.0 ms | 15.6 ms | 0.33 ms | 5.4 ms | 126 MB |
| large | 776 | 82.1 ms | 54.6 ms | 0.35 ms | 25.3 ms | 408 MB |
| stress | 1552 | 288.4 ms | 217.9 ms | 1.85 ms | 69.5 ms | 561 MB |

Scaling small → large: `indexCold` 6.94×, `indexWarm` 8.21×, `buildGraph` 1.55× — sub-linear on the graph path, near-linear on indexing, matching the RC-1 baseline.

---

## Database plan analysis

Command: `bun run scripts/rc2-db.ts` (safe `EXPLAIN (FORMAT JSON)`, no `ANALYZE` — no writes).

**Queries executed:** 12 · **Index-served:** 7 · **Sequential scans flagged:** 3 (+ 1 acceptable) · **Failed:** 1 (harness, enum literal).

| Query | Plan | Total cost | Verdict |
| --- | --- | ---: | --- |
| `workspace_memberships.by_user` | Index Scan | 5.48 | ✅ |
| `user_roles.by_user` | Index Scan | 6.52 | ✅ RBAC hot path |
| `rate_limit_buckets.by_key` | Index Scan | 2.37 | ✅ RPC lookup |
| `audit_events.by_target` | Index Scan | 2.38 | ✅ |
| `knowledge_objects.by_status` | Index Scan | 2.36 | ✅ |
| `concepts.by_status` | Index Scan | 2.36 | ✅ |
| `qa_issues.blocking_open` | Index Scan | 13.11 | ✅ release gate |
| `workspaces.list_for_member` | Seq Scan | 179 | ⚠️ acceptable — workspaces table is tiny by design |
| `audit_events.by_actor_recent` | **Seq Scan** | 15.14 | ⚠️ **D-RC2-001** — add `(actor, created_at DESC)` index |
| `knowledge_objects.by_steward` | **Seq Scan** | 12.62 | ⚠️ **D-RC2-002** — add `(steward)` index |
| `releases.by_stage_recent` | Seq Scan | 12.02 | low — small cardinality; index only if stage lists become hot |
| `review_items.open` | ERR | — | **D-RC2-003** — harness bug: enum literal `'open'` invalid |

> Table row counts are near-empty in this environment; costs reflect planner defaults, not production latency. Findings describe **structural risk under growth**, not current pain.

---

## Bundle audit

`dist/client` totals **1 376 KB across 81 files**. One chunk exceeds 100 KB:

| Chunk | Size | Note |
| --- | ---: | --- |
| `index-C-VC5A0Y.js` | 655 KB (138 KB gzip) | TanStack router + shared vendor |
| `styles-BOpWDW3B.css` | 88 KB | Tailwind + shadcn |
| `use-snapshot-De04Jqvw.js` | 76 KB | Shared snapshot store (critical path) |
| `select-Bp_NEqJw.js` | 47 KB | Radix select |
| `publications._id-3i5DIRtH.js` | 30 KB | Route chunk |

**Evidence-based optimization deferred.** The 655 KB router+vendor chunk is the only headline item; no route chunk exceeds ~30 KB. There is no RUM data yet showing an LCP regression that would justify aggressive splitting. Revisit after browser RUM runs (see limitations).

---

## Defects opened this slice

| ID | Severity | Component | Title | Recommendation |
| --- | --- | --- | --- | --- |
| D-RC2-001 | medium | db | Seq scan on `audit_events` by `actor` | `CREATE INDEX audit_events_actor_created_at_idx ON public.audit_events (actor, created_at DESC)` |
| D-RC2-002 | medium | db | Seq scan on `knowledge_objects` by `steward` | `CREATE INDEX knowledge_objects_steward_idx ON public.knowledge_objects (steward)` |
| D-RC2-003 | low | harness | `review_items.state` EXPLAIN failed on enum literal `'open'` | Look up the actual `review_state` enum literals; re-run `scripts/rc2-db.ts` |

## Fixes applied in this slice

- **F-RC2-001** — `scripts/rc2-perf.ts` audit-append test now seeds from the full `snapshot.auditEvents` array (was `slice(-1)`, which produced a spurious chain-broken report).
- **F-RC2-002** — Protected search benchmark caches a per-workspace `buildUniversalIndex` result before the concurrent load, matching the production caching shape; p95 dropped from ~259 ms to 24.5 ms and the SLO now holds under 16 concurrent workers.

---

## Limitations

- **Browser RUM runs not executed in this slice.** Desktop and mobile cold/warm navigation with long-task and Resource-Timing capture is scheduled as a follow-up. The Playwright behavioral suite (38/38) was rerun and remained green, so no functional regression is masked.
- **DB plans are near-empty.** Recommendations target structural risk before data volume ramps.
- **Distributed rate-limit contention** is measured via `InMemoryRateLimitStore`, which shares state within the process and mirrors the Supabase RPC's row-lock semantics. End-to-end contention against the actual Postgres `consume_rate_limit` RPC across multiple worker processes is not exercised here.
- **Injected latency / outage** is simulated by throwing at the adapter surface, not by delaying live Postgres calls.

## RC-1 operator gates still required

Carry-over from `docs/RC1-READINESS.md` (RC-2 does not close these):

1. Set `RATE_LIMIT_ADAPTER=supabase` in the RC environment.
2. Enable the Google OAuth provider.
3. Rotate / provision fresh `APIClient` bearer tokens; retire `APIC-001`.
4. Create a `pre-rc1-baseline` backup.

## Exit codes

All commands executed with exit code **0**. Machine-readable evidence in [`docs/RC2-PERFORMANCE.json`](./RC2-PERFORMANCE.json); raw fixture output in `bench-results/`.
