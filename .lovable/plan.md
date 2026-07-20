# Legacy Forge — Release Freeze: Operator Closure Sequence

**Mode:** Release freeze. No code, schema, test, route, or doc changes.
**Baseline accepted as-is:** typecheck 0 · validate 356/356 · Playwright 44/44 · build 0 · RC-2 perf PASS · RC-2 db 12/12.
**Invariant:** H1–H4 remain `BLOCKED-OPERATOR`. Production promotion stays hard-locked in `AuthoritativeGatesPanel` until each hard gate flips to PASS via `attestGateServer` with a server-verified reason. No GA claim. No publish from the agent.

---

## 1. H1 · Rate-limit adapter (Platform Ops)

**Action:** Set `RATE_LIMIT_ADAPTER=supabase` in the production runtime env.
**Evidence required before flipping H1 → PASS:**
- Production runtime attestation that `RATE_LIMIT_ADAPTER=supabase` is live (env dump excerpt or platform screenshot, secrets redacted).
- `/admin/deployment` startup-diagnostics row **rate-limit = OK** on the production build.
- Attest via `AuthoritativeGatesPanel` → H1 → reason ≥ 12 chars citing the evidence.

## 2. H2 · Google OAuth (Auth Owner)

**Action:** Enable Google provider in Cloud Auth Settings; complete a live sign-in from the published URL.
**Evidence required before H2 → PASS:**
- Provider toggle ON (settings screenshot).
- Successful callback landing from the published origin (screenshot) **or** an `auth.users` row with `provider='google'` created after toggle time.
- Attest H2 with reason referencing the callback timestamp.

## 3. H3 · API bearer rotation (API Owner)

**Action:** Disable/delete `APIC-001`; provision ≥ 1 production `api_clients` row; deliver bearers only via Project Settings → Secrets.
**Evidence required before H3 → PASS:**
- `api_clients` shows `APIC-001` disabled or soft-deleted **and** ≥ 1 enabled non-demo client (server verifier enforces this — will refuse PASS otherwise).
- Bearer(s) stored as secrets; zero occurrences in code/commits/logs.
- Attest H3; server verifier must return OK at attestation time.

## 4. H4 · Baseline backup (Data Ops)

**Action:** `performBackup()` → capture BKP id; `verifyBackupIntegrity()` → confirm SHA-256 match; confirm monitoring green at same timestamp.
**Evidence required before H4 → PASS:**
- BKP id recorded.
- Verifier SHA-256 match recorded.
- `/admin/monitoring` all diagnostics green at the same timestamp (screenshot).
- Attest H4 with the BKP id + hash in the reason.

---

## 5. Final regression freshness (QA, immediately before authorization)

Re-run against the exact build that will publish; no source changes between run and publish:
- `bunx tsgo --noEmit` → exit 0
- `bun run scripts/validate.ts` → 356/356
- `bunx playwright test` → 44/44, 0 serious/critical axe
- `bun run build` → exit 0
- `bun run scripts/rc2-perf.ts` → PASS
- `bun run scripts/rc2-db.ts` → 12/12
- `/admin/deployment` shows `AUTHORITATIVE · server` badge and **UNLOCKED**.

**Do not proceed** if any check regresses or if any hard gate reverts to STALE.

## 6. Launch authorization

**Evidence required:**
- H1–H4 all PASS in `AuthoritativeGatesPanel` (server-authoritative, not local diagnostic).
- Freshness matrix above green.
- Named approvers signed off: Platform Ops (H1), Auth Owner (H2), API Owner (H3), Data Ops (H4), QA (regression), Release Manager (final).

Only after this: the promote button becomes usable. Agent still does not publish.

## 7. Manual publish (Release Manager)

- Operator uses Lovable **Publish** in the UI (not the agent, not the CLI).
- Record: published build commit, publish timestamp, published URL.

## 8. Post-deploy smoke (QA)

Against the published URL:
- Playwright smoke pack → 44/44, 0 serious/critical axe.
- `/api/public/v1/health` → 200, rate-limit + auth path OK.
- Sign-in via Google end-to-end.
- One authenticated server-fn call round-trip from `/admin/deployment` succeeds; unauthenticated call denied.

## 9. Monitoring watch (SRE, 15 min minimum)

Watch `/admin/monitoring`:
- Startup diagnostics all OK.
- `verifyAuditChain()` intact.
- `detectWorkspaceLeakage()` = false.
- RC-2 SLO p95 within budget; error rate < 1%.

## 10. Rollback (any trigger below → execute immediately)

**Triggers:**
- RC-2 SLO p95 > 2× budget for 5 min, or error rate > 1% for 5 min.
- `detectWorkspaceLeakage()` = true.
- `verifyAuditChain()` broken.
- Startup diagnostics rate-limit or Supabase key row FAIL post-cutover.
- H4 baseline BKP missing or hash mismatch.

**Procedure:**
1. Enable maintenance mode on `/admin/deployment`.
2. Revert to previous published build via Lovable Publish.
3. If migration-related: forward-fix via additive migration (re-issue previous named policy).
4. If data corruption suspected: `performGovernedRestore(BKP, reason ≥ 8 chars, typed 'RESTORE', workspace-bound)` using the H4 baseline.
5. Re-run smoke pack; watch monitoring 15 min; disable maintenance mode.

---

**Explicit non-actions during freeze:** no code edits, no schema/migration changes, no test edits, no doc edits, no agent-initiated publish, no GA claim. Any deviation restarts Phase 3 verification.
