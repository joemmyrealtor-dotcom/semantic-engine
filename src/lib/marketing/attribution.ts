// Task 20 / 24 — CRM attribution (first-touch and latest-touch).
//
// First touch is captured once and never overwritten, so HubSpot always
// knows the campaign and landing page that originated the relationship.
// Latest touch updates whenever a new campaign or external referrer
// brings the visitor back, so the closing channel is measurable too.

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
const LAST_KEY = "lf.attribution.last.v1";

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

function read(key: string): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: Attribution): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — attribution is best-effort */
  }
}

/** Read stored first-touch attribution without writing. Safe during SSR. */
export function readAttribution(): Attribution | null {
  return read(KEY);
}

/** Read the most recent touch; falls back to first touch. */
export function readLatestAttribution(): Attribution | null {
  return read(LAST_KEY) ?? read(KEY);
}

function currentTouch(): Attribution & { hasCampaignSignal: boolean } {
  const params = new URLSearchParams(window.location.search);
  const fallback = classifyReferrer(document.referrer || "");
  const utm: Record<string, string> = {};
  for (const [param, field] of UTM_KEYS) utm[field] = params.get(param) ?? "";
  const hasCampaignSignal =
    Boolean(utm.source || utm.medium || utm.campaign) || fallback.medium !== "none";

  return {
    source: utm.source || fallback.source,
    medium: utm.medium || fallback.medium,
    campaign: utm.campaign || "(none)",
    content: utm.content ?? "",
    term: utm.term ?? "",
    referrer: document.referrer || "",
    landingPage: window.location.pathname,
    firstSeenAt: new Date().toISOString(),
    hasCampaignSignal,
  };
}

/**
 * Capture attribution. First touch wins for the origin record; the latest
 * touch is refreshed whenever a new campaign or external referrer appears.
 */
export function captureAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  const { hasCampaignSignal, ...touch } = currentTouch();

  const existing = readAttribution();
  if (!existing) write(KEY, touch);

  const lastTouch = read(LAST_KEY);
  if (!lastTouch || hasCampaignSignal) write(LAST_KEY, touch);

  return existing ?? touch;
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
 * HubSpot properties defined in src/lib/marketing/crm-schema.ts.
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

/** Test helper. */
export function resetAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
    window.sessionStorage.removeItem(LAST_KEY);
  } catch {
    /* noop */
  }
}
