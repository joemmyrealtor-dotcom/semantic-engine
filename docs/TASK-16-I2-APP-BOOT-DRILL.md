# Task 16 — I2 Application Boot Against Restored Target

**Drill ID:** `DR-I2BOOT-20260811T190919Z`
**Executed:** 2026-08-11T19:09:19Z
**Type:** Application boot + verification against an isolated non-production restored target
**Production impact:** none — production schema read-only, no production credentials used
**Result:** PASS (all 15 acceptance criteria)

---

## 1. Method

1. A verified v10 snapshot of the application data set was captured from a source instance
   (read-only) and fingerprinted.
2. A **fresh isolated target** (clean browser storage profile, no shared state, private
   loopback app instance on `127.0.0.1:8123`, never exposed publicly) was created and the
   snapshot restored into it.
3. Pre-boot structural and content integrity were recorded before any application code ran
   against the target.
4. The **current tested application build** was started against the restored target and driven
   through public and permission-gated read paths.
5. Post-boot integrity was re-measured and compared byte-for-byte with the pre-boot state.
6. The isolated target was destroyed and production inventory re-verified.

No production credentials, service-role keys, or real user sessions were used. The
permission-gated path used the test-only non-production actor bridge (`DEV && VITE_E2E=1`),
which cannot exist in a production build.

## 2. Acceptance checks

| # | Requirement | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Restore verified snapshot into a fresh isolated target | PASS | Clean profile, target created empty then restored; restore step 0.481 s |
| 2 | Schema version 10 confirmed before boot | PASS | Pre-boot `schemaVersion = 10` |
| 3 | Pre-boot structural/content integrity recorded | PASS | 35 collections, 234 records, MD5 `39ea74eef582ffc33d27df1adb616c89`, SHA-256 `bb23c2c3…93177ad`; matches source fingerprint exactly |
| 4 | Application started against restored target | PASS | Isolated instance booted, no production binding |
| 5 | Application reaches healthy/ready state | PASS | First meaningful render in **1.620 s**; title `Executive Dashboard — Legacy Platform v2.0` |
| 6 | Representative public read paths verified | PASS | 7/7 routes HTTP 200 with rendered content: `/`, `/guides`, `/answers`, `/repository`, `/publications`, `/local`, `/attorneys` |
| 7 | Permission-gated read path verified | PASS | `/admin/audit` blocked when signed out; readable as non-production Owner actor (`Audit Explorer` rendered), then signed out again |
| 8 | No destructive migration drift or unexpected reseed | PASS | Snapshot already at v10 → non-stale path taken; migration log empty (no migrate, no reseed, no backup rotation) |
| 9 | Restored records intact after startup | PASS | 234/234 records present post-boot; per-collection row counts unchanged |
| 10 | Post-boot content-hash / structural integrity | PASS | Post-boot fingerprint identical to pre-boot: MD5 `39ea74eef582ffc33d27df1adb616c89`; drift set empty across all 35 collections |
| 11 | No secrets/credentials/tokens/PII in logs or evidence | PASS | Evidence + server log scanned: 0 matches for secret/service_role/password/token; no page errors; sole console entry is the intentional `/__drill-blank` 404 used to reach the origin before restore |
| 12 | Application recovery time measured separately from DB restore RTO | PASS | See §3 — DB restore RTO 0.265 s retained unchanged; Application Recovery RTO recorded independently |
| 13 | Migration/startup warnings recorded | PASS | 0 page errors; 0 application warnings; 1 expected 404 (drill scaffold URL) |
| 14 | Isolated target destroyed after evidence capture | PASS | Target database deleted; enumeration returns `[]`; app instance terminated (`127.0.0.1:8123` refuses connections) |
| 15 | Production inventory unchanged | PASS | Pre-drill 21 tables / 21 RLS / 62 policies → post-drill identical; 0 drill schemas remain |

## 3. Recovery timings (kept separate)

| Metric | Value | Scope |
| --- | --- | --- |
| **Database Restore RTO** | **0.265 s** | Unchanged, from `DR-I2-20260811T173051Z` — 21 tables, 62 policies, 26 rows restored into an isolated target |
| **Application Recovery RTO** | **11.524 s** | Restore start → application healthy → representative public + permission-gated verification complete |
| — restore step | 0.481 s | Snapshot materialised into the isolated target |
| — restore start → healthy | 2.475 s | Includes application boot and first meaningful render |
| — boot → healthy | 1.620 s | Application start to ready state |
| Snapshot-verify RTO (I1) | ~10 s | Capture + integrity verification |
| RPO | 0 s | At capture instant |

These are deliberately **not** combined: the database layer and the application layer recover on
different mechanisms and different clocks.

## 4. Teardown and isolation

- Isolated app instance bound to loopback only, never published, never DNS-bound.
- Restored target destroyed after evidence capture; no copy of the restored data persists.
- Production database untouched (read-only inventory queries only).

## 5. Classification

| Sub-capability | Status |
| --- | --- |
| I2 Logical restore mechanics | **PASS** |
| I2 Application boot against restore | **PASS** |
| I2 Platform PITR | BLOCKED-OPERATOR (unchanged) |
| I3 / I4 | REVIEW (unchanged — awaiting owner vault confirmation) |
| I6 / I7 | Domain-dependent (unchanged) |
| **Task 16 overall** | **PARTIAL** — pending PITR, I3/I4 vault confirmation, and the domain track |

This drill does not clear production and is not owner-accepted.
