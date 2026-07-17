// axe-core accessibility scans on representative surfaces.
// Serious + critical violations fail the test. We do not blanket-disable
// rules; every exception is narrowly documented below.

import AxeBuilder from "@axe-core/playwright";
import { test, expect, type E2EActor } from "./fixtures";

const CRITICAL = new Set(["serious", "critical"]);

/**
 * Narrow, documented axe exceptions. Extend deliberately.
 * Each entry: rule id, why it is safe to exclude, and the remediation owner.
 */
const EXCLUDED_RULES: { id: string; reason: string; owner: string }[] = [
  // color-contrast: shadcn default palette meets AA; individual failures
  // are addressed in-product. If a temporary excursion is needed for a
  // brand-token experiment, list it here with an owner.
];

async function scan(page: import("@playwright/test").Page) {
  const builder = new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  for (const ex of EXCLUDED_RULES) builder.disableRules(ex.id);
  const results = await builder.analyze();
  return results.violations.filter(v => CRITICAL.has(v.impact ?? "minor"));
}

const ADMIN: E2EActor = { userId: "e2e:admin", role: "Administrator", email: "admin@e2e.test" };

const ROUTES: { path: string; note: string }[] = [
  { path: "/auth", note: "sign-in" },
  { path: "/", note: "dashboard" },
  { path: "/repository", note: "repository list" },
  { path: "/publications", note: "publications registry" },
  { path: "/developer", note: "public API catalog" },
  { path: "/admin/audit", note: "audit ledger" },
  { path: "/admin/monitoring", note: "monitoring" },
  { path: "/admin/backups", note: "backups" },
  { path: "/admin/workspaces", note: "workspaces" },
  { path: "/admin/deployment", note: "deployment readiness" },
];

test.describe("Accessibility (axe-core, serious+critical fail-gate)", () => {
  for (const r of ROUTES) {
    test(`a11y: ${r.note} (${r.path})`, async ({ page, asActor }) => {
      if (r.path !== "/auth") await asActor(ADMIN);
      await page.goto(r.path);
      await page.waitForLoadState("networkidle").catch(() => { /* best effort */ });
      const violations = await scan(page);
      if (violations.length) {
        console.log(`\n[a11y] ${r.path} — ${violations.length} serious/critical:`);
        for (const v of violations) {
          console.log(`  ${v.id} (${v.impact}) — ${v.help}`);
          for (const n of v.nodes.slice(0, 3)) {
            console.log(`    target: ${n.target.join(" ")}`);
          }
        }
      }
      expect(violations, `serious/critical a11y violations on ${r.path}`).toEqual([]);
    });
  }
});
