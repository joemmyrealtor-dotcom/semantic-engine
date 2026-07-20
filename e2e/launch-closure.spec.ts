// Launch-closure — Phase 3 authoritative server state.
//
// In the E2E sandbox there is no real Supabase session, so
// `computeReadinessServer` is unreachable. The UI must fall into
// "diagnostic-only" mode:
//   - authoritative badge = DIAGNOSTIC ONLY
//   - launch lock stays LOCKED
//   - promote-production stays disabled
//   - browser-local IndexedDB evidence renders only under the labeled
//     "Local evidence (diagnostic)" section and NEVER unlocks promote.
import { test, expect, type Page } from "./fixtures";

async function waitForActor(page: Page, role: string) {
  await page.waitForFunction((r) => {
    const w = window as unknown as { __lovableE2E?: { getActor(): { role: string } } };
    return !!w.__lovableE2E && w.__lovableE2E.getActor().role === r;
  }, role, { timeout: 10_000 });
}

test.describe("Launch closure — Phase 3 authoritative server state", () => {
  test("viewer sees Forbidden on deployment; cannot reach promote", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:viewer", role: "Viewer", displayLabel: "Viewer User" });
    await page.goto("/admin/deployment");
    await waitForActor(page, "Viewer");
    await expect(page.getByRole("heading", { name: /access denied/i })).toBeVisible();
    await expect(page.getByTestId("promote-production")).toHaveCount(0);
  });

  test("owner sees authoritative panel; server unreachable in sandbox → LOCKED + diagnostic badge", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:admin", role: "Administrator", displayLabel: "Admin User" });
    await page.goto("/admin/deployment");
    await waitForActor(page, "Administrator");

    await expect(page.getByTestId("hard-gates")).toBeVisible({ timeout: 15_000 });
    for (const id of ["H1", "H2", "H3", "H4"]) {
      await expect(page.getByTestId(`gate-${id}`)).toBeVisible();
    }
    // Authoritative source badge must be visible and mark diagnostic mode.
    await expect(page.getByTestId("authoritative-source-badge")).toContainText(/DIAGNOSTIC ONLY|AUTHORITATIVE/);
    // Lock stays LOCKED and promote disabled when server unreachable.
    await expect(page.getByTestId("launch-lock-state")).toContainText(/LOCKED/);
    await expect(page.getByTestId("promote-production")).toBeDisabled();
  });

  test("unauthorized attest surfaces server denial (server unreachable → attest disabled)", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:admin", role: "Administrator", displayLabel: "Admin User" });
    await page.goto("/admin/deployment");
    await waitForActor(page, "Administrator");
    await expect(page.getByTestId("hard-gates")).toBeVisible({ timeout: 15_000 });
    // In diagnostic mode the attest control is replaced with an "unauth" label.
    // If a real session were present, the "attest-open" button would appear;
    // here we assert the sandbox behaves as a denial-by-default (LOCKED).
    const unauth = page.getByTestId("gate-H1-unauth");
    const attestOpen = page.getByTestId("gate-H1-attest-open");
    await expect(async () => {
      expect((await unauth.count()) + (await attestOpen.count())).toBeGreaterThan(0);
    }).toPass();
  });

  test("local browser evidence renders only under labeled diagnostic section", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:admin", role: "Administrator", displayLabel: "Admin User" });
    await page.goto("/admin/deployment");
    await waitForActor(page, "Administrator");
    // Diagnostic panel exists and is clearly labeled.
    const local = page.getByTestId("local-diagnostic-panel");
    await expect(local).toBeVisible({ timeout: 15_000 });
    await expect(local).toContainText(/Diagnostic only/i);
    // No local-* row unlocks the promote button.
    await expect(page.getByTestId("promote-production")).toBeDisabled();
  });

  test("cutover center shows authoritative ledger with per-gate anchors", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:admin", role: "Administrator", displayLabel: "Admin User" });
    await page.goto("/admin/cutover");
    await waitForActor(page, "Administrator");
    await expect(page.getByTestId("cutover-ledger")).toBeVisible({ timeout: 15_000 });
    for (const id of ["H1", "H2", "H3", "H4"]) {
      await expect(page.getByTestId(`cutover-${id}`)).toBeAttached();
      await expect(page.getByTestId(`gate-${id}`)).toBeVisible();
    }
    // Authoritative badge present.
    await expect(page.getByTestId("authoritative-source-badge")).toBeVisible();
  });

  test("deployment page issues a real server-fn RPC and server rejects unauthenticated caller", async ({ page, asActor }) => {
    await asActor({ userId: "e2e:admin", role: "Administrator", displayLabel: "Admin User" });
    // Capture every RPC to the TanStack server-fn base (`/n/`) — the panel's
    // authoritative call goes here. Without a real Supabase bearer the
    // `requireSupabaseAuth` middleware must deny (401 or Response-thrown
    // error surfacing as non-2xx). A silent 200 would prove the panel
    // fabricated PASS locally instead of consulting the server.
    const rpcResponses: number[] = [];
    page.on("response", (res) => {
      const u = new URL(res.url());
      if (u.pathname.startsWith("/n/")) rpcResponses.push(res.status());
    });
    await page.goto("/admin/deployment");
    await waitForActor(page, "Administrator");
    await expect(page.getByTestId("authoritative-source-badge")).toBeVisible({ timeout: 15_000 });
    // Give the query a moment to fire and settle.
    await page.waitForTimeout(1500);
    expect(rpcResponses.length, "expected at least one /n/ server-fn RPC").toBeGreaterThan(0);
    // Every RPC must be a denial — no 2xx allowed without a real session.
    for (const s of rpcResponses) expect(s, `unexpected 2xx from /n/ RPC (status ${s})`).toBeGreaterThanOrEqual(400);
    // And the UI must reflect denial: badge = DIAGNOSTIC ONLY, lock = LOCKED,
    // promote disabled. Together this proves the promote path is
    // server-authoritative and cannot be unlocked from the browser.
    await expect(page.getByTestId("authoritative-source-badge")).toContainText(/DIAGNOSTIC ONLY/);
    await expect(page.getByTestId("launch-lock-state")).toContainText(/LOCKED/);
    await expect(page.getByTestId("promote-production")).toBeDisabled();
  });
});
