// Task 33 — Paid acquisition READINESS ONLY.
//
// ACTIVATION IS BLOCKED. This module produces a reviewable blueprint: what
// would be built, what must be true first, and what the guardrails are. It
// creates no accounts, no campaigns, no audiences, no pixels, and no spend.
// Nothing here can be executed.

export const PAID_ACTIVATION_STATUS = "BLOCKED" as const;

export type PaidPlatform = "google-search" | "google-pmax" | "meta" | "local-services";

export interface PaidBlueprint {
  platform: PaidPlatform;
  label: string;
  intent: string;
  /** Governed destinations that already exist. No new pages are implied. */
  destinations: string[];
  audienceBasis: string;
  measurement: string;
  status: "BLOCKED";
  activated: false;
}

export const PAID_BLUEPRINTS: PaidBlueprint[] = [
  {
    platform: "google-search",
    label: "Google Search — high-intent question terms",
    intent: "Capture people already searching a specific decision question, not brand or generic 'realtor near me' terms.",
    destinations: ["/answers", "/guides", "/assessments"],
    audienceBasis: "Keyword intent only. No demographic, ZIP, or life-event targeting of housing audiences.",
    measurement: "Requires GA4 and conversion import. Neither is connected, so no campaign may run.",
    status: "BLOCKED",
    activated: false,
  },
  {
    platform: "google-pmax",
    label: "Performance Max — deferred",
    intent: "Not recommended before organic and search-intent baselines exist. Listed for completeness only.",
    destinations: [],
    audienceBasis: "Not defined. Automated placements make fair-housing compliance harder to evidence.",
    measurement: "Not applicable while activation is blocked.",
    status: "BLOCKED",
    activated: false,
  },
  {
    platform: "meta",
    label: "Meta — educational reach",
    intent: "Distribute educational answers and guides. Never a listing or valuation offer.",
    destinations: ["/guides", "/local-guides"],
    audienceBasis:
      "Housing Special Ad Category is mandatory. No age, gender, ZIP-radius, or detailed targeting. Broad geography only.",
    measurement: "Requires GA4 and a verified conversion path. Not connected.",
    status: "BLOCKED",
    activated: false,
  },
  {
    platform: "local-services",
    label: "Local Services / verified listings — deferred",
    intent: "Requires business verification and a live production domain.",
    destinations: [],
    audienceBasis: "Service-area based. Not configurable before domain activation.",
    measurement: "Not applicable while activation is blocked.",
    status: "BLOCKED",
    activated: false,
  },
];

export interface PaidPrerequisite {
  id: string;
  label: string;
  detail: string;
  met: false;
  blocks: PaidPlatform[] | "all";
}

export const PAID_PREREQUISITES: PaidPrerequisite[] = [
  {
    id: "domain",
    label: "Final production domain verified and active",
    detail: "Paid traffic must land on the permanent domain. Domain control is not yet proven.",
    met: false,
    blocks: "all",
  },
  {
    id: "publication",
    label: "Production release authorized",
    detail: "The site is not published. Paid traffic cannot be sent to an unreleased application.",
    met: false,
    blocks: "all",
  },
  {
    id: "measurement",
    label: "GA4 property and conversion import verified",
    detail: "Without verified conversion measurement, spend cannot be evaluated and would produce unattributable cost.",
    met: false,
    blocks: "all",
  },
  {
    id: "crm",
    label: "CRM lead delivery verified end to end",
    detail: "Paid leads must land in a verified pipeline before any spend begins.",
    met: false,
    blocks: "all",
  },
  {
    id: "compliance",
    label: "Fair-housing and Special Ad Category review signed off",
    detail: "Housing ads require the Special Ad Category and restricted targeting on every platform.",
    met: false,
    blocks: ["meta", "google-search", "google-pmax"],
  },
  {
    id: "budget",
    label: "Owner-approved budget and spend controls",
    detail: "No budget is authorized. No account, billing profile, or spend cap exists.",
    met: false,
    blocks: "all",
  },
];

export const PAID_GUARDRAILS: string[] = [
  "Housing Special Ad Category on every platform that offers it; restricted targeting is not optional.",
  "No age, gender, familial-status, disability, national-origin, or ZIP-radius targeting.",
  "No exclusion audiences built from demographic or neighbourhood proxies.",
  "Educational destinations only. No listing, valuation, or 'what's your home worth' offer.",
  "No results, ratings, testimonials, or market statistics in ad copy unless verified, sourced, and dated.",
  "No urgency, scarcity, or fear framing.",
  "Every landing destination must already exist in the governed inventory. Paid activity never adds pages.",
  "Spend caps set before any campaign is enabled; daily review for the first 14 days of any future activation.",
];

export interface PaidReadinessReport {
  generatedAt: string;
  activation: typeof PAID_ACTIVATION_STATUS;
  blueprints: number;
  prerequisites: PaidPrerequisite[];
  unmet: number;
  guardrails: number;
  status: "READINESS_DOCUMENTED";
  detail: string;
}

export function buildPaidReadiness(now: Date = new Date()): PaidReadinessReport {
  const unmet = PAID_PREREQUISITES.filter(p => !p.met).length;
  return {
    generatedAt: now.toISOString(),
    activation: PAID_ACTIVATION_STATUS,
    blueprints: PAID_BLUEPRINTS.length,
    prerequisites: PAID_PREREQUISITES,
    unmet,
    guardrails: PAID_GUARDRAILS.length,
    status: "READINESS_DOCUMENTED",
    detail: `Paid acquisition is documented as a blueprint only. ${unmet} of ${PAID_PREREQUISITES.length} prerequisites are unmet and activation remains BLOCKED. No account, campaign, audience, pixel, or spend exists.`,
  };
}
