# SECURITY DEFINER guard — retained local evidence

Controlled evidence for the migration-triggered SECURITY DEFINER CI guard
(`scripts/secdef-check.ts`, `.github/workflows/secdef-check.yml`).
Produced locally against an ephemeral PostgreSQL instance with all
`supabase/migrations/*.sql` replayed in order. **No production contact.**

| File | Path under test | Expected | Recorded |
| --- | --- | --- | --- |
| `secdef-negative-anon.json` | isolated `public.__secdef_probe()`, `REVOKE ALL ... FROM PUBLIC`, `GRANT EXECUTE ... TO anon` | FAIL, exit 1 | FAIL, exit 1, violation `public.__secdef_probe()` / role `anon` / check `anon_or_public_execute` |
| `secdef-negative-overload.json` | isolated `public.has_role(text)`, `REVOKE ALL ... FROM PUBLIC` and `FROM anon`, `GRANT EXECUTE ... TO authenticated` | FAIL, exit 1 | FAIL, exit 1, violation `public.has_role(text)` / role `authenticated` / check `authenticated_execute_allowlist` |
| `secdef-check.json` | clean schema after both probes dropped | PASS, exit 0 | PASS, exit 0, 7 functions inspected, 0 violations |

Isolation proof recorded during the overload run:
`anon_execute=false authenticated_execute=true` — the failure can only come
from signature-level allowlisting, not from PUBLIC/anon reachability.

Content assertions (not exit code alone) are enforced by
`scripts/secdef-assert.ts`, which the CI workflow runs after every path.

Scope note: these artifacts are LOCAL evidence. CI enforcement remains
NOT VERIFIED until a completed GitHub Actions run on the committed revision
uploads the `secdef-check-evidence` artifact, and until branch protection
requires the status check named `SECURITY DEFINER execute grants`.
