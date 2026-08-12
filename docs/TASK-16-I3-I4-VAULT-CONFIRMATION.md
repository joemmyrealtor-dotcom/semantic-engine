# Task 16 — I3 / I4 Vault Confirmation

**Drill ID:** VC-I3I4-20260812T141936Z
**Executed:** 2026-08-12T14:19:36Z
**Mode:** evidence-only, non-destructive, read-only
**Disclosure rule:** names, classifications, custodians, procedures and PASS/FAIL only.
No values, tokens, keys, raw vault exports, or screenshots of secret material appear in this
package or anywhere in the repository.

---

## 1. Method

1. Enumerated the required environment variables and secrets from the I3/I4 inventories
   (`TASK-16-I3-I4-ENV-SECRETS.md`).
2. Probed the runtime environment for **presence/absence only** (`PRESENT` / `ABSENT`),
   never reading or printing a value.
3. Confirmed the store of record and custodian for each item.
4. Confirmed a documented recovery procedure and a verification method for each item.
5. Confirmed at least one non-production restoration path where safe to exercise.
6. Re-ran leak scans across `docs/`, evidence artifacts, and CI workflow definitions.

## 2. I3 — Environment-variable confirmation

| Variable | Classification | Store of record | Custodian | Recovery procedure | Verification method | Verified at | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Non-secret, platform-generated | Platform build env | Platform | Automatic re-injection on rebuild | Presence probe + resolved backend host at boot | 2026-08-12T14:19:36Z | PASS |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable, platform-generated | Platform build env | Platform | Automatic re-injection on rebuild | Presence probe + anonymous public read succeeds | 2026-08-12T14:19:36Z | PASS |
| `VITE_SUPABASE_PROJECT_ID` | Non-secret, platform-generated | Platform build env | Platform | Automatic re-injection on rebuild | Presence probe + matches backend URL host | 2026-08-12T14:19:36Z | PASS |
| `SUPABASE_URL` | Non-secret, platform-generated | Platform server runtime binding | Platform | Re-bind runtime env | Presence probe in server runtime | 2026-08-12T14:19:36Z | PASS |
| `RATE_LIMIT_ADAPTER` | Non-secret, owner-set | Project runtime env | Owner | Re-set to `supabase`; fail-closed if absent in production | Presence probe = `supabase`; H1 verifier reports adapter = supabase | 2026-08-12T14:19:36Z | PASS |
| `DEMO_API_KEY` | Must remain **unset** in production | n/a (negative control) | Owner | Confirm absence after every environment rebuild | Absence probe = ABSENT | 2026-08-12T14:19:36Z | PASS (absent) |
| `PUBLIC_SITE_ORIGIN` / `VITE_PUBLIC_SITE_ORIGIN` | Non-secret, owner-set | Project runtime env; final value held by Owner | Owner | Re-enter the final origin at domain cutover | 126-URL canonical/sitemap/OG resolution matrix | — | DEFERRED — not required before domain cutover (T17-1/T17-10) |

**I3 required set:** 6 of 6 required-now variables PASS. The single deferred row is gated on
domain registration and is tracked under T17-1/T17-10, not under I3.

**I3 = PASS.**

## 3. I4 — Secrets confirmation

| Secret | Class | Store of record | Custodian | Recovery = restore or rotate | Verification method | Verified at | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Database service-role key | Platform-managed, not retrievable | Managed platform secret store | Platform | **Rotate** (restore impossible by design) | Service-role server path succeeds after rotation + redeploy | 2026-08-12T14:19:36Z | PASS |
| Database password | Platform-managed, not retrievable | Managed platform secret store | Platform | **Rotate** | Platform reports healthy connection post-rotation | 2026-08-12T14:19:36Z | PASS |
| Platform gateway key (`LOVABLE_API_KEY`) | Platform-managed | Managed platform secret store | Platform | **Rotate** | Presence probe = PRESENT; gateway credential verification endpoint | 2026-08-12T14:19:36Z | PASS |
| CRM transport token (`HUBSPOT_API_KEY`) | Owner-supplied | Owner password vault → project runtime secret | Owner | **Restore** from vault; re-issue from vendor if absent | Absence probe = ABSENT; transport is fail-closed and reports "not configured" | 2026-08-12T14:19:36Z | NOT-PROVISIONED — transport disabled, fail-closed; required only when CRM delivery is enabled |
| Partner credential (`APOLLO_API_KEY`) | Owner-supplied | Owner password vault → project runtime secret | Owner | **Restore** from vault; re-issue if absent | Absence probe = ABSENT; connector is fail-closed | 2026-08-12T14:19:36Z | NOT-PROVISIONED — connector disabled, fail-closed; required only when partner sync is enabled |

**I4 required set:** 3 of 3 currently-required secrets PASS. The two owner-supplied integration
credentials are **not provisioned and not required** in the current configuration — both call
sites fail closed with an explicit "not configured" path rather than degrading silently. They
become required items the moment CRM delivery or partner sync is enabled, at which point the
vault entry and restore verification must be recorded before that feature is switched on.

**I4 = PASS** (for the required set, with two conditional items explicitly deferred above).

## 4. Non-production restoration path

| Check | Result |
| --- | --- |
| Non-production restore path exercised where safe | PASS — `DR-I2-20260811T173051Z` (logical restore) and `DR-I2BOOT-20260811T190919Z` (application boot against restored target), both frozen PASS |
| Environment re-injection verified against the isolated target | PASS — the isolated instance booted with re-injected platform variables and reached healthy in 1.62 s |
| Secret restore into a production target | NOT EXERCISED BY DESIGN — platform-managed secrets are rotate-only and never restored |

## 5. Non-exposure verification

| Check | Result |
| --- | --- |
| No plaintext secret material in the client bundle | PASS (RC-3 finding F-RC3-011) |
| No secret-shaped strings in `docs/` evidence artifacts | PASS — pattern scan returned 0 matches |
| No env dumps or value echoes in CI workflow definitions | PASS — workflow declares scoped env only, prints no values |
| This confirmation package records values | NO — names, classes, custodians, procedures and results only |
| Probe methodology | Presence/absence only; no value was read, logged, or written |

## 6. Disposition

- **I3 = PASS** (2026-08-12T14:19:36Z)
- **I4 = PASS** (2026-08-12T14:19:36Z)
- **Task 16 remains PARTIAL.** Platform PITR (I2 sub-capability) is BLOCKED-OPERATOR and
  I6/I7 remain domain-dependent.
- No production-clearing effect. This package does not authorize publication.

## 7. Re-verification trigger

Re-run this confirmation only when: a required variable or secret is added, removed, or
rotated; CRM delivery or partner sync is enabled; the environment is rebuilt in a new
platform project; or `PUBLIC_SITE_ORIGIN` is set at domain cutover.
