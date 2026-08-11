# Task 16 — I2 Non-Production Restore Drill

**Drill ID:** `DR-I2-20260811T173051Z`
**Executed:** 2026-08-11T17:30:51Z
**Type:** Structural + data restore into an isolated non-production target (`dr_verify` schema)
**Production impact:** none — production `public` schema was read-only throughout
**Result:** PASS (restore + parity), PARTIAL for I2 overall (see §5)

---

## 1. Method

A non-production target schema `dr_verify` was created inside the managed backend and the
captured production state was materialised into it:

1. `CREATE TABLE dr_verify.<t> (LIKE public.<t> INCLUDING ALL)` for all 21 public tables
   (columns, types, defaults, constraints, indexes, identity/generated columns).
2. `INSERT INTO dr_verify.<t> SELECT * FROM public.<t>` for every table.
3. Row-level security enabled on every restored table.
4. All 62 production policies re-created verbatim against the restored tables
   (name, permissive/restrictive, command, grantee roles, USING, WITH CHECK).
5. Schema privileges revoked from `PUBLIC`, `anon`, `authenticated` — the restored copy is
   unreachable through the Data API (verified: `USAGE` = false for both API roles).

Production was never dropped, truncated, altered, or written to.

## 2. Acceptance checks

| # | Requirement | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Restore completes | PASS | Drill completed without error |
| 2 | Table count matches | PASS | 21 source tables → 21 restored; 0 missing |
| 3 | Schema version matches | PASS | Application `SCHEMA_VERSION = 10`; restored snapshot rows carry v10, no divergence |
| 4 | RLS coverage matches | PASS | 21/21 restored tables RLS-enabled (source 21/21) |
| 5 | Policy count matches | PASS | 62 restored policies vs 62 in production |
| 6 | Row / data integrity | PASS | 26 rows source → 26 rows restored; per-table MD5 content hash equality for all 21 tables (`all_match = true`) |
| 7 | Restored-set fingerprint | PASS | `1ec8b5b5dc7ae12dfe53c89cfd8d886c` (MD5 over per-table content hashes, table-ordered) |
| 8 | Application starts against restored target | NOT EXERCISED | Requires an operator-run app instance bound to a separate project/connection string; the managed platform does not permit repointing the app at an alternate target |
| 9 | Measured restore RTO | PASS | Start 2026-08-11T17:30:51.208Z, finish 2026-08-11T17:30:51.473Z → **0.265 s** |
| 10 | Original production untouched | PASS | Read-only against `public`; post-drill inventory unchanged (21 tables / 21 RLS / 62 policies / 26 rows) |

## 3. Measured recovery objectives

| Metric | Value | Scope |
| --- | --- | --- |
| Restore RTO (logical, 21 tables + 62 policies) | 0.265 s | Data + structure + access-control restore |
| Snapshot-verify RTO (I1 drill `DR-INFRA-20260811T172226Z`) | ~10 s | Capture + integrity verification |
| RPO | 0 s | At capture instant |
| Application-layer restore RTO (Phase 2B `BL-APPDRILL-20260727T153835212Z`) | 0.248 s | Client snapshot restore |

## 4. Teardown

The `dr_verify` target was dropped after evidence capture. It was never API-exposed and no
copy of production data persists outside the production schema.

## 5. Residual gap

I2 remains **PARTIAL**, not PASS:

- Check 8 (application boot against the restored target) is **BLOCKED-OPERATOR** — it needs a
  separate non-production project provisioned by the platform owner.
- A platform point-in-time restore (as opposed to this logical restore) is still owner-only and
  unmeasured.

I2 closes as PASS when the owner runs a PITR into a separate non-production project, boots the
application against it, and records start/finish timestamps plus a post-restore integrity check.
