// Role-gate + expired-session + signed-out surface behavior.
import { test, expect } from "./fixtures";

test.describe("Role & session gates", () => {
  test("signed-out user sees sign-in CTA in shell", async ({ page, asSignedOut }) => {
    await asSignedOut();
    await page.goto("/");
    // Signed-out shell shows "Sign in" link.
    await expect(page.getByRole("link", { name: /sign in/i }).first()).toBeVisible();
  });

  test("expired session is reflected in mutation actor resolver", async ({ page, asExpiredSession }) => {
    await asExpiredSession();
    await page.goto("/");
    // Page still renders — expiry is a mutation-boundary concern, not a UI crash.
    await expect(page.locator("main")).toBeVisible();
    // Wait for the bridge to install and the injected expired actor to land.
    await page.waitForFunction(() => {
      const w = window as unknown as { __lovableE2E?: { isSessionExpired(): boolean; getActor(): { source: string } } };
      return !!w.__lovableE2E && w.__lovableE2E.getActor().source === "session";
    }, null, { timeout: 10_000 });
    const isExpired = await page.evaluate(() => {
      const w = window as unknown as { __lovableE2E?: { isSessionExpired(): boolean } };
      return !!w.__lovableE2E?.isSessionExpired();
    });
    expect(isExpired).toBe(true);
  });

  test("viewer role does not surface admin sign-out label as owner-only", async ({ page, asActor }) => {
    // Viewer is a legitimate signed-in role; header should still greet them.
    await asActor({ userId: "e2e:viewer", role: "Viewer", displayLabel: "Viewer User" });
    await page.goto("/");
    await expect(page.getByText(/viewer user/i)).toBeVisible();
    // Sign-out affordance is present for any signed-in actor.
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
  });
});
