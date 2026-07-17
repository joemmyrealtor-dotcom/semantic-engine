// Cross-project smoke pass — reused for tablet viewport (see playwright.config.ts).
import { test, expect } from "./fixtures";

test("smoke: dashboard boots with no runtime errors", async ({ page, asActor, errorSink }) => {
  await asActor({ userId: "e2e:admin", role: "Administrator" });
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  expect(errorSink.consoleErrors, `Console errors: ${errorSink.consoleErrors.join(" | ")}`).toEqual([]);
});
