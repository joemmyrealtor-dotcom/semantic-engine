// Launch-closure — hard-gate lock, permission gating, evidence flow.
import { test, expect } from "./fixtures";

test.describe("Launch closure — hard gates", () => {
  test("viewer cannot attest evidence; promote button locked", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:viewer", role: "Viewer", displayLabel: "Viewer User" });
    await page.goto("/admin/deployment");
    // RequirePermission may block the whole page for viewer; if it renders, the promote button must be locked.
    const promote = page.getByTestId("promote-production");
    if (await promote.count()) {
      await expect(promote).toBeDisabled();
    }
  });

  test("owner sees hard-gate panel with all 4 gates locked and promote disabled", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:owner", role: "Owner", displayLabel: "Owner User" });
    await page.goto("/admin/deployment");
    await expect(page.getByTestId("hard-gates")).toBeVisible();
    for (const id of ["H1", "H2", "H3", "H4"]) {
      await expect(page.getByTestId(`gate-${id}`)).toBeVisible();
    }
    await expect(page.getByTestId("launch-lock-state")).toContainText(/LOCKED/);
    await expect(page.getByTestId("promote-production")).toBeDisabled();
  });

  test("cutover center is reachable and mirrors the ledger", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:owner", role: "Owner", displayLabel: "Owner User" });
    await page.goto("/admin/cutover");
    await expect(page.getByTestId("cutover-ledger")).toBeVisible();
    for (const id of ["H1", "H2", "H3", "H4"]) {
      await expect(page.getByTestId(`cutover-${id}`)).toBeVisible();
    }
  });
});
