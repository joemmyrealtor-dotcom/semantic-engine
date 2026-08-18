// Client-acquisition readiness — internal qualified-visitor definition.
//
// The 90-day plan carries a qualified-visitor target. Until now nothing
// defined what a qualified visitor IS, so the target stayed TARGET_ONLY and
// there was a standing risk of substituting raw sessions for it. This module
// defines the measurement, deterministically and privacy-safely.
//
// Rules enforced here:
//   * Behaviour only. No protected traits, no demographics, no PII, no
//     device fingerprinting, no inferred household or family status.
//   * A qualified visitor is NEVER a session. A session is a visit; a
//     qualified visitor is a visit that showed situation-relevant intent AND
//     meaningful engagement. The two counts are reported separately.
//   * Nothing is forwarded to GA4 or any external property. This is an
//     internal contract only.

import type { MarketingEvent } from "./analytics";
import { indexableRecords } from "./intent-map";
import { isHighIntent } from "./conversion-paths";

export const QUALIFIED_VISITOR_EVENT = "qualified_visitor" as const;

export interface QualifiedVisitorCriterion {
  id: string;
  label: string;
  detail: string;
}

/** All three criteria must hold within one session window. */
export const QUALIFIED_VISITOR_CRITERIA: QualifiedVisitorCriterion[] = [
  {
    id: "situation-relevant-landing",
    label: "Situation-relevant entry",
    detail:
      "The session landed on, or reached, a governed page whose declared search intent is commercial, transactional, decision or conversion stage.",
  },
  {
    id: "meaningful-engagement",
    label: "Meaningful engagement",
    detail:
      "The session recorded at least two distinct governed content events (page views of separate pages, guide views, answer views, or local page views).",
  },
  {
    id: "intent-interaction",
    label: "Intent interaction",
    detail:
      "The session performed at least one governed intent action: assessment start or completion, guide download, consultation click, phone click, email click, referral start, or a lead submission.",
  },
];

export const QUALIFIED_VISITOR_EXCLUSIONS: string[] = [
  "No protected characteristic, demographic inference, or household-status inference is used.",
  "No personally identifying value (name, email, phone, address) is read or stored by this definition.",
  "Raw session count is never used as a substitute value for this metric.",
];

const INTENT_EVENTS = new Set([
  "assessment_started",
  "assessment_completed",
  "assessment_result_viewed",
  "lead_magnet_downloaded",
  "consultation_clicked",
  "phone_clicked",
  "email_clicked",
  "partner_referral_started",
  "partner_referral_submitted",
  "contact_submitted",
  "lead_submitted",
]);

const CONTENT_EVENTS = new Set([
  "page_view",
  "lead_magnet_viewed",
  "local_guide_viewed",
  "partner_page_viewed",
]);

function highIntentPaths(): Set<string> {
  return new Set(indexableRecords().filter(isHighIntent).map(r => r.path));
}

/** Non-PII session key: attribution envelope plus the hour bucket. */
export function sessionKey(event: MarketingEvent): string {
  return `${event.originalSource}|${event.landingPage}|${event.occurredAt.slice(0, 13)}`;
}

export interface QualifiedVisitorResult {
  /** Distinct sessions observed. Reported for contrast only. */
  sessions: number;
  /** Sessions meeting every criterion. Never defaulted to the session count. */
  qualified: number;
  /** Per-criterion session counts, for diagnosis. */
  criteriaMet: Record<string, number>;
  status: "MEASURED" | "UNAVAILABLE";
  note?: string;
}

export function evaluateQualifiedVisitors(events: MarketingEvent[]): QualifiedVisitorResult {
  const high = highIntentPaths();
  const sessions = new Map<
    string,
    { relevant: boolean; contentPaths: Set<string>; intent: boolean }
  >();

  for (const event of events) {
    const key = sessionKey(event);
    const row = sessions.get(key) ?? { relevant: false, contentPaths: new Set<string>(), intent: false };
    const path = (event.label ?? "").trim();
    if (high.has(path) || high.has(event.landingPage)) row.relevant = true;
    if (CONTENT_EVENTS.has(event.event)) row.contentPaths.add(path || event.event);
    if (INTENT_EVENTS.has(event.event)) row.intent = true;
    sessions.set(key, row);
  }

  const criteriaMet: Record<string, number> = {
    "situation-relevant-landing": 0,
    "meaningful-engagement": 0,
    "intent-interaction": 0,
  };
  let qualified = 0;
  for (const row of sessions.values()) {
    if (row.relevant) criteriaMet["situation-relevant-landing"]! += 1;
    if (row.contentPaths.size >= 2) criteriaMet["meaningful-engagement"]! += 1;
    if (row.intent) criteriaMet["intent-interaction"]! += 1;
    if (row.relevant && row.contentPaths.size >= 2 && row.intent) qualified += 1;
  }

  if (events.length === 0) {
    return {
      sessions: 0,
      qualified: 0,
      criteriaMet,
      status: "UNAVAILABLE",
      note: "No governed events recorded on this device. Absence of events is not a measured zero.",
    };
  }

  return { sessions: sessions.size, qualified, criteriaMet, status: "MEASURED" };
}

export interface QualifiedVisitorSpec {
  eventName: string;
  criteria: QualifiedVisitorCriterion[];
  exclusions: string[];
  /** External activation state. Internal-only by design. */
  externalActivation: "NOT_CONNECTED";
  substitutesSessions: false;
}

export const QUALIFIED_VISITOR_SPEC: QualifiedVisitorSpec = {
  eventName: QUALIFIED_VISITOR_EVENT,
  criteria: QUALIFIED_VISITOR_CRITERIA,
  exclusions: QUALIFIED_VISITOR_EXCLUSIONS,
  externalActivation: "NOT_CONNECTED",
  substitutesSessions: false,
};
