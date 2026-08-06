// Mobile-viewport delta check for the PL-206 / PL-211 cross-reference panel.
import { test, expect } from "./fixtures";

for (const id of ["PL-211", "PL-206"]) {
  test(`${id} cross-reference panel fits the mobile viewport`, async ({ page, asActor }) => {
    await asActor({ userId: "u-owner", role: "Owner" });
    await page.goto(`/publications/${id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Cross-Reference/i })).toBeVisible();
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow on ${id}`).toBeLessThanOrEqual(2);
  });
}
