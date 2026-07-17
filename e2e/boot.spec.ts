// Boot + core rendering + navigation smoke tests.
import { test, expect } from "./fixtures";

test.describe("Boot & rendering", () => {
  test("dashboard renders without runtime errors", async ({ page, errorSink, asActor }) => {
    await asActor({ userId: "e2e:admin", role: "Administrator", email: "admin@e2e.test", activeWorkspaceId: null });
    await page.goto("/");
    // Semantic landmarks.
    await expect(page.locator("main")).toBeVisible();
    // Sidebar or menu trigger present (menu button is icon-only, aria-labelled).
    await expect(page.getByRole("button", { name: /open menu/i }).or(page.locator("nav"))).toBeVisible();
    // No React error boundary output.
    await expect(page.getByText(/Something interrupted this view/i)).toHaveCount(0);
    // Console/pageerror expectations run in the fixture teardown.
    expect(errorSink.consoleErrors, `Unexpected console errors: ${errorSink.consoleErrors.join(" | ")}`).toEqual([]);
  });

  test("sign-in page renders with accessible email + password fields", async ({ page, asSignedOut }) => {
    await asSignedOut();
    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    // Explicit label association.
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("command palette can be opened", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:admin", role: "Administrator" });
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
    // Wait for the test bridge to install so the initial actor injection
    // has settled — otherwise a re-render caused by actor notify() can race
    // the click handler in dev mode.
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForFunction(() => {
      const w = window as unknown as { __lovableE2E?: { getActor(): { userId: string } } };
      return w.__lovableE2E?.getActor().userId === "e2e:admin";
    }, null, { timeout: 20_000 });

    const trigger = page.getByRole("button", { name: /open command palette/i });
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByPlaceholder(/search concepts/i)).toBeVisible();
  });
});
