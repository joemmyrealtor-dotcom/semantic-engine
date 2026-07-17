// Workstream 9 Blocker #1 — Authenticated actor context.
//
// A single source of truth for "who is acting" that:
//   - loads from the Supabase session on boot and stays in sync via
//     `onAuthStateChange`;
//   - fails closed in production when no session exists (mutations refuse
//     to attribute to a fabricated user);
//   - allows a DEV-only demo role fallback (import.meta.env.DEV === true)
//     so the offline harness and validators still work locally;
//   - lets deterministic tests inject an explicit actor context via
//     `injectTestActor()`;
//   - never persists raw access/refresh tokens (only opaque session marker).
//
// Consumed by the audited mutation boundary (`repository.ts`) so every
// audit event carries the real signed-in actor identity + workspace when
// a real Supabase session is present.

import { getRole, setRole } from "./auth";
import type { Role } from "./schema";

export type ActorSource = "session" | "test" | "dev-demo" | "anonymous";

export interface ActorContext {
  userId: string;                 // uuid | "anonymous" | test id
  email: string | null;
  displayLabel: string;
  role: Role;
  activeWorkspaceId: string | null;
  source: ActorSource;
  correlationId: string;
  sessionExpiresAt?: number | null;   // epoch seconds; null when no session
  clientKind?: "user" | "api-client"; // W9 #E — actor kind for API surface
  clientId?: string;                  // when clientKind==='api-client'
}

const isDev = (() => {
  try {
    return typeof import.meta !== "undefined"
      && !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;
  } catch { return false; }
})();

const ANON: ActorContext = {
  userId: "anonymous",
  email: null,
  displayLabel: "Anonymous",
  role: "ReadOnly",
  activeWorkspaceId: null,
  source: "anonymous",
  correlationId: "req_boot",
  sessionExpiresAt: null,
  clientKind: "user",
};

let current: ActorContext = ANON;
let injectedTest: ActorContext | null = null;
const listeners = new Set<() => void>();

function notify() { for (const l of listeners) l(); }

export function subscribeActor(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); }

export function getActor(): ActorContext {
  if (injectedTest) return injectedTest;
  return current;
}

/**
 * Resolve the actor to use for a governed mutation. In production, if no
 * Supabase session exists we return `null` so the mutation boundary can
 * fail closed instead of attributing to a fabricated "current-user".
 * In DEV, the local role switch is honoured to keep the offline harness
 * functional (source is stamped "dev-demo" so audit records are honest).
 */
export function resolveMutationActor(): ActorContext | null {
  if (injectedTest) return injectedTest;
  if (current.source === "session") return current;
  if (isDev) {
    return {
      ...current,
      userId: current.userId === "anonymous" ? "dev:local" : current.userId,
      displayLabel: current.displayLabel === "Anonymous" ? "Local Developer" : current.displayLabel,
      role: getRole(),
      source: "dev-demo",
    };
  }
  return null;
}

export function isProductionRuntime(): boolean { return !isDev; }
export function isDevRuntime(): boolean { return isDev; }

/** Correlation id per request/interaction. */
export function newCorrelationId(prefix = "req"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Deterministic-test override — clears via `clearTestActor()`. */
export function injectTestActor(actor: Partial<ActorContext> & { userId: string; role: Role }): ActorContext {
  injectedTest = { ...ANON, ...actor, source: actor.source ?? "test" };
  notify();
  return injectedTest;
}
export function clearTestActor() { injectedTest = null; notify(); }

/** Wipe identity — called on sign-out and session expiry. */
export function clearActor(reason: "signed-out" | "expired" | "boot" = "signed-out") {
  current = { ...ANON, correlationId: newCorrelationId(reason === "expired" ? "expired" : "logout") };
  notify();
}

/**
 * Update the actor from a Supabase session. Only durable, non-secret
 * fields are stored — never the access or refresh token.
 */
export function setActorFromSession(session: {
  userId: string;
  email: string | null;
  displayLabel?: string | null;
  role?: Role;
  activeWorkspaceId?: string | null;
  expiresAt?: number | null;
}) {
  current = {
    userId: session.userId,
    email: session.email,
    displayLabel: session.displayLabel || session.email || session.userId,
    role: session.role ?? getRole(),
    activeWorkspaceId: session.activeWorkspaceId ?? null,
    source: "session",
    correlationId: newCorrelationId("req"),
    sessionExpiresAt: session.expiresAt ?? null,
    clientKind: "user",
  };
  if (session.role) setRole(session.role);
  notify();
}

/** Session-expiry check used by the mutation boundary. */
export function isSessionExpired(actor: ActorContext = getActor(), nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (actor.source !== "session") return false;
  if (!actor.sessionExpiresAt) return false;
  return actor.sessionExpiresAt < nowSec;
}

/** Actor for an authenticated public-API caller (bearer API key). */
export function apiClientActor(clientId: string, workspaceId: string | null): ActorContext {
  return {
    userId: `api:${clientId}`,
    email: null,
    displayLabel: `API Client ${clientId}`,
    role: "APIClient",
    activeWorkspaceId: workspaceId,
    source: "session",
    correlationId: newCorrelationId("api"),
    clientKind: "api-client",
    clientId,
  };
}

/** Reset for tests + module reloads. */
export function _resetActorForTests() {
  current = ANON;
  injectedTest = null;
}
