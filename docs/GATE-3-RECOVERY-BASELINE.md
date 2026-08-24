# Gate 3 — Recovery Baseline & Dry-Run Report

**Baseline ID:** `BL-GATE3-20260821T161600Z`
**Executed:** 2026-08-21T16:15:39Z → 2026-08-21T16:16:00Z (UTC)
**Scope:** Gate 3 only. T17-1 / T17-10 domain migration NOT executed.
**Production status:** BLOCKED. No merge, publish, deploy, DNS routing change, domain activation,
GSC/Bing submission, or CRM send occurred during this gate.

---

## 1. Code checkpoint

| Item | Value | Source |
| --- | --- | --- |
| HEAD commit | `34edc0450bd0db1da74ae6243f0fbbed5c96d753` | `git rev-parse HEAD` |
| Commit timestamp | 2026-08-21T16:05:22Z | `git log -1` |
| Commit subject | "Verified branch protection" | `git log -1` |
| Working tree | CLEAN (0 modified / 0 untracked) | `git status --porcelain` (empty) |
| Working branch (sandbox) | `edit/edt-08dffc96-8098-4d86-afa1-4d2ed84ae08a` | `git rev-parse --abbrev-ref HEAD` |
| Build / schema version | Application `SCHEMA_VERSION = 10` | `src/lib/data/schema.ts` |
| Server fingerprint | `srv-34edc045` (short HEAD, authoritative build identity) | derived from HEAD |

### Verified repository export

| Item | Value |
| --- | --- |
| Artifact | `git archive --format=tar HEAD` → `checkpoint.tar` |
| Size | 3,952,640 bytes |
| SHA-256 | `8fe3ab87dcf06432916764a06a623d25550b58cb11aab9d3da5e32c5e3953383` |
| Location | sandbox `/tmp/gate3/checkpoint.tar` (ephemeral) |
| Reproduction | `git archive --format=tar 34edc045 \| sha256sum` — deterministic for this commit |

**VERIFIED — R1 (2026-08-24T20:11:29Z):** the immutable off-platform checkpoint exists. Annotated tag
`baseline/BL-GATE3-20260821T161600Z` (peeled `^{}` → `34edc0450bd0db1da74ae6243f0fbbed5c96d753`), protected by
tag ruleset `baseline-tags-immutable` (Active, `baseline/**`, bypass empty, updates + deletions restricted),
published as immutable release
`https://github.com/joemmyrealtor-dotcom/semantic-engine/releases/tag/baseline/BL-GATE3-20260821T161600Z`
(draft false, pre-release false, not latest). Tree SHA `00a2784c2455b59116fa00d5c229891724e43caf` and normalized
tar SHA-256 `8fe3ab87…3383` (3,952,640 bytes, `core.autocrlf=false` / `core.eol=lf`) re-verified in-sandbox.
GitHub-generated archive `BL-GATE3-20260821T161600Z.tar.gz`, 978,345 bytes; its submitted SHA-256 has 65 hex
characters and is tracked as **A-1 (open, non-blocking)** for re-capture. Full record:
`docs/GATE-3-R1-EXECUTION.md` §5b.

## 2. Database backup evidence & inventory

Read-only inventory captured against the production `public` schema. No writes, no DDL,
no truncation, no secret values read or emitted.

| Object class | Count |
| --- | --- |
| Public base tables | 21 |
| Tables with RLS enabled | 21 / 21 |
| RLS policies | 62 |
| Public schema functions | 11 |
| Non-internal triggers (public) | 18 |
| Applied migrations (`supabase_migrations.schema_migrations`) | 13 |
| Storage buckets | 0 |
| Total rows across public tables | 26 |

**Content fingerprint (MD5 over per-table content hashes, table-ordered):**
`162ae0f512749dd49db1a67f68bdbd9d`

**Per-table row counts:**
`agents=0, api_clients=1, audit_events=0, client_tools=0, concepts=0, domains=0, frameworks=0,
knowledge_objects=0, launch_gate_evidence=17, profiles=2, prompts=0, publication_blueprints=0,
qa_issues=0, rate_limit_buckets=2, relationships=0, releases=0, review_items=0, revisions=0,
user_roles=2, workspace_memberships=1, workspaces=1`

**Configuration / secrets inventory:** recorded separately and without values in
`docs/TASK-16-I3-I4-ENV-SECRETS.md` and `docs/TASK-16-I3-I4-VAULT-CONFIRMATION.md`.
No secret material is reproduced in this document.

**UNVERIFIED — R2:** platform-managed physical backup listing and point-in-time-restore (PITR)
window are owner-only surfaces; they cannot be read from this environment. Owner steps in §8.

## 3. Restore test — isolated, non-production

Two independent restore paths were exercised. Production was never overwritten.

### 3a. Application-layer restore dry-run (executed this gate)

| Field | Value |
| --- | --- |
| Drill ID | `DR-GATE3-20260821T161559Z` |
| Environment | Isolated in-process harness (no IndexedDB write to any live store, no network) |
| Start | 2026-08-21T16:15:59.839Z |
| Finish | 2026-08-21T16:16:00.007Z |
| Backup created | `BKP-001`, 443,824 bytes, 191 entities |
| Backup SHA-256 | `83b10ee363f17ca39001a468207062813a577530c5b1d1044fb7c01fb389da84` |
| Integrity verification | PASS (`ok`) |
| Restore duration | **38.111 ms** |
| Post-restore migration verification | PASS (0 issues, schema v10) |

### 3b. Backend logical restore (previously executed, retained)

`DR-I2-20260811T173051Z` — 21 tables + 62 policies restored into isolated `dr_verify` schema,
per-table MD5 parity `all_match = true`, RTO **0.265 s**, production read-only throughout.
Application boot against the restored target: `DR-I2BOOT-20260811T190919Z` (healthy in 1.62 s).
Evidence: `docs/TASK-16-I2-RESTORE-DRILL.md`, `docs/TASK-16-I2-APP-BOOT-DRILL.md`.

### 3c. Automated recovery regression (executed this gate)

`vitest run` over `backups.test.ts`, `recovery.test.ts`, `migrations.test.ts`, `db.test.ts`:
**55 / 55 PASS**, duration 5.32 s.

## 4. Rollback procedures

### 4.1 Code
1. Identify the last-good commit: `34edc0450bd0db1da74ae6243f0fbbed5c96d753`.
2. Open a revert PR against `main` (branch protection forbids direct push and bypass):
   `git revert --no-commit <bad>..HEAD` → PR → `SECURITY DEFINER execute grants` check must pass → merge.
3. Emergency full restore: `git checkout -b rollback/BL-GATE3 34edc045` → PR → merge.
4. Confirm post-rollback fingerprint equals `srv-34edc045`.

### 4.2 Database
1. Freeze writes (maintenance mode, allow-list roles only).
2. Preferred: platform PITR to the timestamp immediately before the faulty migration (owner-only).
3. Logical fallback: re-apply the reverted migration set from `supabase/migrations`, then verify
   21 tables / 21 RLS / 62 policies / 11 functions / 18 triggers and re-compute the content
   fingerprint against `162ae0f512749dd49db1a67f68bdbd9d`.
4. Application layer: `/admin/backups` → **Restore** on the target snapshot (governed restore
   requires reason ≥ 8 chars and the typed phrase `RESTORE`; a pre-restore backup is auto-created).

### 4.3 `PUBLIC_SITE_ORIGIN`
1. Revert the single commit that changed the origin constant.
2. Regenerate all 126 canonical / sitemap / Open Graph / schema URLs in the same atomic commit —
   origin and URL emission must never be split across commits.
3. Verify: URL inventory count is exactly 126 and every emitted URL carries the reverted origin.

### 4.4 DNS routing
1. In GoDaddy DNS for `joemelendezrealty.com`, remove the A / CNAME records added for activation.
2. Retain the apex TXT proof record
   `legacy-forge-verification=4c1a7e93b58d20f6ae4471c0d9b3f82a` (do not delete — it is Task 17 evidence).
3. Allow TTL expiry, then confirm with `dig` against `ns39.domaincontrol.com` and a public resolver.

### 4.5 Custom-domain activation
1. Deactivate / remove the custom domain in project settings; traffic falls back to the
   provisional Lovable origin.
2. Confirm the provisional origin serves 200 and that no 126-URL entry references the custom domain.
3. Rollback is only complete once §4.3 and §4.5 are both reverted — they are one unit.

## 5. Proposed RPO / RTO — AWAITING OWNER APPROVAL (NOT ACCEPTED)

| Objective | Proposed | Reasoning |
| --- | --- | --- |
| **RPO — database** | **≤ 5 minutes** | Measured logical capture RPO is 0 s at capture instant; the 5-minute allowance covers platform PITR granularity. Total production data is 26 rows across 21 tables, so replay exposure is minimal. |
| **RPO — code** | **0 (commit-granular)** | Every change lands via a protected PR on `main`; no unversioned production code exists. |
| **RTO — code rollback** | **≤ 30 minutes** | Revert PR + required status check + rebuild; dominated by CI and review latency, not by the revert itself. |
| **RTO — database restore** | **≤ 60 minutes** | Measured logical restore is 0.265 s and app boot 1.62 s; the envelope covers owner-executed PITR provisioning and verification, which is unmeasured. |
| **RTO — application snapshot restore** | **≤ 5 minutes** | Measured 38 ms this gate and 0.248 s in Phase 2B; envelope covers operator navigation and governed-restore confirmation. |
| **RTO — DNS / domain rollback** | **≤ 4 hours** | Bounded by external resolver TTL propagation, outside platform control. |

These values are **PROPOSED ONLY**. They are not recorded as accepted until Joe approves them
explicitly. No downstream gate may cite them as accepted before that approval.

## 6. Recovery dry-run report

| # | Step | Result | Timestamp (UTC) | Source | Evidence location |
| --- | --- | --- | --- | --- | --- |
| 1 | Capture HEAD + tree status | PASS | 2026-08-21T16:15:39Z | `git rev-parse` / `git status` | §1 |
| 2 | Produce repo export + SHA-256 | PASS | 2026-08-21T16:15:40Z | `git archive` + `sha256sum` | §1 |
| 3 | Publish immutable off-platform checkpoint | PASS (R1) | 2026-08-24T19:53:17Z | owner-executed tag + immutable release | `docs/GATE-3-R1-EXECUTION.md` §5b |
| 4 | Database structural inventory | PASS | 2026-08-21T16:15:45Z | read-only SQL on `public` | §2 |
| 5 | Database content fingerprint | PASS | 2026-08-21T16:15:50Z | read-only SQL | §2 |
| 6 | Platform physical backup / PITR window | UNVERIFIED (R2) | — | owner-only surface | §8 |
| 7 | Isolated restore dry-run | PASS (38.111 ms) | 2026-08-21T16:15:59Z | in-process harness | §3a |
| 8 | Backup integrity verification | PASS | 2026-08-21T16:16:00Z | `verifyBackupIntegrity` | §3a |
| 9 | Post-restore migration verification | PASS (0 issues) | 2026-08-21T16:16:00Z | `verifyMigration` | §3a |
| 10 | Recovery regression suite | PASS (55/55) | 2026-08-21T16:15:44Z | `vitest run` | §3c |
| 11 | Backend logical restore parity | PASS (retained) | 2026-08-11T17:30:51Z | `DR-I2` drill | `docs/TASK-16-I2-RESTORE-DRILL.md` |
| 12 | App boot against restored target | PASS (retained) | 2026-08-11T19:09:19Z | `DR-I2BOOT` drill | `docs/TASK-16-I2-APP-BOOT-DRILL.md` |
| 13 | Rollback procedures documented | PASS | 2026-08-21T16:16:00Z | this document | §4 |
| 14 | RPO / RTO recorded as accepted | PENDING OWNER APPROVAL | — | Joe | §5 |
| 15 | Production untouched | PASS | throughout | read-only DB access; no deploy/DNS/CRM action | — |

## 7. Gate 3 status

**Gate 3: PARTIAL — NOT PASS.**

Passing: code checkpoint, repository export hash, database inventory and fingerprint, isolated
restore test, recovery regression, rollback procedures, dry-run report.

Blocking: R1 (immutable off-platform checkpoint), R2 (platform backup / PITR evidence),
and owner acceptance of the proposed RPO / RTO values. Gate 3 is recorded PASS only when those
three items carry retained evidence. No PASS is inferred.

## 8. Owner actions to clear UNVERIFIED items

**R1 — immutable checkpoint**
1. `git tag -a baseline/BL-GATE3-20260821T161600Z 34edc0450bd0db1da74ae6243f0fbbed5c96d753 -m "Gate 3 recovery baseline"`
2. `git push origin baseline/BL-GATE3-20260821T161600Z`
3. Download `https://github.com/joemmyrealtor-dotcom/semantic-engine/archive/refs/tags/baseline/BL-GATE3-20260821T161600Z.tar.gz`
4. Run `sha256sum` on the download and paste the tag URL + hash here.

**R2 — platform backup / PITR evidence**
1. Open backend project settings → Database → Backups.
2. Record: most recent successful backup timestamp, retention window, and whether PITR is enabled
   with its earliest recoverable timestamp.
3. Paste those three values (no keys, no connection strings, no passwords) here.

**RPO / RTO acceptance**
Reply approving the §5 table as-is, or supply revised values, and it will be recorded as accepted.
