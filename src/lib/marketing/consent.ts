// Task 24 — Analytics and marketing consent handling.
//
// Educational assessment answers stay in the browser. Only the CRM
// payload (which the visitor explicitly submits) leaves the app, and
// analytics vendors only receive events once analytics consent is given.

export type ConsentDecision = "granted" | "denied" | "unset";

export interface ConsentState {
  analytics: ConsentDecision;
  marketing: ConsentDecision;
  decidedAt: string | null;
}

const KEY = "lf.consent.v1";
const DEFAULT: ConsentState = { analytics: "unset", marketing: "unset", decidedAt: null };

type Listener = (state: ConsentState) => void;
const listeners = new Set<Listener>();
let cache: ConsentState | null = null;

export function readConsent(): ConsentState {
  if (typeof window === "undefined") return DEFAULT;
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<ConsentState>) } : DEFAULT;
  } catch {
    cache = DEFAULT;
  }
  return cache;
}

export function setConsent(next: Partial<Omit<ConsentState, "decidedAt">>): ConsentState {
  const state: ConsentState = {
    ...readConsent(),
    ...next,
    decidedAt: new Date().toISOString(),
  };
  cache = state;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable — consent stays session-scoped */
    }
  }
  for (const l of listeners) l(state);
  return state;
}

export function subscribeConsent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True when analytics events may be forwarded to vendors (dataLayer). */
export function analyticsAllowed(): boolean {
  return readConsent().analytics === "granted";
}

/** True when the visitor has not yet made a choice. */
export function consentUndecided(): boolean {
  return readConsent().analytics === "unset";
}

/** Test helper. */
export function resetConsent(): void {
  cache = null;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
  }
}
