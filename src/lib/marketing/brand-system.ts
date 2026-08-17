// Brand Operating System — governed brand/message source of truth.
//
// This module complements ./positioning.ts; it does NOT replace it. The core
// promise, brand identity, and service area continue to come from positioning.
// What lives here is the messaging contract layered on top: pillars, audience
// messaging, the CTA ladder, trust rules, voice rules, and a readiness
// validator that refuses contradictory or unsupported copy.
//
// Nothing here publishes, sends, or renders publicly on its own.

import { BRAND, CORE_PROMISE, ENTRY_PATHS, PRIMARY_CTA, SECONDARY_CTA } from "./positioning";

/* ------------------------------------------------------------------ brand */

export const BRAND_NAME = BRAND.name; // "Legacy Forge" — public brand, never renamed by a domain qualifier.

/**
 * The final-domain candidate string, kept in documentation form only.
 * This is NOT PUBLIC_SITE_ORIGIN and must not be used to build URLs.
 */
export const FINAL_DOMAIN_CANDIDATE = "legacyforgerealestate.com";

export const BRAND_ROLE =
  "Trusted strategic real-estate decision advisor and educator — the person who explains the decision before anyone talks about a listing.";

/** The governing promise. Any message that contradicts this fails validation. */
export const GOVERNING_PROMISE = CORE_PROMISE;

export const BRAND_IDENTITY = {
  name: BRAND_NAME,
  publisher: BRAND.publisher,
  advisor: BRAND.advisor,
  role: BRAND_ROLE,
  promise: GOVERNING_PROMISE,
  /** Documentation-only. Domain activation is gated elsewhere (T17-1/T17-10). */
  finalDomainCandidate: FINAL_DOMAIN_CANDIDATE,
  domainQualifierIsNotARename: true,
} as const;

/* ----------------------------------------------------------------- pillars */

export type PillarId =
  | "protect-your-equity"
  | "seller-strategy"
  | "probate-inherited"
  | "downsizing"
  | "local-market-intelligence"
  | "wealth-strategy";

export interface MessagePillar {
  id: PillarId;
  label: string;
  claim: string;
  /** What the pillar is allowed to promise. */
  supports: string[];
  /** Governed public pages this pillar routes into. */
  paths: string[];
}

export const MESSAGE_PILLARS: MessagePillar[] = [
  {
    id: "protect-your-equity",
    label: "Protect Your Equity",
    claim: "Understand what you actually keep before you make the move.",
    supports: [
      "Net-proceeds thinking before list-price thinking.",
      "Cost, timing, and sequencing tradeoffs stated plainly.",
    ],
    paths: ["/sellers", "/guides", "/assessments"],
  },
  {
    id: "seller-strategy",
    label: "Seller Strategy",
    claim: "Price, prepare, and sequence the sale on evidence, not on hope.",
    supports: ["Preparation and pricing frameworks.", "Answer pages for the questions sellers actually ask."],
    paths: ["/sellers", "/answers", "/guides"],
  },
  {
    id: "probate-inherited",
    label: "Probate & Inherited Property",
    claim: "Know the authority you hold, and the family math, before anything is listed.",
    supports: [
      "Process and authority explained in sequence.",
      "Keep / rent / sell comparison structure.",
      "Legal questions are referred to counsel; this content is educational only.",
    ],
    paths: ["/probate", "/inherited-property", "/attorney-partners"],
  },
  {
    id: "downsizing",
    label: "Downsizing",
    claim: "Move to something smaller without being exposed between the sale and the purchase.",
    supports: ["Sale/purchase sequencing.", "Transition planning checklists."],
    paths: ["/downsizing", "/guides"],
  },
  {
    id: "local-market-intelligence",
    label: "Local Market Intelligence",
    claim: "Context for the specific submarket the decision sits in.",
    supports: [
      "City and submarket context pages.",
      "No market statistic is published without a dated, cited source.",
    ],
    paths: ["/local", "/local-guides"],
  },
  {
    id: "wealth-strategy",
    label: "Real Estate Wealth Strategy",
    claim: "Underwrite the next dollar before you fall in love with the property.",
    supports: ["Investment underwriting frameworks.", "Hold/sell/exchange decision structure."],
    paths: ["/investing", "/guides"],
  },
];

/* --------------------------------------------------------------- audiences */

export type BrandAudienceId =
  | "sellers"
  | "buyers"
  | "probate-inherited"
  | "downsizing"
  | "distressed"
  | "investors"
  | "past-clients"
  | "referral-professionals";

export type CtaRung = "learn" | "evaluate" | "talk" | "refer";

export const CTA_LADDER: { rung: CtaRung; intent: string; label: string; to: string }[] = [
  { rung: "learn", intent: "Research — no decision made yet.", label: "Read the guide library", to: SECONDARY_CTA.to },
  { rung: "evaluate", intent: "Comparing options — wants structure.", label: "Take the readiness assessment", to: "/assessments" },
  { rung: "talk", intent: "Decision window open — wants a person.", label: PRIMARY_CTA.label, to: PRIMARY_CTA.to },
  { rung: "refer", intent: "Professional or past client sending someone.", label: "Refer a client", to: "/refer" },
];

export const CTA_BY_RUNG: Record<CtaRung, { label: string; to: string }> = CTA_LADDER.reduce(
  (acc, c) => {
    acc[c.rung] = { label: c.label, to: c.to };
    return acc;
  },
  {} as Record<CtaRung, { label: string; to: string }>,
);

export interface AudienceMessage {
  id: BrandAudienceId;
  label: string;
  pillar: PillarId;
  /** The question the audience is actually asking. */
  question: string;
  /** One-sentence message. Must not contradict the governing promise. */
  message: string;
  /** Ladder rung the audience normally enters on. */
  entryRung: CtaRung;
  /** Rung the relationship is trying to reach. */
  targetRung: CtaRung;
  /** Governed public page the message routes into. */
  primaryPath: string;
}

const entryQuestion = (id: string) => ENTRY_PATHS.find(p => p.id === id)?.question ?? "";

export const AUDIENCE_MESSAGES: AudienceMessage[] = [
  {
    id: "sellers",
    label: "Sellers",
    pillar: "seller-strategy",
    question: entryQuestion("sellers"),
    message: "Start with what you keep, not with what you list at — then price and prepare against that number.",
    entryRung: "learn",
    targetRung: "talk",
    primaryPath: "/sellers",
  },
  {
    id: "buyers",
    label: "Buyers",
    pillar: "wealth-strategy",
    question: entryQuestion("buyers"),
    message: "Know your financing, your leverage, and your walk-away number before you write an offer.",
    entryRung: "learn",
    targetRung: "talk",
    primaryPath: "/buyers",
  },
  {
    id: "probate-inherited",
    label: "Probate and inherited property",
    pillar: "probate-inherited",
    question: entryQuestion("probate"),
    message: "Understand the authority you hold and the carrying cost you carry before the family decides anything.",
    entryRung: "learn",
    targetRung: "talk",
    primaryPath: "/probate",
  },
  {
    id: "downsizing",
    label: "Downsizing owners",
    pillar: "downsizing",
    question: entryQuestion("downsizing"),
    message: "Sequence the sale and the purchase so you are never exposed in the middle.",
    entryRung: "evaluate",
    targetRung: "talk",
    primaryPath: "/downsizing",
  },
  {
    id: "distressed",
    label: "Owners under pressure",
    pillar: "protect-your-equity",
    question: entryQuestion("distressed-property"),
    message: "Get the real options on the table while you still have all of them.",
    entryRung: "evaluate",
    targetRung: "talk",
    primaryPath: "/distressed-property",
  },
  {
    id: "investors",
    label: "Investors",
    pillar: "wealth-strategy",
    question: entryQuestion("investing"),
    message: "Underwrite the return before the property becomes a preference.",
    entryRung: "learn",
    targetRung: "talk",
    primaryPath: "/investing",
  },
  {
    id: "past-clients",
    label: "Past clients",
    pillar: "protect-your-equity",
    question: "Is my position still right for where I am now?",
    message: "A periodic, no-pressure review of your position — equity, timing, and what has changed since we last spoke.",
    entryRung: "learn",
    targetRung: "refer",
    primaryPath: "/resources",
  },
  {
    id: "referral-professionals",
    label: "Referral professionals",
    pillar: "probate-inherited",
    question: "Can I hand my client to this person without risking my relationship?",
    message: "A documented process, a written handoff, and a client who is educated before they are asked to decide.",
    entryRung: "learn",
    targetRung: "refer",
    primaryPath: "/attorney-partners",
  },
];

/* ------------------------------------------------------- trust and voice */

export const TRUST_RULES: string[] = [
  "Verified facts only. Every statistic carries a dated, named source.",
  "No invented outcomes, results, revenue figures, or client counts.",
  "No reviews, testimonials, or ratings unless verified and consented in the proof ledger.",
  "No ranking, timeline, price, or sale guarantees.",
  "No legal or tax advice, and no promise of a legal or tax outcome. Refer to counsel or a CPA.",
  "Educational framing first; the engagement offer comes after the explanation.",
  "Equal Housing Opportunity and the educational disclaimer appear on distributed assets.",
];

export const VOICE_RULES: string[] = [
  "Calm — no urgency manufacturing, no countdown pressure.",
  "Authoritative — state the framework, not an opinion.",
  "Direct — answer first, then explain.",
  "Clear — plain language over industry vocabulary.",
  "Practical — every piece ends with something the reader can do.",
];

/**
 * Visual-use contract. References existing brand tokens only; this is a usage
 * rule set, not a redesign. No component is restyled by this module.
 */
export const VISUAL_CONTRACT = {
  direction: "Editorial: near-black on paper-white, restrained gold accent, serif headings.",
  tokens: ["--background", "--foreground", "--heritage", "--gold", "--muted-foreground", "--border"],
  rules: [
    "Use semantic tokens only. Never hard-code hex or literal color utilities in components.",
    "Gold is an accent for eyebrows, rules, and emphasis — never a background fill for body content.",
    "Headings use the existing serif face; body uses the existing sans face. No new typefaces.",
    "No stock imagery implying clients, results, or transactions that did not occur.",
    "This contract does not authorize a site redesign.",
  ],
} as const;

/* -------------------------------------------------------------- validator */

export type BrandFindingSeverity = "BLOCKER" | "REVIEW";

export interface BrandFinding {
  id: string;
  severity: BrandFindingSeverity;
  subject: string;
  reason: string;
}

const SUPERLATIVES =
  /\b(#1|number one|best|top[- ]rated|leading|unmatched|guaranteed|guarantee|always wins?|never lose|world[- ]class|premier|expert of choice)\b/i;

const FABRICATED_PROOF =
  /\b(\d+\s*(five|5)[- ]star|hundreds of (happy|satisfied)|thousands of (clients|homes)|\d+%\s*(more|above|over)\s*(asking|list)|sold in \d+ (days|hours)|average sale price|our clients (earn|net|save))\b/i;

const PROMISE_CONFLICT = /\b(fast cash|we buy houses|instant offer|no risk|risk[- ]free|zero cost|free money)\b/i;

const LEGAL_TAX_PROMISE =
  /\b(tax[- ]free|avoid (probate|taxes)|we will (win|settle) your|legal advice|guaranteed (deduction|exemption))\b/i;

export interface BrandCopyCandidate {
  id: string;
  text: string;
  /** CTA rung the copy asks for, when it asks for one. */
  ctaRung?: CtaRung;
  /** Intent the surface is written for. */
  intentRung?: CtaRung;
}

const RUNG_ORDER: CtaRung[] = ["learn", "evaluate", "talk", "refer"];

/** Validate a single piece of copy against the brand contract. */
export function validateBrandCopy(candidate: BrandCopyCandidate): BrandFinding[] {
  const findings: BrandFinding[] = [];
  const text = candidate.text ?? "";

  if (SUPERLATIVES.test(text)) {
    findings.push({ id: candidate.id, severity: "BLOCKER", subject: "superlative", reason: "Unsupported superlative or guarantee language." });
  }
  if (FABRICATED_PROOF.test(text)) {
    findings.push({ id: candidate.id, severity: "BLOCKER", subject: "proof", reason: "Asserts results or proof that no verified record supports." });
  }
  if (PROMISE_CONFLICT.test(text)) {
    findings.push({ id: candidate.id, severity: "BLOCKER", subject: "promise", reason: "Contradicts the governing promise (advisory, not transactional pressure)." });
  }
  if (LEGAL_TAX_PROMISE.test(text)) {
    findings.push({ id: candidate.id, severity: "BLOCKER", subject: "legal-tax", reason: "Implies a legal or tax outcome. Refer to counsel or a CPA instead." });
  }
  if (candidate.ctaRung && candidate.intentRung) {
    const asked = RUNG_ORDER.indexOf(candidate.ctaRung);
    const intent = RUNG_ORDER.indexOf(candidate.intentRung);
    if (asked - intent > 1) {
      findings.push({
        id: candidate.id,
        severity: "REVIEW",
        subject: "cta",
        reason: `CTA "${candidate.ctaRung}" skips a rung for "${candidate.intentRung}" intent.`,
      });
    }
  }
  return findings;
}

export interface BrandReadinessReport {
  brand: string;
  promise: string;
  pillars: number;
  audiences: number;
  ctaRungs: number;
  findings: BrandFinding[];
  status: "READY" | "REVIEW" | "BLOCKED";
  detail: string;
}

/** Validate the brand system itself, plus any extra copy handed in. */
export function buildBrandReadiness(extra: BrandCopyCandidate[] = []): BrandReadinessReport {
  const findings: BrandFinding[] = [];

  for (const audience of AUDIENCE_MESSAGES) {
    findings.push(
      ...validateBrandCopy({
        id: `audience:${audience.id}`,
        text: audience.message,
        ctaRung: audience.entryRung,
        intentRung: audience.entryRung,
      }),
    );
    if (!MESSAGE_PILLARS.some(p => p.id === audience.pillar)) {
      findings.push({ id: `audience:${audience.id}`, severity: "BLOCKER", subject: "pillar", reason: "References an unknown message pillar." });
    }
  }
  for (const pillar of MESSAGE_PILLARS) {
    findings.push(...validateBrandCopy({ id: `pillar:${pillar.id}`, text: `${pillar.claim} ${pillar.supports.join(" ")}` }));
  }
  for (const candidate of extra) findings.push(...validateBrandCopy(candidate));

  const blockers = findings.filter(f => f.severity === "BLOCKER").length;
  const status = blockers > 0 ? "BLOCKED" : findings.length > 0 ? "REVIEW" : "READY";

  return {
    brand: BRAND_NAME,
    promise: GOVERNING_PROMISE,
    pillars: MESSAGE_PILLARS.length,
    audiences: AUDIENCE_MESSAGES.length,
    ctaRungs: CTA_LADDER.length,
    findings,
    status,
    detail:
      status === "READY"
        ? `${MESSAGE_PILLARS.length} pillars and ${AUDIENCE_MESSAGES.length} audience messages validate against the governing promise.`
        : `${blockers} blocking and ${findings.length - blockers} review findings.`,
  };
}
