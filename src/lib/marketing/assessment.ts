// Task 23 — Interactive readiness assessment (pure scoring logic).

import { ENTRY_PATHS, type EntryPathId } from "./positioning";

export interface AssessmentOption {
  value: string;
  label: string;
  score: number;
}

export interface AssessmentQuestion {
  id: string;
  prompt: string;
  help?: string;
  options: AssessmentOption[];
}

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    id: "timeline",
    prompt: "When do you need this decision made?",
    options: [
      { value: "now", label: "Within 30 days — there is a deadline", score: 3 },
      { value: "quarter", label: "In the next three months", score: 2 },
      { value: "year", label: "Sometime this year", score: 1 },
      { value: "unsure", label: "No timeline yet", score: 0 },
    ],
  },
  {
    id: "authority",
    prompt: "Can you legally sign for the property today?",
    help: "Sole or joint owner, trustee, or court-appointed representative all count.",
    options: [
      { value: "yes", label: "Yes, my authority is documented", score: 3 },
      { value: "partial", label: "Partly — others must also sign", score: 2 },
      { value: "pending", label: "Pending court or trust paperwork", score: 1 },
      { value: "no", label: "No, or I am not sure", score: 0 },
    ],
  },
  {
    id: "numbers",
    prompt: "Do you know your payoff, your basis, and your carrying cost?",
    options: [
      { value: "all", label: "All three, in writing", score: 3 },
      { value: "some", label: "One or two of them", score: 2 },
      { value: "rough", label: "Rough estimates only", score: 1 },
      { value: "none", label: "None of them yet", score: 0 },
    ],
  },
  {
    id: "condition",
    prompt: "What condition is the property in?",
    options: [
      { value: "ready", label: "Market ready today", score: 3 },
      { value: "light", label: "Needs cosmetic work", score: 2 },
      { value: "deferred", label: "Meaningful deferred maintenance", score: 1 },
      { value: "unknown", label: "I have not been inside recently", score: 0 },
    ],
  },
  {
    id: "alignment",
    prompt: "Is everyone involved in agreement on the outcome?",
    options: [
      { value: "aligned", label: "Yes, we agree", score: 3 },
      { value: "mostly", label: "Mostly, with open questions", score: 2 },
      { value: "split", label: "No, we disagree", score: 1 },
      { value: "solo", label: "It is only my decision", score: 3 },
    ],
  },
  {
    id: "pressure",
    prompt: "Is there financial pressure on the property right now?",
    options: [
      { value: "none", label: "No — payments are current", score: 3 },
      { value: "tight", label: "Tight but current", score: 2 },
      { value: "late", label: "Behind on payments", score: 1 },
      { value: "notice", label: "A formal notice has been recorded", score: 0 },
    ],
  },
];

export const MAX_SCORE = ASSESSMENT_QUESTIONS.length * 3;

export type ReadinessBand = "ready" | "nearly" | "preparing" | "early";

export interface AssessmentResult {
  score: number;
  maxScore: number;
  percent: number;
  band: ReadinessBand;
  headline: string;
  summary: string;
  nextSteps: string[];
  urgentFlags: string[];
  recommendedPath: EntryPathId | null;
}

const BANDS: Record<ReadinessBand, { headline: string; summary: string; steps: string[] }> = {
  ready: {
    headline: "You are ready to execute",
    summary:
      "Your authority, your numbers, and your timeline all line up. The remaining work is execution: pricing strategy, preparation scope, and a written negotiation plan.",
    steps: [
      "Lock a target list date and work backwards through preparation.",
      "Model net proceeds at three price points before you commit to one.",
      "Set your response rules for offers before the first one arrives.",
    ],
  },
  nearly: {
    headline: "You are close — two or three gaps remain",
    summary:
      "The core decision is sound, but at least one input is still an estimate. Closing those gaps now costs days; discovering them in escrow costs money.",
    steps: [
      "Put your payoff, basis, and carrying cost in writing this week.",
      "Confirm every required signature before marketing begins.",
      "Order a pre-listing inspection so surprises arrive on your schedule.",
    ],
  },
  preparing: {
    headline: "You are in the preparation stage",
    summary:
      "You have a direction but not yet a plan. This is the right moment to build the numbers and confirm authority — before any decision becomes irreversible.",
    steps: [
      "Establish who has legal authority to sign, and document it.",
      "Build a first-pass net sheet, even with estimates.",
      "Walk the property and list the condition items honestly.",
    ],
  },
  early: {
    headline: "You are early — and that is an advantage",
    summary:
      "Almost every expensive real estate mistake is made under time pressure. You do not have that pressure yet, which means every option is still open to you.",
    steps: [
      "Define the outcome you actually want before you evaluate options.",
      "Gather the documents: deed, loan statement, trust or court paperwork.",
      "Set a review date rather than an action date.",
    ],
  },
};

export function scoreAssessment(
  answers: Record<string, string>,
  entryPath: EntryPathId | null,
): AssessmentResult {
  let score = 0;
  for (const q of ASSESSMENT_QUESTIONS) {
    const chosen = q.options.find(o => o.value === answers[q.id]);
    if (chosen) score += chosen.score;
  }
  const percent = Math.round((score / MAX_SCORE) * 100);
  const band: ReadinessBand =
    percent >= 80 ? "ready" : percent >= 60 ? "nearly" : percent >= 35 ? "preparing" : "early";

  const urgentFlags: string[] = [];
  if (answers["pressure"] === "notice") {
    urgentFlags.push(
      "A recorded notice starts a fixed statutory clock. Options disappear on dates, not on readiness — this should be reviewed immediately.",
    );
  }
  if (answers["pressure"] === "late") {
    urgentFlags.push(
      "Being behind on payments narrows your options over time. Acting while you are still pre-notice preserves the widest set of outcomes.",
    );
  }
  if (answers["authority"] === "no" || answers["authority"] === "pending") {
    urgentFlags.push(
      "Nothing should be listed or promised until signing authority is documented. Confirm this before any other step.",
    );
  }
  if (answers["alignment"] === "split") {
    urgentFlags.push(
      "Disagreement among decision-makers is the most common cause of failed estate and family sales. Resolve the decision structure before the property decision.",
    );
  }

  const b = BANDS[band];
  return {
    score,
    maxScore: MAX_SCORE,
    percent,
    band,
    headline: b.headline,
    summary: b.summary,
    nextSteps: b.steps,
    urgentFlags,
    recommendedPath: entryPath,
  };
}

export const ASSESSMENT_PATHS = ENTRY_PATHS;
