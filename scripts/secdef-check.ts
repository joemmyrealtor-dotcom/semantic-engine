/**
 * SECURITY DEFINER execute-grant guard.
 *
 * Re-runs the two targeted checks that were remediated in the
 * "tighten SECURITY DEFINER execute grants" migration:
 *
 *   1. HARD FAIL  - no SECURITY DEFINER function in `public` may grant
 *                   EXECUTE to `anon` or to PUBLIC, whether by a direct ACL
 *                   entry or by inherited/effective privilege.
 *                   (finding: SUPA_anon_security_definer_function_executable)
 *   2. ALLOWLIST  - only the four RLS helper functions, identified by their
 *                   exact signature, may be EXECUTE-able by `authenticated`.
 *                   Any other one is a hard fail.
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
 * Functions intentionally callable by signed-in users, keyed by EXACT identity
 * signature (schema-qualified name + argument types) so that an overload
 * sharing an approved name does NOT silently pass. These are required for RLS
 * policy evaluation — see docs / security memory. Adding to this list is a
 * deliberate security decision and must be reviewed.
 */
const AUTHENTICATED_ALLOWLIST = new Set([
  "public.has_role(uuid,app_role)",
  "public.has_any_role(uuid,app_role[])",
  "public.workspace_role(uuid,uuid)",
  "public.is_workspace_member(uuid,uuid)",
]);

/** Roles that must never hold EXECUTE on a SECURITY DEFINER function. */
const FORBIDDEN_ROLES = new Set(["anon", "public", "PUBLIC", "-"]);

/** Normalize a regprocedure/identity rendering into a comparable key. */
function normalizeSig(schema: string, name: string, args: string): string {
  const a = args.replace(/\s+/g, "").replace(/"/g, "");
  return `${schema}.${name}(${a})`;
}

/**
 * One row per SECURITY DEFINER function in `public`:
 *   schema | name | identity args | direct ACL grantee (or '' for none)
 *   | effective EXECUTE for anon | effective EXECUTE for authenticated
 *
 * `has_function_privilege` resolves inherited role membership, so a grant made
 * to a role that `anon`/`authenticated` inherits from is still caught.
 */
const QUERY = `
SELECT n.nspname
  || '\u0001' || p.proname
  || '\u0001' || pg_get_function_identity_arguments(p.oid)
  || '\u0001' || COALESCE(NULLIF(r.rolname, ''), CASE WHEN acl.grantee IS NULL THEN '' ELSE 'PUBLIC' END)
  || '\u0001' || has_function_privilege('anon', p.oid, 'EXECUTE')::text
  || '\u0001' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
  ON acl.privilege_type = 'EXECUTE'
LEFT JOIN pg_roles r ON r.oid = acl.grantee
WHERE n.nspname = 'public'
  AND p.prosecdef
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

  const rows = raw
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const [schema, name, args, grantee, anonEff, authEff] = l.split("\u0001");
      return {
        sig: normalizeSig(schema, name, args ?? ""),
        grantee: grantee || null,
        anonEffective: anonEff === "t" || anonEff === "true",
        authenticatedEffective: authEff === "t" || authEff === "true",
      };
    });

  const violations: Violation[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    // ---- direct ACL entries ----
    if (row.grantee && FORBIDDEN_ROLES.has(row.grantee)) {
      violations.push({
        check: "anon_or_public_execute",
        finding: "SUPA_anon_security_definer_function_executable",
        fn: row.sig,
        role: row.grantee,
        detail: `${row.sig} is SECURITY DEFINER and grants EXECUTE to ${row.grantee}. REVOKE EXECUTE ON FUNCTION ${row.sig} FROM ${row.grantee === "PUBLIC" ? "PUBLIC" : row.grantee};`,
      });
    }
    if (row.grantee === "authenticated" && !AUTHENTICATED_ALLOWLIST.has(row.sig)) {
      violations.push({
        check: "authenticated_execute_allowlist",
        finding: "SUPA_authenticated_security_definer_function_executable",
        fn: row.sig,
        role: "authenticated",
        detail: `${row.sig} is SECURITY DEFINER and grants EXECUTE to authenticated but its exact signature is not on the reviewed RLS-helper allowlist. Revoke it, or add the signature to AUTHENTICATED_ALLOWLIST with a security review.`,
      });
    }

    // ---- effective (inheritance-aware) privileges, once per function ----
    if (seen.has(row.sig)) continue;
    seen.add(row.sig);

    if (row.anonEffective) {
      violations.push({
        check: "anon_effective_execute",
        finding: "SUPA_anon_security_definer_function_executable",
        fn: row.sig,
        role: "anon",
        detail: `${row.sig} is effectively EXECUTE-able by anon (has_function_privilege), possibly via PUBLIC or inherited role membership. Revoke the grant at its source.`,
      });
    }
    if (row.authenticatedEffective && !AUTHENTICATED_ALLOWLIST.has(row.sig)) {
      violations.push({
        check: "authenticated_effective_allowlist",
        finding: "SUPA_authenticated_security_definer_function_executable",
        fn: row.sig,
        role: "authenticated",
        detail: `${row.sig} is effectively EXECUTE-able by authenticated (has_function_privilege) but is not on the reviewed RLS-helper allowlist.`,
      });
    }
  }

  const report = {
    ranAt: new Date().toISOString(),
    functionsInspected: seen.size,
    functions: [...seen].map(sig => {
      const r = rows.find(x => x.sig === sig)!;
      return {
        signature: sig,
        directGrantees: rows.filter(x => x.sig === sig && x.grantee).map(x => x.grantee),
        anonEffectiveExecute: r.anonEffective,
        authenticatedEffectiveExecute: r.authenticatedEffective,
      };
    }),
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
  for (const f of report.functions) {
    console.log(
      `  ${f.signature} -> direct[${f.directGrantees.join(",") || "none"}] anon=${f.anonEffectiveExecute} authenticated=${f.authenticatedEffectiveExecute}`,
    );
  }

  if (violations.length === 0) {
    console.log("\nPASS: no anon/PUBLIC execute grants (direct or effective); authenticated access matches the reviewed signature allowlist.");
    return;
  }

  console.error(`\nFAIL: ${violations.length} violation(s)`);
  for (const v of violations) {
    console.error(`  [${v.finding}] ${v.detail}`);
  }
  process.exit(1);
}

main();
