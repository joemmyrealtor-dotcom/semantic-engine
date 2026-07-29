/**
 * SECURITY DEFINER execute-grant guard.
 *
 * Re-runs the two targeted checks that were remediated in the
 * "tighten SECURITY DEFINER execute grants" migration:
 *
 *   1. HARD FAIL  - no SECURITY DEFINER function in `public` may grant
 *                   EXECUTE to `anon` or to PUBLIC.
 *                   (finding: SUPA_anon_security_definer_function_executable)
 *   2. ALLOWLIST  - only the four RLS helper functions may grant EXECUTE
 *                   to `authenticated`. Any new one is a hard fail.
 *                   (finding: SUPA_authenticated_security_definer_function_executable)
 *
 *   bun run scripts/secdef-check.ts [--json=path.json]
 *
 * Connection comes from the standard PG* env vars (PGHOST, PGPORT, PGUSER,
 * PGPASSWORD, PGDATABASE) or from DATABASE_URL.
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Functions intentionally callable by signed-in users. These are required for
 * RLS policy evaluation — see docs / security memory. Adding to this list is a
 * deliberate security decision and must be reviewed.
 */
const AUTHENTICATED_ALLOWLIST = new Set([
  "has_role",
  "has_any_role",
  "workspace_role",
  "is_workspace_member",
]);

/** Roles that must never hold EXECUTE on a SECURITY DEFINER function. */
const FORBIDDEN_ROLES = new Set(["anon", "public", "PUBLIC", "-"]);

const QUERY = `
SELECT p.proname || '|' || COALESCE(NULLIF(r.rolname, ''), 'PUBLIC')
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
LEFT JOIN pg_roles r ON r.oid = acl.grantee
WHERE n.nspname = 'public'
  AND p.prosecdef
  AND acl.privilege_type = 'EXECUTE'
ORDER BY 1
`.trim();

function psql(sql: string): string {
  const target = process.env.DATABASE_URL ? `"${process.env.DATABASE_URL}"` : "";
  return execSync(`psql ${target} -Atqc "${sql.replace(/"/g, '\\"')}"`, {
    encoding: "utf8",
  });
}

interface Violation {
  check: string;
  finding: string;
  fn: string;
  role: string;
  detail: string;
}

function main() {
  let raw: string;
  try {
    raw = psql(QUERY);
  } catch (err) {
    console.error("secdef-check: could not query the database.");
    console.error(String(err instanceof Error ? err.message : err));
    process.exit(2);
    return;
  }

  const grants = raw
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const [fn, role] = l.split("|");
      // grantee oid 0 => PUBLIC, rendered as an empty rolname by the LEFT JOIN
      return { fn, role: role || "PUBLIC" };
    });

  const violations: Violation[] = [];

  for (const { fn, role } of grants) {
    if (FORBIDDEN_ROLES.has(role)) {
      violations.push({
        check: "anon_or_public_execute",
        finding: "SUPA_anon_security_definer_function_executable",
        fn,
        role,
        detail: `public.${fn}() is SECURITY DEFINER and grants EXECUTE to ${role}. REVOKE EXECUTE ON FUNCTION public.${fn} FROM ${role === "PUBLIC" ? "PUBLIC" : role};`,
      });
    }

    if (role === "authenticated" && !AUTHENTICATED_ALLOWLIST.has(fn)) {
      violations.push({
        check: "authenticated_execute_allowlist",
        finding: "SUPA_authenticated_security_definer_function_executable",
        fn,
        role,
        detail: `public.${fn}() is SECURITY DEFINER and grants EXECUTE to authenticated but is not on the reviewed RLS-helper allowlist. Revoke it, or add it to AUTHENTICATED_ALLOWLIST with a security review.`,
      });
    }
  }

  const report = {
    ranAt: new Date().toISOString(),
    functionsInspected: [...new Set(grants.map(g => g.fn))].length,
    grants,
    allowlist: [...AUTHENTICATED_ALLOWLIST],
    violations,
    result: violations.length === 0 ? "PASS" : "FAIL",
  };

  const jsonArg = process.argv.find(a => a.startsWith("--json="))?.slice(7);
  if (jsonArg) {
    const out = resolve(process.cwd(), jsonArg);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(report, null, 2));
  }

  console.log(`SECURITY DEFINER functions inspected: ${report.functionsInspected}`);
  for (const g of grants) {
    console.log(`  ${g.fn} -> ${g.role}`);
  }

  if (violations.length === 0) {
    console.log("\nPASS: no anon/PUBLIC execute grants; authenticated grants match the reviewed allowlist.");
    return;
  }

  console.error(`\nFAIL: ${violations.length} violation(s)`);
  for (const v of violations) {
    console.error(`  [${v.finding}] ${v.detail}`);
  }
  process.exit(1);
}

main();
