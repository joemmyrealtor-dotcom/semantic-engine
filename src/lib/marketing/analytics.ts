// Task 24 — Marketing analytics event layer.
//
// One typed event schema shared by GA4 (window.dataLayer), HubSpot, and
// later PostHog. Guarantees:
//   - events fire once per logical action (dedupe key)
//   - no PII in event names or properties
//   - first-touch and latest-touch attribution attached to every event
//   - nothing is forwarded to vendors without analytics consent

import { readAttribution, readLatestAttribution, referrerHost, safeUtm } from "./attribution";
import { analyticsAllowed } from "./consent";
import { recordConversionEvent } from "./conversion-store";


export type MarketingEventName =
  | "page_view"
  | "local_guide_viewed"
  | "lead_magnet_viewed"
  | "lead_magnet_downloaded"
  | "assessment_started"
  | "assessment_completed"
  | "assessment_result_viewed"
  | "consultation_clicked"
  | "contact_submitted"
  | "phone_clicked"
  | "email_clicked"
  | "referral_partner_clicked"
  | "partner_page_viewed"
  | "partner_kit_requested"
  | "partner_referral_started"
  | "partner_referral_submitted"
  | "lead_submitted"
  /** Internal qualified-visitor definition (see qualified-visitor.ts). */
  | "qualified_visitor";


/** Legacy names kept working; mapped onto the canonical schema. */
const ALIASES: Record<string, MarketingEventName> = {
  guide_viewed: "lead_magnet_viewed",
  guide_started: "lead_magnet_viewed",
  guide_downloaded: "lead_magnet_downloaded",
  guide_lead_submitted: "lead_submitted",
  consultation_cta_clicked: "consultation_clicked",
};

export type AnyEventName = MarketingEventName | keyof typeof ALIASES;

export interface MarketingEventProps {
  city?: string;
  situation?: string;
  publication?: string;
  leadMagnet?: string;
  guideId?: string;
  assessmentId?: string;
  assessmentResult?: string;
  readinessLevel?: string;
  leadTier?: string;
  leadClassification?: string;
  leadScore?: number;
  label?: string;
  formId?: string;
  pagePath?: string;
  ctaLocation?: string;
  success?: boolean;
  /** Optional explicit dedupe key; defaults to name + identifying props. */
  dedupeKey?: string;
}

export interface MarketingEvent extends Omit<MarketingEventProps, "dedupeKey"> {
  event: MarketingEventName;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  referrer: string;
  originalSource: string;
  originalCampaign: string;
  landingPage: string;
  occurredAt: string;
}

const BUFFER: MarketingEvent[] = [];
const MAX_BUFFER = 500;
const FIRED = new Set<string>();

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE_RE = /(\+?\d[\d\-.\s()]{7,}\d)/;

/** Strip anything that looks like PII out of a free-text analytics value. */
export function scrubValue(value: string): string {
  return value.replace(EMAIL_RE, "[redacted]").replace(PHONE_RE, "[redacted]");
}

/** Sensitive personal context: lives in the private lead record only. */
const DROPPED_KEYS = new Set(["city", "situation", "readinessLevel", "leadScore", "leadClassification", "leadTier", "assessmentResult"]);

/** Drop query string and hash from a URL or path before tracking. */
export function stripQuery(url: string): string {
  return url.split(/[?#]/)[0] ?? "";
}

function currentPath(): string {
  return typeof window === "undefined" ? "" : window.location.pathname;
}

function scrubProps(props: MarketingEventProps): MarketingEventProps {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (DROPPED_KEYS.has(k)) continue;
    out[k] = typeof v === "string" ? scrubValue(v) : v;
  }
  return out as MarketingEventProps;
}

function canonical(name: AnyEventName): MarketingEventName {
  return (ALIASES[name as string] ?? name) as MarketingEventName;
}

export function trackEvent(
  name: AnyEventName,
  props: MarketingEventProps = {},
): MarketingEvent | null {
  const event = canonical(name);
  const { dedupeKey, ...rest } = scrubProps(props);
  const key =
    dedupeKey ??
    [event, rest.guideId, rest.assessmentId, rest.label].filter(Boolean).join("|");

  // Repeatable actions (submissions, clicks) are allowed to fire again only
  // when they carry a distinct dedupe key; view-style events fire once.
  if (FIRED.has(key)) return null;
  FIRED.add(key);

  const first = readAttribution();
  const last = readLatestAttribution();

  const payload: MarketingEvent = {
    event,
    source: safeUtm(last?.source, "direct"),
    medium: safeUtm(last?.medium, "none"),
    campaign: safeUtm(last?.campaign, "(none)"),
    content: safeUtm(last?.content),
    referrer: referrerHost(last?.referrer?.includes("://") ? last.referrer : last?.referrer ? `https://${last.referrer}` : ""),
    originalSource: safeUtm(first?.source, "direct"),
    originalCampaign: safeUtm(first?.campaign, "(none)"),
    landingPage: stripQuery(first?.landingPage ?? ""),
    pagePath: currentPath(),
    occurredAt: new Date().toISOString(),
    ...rest,
  };

  BUFFER.push(payload);
  if (BUFFER.length > MAX_BUFFER) BUFFER.shift();
  recordConversionEvent(payload);

  if (typeof window !== "undefined" && analyticsAllowed()) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload as unknown as Record<string, unknown>);
  }

  return payload;
}

/** Fire an event that is expected to repeat (each call is a real action). */
export function trackAction(
  name: AnyEventName,
  props: MarketingEventProps = {},
): MarketingEvent | null {
  return trackEvent(name, {
    ...props,
    dedupeKey: `${canonical(name)}|${Date.now()}|${Math.random().toString(36).slice(2)}`,
  });
}

/** Read the in-memory event buffer (newest last). */
export function recentEvents(): MarketingEvent[] {
  return [...BUFFER];
}

/** Test helper. */
export function resetEvents(): void {
  BUFFER.length = 0;
  FIRED.clear();
}
