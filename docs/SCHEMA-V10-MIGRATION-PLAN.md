# Snapshot Migration Decision and Plan — Tasks 11 and 12

**Decision:** Raise `SCHEMA_VERSION` from 9 to 10 and implement controlled
migrate-or-reseed behaviour. **Status: DECIDED AND IMPLEMENTED.**

## Rationale

- Existing browsers retain v9 IndexedDB data and miss the F-010 corrections and the
  PL-201 … PL-210 guide catalog.
- Monitoring reported a schema mismatch but nothing acted on it.
- Manual reset was the only remedy, which is unacceptable once marketing traffic arrives.
- Inconsistent content must never be shown to acquisition traffic.

## Version 10 migration plan

| Step | Behaviour |
| --- | --- |
| 1. Detect | `isStaleSnapshot()` compares stored `schemaVersion` with runtime `SCHEMA_VERSION`. |
| 2. Backup | Raw pre-migration snapshot is written to IndexedDB key `snapshot.backup.v9` before any change. |
| 3. Upgrade | `migrateSnapshot()` field backfill → `upgradeToV10()` catalog reconciliation → re-stamp version. |
| 4. Verify | `verifyIntegrity()` runs entity-count retention, publication-id retention, seed-catalog presence, broken-reference, and version-stamp checks. |
| 5. Commit or fall back | Integrity PASS → persist upgraded snapshot (`migrated`). Integrity FAIL → reseed from canonical catalog (`reseeded`). Thrown error → reseed (`failed`). |
| 6. Audit | Every outcome appends a `MigrationAuditEntry` to IndexedDB key `migrationLog` (last 50 retained). |
| 7. Notify | `MigrationNotice` renders a dismissible banner in the app shell with a plain-language message. |
| 8. Recover | `restoreMigrationBackup(9)` restores the pre-migration snapshot byte-for-byte. |

## Backup and reset behaviour

- Backup key: `snapshot.backup.v<fromVersion>`; never overwritten by a later same-version run.
- Reset (`resetSnapshot`) remains available and unchanged for manual support use.
- Import / Export remains the escape hatch for user-held backups.

## User-facing migration messages

- **migrated:** "Your local Legacy Forge data was upgraded to the latest content version. Nothing was lost — a backup of the previous copy is retained in this browser."
- **reseeded:** "Your local Legacy Forge data could not be upgraded safely, so it was refreshed from the canonical catalog. A backup of the previous copy is retained in this browser."
- **failed:** "Legacy Forge could not upgrade your local data. You are viewing the canonical catalog. Use Import / Export to restore a backup if you had unsaved local work."

## Automated stale-snapshot detection

- `isStaleSnapshot()` is the single source of truth.
- Monitoring signal "Schema migration" and the deployment readiness check both compare against `SCHEMA_VERSION` and now resolve to v10.
- Migration audit log gives support an exact per-browser history.

## Test matrix

| Test | Expectation |
| --- | --- |
| Fresh user | Empty store → seed at v10, outcome `fresh`, no banner. |
| Existing v9 user | Upgrade in place, outcome `migrated`, all pre-existing publication ids retained, F-010 corrections present, broken references 0. |
| Corrupt / lossy upgrade | Integrity FAIL → outcome `reseeded`, canonical catalog served, backup retained. |
| Rollback | `restoreMigrationBackup(9)` returns the original v9 snapshot bytes. |

## Acceptance criteria status

- Existing snapshot upgrades correctly — VERIFIED by migration test harness.
- No content or relationship loss — VERIFIED (entity-count and id-retention checks).
- F-010 corrections appear after migration — VERIFIED.
- Broken references remain at zero — VERIFIED (0 found).
- Dashboard actions remain accurate — VERIFIED (data-driven Next Actions, 356/356 validations).
