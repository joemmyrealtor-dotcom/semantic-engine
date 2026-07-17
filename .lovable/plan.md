# Legacy Forge — Launch-Closure Operator Experience

Scope: build the final operator experience around the existing hard launch lock. No publish, no weakening of the promote-lock. Preserve every green baseline.

## 1 · Schema (Supabase migration)

New table `public.launch_gate_evidence` — append-only/versioned per gate:

```text
id uuid pk
workspace_id uuid not null
gate_id text not null check (gate_id in ('H1','H2','H3','H4'))
attempt_seq int not null                 -- monotonic per (workspace,gate)
status text not null check (status in ('PASS','FAIL','PARTIAL','STALE'))
verifier text not null                    -- 'rate-limit','oauth-callback','api-client','backup-integrity'
verification_method text not null         -- 'automatic','semi-automatic'
actor_user_id uuid not null
actor_email text not null
environment text not null                 -- 'production'|'staging'|'preview'
build_commit text not null
correlation_id text not null
references_json jsonb not null default '{}'::jsonb   -- {bkpId, hash, apiClientIds[], sessionRowId, screenshotId,...}
summary_redacted text not null            -- run through redactSecrets()
created_at timestamptz not null default now()
unique(workspace_id, gate_id, attempt_seq)
```

Grants + RLS: SELECT/INSERT to authenticated (owner/editor/reviewer via `has_any_role`); UPDATE/DELETE denied (append-only). Service role: all. Index `(workspace_id, gate_id, attempt_seq desc)`.

## 2 · Verifier layer (`src/lib/data/launch-gates.ts`)

Typed `HardGateId = 'H1'|'H2'|'H3'|'H4'`, `GateEvidence`, `VerifierResult`.

Per-gate verifiers — deterministic, no manual override:
- `verifyH1_rateLimit()`: calls `assertRateLimitReadiness()` in prod-simulation, checks `RATE_LIMIT_ADAPTER=supabase`, exercises `consume_rate_limit` RPC. Records adapter name + RPC ok, no secrets.
- `verifyH2_oauthCallback()`: calls Supabase to confirm Google provider config exposed via `auth/v1/settings`; requires operator to attach `sessionRowId` (from `auth.users` where `provider='google'`) which the verifier cross-checks via server fn. No token stored.
- `verifyH3_apiClient()`: confirms APIC-001 disabled/deleted, ≥1 new `APIClient` row exists AND its bearer is present as a runtime secret name (checked via `fetch_secrets` list — never value). Redacts bearer references.
- `verifyH4_backup()`: invokes `performBackup('pre-rc1-baseline')` + `verifyBackupIntegrity()` + `startupDiagnostics/monitoring green` in single correlated run; records BKP id + SHA-256.

Each verifier returns `{status, references, summaryRedacted}`; only the verifier writes `PASS` rows via server fn `recordGateEvidence` (uses `auditedMutate`, stamps actor/correlation/build commit). No client path can insert PASS directly.

Staleness: `latestEvidence(gate).build_commit !== currentBuildCommit` OR `env fingerprint changed` OR `regression baseline stale` → status derived as `STALE`. Promotion lock reads derived status.

## 3 · Server functions (`src/lib/launch-gates.functions.ts`)

- `getGateState()` → `{gate, latest, derivedStatus, blockingReason}[]` — RLS-scoped, workspace-bound.
- `runGateVerifier({gate})` → `.middleware([requireSupabaseAuth])`, permission-gated (`launch.gate.verify`, owner/editor only). Runs verifier + inserts evidence.
- `getCutoverReadiness()` → aggregates gates + regression freshness + rollback point (last backup id).

## 4 · UI

`src/routes/admin.deployment.tsx` — replace `HardGatesPanel` with `<GateWorkflowPanel>`:
- Per gate: expandable card with guided steps, evidence timeline (append-only history), `Run verifier` button (permission-gated, disabled for viewer/contributor with explicit "Insufficient role" state), status chip incl. `STALE`, blocking reason, redacted references.
- Promotion button remains locked; label reflects derived status and lists exact blockers.

`src/routes/admin.cutover.tsx` — new **Cutover Command Center**:
- Final checks (all 4 gates + regression freshness + rollback point).
- Approvals: two-person acknowledgement (typed name + role) — recorded but NEVER auto-publishes.
- Explicit "Authorize launch" action: only unlocks a display banner + copies operator runbook to clipboard. Publish itself is manual via Lovable UI.
- Accessible: semantic sections, `aria-live` for verifier progress, focus management.

## 5 · Deterministic validations (`scripts/validate.ts`)

Add checks:
- append-only invariant of `launch_gate_evidence` (no rows without verifier)
- gate-lock semantics (any non-PASS ⇒ locked)
- redaction of summaries (no bearer/JWT/service-role shape)
- staleness derivation on build/env change
- permission matrix for `launch.gate.verify`

Target: +7 checks → 350/350.

## 6 · Playwright (`e2e/launch-closure.spec.ts`)

Test IDs seeded via `__lovableE2E` bridge:
- viewer denied verifier action (button disabled + aria);
- editor runs H1 verifier against fixture → evidence appears redacted;
- H3 partial failure (APIC-001 still active) → PARTIAL status, promote stays LOCKED;
- H4 happy path with fixture backup → PASS + monitoring green;
- staleness: mutate build commit → status flips to STALE, promote re-locks;
- cutover authorization requires all four PASS + regression fresh;
- axe scan on both routes.

## 7 · Docs

- `docs/LAUNCH-CLOSURE.md` / `.json` — extend with verifier contract, evidence schema, staleness rules, cutover center walkthrough. Add operator step-by-step (with screenshots referenced).
- Update `docs/ARCHITECTURE.md` § Launch closure.
- Update `/admin/deployment` operator checklist copy.

## 8 · Regression rerun (mandatory)

1. `bunx tsgo --noEmit`
2. `bun run scripts/validate.ts` (expect 350/350)
3. `bunx playwright test` (expect prior 38 + new specs)
4. `bun run build`
5. `bun run scripts/rc2-perf.ts`
6. `bun run scripts/rc2-db.ts`
7. targeted RC-3 RLS recheck (audit_events, profiles, plus new `launch_gate_evidence`)

## 9 · Report

Exact files/schema/tests/commands/results, remaining operator steps (H1-H4 real evidence, publish), and completion status. GA is **not** claimed; publish is **not** performed.

## Technical notes

- `assertRateLimitReadiness` + `startupDiagnostics` already exist — verifiers wrap them.
- `auditedMutate` + `correlationId` already stamped on every mutation; reused for evidence writes.
- Redaction uses existing `redactSecrets()` from `src/lib/data/security.ts`.
- `fetch_secrets` MCP tool cannot be called from app runtime; H3 verifier reads secret **names** via a server helper backed by an allow-listed table `runtime_secret_names` (populated by ops), never values. Names-only avoids the "no secret in bundle" invariant.
- Promotion lock stays enforced in code, unchanged.
