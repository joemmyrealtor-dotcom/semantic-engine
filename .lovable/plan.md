# Security Triage — Release-Freeze Report

Freeze intact. No code, schema, secrets, memberships, evidence, or fingerprint changes proposed. Build fingerprint `srv-2fa8803f` unchanged. Launch remains blocked.

## The Critical Finding

- **Title:** All authenticated users can read every user's email address
- **Scanner ID:** `PUBLIC_USER_DATA`
- **Severity:** error (critical) — the only non-warn finding in the scan; the other 8 items are warn-level `SECURITY DEFINER` executability notices and two additional warn-level RLS-scope issues (`review_items`, `audit_events`) that do NOT block publish.
- **Affected surface:** Supabase table `public.profiles`, RLS policy **`profiles public directory`**
- **Not a code/route issue:** no file under `src/` needs to change; this is a database policy.

## Exact Evidence (live query against production DB)

`pg_policies` for `public.profiles` currently contains:

```text
policyname                     cmd     roles           qual                                              with_check
profiles public directory      SELECT  {authenticated} true                                              NULL
profiles self or owner read    SELECT  {authenticated} auth.uid()=id OR has_role(auth.uid(),'owner')     NULL
profiles self insert           INSERT  {authenticated} NULL                                              auth.uid()=id
profiles self update           UPDATE  {authenticated} auth.uid()=id                                     auth.uid()=id
```

The `profiles public directory` policy has `USING (true)` for role `authenticated`. Because PostgREST OR-combines permissive SELECT policies, this single row makes the narrower `profiles self or owner read` policy irrelevant. Columns on `public.profiles` include `email` and `display_name`, so every signed-in user can `SELECT id, email, display_name, …` for every other user.

## Exploit Scenario

1. Attacker signs up through `/auth` (self-serve email/password is enabled; first-user-owner logic does not gate later signups).
2. From the browser, with only the publishable anon key, they run
   `supabase.from('profiles').select('id,email,display_name')`.
3. RLS lets it through via `profiles public directory`, returning the full user directory — including `joe@cb-diamond.com`, `joemmyrealtor@gmail.com`, and any future Owner/Editor/Reviewer emails.
4. Harvested emails enable targeted phishing, credential-stuffing, and Owner-account social engineering against the very accounts that attest launch gates.

## True Positive / False Positive

**True positive.** The policy is literally `USING (true)` on a table containing PII (`email`). The narrower self-or-owner policy exists but is overridden by the permissive one. There is no application-layer view or column filter enforcing masking; the schema exposes the full row.

## Smallest Safe Remediation (to be applied only after release-freeze lifts)

Single-migration change, no code touched, no route touched, no data mutated:

```sql
-- Remove the overly-broad directory policy.
-- 'profiles self or owner read' already allows a user to read their own row
-- and Owners to read all rows, which matches the intended access model.
DROP POLICY "profiles public directory" ON public.profiles;
```

If a directory feature is genuinely required later, reintroduce it as a **`SECURITY DEFINER` view** exposing only non-sensitive columns (e.g. `id`, `display_name`) with its own grant, rather than a `USING (true)` policy on the base table. Do not add such a view as part of this remediation — scope is strictly closing the leak.

## Verification Steps (post-fix, still no publish)

1. Re-run `pg_policies` query — confirm `profiles public directory` is gone and only the self/owner + self insert/update policies remain.
2. As a non-Owner authenticated user, `select id,email from profiles` must return only that user's own row.
3. As Owner, the same query must still return all rows (unchanged).
4. Re-run `security--run_security_scan`; confirm `PUBLIC_USER_DATA` is no longer present. Warn-level items (`SECURITY DEFINER` executable, `review_items`/`audit_events` scoping) remain out of scope for this triage and do not block publish.
5. Only then request publish authorization.

## Status

- Finding **not** ignored, **not** dismissed, **not** marked fixed.
- No remediation applied in this turn (release freeze).
- Publish remains correctly blocked by the platform's critical-finding gate.
- Awaiting operator decision to lift freeze for the single `DROP POLICY` migration above, or to defer.
