// RC-1 Blocker #6 — Test-only E2E auth bootstrap.
//
// Exposes a narrow `window.__lovableE2E` API so Playwright can inject
// deterministic actor / role / workspace / session-expiry data through the
// SAME `injectTestActor()` contract used by the deterministic service
// validation harness — never via a real Supabase session or service-role
// credentials.
//
// PRODUCTION SAFETY:
//   Activation is refused unless BOTH of these hold at module load time:
//     - `import.meta.env.DEV === true`   (Vite dev/build:dev only)
//     - `import.meta.env.VITE_E2E === "1"` (opt-in env flag)
//   In a production build (`vite build` without VITE_E2E=1) the module
//   exports a no-op and never touches `window`. There is no runtime path
//   to enable it against a production bundle.
//
// This module NEVER embeds or reads a service-role key, a Supabase JWT,
// or any persistent secret. It only writes to the in-memory actor slot.

import {
  injectTestActor, clearTestActor, clearActor,
  type ActorContext,
} from "@/lib/data/actor";
import { setRole } from "@/lib/data/auth";
import type { Role } from "@/lib/data/schema";

export interface E2EInjectPayload {
  userId: string;
  email?: string | null;
  displayLabel?: string;
  role: Role;
  activeWorkspaceId?: string | null;
  sessionExpiresAt?: number | null;
  source?: ActorContext["source"];
}

export interface E2EBridge {
  readonly enabled: true;
  injectActor(payload: E2EInjectPayload): ActorContext;
  clearActor(): void;
  signOut(): void;
  expireSession(): ActorContext;
}

declare global {
  interface Window { __lovableE2E?: E2EBridge }
}

function isEnabled(): boolean {
  try {
    const env = (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};
    return env.DEV === true && env.VITE_E2E === "1";
  } catch { return false; }
}

let installed = false;

export function installE2EBridge(): void {
  if (installed || typeof window === "undefined") return;
  if (!isEnabled()) return;
  installed = true;
  const bridge: E2EBridge = {
    enabled: true,
    injectActor(payload) {
      setRole(payload.role);
      return injectTestActor({
        userId: payload.userId,
        email: payload.email ?? null,
        displayLabel: payload.displayLabel ?? payload.email ?? payload.userId,
        role: payload.role,
        activeWorkspaceId: payload.activeWorkspaceId ?? null,
        sessionExpiresAt: payload.sessionExpiresAt ?? null,
        source: payload.source ?? "test",
      });
    },
    clearActor() { clearTestActor(); },
    signOut() { clearTestActor(); clearActor("signed-out"); },
    expireSession() {
      // Inject an already-expired session so mutation boundary refuses.
      return injectTestActor({
        userId: "e2e:expired",
        email: null,
        displayLabel: "Expired session",
        role: "Viewer",
        activeWorkspaceId: null,
        sessionExpiresAt: Math.floor(Date.now() / 1000) - 60,
        source: "session",
      });
    },
  };
  window.__lovableE2E = bridge;
  // Loud, honest signal in the console so it is impossible to miss.
  console.info("[E2E] test-only actor bridge enabled (VITE_E2E=1)");
}
