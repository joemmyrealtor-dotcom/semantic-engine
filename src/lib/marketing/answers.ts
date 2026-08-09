// Content Authority Engine — the answer bank.
//
// The Seller's 30 Questions (PL-212) and the Buyer's 30 Questions (PL-213)
// already contain sixty high-intent consumer questions with real answers.
// This module derives them into structured answer records so one editorial
// source powers the public answer pages, the schema, the internal links, and
// the distribution assets. Nothing is invented here: every question and every
// answer sentence is read out of the governed publication data.

import { seedGuidePublications } from "@/lib/data/seed.guides";
import type { EntryPathId } from "./positioning";
import { GUIDES } from "./lead-magnets";
import { CITY_GUIDES } from "./cities";

export type AnswerAudience = "seller" | "buyer";

export interface AnswerRecord {
  /** Stable id, e.g. "AN-S01". */
  id: string;
  slug: string;
  number: number;
  audience: AnswerAudience;
  /** Source publication id, e.g. "PL-212". */
  publicationId: string;
  /** Chapter title the question belongs to — the topic cluster. */
  cluster: string;
  question: string;
  /** The direct answer, first. One to three sentences. */
  shortAnswer: string;
  /** The rest of the answer: factors, costs, risks, and the move. */
  detail: string;
  situation: EntryPathId;
  guideSlug: string;
  assessmentSlug: string;
}

const SOURCES: { publicationId: string; audience: AnswerAudience; situation: EntryPathId }[] = [
  { publicationId: "PL-212", audience: "seller", situation: "sellers" },
  { publicationId: "PL-213", audience: "buyer", situation: "buyers" },
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 9)
    .join("-");
}

/** Split "Q1. …? answer… Q2. …" into per-question segments. */
function splitQuestions(description: string): { n: number; text: string }[] {
  const parts: { n: number; text: string }[] = [];
  const re = /Q(\d+)\.\s/g;
  const marks: { n: number; start: number; contentStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(description)) !== null) {
    marks.push({ n: Number(m[1]), start: m.index, contentStart: m.index + m[0].length });
  }
  marks.forEach((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1]!.start : description.length;
    parts.push({ n: mark.n, text: description.slice(mark.contentStart, end).trim() });
  });
  return parts;
}

/** First sentences of the answer, up to ~320 characters, kept whole. */
function firstSentences(body: string, limit = 320): { head: string; rest: string } {
  const sentences = body.match(/[^.?!]+[.?!]+(\s|$)/g) ?? [body];
  let head = "";
  let used = 0;
  for (const s of sentences) {
    if (head && head.length + s.length > limit) break;
    head += s;
    used += 1;
    if (head.length >= limit) break;
  }
  return { head: head.trim(), rest: sentences.slice(used).join("").trim() };
}

function guideFor(situation: EntryPathId) {
  return GUIDES.find(g => g.situation === situation);
}

function buildAnswers(): AnswerRecord[] {
  const out: AnswerRecord[] = [];
  const seen = new Set<string>();

  for (const source of SOURCES) {
    const pub = seedGuidePublications.find(p => p.id === source.publicationId) as
      | { id: string; chapters: { title: string; description: string; learningObjectives: string[] }[] }
      | undefined;
    if (!pub) continue;
    const guide = guideFor(source.situation);

    for (const chapter of pub.chapters) {
      const objectives = new Map<number, string>();
      for (const objective of chapter.learningObjectives) {
        const match = /^Q(\d+)\.\s*(.+)$/.exec(objective.trim());
        if (match) objectives.set(Number(match[1]), match[2]!.trim());
      }

      for (const segment of splitQuestions(chapter.description)) {
        const inlineQuestion = /^(.*?\?)/.exec(segment.text)?.[1]?.trim();
        const question = objectives.get(segment.n) ?? inlineQuestion;
        if (!question) continue;
        const body = inlineQuestion
          ? segment.text.slice(inlineQuestion.length).trim()
          : segment.text;
        const { head, rest } = firstSentences(body);
        if (!head) continue;

        let slug = `${source.audience}-${slugify(question)}`;
        while (seen.has(slug)) slug = `${slug}-${segment.n}`;
        seen.add(slug);

        out.push({
          id: `AN-${source.audience === "seller" ? "S" : "B"}${String(segment.n).padStart(2, "0")}`,
          slug,
          number: segment.n,
          audience: source.audience,
          publicationId: source.publicationId,
          cluster: chapter.title,
          question,
          shortAnswer: head,
          detail: rest,
          situation: source.situation,
          guideSlug: guide?.slug ?? "seller-decision-guide",
          assessmentSlug: guide?.assessmentSlug ?? "seller-readiness",
        });
      }
    }
  }

  return out.sort((a, b) =>
    a.audience === b.audience ? a.number - b.number : a.audience < b.audience ? -1 : 1,
  );
}

export const ANSWERS: AnswerRecord[] = buildAnswers();

export function getAnswer(slug: string): AnswerRecord | undefined {
  return ANSWERS.find(a => a.slug === slug);
}

export function answersByAudience(audience: AnswerAudience): AnswerRecord[] {
  return ANSWERS.filter(a => a.audience === audience);
}

/** Clusters in publication order, for the index page and the calendar. */
export function answerClusters(): { cluster: string; audience: AnswerAudience; answers: AnswerRecord[] }[] {
  const map = new Map<string, { cluster: string; audience: AnswerAudience; answers: AnswerRecord[] }>();
  for (const a of ANSWERS) {
    const key = `${a.audience}::${a.cluster}`;
    if (!map.has(key)) map.set(key, { cluster: a.cluster, audience: a.audience, answers: [] });
    map.get(key)!.answers.push(a);
  }
  return [...map.values()];
}

/**
 * Local considerations for an answer. Deterministic rotation across the eight
 * submarkets so each answer page carries a different, real local pairing —
 * never eight near-identical city blocks on every page.
 */
export function localAnglesFor(answer: AnswerRecord, count = 2) {
  const offset = (answer.audience === "seller" ? 0 : 3) + answer.number;
  return Array.from({ length: Math.min(count, CITY_GUIDES.length) }, (_, i) => {
    const city = CITY_GUIDES[(offset + i * 3) % CITY_GUIDES.length]!;
    const situation = city.situations.find(s => s.to === `/${answer.situation}`) ?? city.situations[0]!;
    return { slug: city.slug, city: city.city, note: situation.body };
  });
}

export function metaTitleFor(answer: AnswerRecord): string {
  const base = answer.question.replace(/\s+/g, " ").trim();
  const suffix = " | Legacy Forge";
  const max = 60 - suffix.length;
  const trimmed = base.length > max ? `${base.slice(0, max - 1).trimEnd()}…` : base;
  return `${trimmed}${suffix}`;
}

export function metaDescriptionFor(answer: AnswerRecord): string {
  const text = answer.shortAnswer.replace(/\s+/g, " ").trim();
  return text.length > 155 ? `${text.slice(0, 154).trimEnd()}…` : text;
}
