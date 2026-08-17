// Task 34 — 90-day client-acquisition operating cadence.
//
// Extends ./content-calendar.ts. The publishing plan there stays the
// source-of-truth for answer/local/guide/assessment scheduling; this module
// layers the weekly acquisition rhythm on top and adds the past-client /
// sphere touch with a hard frequency cap.
//
// Deterministic: the same start date always yields the same plan. Every item
// is a DRAFT. Nothing here posts, sends, or schedules externally.

import { ANSWERS, type AnswerRecord } from "./answers";
import { CITY_GUIDES } from "./cities";
import { GUIDES } from "./lead-magnets";
import { ASSESSMENTS } from "./assessments";
import { PLAN_DAYS, PLAN_WEEKS, buildContentPlan, type ContentPlan } from "./content-calendar";
import { CTA_BY_RUNG, type CtaRung } from "./brand-system";

export type CadenceKind =
  | "video"
  | "answer-social"
  | "local-post"
  | "email"
  | "long-form"
  | "partner-block"
  | "offer-promo"
  | "sphere-touch";

/** Canonical weekly rhythm. Sphere touch is handled separately (bi-weekly). */
export const WEEKLY_QUOTA: Record<Exclude<CadenceKind, "sphere-touch">, number> = {
  video: 3,
  "answer-social": 2,
  "local-post": 1,
  email: 1,
  "long-form": 1,
  "partner-block": 1,
  "offer-promo": 1,
};

/** Past-client / sphere touch every second week. Never more often than this. */
export const SPHERE_TOUCH_INTERVAL_WEEKS = 2;
export const SPHERE_MIN_GAP_DAYS = 13;

export interface CadenceItem {
  id: string;
  week: number;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  kind: CadenceKind;
  title: string;
  /** Governed public page the item routes back into. */
  path: string;
  ctaRung: CtaRung;
  ctaLabel: string;
  status: "Draft";
  notes: string;
}

const KIND_LABEL: Record<CadenceKind, string> = {
  video: "Short educational video",
  "answer-social": "Answer-based social post",
  "local-post": "Local market educational post",
  email: "Email to the list",
  "long-form": "Long-form authority article",
  "partner-block": "Referral-partner relationship block",
  "offer-promo": "Guide or assessment promotion",
  "sphere-touch": "Past-client / sphere touch",
};

/** Day-of-week offsets, fixed so the plan is reviewable and diffable. */
const SCHEDULE: { kind: CadenceKind; dayOffset: number }[] = [
  { kind: "video", dayOffset: 0 },
  { kind: "long-form", dayOffset: 0 },
  { kind: "answer-social", dayOffset: 1 },
  { kind: "video", dayOffset: 2 },
  { kind: "local-post", dayOffset: 2 },
  { kind: "answer-social", dayOffset: 3 },
  { kind: "email", dayOffset: 3 },
  { kind: "video", dayOffset: 4 },
  { kind: "offer-promo", dayOffset: 4 },
  { kind: "partner-block", dayOffset: 5 },
];

function isoDate(start: Date, offsetDays: number): string {
  const d = new Date(start.getTime());
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const NO_HASHTAG_SPAM = "Three topical tags maximum. No hashtag stacking, no engagement bait, no unsupported claims.";

export interface CadencePlan {
  startDate: string;
  endDate: string;
  weeks: number;
  items: CadenceItem[];
  /** The underlying publishing plan this cadence sits on top of. */
  contentPlan: ContentPlan;
  weeklyCounts: Record<number, Partial<Record<CadenceKind, number>>>;
  sphereTouches: CadenceItem[];
  violations: string[];
}

export function buildAcquisitionCadence(
  startDate = "2026-09-07",
  answers: AnswerRecord[] = ANSWERS,
): CadencePlan {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const contentPlan = buildContentPlan(startDate, answers);
  const items: CadenceItem[] = [];

  let answerCursor = 0;
  let cityCursor = 0;
  let guideCursor = 0;
  let assessmentCursor = 0;
  let offerToggle = 0;

  for (let week = 1; week <= PLAN_WEEKS; week += 1) {
    const weekStart = (week - 1) * 7;

    for (const [index, step] of SCHEDULE.entries()) {
      const dayOffset = weekStart + step.dayOffset;
      if (dayOffset >= PLAN_DAYS) continue;
      const date = isoDate(start, dayOffset);
      const id = `C-W${String(week).padStart(2, "0")}-${step.kind}-${index}`;

      if (step.kind === "local-post") {
        const city = CITY_GUIDES[cityCursor % CITY_GUIDES.length]!;
        cityCursor += 1;
        items.push({
          id,
          week,
          date,
          kind: step.kind,
          title: `${city.city}: what the local context changes about your decision`,
          path: `/local-guides/${city.slug}`,
          ctaRung: "learn",
          ctaLabel: CTA_BY_RUNG.learn.label,
          status: "Draft",
          notes: `${KIND_LABEL[step.kind]}. Facts must be sourced and dated. ${NO_HASHTAG_SPAM}`,
        });
        continue;
      }

      if (step.kind === "offer-promo") {
        const useGuide = offerToggle % 2 === 0;
        offerToggle += 1;
        if (useGuide) {
          const guide = GUIDES[guideCursor % GUIDES.length]!;
          guideCursor += 1;
          items.push({
            id,
            week,
            date,
            kind: step.kind,
            title: guide.title,
            path: `/guides/${guide.slug}`,
            ctaRung: "learn",
            ctaLabel: CTA_BY_RUNG.learn.label,
            status: "Draft",
            notes: `${KIND_LABEL[step.kind]}. ${NO_HASHTAG_SPAM}`,
          });
        } else {
          const assessment = ASSESSMENTS[assessmentCursor % ASSESSMENTS.length]!;
          assessmentCursor += 1;
          items.push({
            id,
            week,
            date,
            kind: step.kind,
            title: assessment.title,
            path: `/assessments/${assessment.slug}`,
            ctaRung: "evaluate",
            ctaLabel: CTA_BY_RUNG.evaluate.label,
            status: "Draft",
            notes: `${KIND_LABEL[step.kind]}. ${NO_HASHTAG_SPAM}`,
          });
        }
        continue;
      }

      if (step.kind === "partner-block") {
        items.push({
          id,
          week,
          date,
          kind: step.kind,
          title: "Referral-professional relationship block — one documented conversation",
          path: "/attorney-partners",
          ctaRung: "refer",
          ctaLabel: CTA_BY_RUNG.refer.label,
          status: "Draft",
          notes: "One scheduled conversation or written follow-up with a referral professional. Log the outcome. No mass outreach, no automated sends.",
        });
        continue;
      }

      const answer = answers[answerCursor % answers.length]!;
      answerCursor += 1;
      const rung: CtaRung = step.kind === "email" ? "evaluate" : "learn";
      items.push({
        id,
        week,
        date,
        kind: step.kind,
        title:
          step.kind === "video"
            ? `60-second answer: ${answer.question}`
            : step.kind === "email"
              ? `Email: ${answer.question}`
              : answer.question,
        path: `/answers/${answer.slug}`,
        ctaRung: rung,
        ctaLabel: CTA_BY_RUNG[rung].label,
        status: "Draft",
        notes: `${KIND_LABEL[step.kind]}. Answer first, then explain. ${NO_HASHTAG_SPAM}`,
      });
    }

    if (week % SPHERE_TOUCH_INTERVAL_WEEKS === 0) {
      const dayOffset = weekStart + 6;
      if (dayOffset < PLAN_DAYS) {
        items.push({
          id: `C-W${String(week).padStart(2, "0")}-sphere`,
          week,
          date: isoDate(start, dayOffset),
          kind: "sphere-touch",
          title: "Past-client and sphere touch — useful, not promotional",
          path: "/resources",
          ctaRung: "learn",
          ctaLabel: CTA_BY_RUNG.learn.label,
          status: "Draft",
          notes:
            "One genuinely useful item every two weeks. No listing pitch, no urgency, no 'thinking of selling?' prompt. Opt-out honoured immediately.",
        });
      }
    }
  }

  items.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? -1 : 1));

  const weeklyCounts: Record<number, Partial<Record<CadenceKind, number>>> = {};
  for (const item of items) {
    const bucket = (weeklyCounts[item.week] ??= {});
    bucket[item.kind] = (bucket[item.kind] ?? 0) + 1;
  }

  const sphereTouches = items.filter(i => i.kind === "sphere-touch");
  const violations = cadenceViolations(items, weeklyCounts);

  return {
    startDate,
    endDate: isoDate(start, PLAN_DAYS - 1),
    weeks: PLAN_WEEKS,
    items,
    contentPlan,
    weeklyCounts,
    sphereTouches,
    violations,
  };
}

/** Weekly quota shortfalls and sphere-touch frequency breaches. */
export function cadenceViolations(
  items: CadenceItem[],
  weeklyCounts: Record<number, Partial<Record<CadenceKind, number>>>,
): string[] {
  const violations: string[] = [];
  const lastWeek = Math.max(...items.map(i => i.week), 0);

  for (const [weekKey, counts] of Object.entries(weeklyCounts)) {
    const week = Number(weekKey);
    // The final partial week of a 90-day plan is allowed to be short.
    if (week === lastWeek && items.filter(i => i.week === week).length < SCHEDULE.length) continue;
    for (const [kind, quota] of Object.entries(WEEKLY_QUOTA) as [CadenceKind, number][]) {
      const actual = counts[kind] ?? 0;
      if (actual < quota) violations.push(`Week ${week}: ${kind} ${actual}/${quota}.`);
    }
  }

  const sphere = items.filter(i => i.kind === "sphere-touch").map(i => i.date).sort();
  for (let i = 1; i < sphere.length; i += 1) {
    const gap = (Date.parse(sphere[i]!) - Date.parse(sphere[i - 1]!)) / 86_400_000;
    if (gap < SPHERE_MIN_GAP_DAYS) {
      violations.push(`Sphere touches ${sphere[i - 1]} and ${sphere[i]} are only ${gap} days apart.`);
    }
  }
  return violations;
}

export const CADENCE_KIND_LABEL = KIND_LABEL;
