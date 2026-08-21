# Task 15 — Branch Protection Evidence Checklist

**Repository:** `joemmyrealtor-dotcom/semantic-engine`  
**Website domain:** `joemelendezrealty.com`
**Branch:** `main`  
**Status:** **PASS** — Option A screenshot evidence accepted 2026-08-21

---

## Verification log

| Date (UTC) | Event |
|---|---|
| 2026-08-21 | Owner reported saving the `main` rule with all six controls in the approved state. |
| 2026-08-21 | Programmatic verification **not possible** — the GitHub connector was declined, so no API read of `/branches/main/protection` could be performed from Lovable. |
| 2026-08-21 | **Option A evidence received.** Two screenshots of `settings/branch_protection_rules/81939926` for `main` show: Require a pull request before merging ✅ (Require approvals ✅, 1 approval); Require status checks to pass before merging ✅ with Require branches to be up to date ✅ and **`SECURITY DEFINER execute grants` (GitHub Actions) listed under "Status checks that are required"**; Do not allow bypassing the above settings ✅; Allow force pushes ❌; Allow deletions ❌. |
| 2026-08-21 | **Task 15 marked PASS.** All six required controls verified against this checklist. |

### Evidence state verified (all six controls)

| Setting | Required | Observed |
|---|---|---|
| Require a pull request before merging | ✅ | ✅ Checked |
| Require status checks to pass before merging | ✅ | ✅ Checked |
| `SECURITY DEFINER execute grants` required | ✅ | ✅ Listed as required (GitHub Actions) |
| Do not allow bypassing the above settings | ✅ | ✅ Checked |
| Allow force pushes | ❌ | ❌ Unchecked |
| Allow deletions | ❌ | ❌ Unchecked |

---




## Required evidence to mark Task 15 PASS

Provide **one** of the following for the `main` branch:

### Option A — Screenshot (simplest)

A screenshot of **Settings → Branches → `main` → Branch protection rule** showing all of the following toggles:

| Setting | Required value |
|---|---|
| **Require a pull request before merging** | ✅ Enabled |
| **Require status checks to pass before merging** | ✅ Enabled |
| **Status checks that are required** | `SECURITY DEFINER execute grants` is selected in the search list and appears as required |
| **Do not allow bypassing the above settings** | ✅ Enabled |
| **Allow force pushes** | ❌ Disabled / Unchecked |
| **Allow deletions** | ❌ Disabled / Unchecked |

### Option B — GitHub API response

Run the following (with a `repo` or `administration:read` token) and paste the JSON:

```bash
gh api repos/joemmyrealtor-dotcom/semantic-engine/branches/main/protection
```

The response must show:

- `required_pull_request_reviews` is present and non-null.
- `required_status_checks.contexts` or `required_status_checks.checks` contains `SECURITY DEFINER execute grants`.
- `enforce_admins.enabled` is `true` (no bypass).
- `allow_force_pushes.enabled` is `false`.
- `allow_deletions.enabled` is `false`.

### Option C — Recent PR merge box screenshot

A screenshot of a recent or test pull request against `main` where the merge box shows:

- `SECURITY DEFINER execute grants` listed as a **required** check.
- The check is green / passing.
- A message indicating at least one approving review is required (if reviews are enforced).

---

## Additional notes

- Repository must remain **Public** (Task 14 already PASS).
- If branch protection is configured but the status check name differs from `SECURITY DEFINER execute grants`, report the exact name shown in the UI and the agent will confirm whether it matches the workflow job defined in `.github/workflows/secdef-check.yml`.
- Once this evidence is supplied and verified, Task 15 will be marked **PASS**.
- **After Task 15 passes, Joe’s explicit approval is required before any of the following are performed:**
  - Changing `PUBLIC_SITE_ORIGIN` / `VITE_PUBLIC_SITE_ORIGIN` to `https://joemelendezrealty.com`.
  - Regenerating the 126 canonical URLs, sitemap URLs, Open Graph URLs, or JSON-LD `@id` values.
  - Publishing, deploying, or activating the custom domain.

---

## Why this matters

Branch protection is the last owner-controlled launch gate before the atomic T17-1 / T17-10 domain migration. It guarantees that the final origin swap and any subsequent production changes must pass peer review and the SECURITY DEFINER guard before reaching `main`.
