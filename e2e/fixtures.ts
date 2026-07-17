// Shared Playwright fixture: installs console/pageerror listeners that
// fail tests on unhandled runtime errors (with a narrow, documented
// allowlist for third-party noise), and exposes typed helpers for the
// test-only actor bridge injected into the page by src/lib/data/e2e-bootstrap.ts.

import { test as base, expect, type Page } from "@playwright/test";

/**
 * Narrow allow-list for known-noisy third-party console messages we do
 * not want to gate CI on. Extend deliberately and document the reason.
 */
const CONSOLE_ALLOWLIST: RegExp[] = [
  /\[E2E\] test-only actor bridge enabled/i, // our own opt-in banner
  /Download the React DevTools/i,             // React dev banner
  /vite.*connected/i,                         // Vite HMR banner
];

export interface E2EActor {
  userId: string;
  role: "Administrator" | "Owner" | "Editor" | "Reviewer" | "Viewer" | "Operations" | "Publisher" | "SME" | "QA" | "Contributor" | "ReadOnly" | "APIClient";
  email?: string;
  displayLabel?: string;
  activeWorkspaceId?: string | null;
  sessionExpiresAt?: number | null;
  source?: "session" | "test";
}

export const test = base.extend<{
  errorSink: { errors: string[]; consoleErrors: string[] };
  asActor: (actor: E2EActor) => Promise<void>;
  asSignedOut: () => Promise<void>;
  asExpiredSession: () => Promise<void>;
}>({
  errorSink: async ({ page }, use, testInfo) => {
    const errors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", err => errors.push(err.message));
    page.on("console", msg => {
      if (msg.type() !== "error" && msg.type() !== "warning") return;
      const text = msg.text();
      if (CONSOLE_ALLOWLIST.some(rx => rx.test(text))) return;
      consoleErrors.push(`[${msg.type()}] ${text}`);
    });
    await use({ errors, consoleErrors });
    // Attach so failed runs surface the source of the failure.
    if (errors.length) await testInfo.attach("page-errors.txt", { body: errors.join("\n"), contentType: "text/plain" });
    if (consoleErrors.length) await testInfo.attach("console.txt", { body: consoleErrors.join("\n"), contentType: "text/plain" });
    // Only critical failures gate the run.
    expect(errors, `Uncaught page errors: ${errors.join(" | ")}`).toHaveLength(0);
  },
  asActor: async ({ page }, use) => {
    await use(async (actor) => {
      await installActorInit(page, actor);
    });
  },
  asSignedOut: async ({ page }, use) => {
    await use(async () => { await installSignedOutInit(page); });
  },
  asExpiredSession: async ({ page }, use) => {
    await use(async () => { await installExpiredInit(page); });
  },
});

export { expect };

async function installActorInit(page: Page, actor: E2EActor) {
  await page.addInitScript((a) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    w.__pendingE2EActor = a;
    const timer = setInterval(() => {
      if (w.__lovableE2E) {
        w.__lovableE2E.injectActor(w.__pendingE2EActor);
        clearInterval(timer);
      }
    }, 10);
  }, actor);
}

async function installSignedOutInit(page: Page) {
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const timer = setInterval(() => {
      if (w.__lovableE2E) { w.__lovableE2E.signOut(); clearInterval(timer); }
    }, 10);
  });
}

async function installExpiredInit(page: Page) {
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const timer = setInterval(() => {
      if (w.__lovableE2E) { w.__lovableE2E.expireSession(); clearInterval(timer); }
    }, 10);
  });
}
