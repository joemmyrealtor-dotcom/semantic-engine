# Task 16 — I3 Environment-Variable Recovery / I4 Secrets Recovery

**Compiled:** 2026-08-11T17:30Z
**Rule:** no secret values appear in this package, in the repository, in logs, or in any evidence
artifact. Only names, classifications, custodians, and procedures are recorded.

---

## 1. I3 — Environment-variable inventory

| Variable | Required? | Storage / source of truth | Custodian | Recovery procedure | Verification method |
| --- | --- | --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Required | Platform-generated, injected at build | Platform | Automatic re-injection on rebuild | App boot diagnostics show a resolved backend URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Required | Platform-generated, injected at build | Platform | Automatic re-injection on rebuild | Anonymous read of a public table succeeds |
| `VITE_SUPABASE_PROJECT_ID` | Required | Platform-generated, injected at build | Platform | Automatic re-injection on rebuild | Present in build env; matches backend URL host |
| `SUPABASE_URL` | Required (server) | Platform-generated runtime binding | Platform | Re-bind runtime env | Server function executes a service-role read |
| `PUBLIC_SITE_ORIGIN` / `VITE_PUBLIC_SITE_ORIGIN` | Required at domain cutover; currently unset | Owner-set, recorded in owner password vault | Owner | Re-enter the final origin value in project env | Canonical/sitemap/OG output resolves to the configured origin across the 126-URL matrix |
| `RATE_LIMIT_ADAPTER` | Required in production (`supabase`) | Owner-set | Owner | Re-set to `supabase` | H1 gate verifier reports adapter = supabase; absence fails closed |
| `DEMO_API_KEY` | Must remain **unset** in production | n/a | Owner | Confirm absence after any environment rebuild | Deployment check asserts the variable is not present |

**I3 status:** REVIEW → closes to PASS when the owner confirms a vault entry exists for every
owner-set row (`PUBLIC_SITE_ORIGIN`, `RATE_LIMIT_ADAPTER`) and attests the `DEMO_API_KEY`
absence check.

## 2. I4 — Secrets inventory

| Secret | Class | Storage | Custodian | Recovery = restore or rotate? | Verification method |
| --- | --- | --- | --- | --- | --- |
| Database service-role key | Platform-managed | Managed platform secret store; not retrievable | Platform | **Rotate** (not retrievable, so restore is impossible) | Service-role server function succeeds after rotation + redeploy |
| Database password | Platform-managed | Managed platform secret store; not retrievable | Platform | **Rotate** | Platform reports a healthy connection post-rotation |
| CRM / lead transport token (HubSpot) | Owner-supplied | Owner password vault + project runtime secret | Owner | **Restore** from vault; re-issue from vendor if vault entry missing | `/admin/lead-delivery` test transport returns success without exposing the value |
| Apollo / partner API credential | Owner-supplied | Owner password vault + project runtime secret | Owner | **Restore** from vault; re-issue if absent | Partner connector health check passes |

### Rotation / recovery procedure

1. Identify the affected secret and its custodian from the table above.
2. Platform-managed: rotate API keys on the managed backend, then redeploy so server functions
   pick up the new values. Restore is not available by design.
3. Owner-supplied: re-read from the owner vault and re-enter as a project runtime secret; if no
   vault entry exists, re-issue from the upstream vendor and create the vault entry.
4. Re-run the verification method in the table. Record only pass/fail — never the value.

### Non-exposure verification

| Check | Result |
| --- | --- |
| No plaintext secrets in the client bundle | PASS (RC-3 finding F-RC3-011) |
| No secret values in `docs/` evidence artifacts | PASS (this package records names only) |
| No secret values echoed to CI logs | PASS (CI workflow prints no env dumps) |
| Secret restored into a non-production verification target | NOT EXERCISED — requires the separate non-production project from I2 check 8 |

**I4 status:** REVIEW → closes to PASS when the owner confirms vault entries for both
owner-supplied secrets and completes a secret-restore verification in the non-production target.
