// Task 24 — Internal lead scoring model.
//
// Deterministic, explainable, and independent of any CRM vendor. The
// score and its signals are written to HubSpot; the raw inputs stay here.

import { BRAND } from "./positioning";

export type LeadClassification = "Hot" | "Qualified" | "Nurture" | "Long-term";

export interface LeadScoreInput {
  timeline?: string;
  situation?: string;
  city?: string;
  motivation?: string;
  propertyAddress?: string;
  consultationRequested?: boolean;
  assessmentCompleted?: boolean;
  readinessLevel?: string;
  /** Count of distinct high-intent pages visited this session. */
  intentVisits?: number;
}

export interface LeadScore {
  points: number;
  classification: LeadClassification;
  signals: string[];
}

const HIGH_INTENT_SITUATIONS = ["sellers", "probate", "inherited", "distressed"];

const STRONG_MOTIVATION =
  /(must|need|urgent|relocat|job|divorce|death|estate|foreclos|default|health|care|settle|court)/i;

function inServiceArea(city?: string): boolean {
  if (!city) return false;
  const c = city.trim().toLowerCase();
  if (!c) return false;
  return (
    BRAND.serviceArea.some(a => a.toLowerCase() === c || c.includes(a.toLowerCase())) ||
    /orange county|oc\b/i.test(city)
  );
}

/** Score a lead 0-100 and classify it. */
export function scoreLead(input: LeadScoreInput): LeadScore {
  const signals: string[] = [];
  let points = 0;

  const add = (n: number, signal: string) => {
    points += n;
    signals.push(signal);
  };

  if (input.timeline === "0-90") add(25, "Timeline within 90 days");
  else if (input.timeline === "3-6") add(14, "Timeline three to six months");
  else if (input.timeline === "6-12") add(7, "Timeline six to twelve months");
  else if (input.timeline === "researching") add(2, "Still researching");

  if (input.propertyAddress && input.propertyAddress.trim().length > 4) {
    add(12, "Property identified");
  }
  if (input.consultationRequested) add(18, "Consultation requested");
  if (input.situation && HIGH_INTENT_SITUATIONS.includes(input.situation)) {
    add(12, `High-intent situation: ${input.situation}`);
  }
  if (input.motivation && STRONG_MOTIVATION.test(input.motivation)) {
    add(10, "Strong stated motivation");
  }
  if (inServiceArea(input.city)) add(8, "Inside local service area");
  if (input.assessmentCompleted) add(8, "Assessment completed");
  if (input.readinessLevel === "Ready") add(4, "Assessment readiness: Ready");
  if (input.readinessLevel === "Action Required") add(6, "Assessment flagged urgency");

  const visits = Math.max(0, Math.min(input.intentVisits ?? 0, 6));
  if (visits >= 2) add(Math.min(visits * 2, 10), `${visits} high-intent page visits`);

  points = Math.max(0, Math.min(100, points));

  let classification: LeadClassification;
  if (points >= 70) classification = "Hot";
  else if (points >= 45) classification = "Qualified";
  else if (points >= 22) classification = "Nurture";
  else classification = "Long-term";

  return { points, classification, signals };
}

// ---------------------------------------------------------------------------
// High-intent page visit tracking (session-scoped, no PII)
// ---------------------------------------------------------------------------

const INTENT_KEY = "lf.intent.v1";

const HIGH_INTENT_PREFIXES = [
  "/guides/",
  "/assessments/",
  "/local-guides/",
  "/sellers",
  "/probate",
  "/inherited-property",
  "/distressed-property",
  "/downsizing",
  "/contact",
];

export function isHighIntentPath(pathname: string): boolean {
  return HIGH_INTENT_PREFIXES.some(p => pathname === p || pathname.startsWith(p));
}

/** Record a pathname visit; returns the distinct high-intent visit count. */
export function recordIntentVisit(pathname: string): number {
  if (typeof window === "undefined") return 0;
  if (!isHighIntentPath(pathname)) return intentVisitCount();
  try {
    const raw = window.sessionStorage.getItem(INTENT_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    if (!list.includes(pathname)) list.push(pathname);
    window.sessionStorage.setItem(INTENT_KEY, JSON.stringify(list.slice(-20)));
    return list.length;
  } catch {
    return 0;
  }
}

export function intentVisitCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.sessionStorage.getItem(INTENT_KEY);
    return raw ? (JSON.parse(raw) as string[]).length : 0;
  } catch {
    return 0;
  }
}
