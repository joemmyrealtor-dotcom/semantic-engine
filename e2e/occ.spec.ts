// Operations Command Center (provisional) — structure, truth-model, and
// role-matrix coverage. The OCC subtree must be strictly read-only for every
// role, must never present a false PASS, and must not render at all when no
// authenticated actor is present.

import { test, expect, type E2EActor } from "./fixtures";

const OCC_ROUTES = ["/admin/monitoring", "/operations"] as const;
const SECTIONS = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12"];

const ROLES: E2EActor["role"][] = ["Owner", "Editor", "Reviewer", "Contributor", "Viewer"];

const BLOCKING_ROW_STATES = ["BLOCKED", "CRITICAL", "NOT IMPLEMENTED", "NOT ESTABLISHED", "UNVERIFIED"];

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

  test("S3 never presents a report-computation time as source data", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:owner", role: "Owner", displayLabel: "Owner User" });
    await occReady(page, "/admin/monitoring");
    const s3 = page.getByTestId("occ-panel-S3");
    const source = (await page.getByTestId("occ-S3-timestamp").innerText()).trim();
    const computed = (await page.getByTestId("occ-S3-computed").innerText()).trim();
    expect(source).not.toBe(computed);
    if (source === "UNVERIFIED") {
      // Missing trustworthy attestation evidence → panel and rows UNVERIFIED.
      await expect(page.getByTestId("occ-S3-state")).toContainText("UNVERIFIED");
      for (const i of [0, 1, 2, 3]) {
        await expect(s3.getByTestId(`occ-S3-row-${i}`)).toHaveAttribute("data-row-state", "UNVERIFIED");
      }
    } else {
      // Present source timestamp must be a real attestation time, and it must
      // be the least-fresh (oldest) attestation among the required gates.
      expect(Number.isNaN(Date.parse(source))).toBe(false);
      const attested = await s3.locator("[data-row-state]").evaluateAll(nodes =>
        nodes
          .map(n => (n.textContent ?? "").match(/attested (\S+)/)?.[1])
          .filter((v): v is string => !!v),
      );
      expect(attested.length).toBeGreaterThan(0);
      const oldest = attested.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b));
      expect(source).toBe(oldest);
    }
  });

  test("S1 rolls up to BLOCKED and S4 is BLOCKED", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:owner", role: "Owner", displayLabel: "Owner User" });
    await occReady(page, "/admin/monitoring");
    await expect(page.getByTestId("occ-S1-state")).toContainText("BLOCKED");
    await expect(page.getByTestId("occ-S4-state")).toContainText("BLOCKED");
    // No false PASS at the executive level.
    await expect(page.getByTestId("occ-panel-S1").getByText(/^OK$/)).toHaveCount(0);
  });

  test("unresolved S5 production recovery rows force S1 to BLOCKED", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:owner", role: "Owner", displayLabel: "Owner User" });
    await occReady(page, "/admin/monitoring");
    const s5 = page.getByTestId("occ-panel-S5");

    const expected: Record<string, string> = {
      "Production database restore": "UNVERIFIED",
      "Production infrastructure recovery": "UNVERIFIED",
      "Production RPO": "NOT ESTABLISHED",
      "Production RTO": "NOT ESTABLISHED",
      "Production rollback capability": "NOT ESTABLISHED",
    };
    for (const [label, state] of Object.entries(expected)) {
      await expect(s5.locator(`[data-row-label="${label}"]`)).toHaveAttribute("data-row-state", state);
    }

    // 1. The panel state must represent its worst blocking row.
    const s5State = (await page.getByTestId("occ-S5-state").innerText()).trim();
    expect(BLOCKING_ROW_STATES).toContain(s5State);
    expect(["OK", "ATTENTION", "STALE"]).not.toContain(s5State);

    // 2. S1 must reflect that unresolved row set and read BLOCKED.
    const s1Row = page.getByTestId("occ-panel-S1").locator('[data-row-label^="S5 "]');
    await expect(s1Row).toHaveAttribute("data-row-state", s5State);
    await expect(s1Row).toContainText("unresolved row(s)");
    await expect(page.getByTestId("occ-S1-state")).toContainText("BLOCKED");
  });

  test("no panel reports OK while it holds a blocking row", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:owner", role: "Owner", displayLabel: "Owner User" });
    await occReady(page, "/admin/monitoring");
    for (const id of SECTIONS) {
      const state = (await page.getByTestId(`occ-${id}-state`).innerText()).trim();
      const blockingRows = await page
        .getByTestId(`occ-panel-${id}`)
        .locator("[data-row-state]")
        .evaluateAll((nodes, blocking) =>
          nodes.filter(n => blocking.includes(n.getAttribute("data-row-state") ?? "")).length,
        BLOCKING_ROW_STATES);
      if (blockingRows > 0) expect(BLOCKING_ROW_STATES).toContain(state);
    }
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
    for (const route of OCC_ROUTES) {
      test(`${role} sees the OCC read-only with no action controls on ${route}`, async ({ page, asActor }) => {
        await asActor({ userId: `e2e:${role.toLowerCase()}`, role, displayLabel: `${role} User` });
        await occReady(page, route);
        await expect(page.getByTestId("occ-provisional-banner")).toBeVisible();
        for (const id of SECTIONS) {
          await expect(page.getByTestId(`occ-panel-${id}`)).toBeVisible();
        }
        const occ = page.getByTestId("occ-dashboard");
        // Strictly read-only subtree: no interactive controls of any kind.
        expect(await occ.locator("button, input, select, textarea, [role=button]").count()).toBe(0);
        // And specifically no actionable publish/rollback/restore affordance.
        // (Informational label text such as "Production rollback capability" is allowed.)
        await expect(
          occ.getByRole("button", { name: /publish|rollback|restore|re-attest|capture baseline/i }),
        ).toHaveCount(0);
        await expect(
          occ.getByRole("link", { name: /publish|rollback|restore|re-attest|capture baseline/i }),
        ).toHaveCount(0);
      });
    }
  }

  for (const route of OCC_ROUTES) {
    test(`unauthenticated caller is shown no OCC content on ${route}`, async ({ page, asSignedOut }) => {
      await asSignedOut();
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      // Exact expected behaviour: the app stays on the requested route (no
      // OCC-specific redirect) and renders NO OCC content whatsoever.
      expect(new URL(page.url()).pathname).toBe(route);
      await page.waitForTimeout(2_000);
      await expect(page.getByTestId("occ-unauthenticated")).toBeVisible();
      await expect(page.getByTestId("occ-dashboard")).toHaveCount(0);
      await expect(page.getByTestId("occ-provisional-banner")).toHaveCount(0);
      for (const id of SECTIONS) {
        await expect(page.getByTestId(`occ-panel-${id}`)).toHaveCount(0);
      }
      // No protected OCC evidence content leaks into the unauthenticated page.
      const body = await page.locator("body").innerText();
      for (const marker of [
        "Operations Command Center",
        "Hard gates H1–H4",
        "Executive health summary",
        "PROVISIONAL IMPLEMENTATION",
      ]) {
        expect(body).not.toContain(marker);
      }
    });
  }
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
