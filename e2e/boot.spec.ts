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
    // Trigger the palette via keyboard shortcut (Cmd/Ctrl+K) which is the
    // documented, cross-viewport-safe affordance. The header trigger button
    // is also present and clickable but keyboard is the canonical path.
    await page.keyboard.press("ControlOrMeta+KeyK");
    await expect(page.getByRole("dialog")).toBeVisible();
    // The palette exposes a search box.
    await expect(page.getByPlaceholder(/search concepts/i)).toBeVisible();
  });
});
