// Launch-closure — hard-gate lock, permission gating, evidence flow.
import { test, expect, type Page } from "./fixtures";

async function waitForActor(page: Page, role: string) {
  await page.waitForFunction((r) => {
    const w = window as unknown as { __lovableE2E?: { getActor(): { role: string } } };
    return !!w.__lovableE2E && w.__lovableE2E.getActor().role === r;
  }, role, { timeout: 10_000 });
}

test.describe("Launch closure — hard gates", () => {
  test("viewer sees Forbidden on deployment; cannot reach promote", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:viewer", role: "Viewer", displayLabel: "Viewer User" });
    await page.goto("/admin/deployment");
    await waitForActor(page, "Viewer");
    await page.reload();
    await expect(page.getByRole("heading", { name: /access denied/i })).toBeVisible();
    await expect(page.getByTestId("promote-production")).toHaveCount(0);
  });

  test("owner sees hard-gate panel with all 4 gates locked and promote disabled", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:owner", role: "Owner", displayLabel: "Owner User" });
    await page.goto("/admin/deployment");
    await waitForActor(page, "Owner");
    await page.reload();
    await expect(page.getByTestId("hard-gates")).toBeVisible();
    for (const id of ["H1", "H2", "H3", "H4"]) {
      await expect(page.getByTestId(`gate-${id}`)).toBeVisible();
    }
    await expect(page.getByTestId("launch-lock-state")).toContainText(/LOCKED/);
    await expect(page.getByTestId("promote-production")).toBeDisabled();
  });

  test("cutover center is reachable and mirrors the ledger for owner", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:owner", role: "Owner", displayLabel: "Owner User" });
    await page.goto("/admin/cutover");
    await waitForActor(page, "Owner");
    await page.reload();
    await expect(page.getByTestId("cutover-ledger")).toBeVisible();
    for (const id of ["H1", "H2", "H3", "H4"]) {
      await expect(page.getByTestId(`cutover-${id}`)).toBeVisible();
    }
  });
});
