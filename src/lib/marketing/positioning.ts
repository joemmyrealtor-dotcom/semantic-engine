// Task 19 — Legacy Forge market position.
//
// One core promise carried across every public surface, plus the six
// audience entry paths. This module is the single source of truth for
// public positioning copy; routes and components read from it.

export const CORE_PROMISE =
  "Make smarter real estate decisions. Protect your equity. Follow a clear plan.";

export const BRAND = {
  name: "Legacy Forge",
  publisher: "JM Advisory Press",
  advisor: "Joe Melendez",
  origin: "https://semantic-engine.lovable.app",
  serviceArea: [
    "La Habra",
    "Brea",
    "Fullerton",
    "Whittier",
    "La Mirada",
    "Yorba Linda",
    "Orange",
    "Orange County",
  ],
} as const;

export type EntryPathId =
  | "sellers"
  | "buyers"
  | "probate"
  | "inherited-property"
  | "downsizing"
  | "distressed-property"
  | "investing";

export interface EntryPath {
  id: EntryPathId;
  label: string;
  to: string;
  question: string;
  promiseLine: string;
}

/** The audience entry paths. Every public page routes a visitor into one. */
export const ENTRY_PATHS: EntryPath[] = [
  {
    id: "sellers",
    label: "I'm selling",
    to: "/sellers",
    question: "What is my home actually worth, and what will I walk away with?",
    promiseLine: "Price it right, prepare it well, and keep more of the proceeds.",
  },
  {
    id: "buyers",
    label: "I'm buying",
    to: "/buyers",
    question: "How do I buy well without overpaying or getting outmaneuvered?",
    promiseLine: "Know your financing, your leverage, and your walk-away number.",
  },
  {
    id: "probate",
    label: "I'm handling a probate",
    to: "/probate",
    question: "I'm the executor or administrator. What am I allowed to do, and when?",
    promiseLine: "Understand the authority you hold before you list anything.",
  },
  {
    id: "inherited-property",
    label: "I inherited a property",
    to: "/inherited-property",
    question: "Do we keep it, rent it, or sell it — and what does it cost us either way?",
    promiseLine: "See the basis, the carrying cost, and the family math side by side.",
  },
  {
    id: "downsizing",
    label: "I'm downsizing",
    to: "/downsizing",
    question: "How do I move to something smaller without losing my equity in the process?",
    promiseLine: "Sequence the sale and the purchase so you are never exposed.",
  },
  {
    id: "distressed-property",
    label: "I'm behind on payments",
    to: "/distressed-property",
    question: "Foreclosure, short sale, or a workout — which one applies to me?",
    promiseLine: "Get the real options on the table while you still have all of them.",
  },
  {
    id: "investing",
    label: "I'm investing",
    to: "/investing",
    question: "Where does the next dollar actually earn its return?",
    promiseLine: "Underwrite before you fall in love with a property.",
  },
];

/** Capability proof — verifiable statements only, no invented testimonials. */
export const TRUST_PROOF: { label: string; detail: string }[] = [
  {
    label: "Published guide library",
    detail:
      "Seventeen full-length guides covering selling, buying, probate, inherited property, 1031 exchanges, title, ownership structures, loan programs, and distressed property.",
  },
  {
    label: "Governed research process",
    detail:
      "Every guide moves through drafting, editorial, QA, and canonical review before it is published. Nothing goes out as an unreviewed opinion.",
  },
  {
    label: "Decision tools, not sales pitches",
    detail:
      "Interactive decision trees and readiness assessments give you a structured answer you can act on, whether or not you ever hire us.",
  },
  {
    label: "Orange County focus",
    detail: `Local work concentrated in ${BRAND.serviceArea.slice(0, 7).join(", ")}, and the surrounding Orange County submarkets.`,
  },
];

/** Standard CTA pair used on every public page. */
export const PRIMARY_CTA = {
  label: "Book a strategy call",
  to: "/contact",
} as const;

export const SECONDARY_CTA = {
  label: "Browse the guide library",
  to: "/resources",
} as const;
