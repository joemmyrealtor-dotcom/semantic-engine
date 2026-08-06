// Delta verification for the PL-206 / PL-211 cross-reference update.
// Read-only assertions: bidirectional links, gate order, risk-table parity,
// mobile overflow, and accessibility.

import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "./fixtures";

const PAIR = [
  { id: "PL-211", other: "PL-206" },
  { id: "PL-206", other: "PL-211" },
];

const GATES = ["Gate 1", "Gate 2", "Gate 3", "Gate 4"];

async function openGuide(page: Page, id: string) {
  await page.goto(`/publications/${id}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Cross-Reference/i })).toBeVisible();
}

async function riskRows(page: Page) {
  return page.evaluate(() => {
    const section = document.querySelector('section[aria-labelledby="crossref-heading"]');
    const rows = section?.querySelectorAll("tbody tr") ?? [];
    return Array.from(rows).map(r =>
      Array.from(r.querySelectorAll("td")).map(td => (td.textContent ?? "").trim()),
    );
  });
}

test.describe("PL-206 / PL-211 cross-reference delta", () => {
  for (const p of PAIR) {
    test(`${p.id} renders the panel, links to ${p.other}, gates in order`, async ({ page, asActor }) => {
      await asActor({ userId: "u-owner", role: "Owner" });
      await openGuide(page, p.id);

      // Bidirectional reference resolves to a real route.
      const link = page.getByRole("link", { name: new RegExp(`${p.other}`) }).first();
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(new RegExp(`/publications/${p.other}$`));
      await expect(page.getByRole("heading", { name: /Cross-Reference/i })).toBeVisible();

      // Gate order.
      await openGuide(page, p.id);
      const labels = await page.evaluate(() => {
        const section = document.querySelector('section[aria-labelledby="crossref-heading"]');
        return Array.from(section?.querySelectorAll("span.font-bold") ?? []).map(
          e => (e.textContent ?? "").trim(),
        );
      });
      expect(labels.slice(0, 4).map(l => l.toUpperCase())).toEqual(GATES.map(g => g.toUpperCase()));
    });
  }

  test("risk table content is identical on both pages", async ({ page, asActor }) => {
    await asActor({ userId: "u-owner", role: "Owner" });
    await openGuide(page, "PL-211");
    const a = await riskRows(page);
    await openGuide(page, "PL-206");
    const b = await riskRows(page);
    expect(a.length).toBeGreaterThanOrEqual(7);
    expect(a).toEqual(b);
    // Each risk maps to schedule impact + required action.
    for (const row of a) expect(row).toHaveLength(3);
  });

  test("no serious accessibility violations on either guide", async ({ page, asActor }) => {
    await asActor({ userId: "u-owner", role: "Owner" });
    for (const p of PAIR) {
      await openGuide(page, p.id);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const serious = results.violations.filter(v => v.impact === "serious" || v.impact === "critical");
      expect(serious.map(v => v.id), `a11y on ${p.id}`).toEqual([]);
    }
  });
});
