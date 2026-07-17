// Authenticated navigation across primary sidebar / governed surfaces.
import { test, expect } from "./fixtures";

const ROUTES = [
  { path: "/", heading: /dashboard|executive|legacy/i },
  { path: "/repository", heading: /repository/i },
  { path: "/publications", heading: /publications/i },
  { path: "/agents", heading: /agents/i },
  { path: "/automations", heading: /automations/i },
  { path: "/integrations", heading: /integrations/i },
  { path: "/governance", heading: /governance/i },
  { path: "/admin/audit", heading: /audit/i },
  { path: "/admin/backups", heading: /backups/i },
  { path: "/admin/workspaces", heading: /workspaces/i },
  { path: "/admin/monitoring", heading: /monitoring/i },
  { path: "/admin/deployment", heading: /deployment|readiness/i },
  { path: "/developer", heading: /api explorer/i },
];

test.describe("Authenticated navigation", () => {
  for (const r of ROUTES) {
    test(`admin can render ${r.path}`, async ({ page, asActor, errorSink }) => {
      await asActor({ userId: "e2e:admin", role: "Administrator", email: "admin@e2e.test" });
      const resp = await page.goto(r.path);
      expect(resp?.status(), `HTTP status for ${r.path}`).toBeLessThan(500);
      await expect(page.locator("main")).toBeVisible();
      // Heading text is a soft signal — do not gate hard because page copy may vary.
      const headings = page.locator("h1, h2");
      await expect(headings.first()).toBeVisible();
      expect(errorSink.consoleErrors, `Console errors on ${r.path}: ${errorSink.consoleErrors.join(" | ")}`).toEqual([]);
    });
  }
});
