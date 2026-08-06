import { test, expect } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

const GUIDES = [
  { id: "PL-212", title: "The Seller's 30 Questions" },
  { id: "PL-213", title: "The Buyer's 30 Questions" },
];

test.describe("PL-212 / PL-213 delta verification", () => {
  for (const g of GUIDES) {
    test(`${g.id} appears in registry, search, and detail`, async ({ page, asActor }) => {
      await asActor({ userId: "u-owner", role: "Owner" });
      await page.goto("/publications", { waitUntil: "domcontentloaded" });
      await page.getByPlaceholder(/Search title, audience, tag, ID/i).fill(g.id);
      await expect(page.getByRole("link", { name: g.id }).first()).toBeVisible();
      await page.getByRole("link", { name: g.id }).first().click();
      await expect(page.getByText(g.title.slice(0, 24)).first()).toBeVisible();
      expect(page.url()).toContain(g.id);
    });

    test(`${g.id} renders on mobile viewport`, async ({ page, asActor }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await asActor({ userId: "u-owner", role: "Owner" });
      await page.goto(`/publications/${g.id}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(g.title.slice(0, 24)).first()).toBeVisible();
      // Parity check: the new guides must not render worse than an existing canonical guide.
      // (The publication editor has a pre-existing horizontal scroll region on narrow viewports;
      // this asserts no NEW overflow is introduced by PL-212 / PL-213.)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      await page.goto("/publications/PL-201", { waitUntil: "domcontentloaded" });
      const baseline = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(baseline);
    });

    test(`${g.id} has no serious accessibility violations`, async ({ page, asActor }) => {
      await asActor({ userId: "u-owner", role: "Owner" });
      await page.goto(`/publications/${g.id}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const serious = results.violations.filter(v => v.impact === "serious" || v.impact === "critical");
      expect(serious.map(v => v.id)).toEqual([]);
    });
  }
});
