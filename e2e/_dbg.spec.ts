import { test } from "@playwright/test";
test("dbg", async ({ page }) => {
  page.on("console", m => console.log("CONSOLE", m.type(), m.text().slice(0,300)));
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  await page.goto("/guides/seller-decision-guide");
  await page.getByLabel("First name").fill("Joe");
  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByLabel("City").fill("Brea");
  await page.getByLabel("Your situation").selectOption("sellers");
  await page.getByLabel("Your timeline").selectOption("0-90");
  await page.getByRole("checkbox").last().check();
  await page.getByRole("button", { name: "Get Your Seller Strategy" }).click();
  await page.waitForTimeout(3000);
  console.log("QUEUE", await page.evaluate(() => window.localStorage.getItem("lf.lead-queue.v1")));
  console.log("BODY", (await page.locator("form").innerText()).slice(0,600));
});
