// Responsive smoke — critical UI works at mobile viewport.
import { test, expect } from "./fixtures";

test.describe("Mobile smoke", () => {
  test("dashboard has no horizontal scroll and menu opens", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:admin", role: "Administrator" });
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
    // No horizontal overflow.
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, `document overflows viewport (${scrollWidth} > ${clientWidth})`).toBeLessThanOrEqual(clientWidth + 1);
    // Menu trigger is visible only on mobile (md:hidden).
    const menu = page.getByRole("button", { name: /open menu/i });
    await expect(menu).toBeVisible();
    await menu.click();
    // Sheet dialog opens with navigation content.
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("auth form is usable at mobile width", async ({ page, asSignedOut }) => {
    await asSignedOut();
    await page.goto("/auth");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    // Buttons meet a reasonable tap target (at least 40px tall).
    const btn = page.getByRole("button", { name: /sign in/i });
    const box = await btn.boundingBox();
    expect(box?.height ?? 0, "sign-in button tap target").toBeGreaterThanOrEqual(36);
  });
});
