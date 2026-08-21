# Gate 3 — R3 Owner Acceptance Record (Recovery Objectives)

| Field | Value |
| --- | --- |
| Owner | Joe Melendez |
| Decision | **ACCEPTED** |
| Scope | R3 RPO / RTO table, rows 1 through 7, as presented |
| Acceptance timestamp (UTC) | 2026-08-21T18:56:51Z |
| Bound Git commit | `6c6f10d4f1ebbbbca11235e68322e728922b9f4a` |
| Server fingerprint | `srv-6c6f10d4` |
| Packet version | Gate 3 Owner Decision Packet — R2 PASS / R3 ACCEPTED revision |
| Packet file | `docs/GATE-3-OWNER-DECISION-PACKET.md` |
| Packet SHA-256 | `812353fff6444dc4c8653f58e99e00c3fc7ec5519b13a524fe36e1a2011de35e` |
| Packet byte size | 13602 |

## Accepted objectives (verbatim summary)

| # | System | Objective | Accepted value |
| --- | --- | --- | --- |
| 1 | Database (managed Postgres) | RPO | **≤ 24 hours** (daily snapshot cadence; no PITR) |
| 2 | Application code (`main`) | RPO | 0 (commit-granular) |
| 3 | Application code rollback | RTO | ≤ 30 minutes |
| 4 | Database restore (platform daily snapshot) | RTO | ≤ 60 minutes |
| 5 | Application snapshot restore (`/admin/backups`) | RTO | ≤ 5 minutes |
| 6 | DNS routing (`joemelendezrealty.com`) | RTO | ≤ 4 hours |
| 7 | Custom-domain activation / `PUBLIC_SITE_ORIGIN` | RTO | ≤ 4 hours (bound to row 6) |

Row detail (measurement point, owner, recovery priority) is authoritative in §R3 of the packet
identified by the SHA-256 above.

## Monitoring item

**M-1 — 2026-08-10 backup gap: OPEN for monitoring.** No backup failure is inferred. Re-inspect the
Backups panel at the next gate review and confirm whether daily entries remain contiguous.

## Authorization boundary

This acceptance establishes recovery objectives only. It does **not** authorize:

- a database restore
- a code rollback
- any DNS change
- custom-domain activation
- a merge, publish, or deployment
- the T17-1 / T17-10 domain migration

## Gate state after acceptance

| Item | State |
| --- | --- |
| R1 — off-platform immutable checkpoint | **PENDING**, plan defined, nothing executed |
| R2 — platform backup evidence | **PASS** (M-1 open) |
| R3 — recovery objectives | **ACCEPTED** |
| Gate 3 | **PARTIAL** — clears only when R1 is completed and verified |
| Production | **BLOCKED** |
