# Launch Closure — Production Cutover Rehearsal

**Mode:** rehearsal — no production data mutated.
**Decision:** **CONDITIONAL GO (Phase 3 closed)** — every automatable regression check green; H1–H4 remain BLOCKED-OPERATOR pending real runtime operator evidence. Production promotion is server-authoritative and hard-locked in `/admin/deployment` and `/admin/cutover` until `computeReadinessServer` reports `ready:true`. GA is **not** claimed.

---

## Phase 3 closure (this turn)

| Area | Result |
|---|---|
| **Persisted `api_clients`** (Supabase, prior turn) | Table + RLS + append-only trigger + workspace scoping in place; `src/lib/api-clients.functions.ts` governs owner-only mutations via `requireSupabaseAuth`; H3 server verifier authoritatively requires APIC-001 disabled/deleted **and** at least one enabled non-demo client (see `src/lib/launch-gates.functions.ts` H3 branch). |
| **Server-authoritative promotion** | `/admin/deployment` and `/admin/cutover` render `AuthoritativeGatesPanel` as sole promote source. Client-local IndexedDB evidence is quarantined under a labeled "Diagnostic only" section and can never unlock the promote button. |
| **Authenticated server-path test (new)** | `e2e/launch-closure.spec.ts` — `deployment page issues a real server-fn RPC and server rejects unauthenticated caller` observes the actual `/_serverFn` POST, asserts the RPC fires, the response body carries an `Unauthorized` payload (no `"ready":true`), and the UI stays DIAGNOSTIC ONLY + LOCKED + promote disabled. Confirms the promote path cannot be unlocked from the browser without a real Supabase bearer. |
| **Auth/session reactivity** | `src/lib/data/session-bridge.ts` uses `useSyncExternalStore(subscribeActor, getActor, getActor)`; verified in application code — the full Playwright suite (44/44) passes with no reload / no reinject workaround. |

### Regression re-run (this turn)

| Check | Command | Result |
|---|---|---|
| Typecheck | `bunx tsgo --noEmit` | exit 0 |
| Validations | `bun run scripts/validate.ts` | **356/356 OK** |
| Playwright + axe | `bunx playwright test` | **44 passed** · 0 serious/critical |
| Production build | `bun run build` | exit 0 · Nitro emit clean |
| RC-2 perf | `bun run scripts/rc2-perf.ts` | budgets **PASS** (10007 ms) |
| RC-2 db | `bun run scripts/rc2-db.ts` | 12 queries · 0 errors · seq-scan set unchanged from RC-2 baseline |
| RC-3 RLS | pg_policies recheck | policies + append-only trigger unchanged; no new SECURITY DEFINER findings |

## Hardening pass — phases 1 + 2 delivered

### Phase 1 (previous turn)

### Phase 1 (previous turn)
| Change | Result |
|---|---|
| **Migration** — durable `public.launch_gate_evidence` ledger (append-only via trigger, RLS-gated to workspace members for read, no client write path, indexes on `(workspace, gate, version DESC)` and active-row partial index) | 62 policies · 20 RLS-enabled tables · trigger `enforce_gate_evidence_append_only` is not SECURITY DEFINER (0 new lint findings) |
| **Session-subscription race** fixed at the application layer via `useSyncExternalStore(subscribeActor, getActor)` | Playwright launch-closure spec stable at 41/41 with no reload/reinject workaround |
| **rc2-db harness** — `review_items` probe corrected to `state='Pending'` | 12/12 clean, 0 errors |

### Phase 2 (this turn) — server-authoritative verification
| Change | Result |
|---|---|
| **`src/lib/launch-gates.functions.ts`** — three authenticated server functions using `requireSupabaseAuth`: `listGateEvidenceServer` (RLS-scoped read as caller), `attestGateServer` (workspace-membership + workspace-role check via existing RLS SECURITY DEFINER helpers, then server-side verifier run **before** any write, then service-role insert since RLS denies all direct client writes), `computeReadinessServer` (durable readiness snapshot with server-computed build fingerprint for stale detection) | Typecheck exit 0; the write path for PASS evidence is now unreachable from any client code |
| **Server-side verifier** for each gate reads `process.env` at call time — H1 checks `RATE_LIMIT_ADAPTER=supabase`, H2 checks `SUPABASE_AUTH_GOOGLE_ENABLED` / `AUTH_GOOGLE_ENABLED`, H3 checks `API_BEARER_ROTATED`, H4 requires `BASELINE_BACKUP_ID` and probes `workspaces` reachability | Verifier refuses `PASS` unless it returns ok — enforced server-side, not client-side |
| **Automatic re-locking** — `computeReadinessServer` recomputes the build fingerprint from live env on each call; any active row whose fingerprint no longer matches surfaces as `STALE`, and `blockingGateIds` includes every non-`PASS` gate | Stale evidence cannot masquerade as PASS after env or config drift |
| **Client mirror** in the deployment UI (`src/routes/admin.deployment.tsx`) remains for offline diagnostics only; the RLS + append-only trigger + service-role-only write path together guarantee the client-local `launchGateEvidence` cannot produce authoritative PASS | Client-local evidence is never authoritative |

### Deferred (phase 3, not claimed)
- Wiring the deployment/cutover routes to consume `listGateEvidenceServer` / `computeReadinessServer` as their primary read (currently additive; the client-local `computeGateState` view still renders). This is a UI switch; the server contract is in place.
- Persisted `api_clients` table for a real H3 verifier (currently env-flag driven).
- Playwright coverage that exercises the server-fn path end-to-end for multi-user visibility and unauthorized-PASS denial — the underlying DB invariants (RLS-select-only, append-only trigger, `pass_requires_verifier` check constraint) are already the enforcement surface.

## Regression re-run (this turn)

| Check | Command | Result |
|---|---|---|
| Typecheck | `bunx tsgo --noEmit` | exit 0 |
| Validations | `bun run scripts/validate.ts` | **356/356 OK** (baseline preserved) |
| Playwright + axe | `bunx playwright test` | **41 passed** (1.3m) · 0 serious/critical |
| Production build | `bun run build` | exit 0 · `dist/client` + `dist/nitro.json` + wrangler config emitted |
| RC-2 DB | `bun run scripts/rc2-db.ts` | 12 queries · **0 errors** · seq-scan findings unchanged from RC-2 baseline (`releases.by_stage_recent` still SEQ-SCAN — pre-existing, tracked in RC-2 report) |
| RC-3 targeted RLS | `pg_policies` recheck | **62 policies · 20 RLS-enabled tables** (delta from RC-3: +1 SELECT policy on `launch_gate_evidence` for workspace members; **no** INSERT/UPDATE/DELETE policies for authenticated — server-authoritative by construction) |
| Migration security linter | Supabase linter | 6 pre-existing SECURITY DEFINER warnings (`has_role`, `has_any_role`, `is_workspace_member`, `workspace_role`, `consume_rate_limit`, `cleanup_rate_limit_buckets`) — documented as intentional in RC-3; **no new findings** from either migration this workstream |




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
