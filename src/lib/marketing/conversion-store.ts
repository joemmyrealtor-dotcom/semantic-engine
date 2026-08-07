// Task 24 — Durable conversion event store for the conversion dashboard.
//
// Persists the non-PII analytics envelope so the dashboard can report
// across sessions without a vendor round-trip. Capped and best-effort.

import type { MarketingEvent } from "./analytics";

const KEY = "lf.conversions.v1";
const MAX = 1000;

export function recordConversionEvent(event: MarketingEvent): void {
  if (typeof window === "undefined") return;
  try {
    const list = loadConversionEvents();
    list.push(event);
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    /* storage unavailable — dashboard falls back to the session buffer */
  }
}

export function loadConversionEvents(): MarketingEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MarketingEvent[]) : [];
  } catch {
    return [];
  }
}

export function clearConversionEvents(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

export interface ConversionMetrics {
  visitors: number;
  pageViews: number;
  guideDownloads: number;
  assessmentStarts: number;
  assessmentCompletions: number;
  consultationRequests: number;
  qualifiedLeads: number;
  hotLeads: number;
  byCity: { key: string; conversions: number; views: number }[];
  bySituation: { key: string; conversions: number; views: number }[];
  bySource: { key: string; conversions: number; views: number }[];
  byLandingPage: { key: string; conversions: number; views: number }[];
}

const CONVERSION_EVENTS = new Set([
  "lead_submitted",
  "contact_submitted",
  "lead_magnet_downloaded",
  "consultation_clicked",
]);

function group(
  events: MarketingEvent[],
  pick: (e: MarketingEvent) => string | undefined,
): { key: string; conversions: number; views: number }[] {
  const map = new Map<string, { conversions: number; views: number }>();
  for (const e of events) {
    const key = (pick(e) ?? "").trim();
    if (!key) continue;
    const row = map.get(key) ?? { conversions: 0, views: 0 };
    if (CONVERSION_EVENTS.has(e.event)) row.conversions += 1;
    else row.views += 1;
    map.set(key, row);
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.conversions - a.conversions || b.views - a.views)
    .slice(0, 12);
}

/** Aggregate the funnel from a list of events. Pure — safe to unit test. */
export function computeConversionMetrics(events: MarketingEvent[]): ConversionMetrics {
  const count = (name: string) => events.filter(e => e.event === name).length;
  const sessions = new Set(
    events.map(e => `${e.originalSource}|${e.landingPage}|${e.occurredAt.slice(0, 13)}`),
  );

  return {
    visitors: sessions.size,
    pageViews: count("page_view") + count("local_guide_viewed") + count("lead_magnet_viewed"),
    guideDownloads: count("lead_magnet_downloaded"),
    assessmentStarts: count("assessment_started"),
    assessmentCompletions: count("assessment_completed"),
    consultationRequests: count("consultation_clicked"),
    qualifiedLeads: events.filter(
      e => e.leadClassification === "Qualified" || e.leadClassification === "Hot",
    ).length,
    hotLeads: events.filter(e => e.leadClassification === "Hot").length,
    byCity: group(events, e => e.city),
    bySituation: group(events, e => e.situation),
    bySource: group(events, e => e.source),
    byLandingPage: group(events, e => e.landingPage),
  };
}
