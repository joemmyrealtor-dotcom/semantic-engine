// Content Authority Engine — the 90-day publishing calendar.
//
// Deterministic: the same start date always produces the same plan, so the
// calendar can be reviewed, diffed, and tested. Nothing here publishes,
// posts, or schedules externally — it produces a reviewable plan of drafts.

import { ANSWERS, type AnswerRecord } from "./answers";
import { CITY_GUIDES } from "./cities";
import { GUIDES } from "./lead-magnets";
import { ASSESSMENTS } from "./assessments";
import { assetsFor, CHANNEL_LABEL, type Channel, type DistributionAsset } from "./distribution";

export const PLAN_DAYS = 90;
export const PLAN_WEEKS = Math.ceil(PLAN_DAYS / 7);

export type SlotKind = "answer" | "local" | "guide" | "assessment";

export interface CalendarSlot {
  id: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  week: number;
  kind: SlotKind;
  channel: Channel;
  channelLabel: string;
  title: string;
  path: string;
  status: "Draft";
  /** Distribution asset id when the slot is generated from an answer. */
  assetId?: string;
}

function isoDate(start: Date, offsetDays: number): string {
  const d = new Date(start.getTime());
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Weekly cadence: answers carry the week, local + offer round it out. */
const WEEK_PATTERN: { dayOffset: number; kind: SlotKind; channel: Channel }[] = [
  { dayOffset: 0, kind: "answer", channel: "seo" },
  { dayOffset: 0, kind: "answer", channel: "linkedin" },
  { dayOffset: 1, kind: "answer", channel: "youtube" },
  { dayOffset: 2, kind: "answer", channel: "seo" },
  { dayOffset: 2, kind: "answer", channel: "x" },
  { dayOffset: 3, kind: "local", channel: "facebook" },
  { dayOffset: 3, kind: "local", channel: "instagram" },
  { dayOffset: 4, kind: "answer", channel: "seo" },
  { dayOffset: 4, kind: "answer", channel: "email" },
  { dayOffset: 5, kind: "guide", channel: "linkedin" },
  { dayOffset: 6, kind: "assessment", channel: "facebook" },
  { dayOffset: 6, kind: "answer", channel: "partner" },
];

export interface ContentPlan {
  startDate: string;
  endDate: string;
  slots: CalendarSlot[];
  assets: DistributionAsset[];
  coverage: {
    totalAnswers: number;
    answersScheduled: number;
    citiesScheduled: number;
    guidesScheduled: number;
    assessmentsScheduled: number;
    byChannel: Record<Channel, number>;
  };
}

export function buildContentPlan(startDate = "2026-09-07", answers: AnswerRecord[] = ANSWERS): ContentPlan {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const slots: CalendarSlot[] = [];
  const scheduledAnswers = new Set<string>();
  let answerCursor = 0;
  let cityCursor = 0;
  let guideCursor = 0;
  let assessmentCursor = 0;

  for (let week = 1; week <= PLAN_WEEKS; week += 1) {
    const weekStart = (week - 1) * 7;
    for (const step of WEEK_PATTERN) {
      const dayOffset = weekStart + step.dayOffset;
      if (dayOffset >= PLAN_DAYS) continue;
      const date = isoDate(start, dayOffset);
      const id = `W${String(week).padStart(2, "0")}-${step.kind}-${step.channel}-${dayOffset}`;

      if (step.kind === "answer") {
        const answer = answers[answerCursor % answers.length]!;
        // Pair the SEO page with its social echoes before advancing.
        if (step.channel !== "seo") answerCursor += 1;
        scheduledAnswers.add(answer.slug);
        const asset = assetsFor(answer).find(a => a.channel === step.channel)!;
        slots.push({
          id,
          date,
          week,
          kind: "answer",
          channel: step.channel,
          channelLabel: CHANNEL_LABEL[step.channel],
          title: asset.title,
          path: `/answers/${answer.slug}`,
          status: "Draft",
          assetId: asset.id,
        });
        continue;
      }

      if (step.kind === "local") {
        const city = CITY_GUIDES[cityCursor % CITY_GUIDES.length]!;
        cityCursor += 1;
        slots.push({
          id,
          date,
          week,
          kind: "local",
          channel: step.channel,
          channelLabel: CHANNEL_LABEL[step.channel],
          title: `${city.city} market context — what it changes for your decision`,
          path: `/local-guides/${city.slug}`,
          status: "Draft",
        });
        continue;
      }

      if (step.kind === "guide") {
        const guide = GUIDES[guideCursor % GUIDES.length]!;
        guideCursor += 1;
        slots.push({
          id,
          date,
          week,
          kind: "guide",
          channel: step.channel,
          channelLabel: CHANNEL_LABEL[step.channel],
          title: guide.title,
          path: `/guides/${guide.slug}`,
          status: "Draft",
        });
        continue;
      }

      const assessment = ASSESSMENTS[assessmentCursor % ASSESSMENTS.length]!;
      assessmentCursor += 1;
      slots.push({
        id,
        date,
        week,
        kind: "assessment",
        channel: step.channel,
        channelLabel: CHANNEL_LABEL[step.channel],
        title: assessment.title,
        path: `/assessments/${assessment.slug}`,
        status: "Draft",
      });
    }
  }

  const byChannel = slots.reduce(
    (acc, s) => {
      acc[s.channel] = (acc[s.channel] ?? 0) + 1;
      return acc;
    },
    {} as Record<Channel, number>,
  );

  return {
    startDate,
    endDate: isoDate(start, PLAN_DAYS - 1),
    slots: slots.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? -1 : 1)),
    assets: answers.flatMap(assetsFor),
    coverage: {
      totalAnswers: answers.length,
      answersScheduled: scheduledAnswers.size,
      citiesScheduled: Math.min(cityCursor, CITY_GUIDES.length),
      guidesScheduled: Math.min(guideCursor, GUIDES.length),
      assessmentsScheduled: Math.min(assessmentCursor, ASSESSMENTS.length),
      byChannel,
    },
  };
}
