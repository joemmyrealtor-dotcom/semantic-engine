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

## R2 — Backup platform and read-only lookup path

**Backup platform:** the managed Lovable Cloud backend (the project's managed Postgres database).
Backups are platform-managed; they are not created or scheduled by application code.

**Read-only path for Joe** — in the Lovable project, open the **Cloud** tab (backend view) →
**Database** → **Backups**. Record only these four values:

| # | Value to record | Where it appears |
| --- | --- | --- |
| 1 | Latest successful backup timestamp (UTC) | Backups list — most recent row with status "success"/"completed" |
| 2 | Backup retention period (days) | Backups panel header / retention or plan line |
| 3 | PITR status (enabled / disabled) | Point-in-Time Recovery section on the same page |
| 4 | Earliest recoverable time (UTC) | PITR section — shown only when PITR is enabled; if disabled, record "N/A — PITR disabled" |

Rules for this check: **read-only**. Do not change retention, do not trigger a backup, do not start
a restore. Do not copy or send any connection string, database password, service key, or project
identifier — the four values above are the entire deliverable.

Paste those four values back here and R2 clears.

---

## R3 — Proposed RPO / RTO table (PROPOSED ONLY — NOT ACCEPTED)

| # | System | Objective | Proposed value | Measurement point | Owner | Recovery priority |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Database (managed Postgres) | **RPO** | ≤ 5 minutes | Interval between last durable backup/PITR checkpoint and the failure instant | Owner (Joe) — platform PITR is owner-only | P1 — highest |
| 2 | Application code (`main`) | **RPO** | 0 (commit-granular) | Last merged commit on protected `main`; no unversioned production code exists | Owner (Joe) via protected PR | P1 |
| 3 | Application code rollback | **RTO** | ≤ 30 minutes | Revert PR opened → required check `SECURITY DEFINER execute grants` green → merged → rebuilt fingerprint matches `srv-34edc045` | Owner (Joe) | P1 |
| 4 | Database restore | **RTO** | ≤ 60 minutes | Restore initiated → post-restore verification passes (21 tables / 21 RLS / 62 policies / 11 functions / 18 triggers, content fingerprint `162ae0f512749dd49db1a67f68bdbd9d`) | Owner (Joe) | P1 |
| 5 | Application snapshot restore (`/admin/backups`) | **RTO** | ≤ 5 minutes | Operator clicks Restore (reason ≥ 8 chars + typed `RESTORE`) → integrity PASS + migration verification PASS | Operator / Owner | P2 |
| 6 | DNS routing (`joemelendezrealty.com`) | **RTO** | ≤ 4 hours | Registrar record change saved → authoritative + public resolver agreement via `dig` | Owner (Joe) at registrar | P3 |
| 7 | Custom-domain activation / `PUBLIC_SITE_ORIGIN` | **RTO** | ≤ 4 hours (bound to row 6) | Origin revert commit merged **and** domain deactivated → all 126 URLs emit the reverted origin | Owner (Joe) | P3 — reverts as one unit with row 6 |

**Supporting measurements (already evidenced, not objectives):** logical DB restore 0.265 s
(`DR-I2`), app boot against restored target 1.62 s (`DR-I2BOOT`), application snapshot restore
38.111 ms this gate / 0.248 s in Phase 2B, recovery regression 55/55 PASS.

**These values are PROPOSED. They are not recorded as accepted.** Reply approving the table exactly
as written, or supply revised values per row, and only then will acceptance be recorded. No
downstream gate may cite these as accepted before that reply.

---

## Packet status

| Item | State | Cleared by |
| --- | --- | --- |
| R1 | Plan defined, **nothing executed** | Owner runs the 6 steps, then sends release URL + tarball SHA-256 + byte size + download timestamp |
| R2 | Lookup path provided | Owner sends the 4 read-only values |
| R3 | Table proposed | Owner approves or revises the 7 rows |

Gate 3 is recorded PASS only when all three carry retained evidence. No PASS is inferred.
