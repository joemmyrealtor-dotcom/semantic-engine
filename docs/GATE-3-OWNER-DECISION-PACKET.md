# Gate 3 — Owner Decision Packet (R1 / R2 / R3)

**Status:** Gate 3 PARTIAL. Nothing in this packet has been executed.
**Production:** BLOCKED. T17-1 / T17-10 not run. No tag pushed, no release created,
no DNS/domain/publish/CRM/GSC action taken.

---

## R1 — Immutable off-platform checkpoint (PROPOSED, NOT EXECUTED)

### Why a plain tag is not enough

A lightweight or annotated Git tag is a movable reference: anyone with push access can run
`git tag -f` + `git push --force` or `git push --delete` and the name will resolve to a different
commit. The tag name alone is therefore **not** admissible recovery evidence.

Immutability is achieved by three independent layers, not by the tag itself:

1. **Content addressing** — the commit SHA-1 and the tarball SHA-256 are the real anchors. Even if
   a tag is moved, the recorded commit hash still identifies exactly one immutable object, and the
   recorded tarball SHA-256 proves any downloaded copy is bit-identical.
2. **Tag protection ruleset** — a GitHub repository ruleset scoped to the tag name pattern blocks
   update and deletion for everyone, including admins (bypass list empty).
3. **Immutable release** — GitHub's release immutability setting freezes the release and its
   attached assets; the release cannot be edited or its assets replaced after publication.

### Exact proposed parameters

| Field | Value |
| --- | --- |
| Target commit | `34edc0450bd0db1da74ae6243f0fbbed5c96d753` |
| Commit timestamp | 2026-08-21T16:05:22Z |
| Repository | `joemmyrealtor-dotcom/semantic-engine` |
| Tag type | **Annotated** (`git tag -a`), signed if a GPG key is configured (`-s`) |
| Tag name | `baseline/BL-GATE3-20260821T161600Z` |
| Tag message | `Gate 3 recovery baseline — srv-34edc045, schema v10` |
| Release name | `Gate 3 Recovery Baseline — BL-GATE3-20260821T161600Z` |
| Release type | Published, **not** pre-release, **not** "latest" |
| Tarball source | GitHub auto-generated source archive for the tag: `https://github.com/joemmyrealtor-dotcom/semantic-engine/archive/refs/tags/baseline/BL-GATE3-20260821T161600Z.tar.gz` |
| Secondary artifact | `checkpoint.tar` produced by `git archive --format=tar 34edc045` — 3,952,640 bytes, SHA-256 `8fe3ab87dcf06432916764a06a623d25550b58cb11aab9d3da5e32c5e3953383` (deterministic, reproducible from the commit) |

### SHA-256 process

1. Download the tag tarball from the release page (browser or `curl -L`).
2. Run `sha256sum <file>` (macOS: `shasum -a 256 <file>`).
3. Record: filename, byte size, SHA-256, download timestamp (UTC), and the release URL.
4. Note: the GitHub auto-generated `.tar.gz` is gzip-compressed and its hash will **not** equal the
   `git archive` tar hash above. Both hashes are recorded separately; neither substitutes for the
   other.
5. Re-verification later = re-download + `sha256sum` + compare to the recorded value.

### Tag-protection method

Repository → Settings → Rules → Rulesets → **New ruleset** → *Tag ruleset*:

- Ruleset name: `baseline-tags-immutable`
- Enforcement status: **Active**
- Target tags → Include by pattern: `baseline/**`
- Rules enabled: **Restrict updates**, **Restrict deletions**
- Bypass list: **empty** (no roles, no apps, no admins)

### Release-immutability setting

Repository → Settings → General → *Releases* (or the release creation form) → enable
**Immutable releases**. With this on, the published release and its attached assets can no longer
be edited, replaced, or re-uploaded; the tag it points at is also frozen.

### Execution order (awaiting your go-ahead — not performed)

1. Create the tag ruleset `baseline-tags-immutable`.
2. Enable immutable releases.
3. `git tag -a baseline/BL-GATE3-20260821T161600Z 34edc0450bd0db1da74ae6243f0fbbed5c96d753 -m "Gate 3 recovery baseline — srv-34edc045, schema v10"`
4. `git push origin baseline/BL-GATE3-20260821T161600Z`
5. Publish the release from that tag.
6. Download the tarball, hash it, and record the four values from the SHA-256 process.

**No step above has been run.** Steps 1, 2, and 5 are owner-only GitHub UI actions.

---

## R2 — Backup platform and read-only lookup path (PASS)

**Backup platform:** the managed Lovable Cloud backend (managed Postgres). A **Backups** panel does
exist at Cloud → Database → Backups; it lists daily snapshots with a "Restore to this backup"
action per row. It was reached read-only; nothing was changed and no backup or restore was started.

**Evidence:** two owner-side screenshots of Cloud → Database → Backups (2026-08-21, 11:48 local /
18:48 UTC), plus official Lovable documentation stating daily backups with retention of roughly
14 days and no point-in-time recovery.

| # | Value | Recorded state |
| --- | --- | --- |
| 1 | Latest successful backup timestamp | **2026-08-21T07:36:26Z** (verified — screenshot) |
| 2 | Observed retention window | **2026-08-08 → 2026-08-21** (13 snapshots visible) |
| 3 | Official platform retention | **Up to ~14 days** (Lovable documentation) |
| 4 | PITR status | **Not available** — recovery uses daily snapshots |
| 5 | Oldest visible recoverable snapshot | **2026-08-08T07:34:03Z** |

### Observed snapshot list (verbatim from the panel)

Aug 21 07:36:26Z · Aug 20 07:35:31Z · Aug 19 07:38:58Z · Aug 18 07:39:18Z · Aug 17 07:33:56Z ·
Aug 16 07:36:33Z · Aug 15 07:39:13Z · Aug 14 07:36:29Z · Aug 13 07:38:09Z · Aug 12 07:39:41Z ·
Aug 11 07:37:27Z · Aug 9 07:37:51Z · Aug 8 07:34:03Z

**Observed gap:** there is **no August 10, 2026 entry** between Aug 9 and Aug 11. This is recorded
as an *observed gap in the listing* only. No backup failure is inferred: the platform has published
no evidence of a failed or skipped run, and the cause (missed run, retention trim, or display
behaviour) is unknown. Tracked as a monitoring item, not as a defect.

R2 is recorded as **PASS** — values verified from owner-side screenshot evidence and official
Lovable documentation.

---

## R3 — Re-proposed RPO / RTO table (PROPOSED ONLY — NOT ACCEPTED)

Row 1 is re-derived against the now-verified daily snapshot cadence. The database RPO is bounded by
the documented daily-backup interval; PITR is unavailable, so sub-daily recovery is not claimed.

| # | System | Objective | Proposed value | Measurement point | Owner | Recovery priority |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Database (managed Postgres) | **RPO** | **≤ 24 hours** — documented daily snapshot cadence; no PITR, so sub-daily recovery is not available | `now()` minus the timestamp of the latest snapshot listed in Cloud → Database → Backups (latest verified: 2026-08-21T07:36:26Z) | Owner (Joe) | P1 — highest |
| 2 | Application code (`main`) | **RPO** | 0 (commit-granular) | Last merged commit on protected `main`; no unversioned production code exists | Owner (Joe) via protected PR | P1 |
| 3 | Application code rollback | **RTO** | ≤ 30 minutes | Revert PR opened → required check `SECURITY DEFINER execute grants` green → merged → rebuilt fingerprint matches `srv-34edc045` | Owner (Joe) | P1 |
| 4 | Database restore (platform daily snapshot) | **RTO** | ≤ 60 minutes | Restore initiated from the Backups panel → post-restore verification passes (21 tables / 21 RLS / 62 policies / 11 functions / 18 triggers, content fingerprint `162ae0f512749dd49db1a67f68bdbd9d`) | Owner (Joe) | P1 |
| 5 | Application snapshot restore (`/admin/backups`) | **RTO** | ≤ 5 minutes | Operator clicks Restore (reason ≥ 8 chars + typed `RESTORE`) → integrity PASS + migration verification PASS | Operator / Owner | P2 |
| 6 | DNS routing (`joemelendezrealty.com`) | **RTO** | ≤ 4 hours | Registrar record change saved → authoritative + public resolver agreement via `dig` | Owner (Joe) at registrar | P3 |
| 7 | Custom-domain activation / `PUBLIC_SITE_ORIGIN` | **RTO** | ≤ 4 hours (bound to row 6) | Origin revert commit merged **and** domain deactivated → all 126 URLs emit the reverted origin | Owner (Joe) | P3 — reverts as one unit with row 6 |

**Monitoring item M-1:** missing 2026-08-10 snapshot in the Backups listing. Action: re-inspect the
panel on the next gate review and confirm whether daily entries remain contiguous. No failure
inferred; no remediation opened.

**Supporting measurements (already evidenced, not objectives):** logical DB restore 0.265 s
(`DR-I2`), app boot against restored target 1.62 s (`DR-I2BOOT`), application snapshot restore
38.111 ms this gate / 0.248 s in Phase 2B, recovery regression 55/55 PASS.

**These values are PROPOSED. Acceptance is not recorded.** No downstream gate may cite them as
accepted.


---

## R2 remediation paths (NOT IMPLEMENTED — approval required for either)

### Path A — Platform confirmation or plan upgrade exposing backup and PITR evidence

| Dimension | Detail |
| --- | --- |
| What it is | Obtain, from the platform, either (a) a written statement of the backup cadence, retention window, and PITR availability for this project, or (b) a plan/compute tier that surfaces a Backups + PITR panel with those four values readable in-product |
| Cost | Support request: $0. Plan/compute upgrade: recurring platform charge (amount depends on the tier offered; must be quoted before approval). Possible additional storage cost for PITR WAL retention |
| Permissions | Owner-only. Requires the Lovable account owner to open the support/billing request and to accept any plan change. No database or repository permission is involved |
| Security requirements | Request must contain no connection string, database password, service-role key, or project credentials. Only the four values are requested. Any response containing secrets is rejected and not stored in evidence |
| Approval gates | (1) Owner approves opening the request; (2) Owner approves any cost before a plan change; (3) values received are recorded verbatim into R2; (4) Owner approves the resulting revised R3 row 1 |
| Effect if completed | R2 clears with real values; R3 row 1 can become a bounded numeric RPO |

### Path B — Owner-controlled, encrypted, scheduled off-platform logical backup

| Dimension | Detail |
| --- | --- |
| What it is | A recurring job that produces a full logical dump of the production database, encrypts it at rest, uploads it to owner-controlled off-platform storage, records a SHA-256 checksum per artifact, enforces a retention policy, emits success/failure monitoring, and is proven by a scheduled restore test |
| Components | (1) scheduler (pg_cron → an authenticated `/api/public/*` job route, or an external scheduler); (2) dump routine; (3) encryption with an owner-held key; (4) off-platform object storage bucket; (5) checksum ledger row per artifact; (6) alert on missed/failed run; (7) periodic restore-and-verify drill against a non-production target |
| Cost | Object storage: low single-digit $/month at current 13 MB database size plus retention copies. Egress: negligible at this size. Scheduler/compute: covered by existing platform usage. Engineering: one implementation cycle plus ongoing drill time |
| Permissions | Requires a privileged database read (service-role or a dedicated read-only backup role) executed server-side only; write credentials for the off-platform bucket; owner custody of the encryption key. No client-side code may hold any of these |
| Security requirements | Encryption key never stored in the repository or client bundle; credentials stored as platform secrets only; artifacts encrypted before leaving the platform; storage bucket private with no public read; checksum verified on both write and restore; no secret value written to logs, audit rows, or evidence documents; backup contents treated as PII-bearing and access-logged |
| Approval gates | (1) Owner approves the design and the storage destination; (2) Owner approves creation of the required secrets and the encryption-key custody procedure; (3) Owner approves the recurring cost; (4) first successful run + first successful restore test are recorded before R2 is re-evaluated; (5) Owner approves the resulting revised R3 row 1 |
| Effect if completed | Provides an owner-held recurring backup independent of the platform, tightening R3 row 1 below the 24-hour daily cadence |

**Neither path is implemented.** No scheduler, secret, bucket, or job has been created. Both paths
are now optional improvements, not R2 blockers — R2 has cleared on platform evidence.

---

## Packet status

| Item | State | Cleared by |
| --- | --- | --- |
| R1 | Plan defined, **nothing executed**, not approved | Owner runs the 6 steps, then sends release URL + tarball SHA-256 + byte size + download timestamp |
| R2 | **PASS** — values verified from owner screenshots + official Lovable documentation; monitoring item M-1 (missing Aug 10 entry) open | Cleared |
| R3 | Table re-proposed with **≤ 24 h** database RPO | Owner approves or revises the 7 rows |

Gate 3 remains **PARTIAL** (R1 pending, R3 unapproved). Production remains **BLOCKED**. T17-1 /
T17-10 not run.


