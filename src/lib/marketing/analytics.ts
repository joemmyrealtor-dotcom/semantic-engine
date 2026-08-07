// Task 24 — Marketing analytics event instrumentation.
//
// One typed event surface for GA4 / HubSpot / PostHog. No vendor SDK is
// wired yet: events are pushed to window.dataLayer (GA4-compatible) and
// mirrored to an in-memory buffer so tests and the conversion dashboard
// can read them without a network dependency.

import { readAttribution } from "./attribution";

export type MarketingEventName =
  | "guide_viewed"
  | "guide_started"
  | "guide_downloaded"
  | "guide_lead_submitted"
  | "assessment_started"
  | "assessment_completed"
  | "assessment_result_viewed"
  | "consultation_cta_clicked"
  | "contact_submitted"
  | "phone_clicked"
  | "email_clicked"
  | "local_guide_viewed";

export interface MarketingEventProps {
  situation?: string;
  city?: string;
  guideId?: string;
  assessmentId?: string;
  leadTier?: string;
  readinessLevel?: string;
  label?: string;
}

export interface MarketingEvent extends MarketingEventProps {
  event: MarketingEventName;
  campaign: string;
  source: string;
  medium: string;
  content: string;
  referrer: string;
  occurredAt: string;
}

const BUFFER: MarketingEvent[] = [];
const MAX_BUFFER = 200;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function trackEvent(
  event: MarketingEventName,
  props: MarketingEventProps = {},
): MarketingEvent {
  const attr = readAttribution();
  const payload: MarketingEvent = {
    event,
    campaign: attr?.campaign ?? "(none)",
    source: attr?.source ?? "direct",
    medium: attr?.medium ?? "none",
    content: attr?.content ?? "",
    referrer: attr?.referrer ?? "",
    occurredAt: new Date().toISOString(),
    ...props,
  };

  BUFFER.push(payload);
  if (BUFFER.length > MAX_BUFFER) BUFFER.shift();

  if (typeof window !== "undefined") {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload as unknown as Record<string, unknown>);
  }
  return payload;
}

/** Read the in-memory event buffer (newest last). */
export function recentEvents(): MarketingEvent[] {
  return [...BUFFER];
}

/** Test helper. */
export function resetEvents(): void {
  BUFFER.length = 0;
}
