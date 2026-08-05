// Operations Command Center (provisional) — structure, truth-model, and
// role-matrix coverage. The OCC subtree must be strictly read-only for every
// role, and must never present a false PASS.

import { test, expect, type E2EActor } from "./fixtures";

const OCC_ROUTES = ["/admin/monitoring", "/operations"] as const;
const SECTIONS = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12"];

const ROLES: E2EActor["role"][] = ["Owner", "Editor", "Reviewer", "Contributor", "Viewer"];

async function occReady(page: import("@playwright/test").Page, route: string) {
  await page.goto(route);
  await expect(page.getByTestId("occ-dashboard")).toBeVisible({ timeout: 20_000 });
}

test.describe("OCC structure", () => {
  for (const route of OCC_ROUTES) {
    test(`all twelve sections render on ${route}`, async ({ page, asActor }) => {
      await asActor({ userId: "e2e:owner", role: "Owner", displayLabel: "Owner User" });
      await occReady(page, route);
      await expect(page.getByTestId("occ-provisional-banner")).toBeVisible();
      for (const id of SECTIONS) {
        await expect(page.getByTestId(`occ-panel-${id}`)).toBeVisible();
      }
    });
  }

  test("each panel separates source-data timestamp from computation time", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:owner", role: "Owner", displayLabel: "Owner User" });
    await occReady(page, "/admin/monitoring");
    for (const id of SECTIONS) {
      await expect(page.getByTestId(`occ-${id}-computed`)).not.toBeEmpty();
      const source = (await page.getByTestId(`occ-${id}-timestamp`).innerText()).trim();
      expect(source.length).toBeGreaterThan(0);
    }
    // Roll-up and untimestamped panels must declare UNVERIFIED freshness.
    for (const id of ["S1", "S6", "S8"]) {
      await expect(page.getByTestId(`occ-${id}-timestamp`)).toHaveText("UNVERIFIED");
    }
  });

  test("S1 rolls up to BLOCKED and S4 is BLOCKED", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:owner", role: "Owner", displayLabel: "Owner User" });
    await occReady(page, "/admin/monitoring");
    await expect(page.getByTestId("occ-panel-S1")).toContainText("BLOCKED");
    await expect(page.getByTestId("occ-panel-S4")).toContainText("BLOCKED");
    // No false PASS at the executive level.
    await expect(page.getByTestId("occ-panel-S1").getByText(/^OK$/)).toHaveCount(0);
  });

  test("S10 lists the complete held risk set", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:owner", role: "Owner", displayLabel: "Owner User" });
    await occReady(page, "/admin/monitoring");
    const s10 = page.getByTestId("occ-panel-S10");
    for (const label of [
      "Production Release Standard v1.0.3",
      "Operations Command Center v1.0.2",
      "GitHub Actions enforcement",
      "Branch protection",
      "Production database restore",
      "Production infrastructure recovery",
      "Production RPO",
      "Production RTO",
      "Production rollback capability",
      "Production release activity",
    ]) {
      await expect(s10).toContainText(label);
    }
  });
});

test.describe("OCC role matrix", () => {
  for (const role of ROLES) {
    test(`${role} sees the OCC read-only with no action controls`, async ({ page, asActor }) => {
      await asActor({ userId: `e2e:${role.toLowerCase()}`, role, displayLabel: `${role} User` });
      await occReady(page, "/admin/monitoring");
      await expect(page.getByTestId("occ-provisional-banner")).toBeVisible();
      for (const id of SECTIONS) {
        await expect(page.getByTestId(`occ-panel-${id}`)).toBeVisible();
      }
      const occ = page.getByTestId("occ-dashboard");
      // Strictly read-only subtree: no interactive controls of any kind.
      expect(await occ.locator("button, input, select, textarea, [role=button]").count()).toBe(0);
      // And specifically none of the prohibited operational actions.
      await expect(occ.getByText(/publish|rollback|restore|re-attest|capture baseline/i)).toHaveCount(0);
    });
  }

  test("unauthenticated caller is not shown OCC action controls", async ({ page, asSignedOut }) => {
    await asSignedOut();
    await page.goto("/admin/monitoring");
    await expect(page.locator("main")).toBeVisible();
    const occ = page.getByTestId("occ-dashboard");
    if (await occ.count()) {
      expect(await occ.locator("button, input, select, textarea, [role=button]").count()).toBe(0);
    }
  });
});

test.describe("OCC responsive", () => {
  test("renders all sections on a mobile viewport", async ({ page, asActor }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await asActor({ userId: "e2e:viewer", role: "Viewer", displayLabel: "Viewer User" });
    await occReady(page, "/admin/monitoring");
    for (const id of SECTIONS) {
      await expect(page.getByTestId(`occ-panel-${id}`)).toBeVisible();
    }
    // No horizontal overflow.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });
});
