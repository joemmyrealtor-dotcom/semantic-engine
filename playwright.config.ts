// RC-1 Blocker #6 — Playwright configuration for the Legacy Platform.
//
// Boot: `bun run e2e` starts the Vite dev server on an isolated port with
// VITE_E2E=1 so the test-only actor bridge activates. In a production build
// the bridge is dead code (see src/lib/data/e2e-bootstrap.ts).
//
// Reports/artifacts: HTML + JUnit reports and traces/screenshots/videos on
// failure only are written under playwright-report/ and test-results/ —
// both are gitignored.

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : Number(process.env.E2E_WORKERS ?? 2),
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "playwright-report/junit.xml" }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium-desktop",
      // The desktop project runs everything EXCEPT the mobile-only spec,
      // which asserts on the `md:hidden` menu trigger that is not present at
      // desktop widths by design.
      testIgnore: /mobile\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
    { name: "chromium-mobile",  use: { ...devices["Pixel 5"] }, testMatch: /(mobile|smoke)\.spec\.ts$/ },
    { name: "chromium-tablet",  use: { ...devices["iPad Mini"] }, testMatch: /smoke\.spec\.ts$/ },
  ],
  webServer: {
    command: `VITE_E2E=1 bunx vite dev --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
    env: { VITE_E2E: "1" },
  },
});
