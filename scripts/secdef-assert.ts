/**
 * Evidence assertion helper for the SECURITY DEFINER CI guard.
 *
 * Exit code alone is not sufficient proof that a negative path failed for the
 * intended reason, so each CI negative step asserts the CONTENT of the JSON
 * evidence it just produced.
 *
 *   bun run scripts/secdef-assert.ts <report.json> <expected-result> [fn=<sig> role=<role> checks=<a,b>]
 *
 * Examples:
 *   bun run scripts/secdef-assert.ts out.json FAIL fn=public.has_role(text) role=authenticated \
 *     checks=authenticated_execute_allowlist,authenticated_effective_allowlist
 *   bun run scripts/secdef-assert.ts out.json PASS
 */
import { readFileSync } from "node:fs";

interface Violation {
  check: string;
  finding: string;
  fn: string;
  role: string;
  detail: string;
}
interface Report {
  result: "PASS" | "FAIL";
  violations: Violation[];
}

const [file, expectedResult, ...rest] = process.argv.slice(2);
if (!file || !expectedResult) {
  console.error("usage: secdef-assert.ts <report.json> <PASS|FAIL> [fn=..] [role=..] [checks=a,b]");
  process.exit(2);
}

const opts = Object.fromEntries(
  rest.map(a => {
    const i = a.indexOf("=");
    return [a.slice(0, i), a.slice(i + 1)];
  }),
) as { fn?: string; role?: string; checks?: string };

let report: Report;
try {
  report = JSON.parse(readFileSync(file, "utf8")) as Report;
} catch (err) {
  console.error(`assert: cannot read/parse ${file}: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
  throw err;
}

const fail = (msg: string) => {
  console.error(`assert FAIL (${file}): ${msg}`);
  console.error(JSON.stringify(report.violations ?? [], null, 2));
  process.exit(1);
};

if (report.result !== expectedResult) {
  fail(`result is ${report.result}, expected ${expectedResult}`);
}

if (expectedResult === "PASS") {
  if ((report.violations ?? []).length !== 0) fail("PASS report still lists violations");
  console.log(`assert OK (${file}): PASS with zero violations`);
} else {
  const wantChecks = opts.checks ? opts.checks.split(",") : [];
  const norm = (s: string) => s.replace(/\s+/g, "");
  const match = (report.violations ?? []).find(
    v =>
      (!opts.fn || norm(v.fn) === norm(opts.fn)) &&
      (!opts.role || v.role === opts.role) &&
      (wantChecks.length === 0 || wantChecks.includes(v.check)),
  );
  if (!match) {
    fail(
      `no violation matching fn=${opts.fn ?? "*"} role=${opts.role ?? "*"} checks=[${wantChecks.join(",") || "*"}]`,
    );
  }
  console.log(
    `assert OK (${file}): FAIL with expected violation ${match!.fn} role=${match!.role} check=${match!.check}`,
  );
}
