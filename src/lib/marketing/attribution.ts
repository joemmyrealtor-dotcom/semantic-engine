// Task 20 — CRM attribution scaffold (app-side).
//
// Captures campaign attribution on first public pageview, persists it for
// the session, and shapes the lead payload that the HubSpot integration
// will submit once the CRM objects exist (Task 24). No network calls are
// made here — this is deliberately the app-side half of the contract.

export interface Attribution {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  referrer: string;
  landingPage: string;
  firstSeenAt: string;
}

const KEY = "lf.attribution.v1";

const UTM_KEYS = [
  ["utm_source", "source"],
  ["utm_medium", "medium"],
  ["utm_campaign", "campaign"],
  ["utm_content", "content"],
  ["utm_term", "term"],
] as const;

function classifyReferrer(referrer: string): { source: string; medium: string } {
  if (!referrer) return { source: "direct", medium: "none" };
  let host = "";
  try {
    host = new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return { source: "direct", medium: "none" };
  }
  if (typeof window !== "undefined" && host === window.location.hostname) {
    return { source: "direct", medium: "none" };
  }
  if (/google|bing|duckduckgo|yahoo|ecosia/.test(host)) return { source: host, medium: "organic" };
  if (/facebook|instagram|linkedin|youtube|t\.co|x\.com|pinterest|nextdoor/.test(host)) {
    return { source: host, medium: "social" };
  }
  return { source: host, medium: "referral" };
}

/** Read stored attribution without writing. Safe during SSR (returns null). */
export function readAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}

/**
 * Capture attribution once per session. First touch wins so that an
 * in-session navigation never overwrites the campaign that produced
 * the visit.
 */
export function captureAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  const existing = readAttribution();
  if (existing) return existing;

  const params = new URLSearchParams(window.location.search);
  const fallback = classifyReferrer(document.referrer || "");
  const utm: Record<string, string> = {};
  for (const [param, field] of UTM_KEYS) utm[field] = params.get(param) ?? "";

  const attribution: Attribution = {
    source: utm.source || fallback.source,
    medium: utm.medium || fallback.medium,
    campaign: utm.campaign || "(none)",
    content: utm.content,
    term: utm.term,
    referrer: document.referrer || "",
    landingPage: window.location.pathname,
    firstSeenAt: new Date().toISOString(),
  };

  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(attribution));
  } catch {
    /* storage unavailable — attribution is best-effort */
  }
  return attribution;
}

export interface LeadPayload {
  entryPath: string;
  pageSlug: string;
  ctaLabel: string;
  attribution: Attribution | null;
  submittedAt: string;
}

/**
 * Shape a CRM-ready lead payload. Field names intentionally mirror the
 * HubSpot properties defined in Task 24 so the submit handler is a
 * pass-through when the CRM objects are created.
 */
export function buildLeadPayload(input: {
  entryPath: string;
  pageSlug: string;
  ctaLabel: string;
}): LeadPayload {
  return {
    entryPath: input.entryPath,
    pageSlug: input.pageSlug,
    ctaLabel: input.ctaLabel,
    attribution: readAttribution(),
    submittedAt: new Date().toISOString(),
  };
}
