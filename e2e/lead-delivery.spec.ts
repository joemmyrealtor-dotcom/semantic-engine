// Task 25 verification — browser flow for the HubSpot lead transport.
// Exercises the real form, the durable delivery queue, and the operator view.

import { test, expect } from "./fixtures";

const GUIDE = "/guides/seller-decision-guide";

async function fillForm(page: import("@playwright/test").Page, email: string) {
  await page.getByLabel("First name").fill("Joe");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("City").fill("Brea");
  await page.getByLabel("Your situation").selectOption("sellers");
  await page.getByLabel("Your timeline").selectOption("0-90");
  const consent = page.getByRole("checkbox").first();
  if (!(await consent.isChecked())) await consent.check();
}

test.describe("lead delivery transport", () => {
  test("captures a guide lead, persists attribution, and queues delivery", async ({ page }) => {
    await page.goto(`${GUIDE}?utm_source=google&utm_medium=organic&utm_campaign=brea-guide`);
    await fillForm(page, "e2e.seller@example.com");
    await page.getByRole("button", { name: /send|get the guide|request/i }).first().click();

    await expect(page.getByText(/on the way|thank|check your email/i).first()).toBeVisible();

    const queue = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("lf.lead-queue.v1") ?? "[]"),
    );
    expect(queue.length).toBe(1);
    expect(queue[0].payload.email).toBe("e2e.seller@example.com");
    expect(queue[0].payload.lf_original_source).toBe("google");
    expect(queue[0].payload.lf_original_campaign).toBe("brea-guide");
    expect(queue[0].idempotencyKey).toBeTruthy();
    expect(["delivered", "retry_scheduled", "pending"]).toContain(queue[0].status);

    // Duplicate submission of the same conversion must not enqueue twice.
    await page.reload();
    await fillForm(page, "e2e.seller@example.com");
    await page.getByRole("button", { name: /send|get the guide|request/i }).first().click();
    await page.waitForTimeout(500);
    const after = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("lf.lead-queue.v1") ?? "[]"),
    );
    expect(after.length).toBe(1);

    // No PII in analytics events.
    const events = await page.evaluate(() =>
      window.localStorage.getItem("lf.conversions.v1") ?? "[]",
    );
    expect(events).not.toContain("e2e.seller@example.com");
  });

  test("operator delivery view is gated and never public", async ({ page }) => {
    await page.goto("/admin/lead-delivery");
    await expect(page.getByText(/permission|sign in|not authorized/i).first()).toBeVisible();
  });
});
