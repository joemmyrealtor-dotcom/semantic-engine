// Task 33 — Paid acquisition READINESS ONLY.
//
// ACTIVATION IS BLOCKED. This module produces a reviewable blueprint: what
// would be built, what must be true first, and what the guardrails are. It
// creates no accounts, no campaigns, no audiences, no pixels, no conversions,
// and no spend. Nothing here is connected and nothing here can be executed.

export const PAID_ACTIVATION_STATUS = "BLOCKED" as const;

export type PaidPlatform = "google-search" | "google-pmax" | "meta" | "local-services";

/** High-intent Google Search clusters this blueprint is scoped to. */
export type SearchClusterId =
  | "seller-intent"
  | "probate-inherited"
  | "downsizing"
  | "distressed-preforeclosure"
  | "equity-sell-vs-rent";

export interface PaidCluster {
  id: SearchClusterId;
  label: string;
  /** What the campaign would be asked to do. */
  objective: string;
  /** Governed destinations that already exist. No new pages are implied. */
  destinations: string[];
  /** The single conversion action the cluster would be optimized toward. */
  primaryConversionAction: string;
  /** Concepts to exclude, expressed as concepts rather than a live keyword list. */
  negativeConcepts: string[];
  budgetGuardrail: string;
  stopConditions: string[];
  measurementPrerequisites: string[];
  status: "BLOCKED";
  activated: false;
}

const NO_SPEND_GUARDRAIL =
  "No budget is authorized. Any future activation requires an Owner-approved daily cap, a total spend ceiling, and daily review for the first 14 days.";

const COMMON_STOPS = [
  "Conversion measurement stops reporting or cannot be verified end to end.",
  "CRM delivery of a paid lead cannot be confirmed.",
  "Any ad, keyword, or destination is flagged under housing policy.",
  "Spend reaches the Owner-approved ceiling without an evidenced qualified lead.",
];

const COMMON_MEASUREMENT_PREREQS = [
  "Final production domain verified and serving the governed destinations.",
  "Consent-safe production analytics live, with consent state respected before any measurement tag fires.",
  "A single primary conversion action defined, instrumented, and verified end to end.",
  "First-party conversion measurement designed for Google Data Manager / API-compatible enhanced conversions for leads — not a deprecated legacy-only offline click-ID import assumption. Nothing is connected today.",
  "CRM delivery verification for every paid lead before spend begins.",
];

export const SEARCH_CLUSTERS: PaidCluster[] = [
  {
    id: "seller-intent",
    label: "Seller intent — process and cost questions",
    objective: "Reach people actively working out how a sale would work for them, and give them the written reasoning before any conversation.",
    destinations: ["/sellers", "/answers", "/guides"],
    primaryConversionAction: "Guide download or assessment completion (education-first), not a phone call.",
    negativeConcepts: [
      "Rental, tenancy, and property-management queries.",
      "Job, licensing, and 'how to become an agent' queries.",
      "Instant-offer / cash-buyer and iBuyer queries.",
      "Home-valuation and 'what's my home worth' bait queries.",
      "Brand terms of other brokerages.",
    ],
    budgetGuardrail: NO_SPEND_GUARDRAIL,
    stopConditions: COMMON_STOPS,
    measurementPrerequisites: COMMON_MEASUREMENT_PREREQS,
    status: "BLOCKED",
    activated: false,
  },
  {
    id: "probate-inherited",
    label: "Probate and inherited property",
    objective: "Answer procedural questions for people handling an estate, without implying legal advice or representation.",
    destinations: ["/probate", "/inherited-property", "/answers"],
    primaryConversionAction: "Guide download on probate or inherited-property sequencing.",
    negativeConcepts: [
      "Attorney-hiring and legal-representation queries.",
      "Estate-planning document drafting queries.",
      "Probate court forms and filing-service queries.",
      "Genealogy and heir-search queries.",
    ],
    budgetGuardrail: NO_SPEND_GUARDRAIL,
    stopConditions: [...COMMON_STOPS, "Any copy or destination reads as legal advice rather than education."],
    measurementPrerequisites: COMMON_MEASUREMENT_PREREQS,
    status: "BLOCKED",
    activated: false,
  },
  {
    id: "downsizing",
    label: "Downsizing",
    objective: "Serve people weighing a move to a smaller property, with sequencing and cost reasoning.",
    destinations: ["/downsizing", "/answers", "/assessments"],
    primaryConversionAction: "Downsizing assessment completion.",
    negativeConcepts: [
      "Senior-living facility and care-home queries.",
      "Moving-company and storage-service queries.",
      "Age, familial-status, or disability descriptors used as targeting proxies.",
    ],
    budgetGuardrail: NO_SPEND_GUARDRAIL,
    stopConditions: [...COMMON_STOPS, "Any targeting or copy that segments by age, disability, or familial status."],
    measurementPrerequisites: COMMON_MEASUREMENT_PREREQS,
    status: "BLOCKED",
    activated: false,
  },
  {
    id: "distressed-preforeclosure",
    label: "Distressed and pre-foreclosure",
    objective: "Provide options and timelines to owners under financial pressure, with no urgency framing and no offer to buy.",
    destinations: ["/distressed-property", "/answers"],
    primaryConversionAction: "Guide download covering options and timelines.",
    negativeConcepts: [
      "'We buy houses' and cash-offer queries.",
      "Loan-modification and credit-repair service queries.",
      "Bankruptcy-filing service queries.",
      "Foreclosure-listing and auction-shopping queries.",
    ],
    budgetGuardrail: NO_SPEND_GUARDRAIL,
    stopConditions: [...COMMON_STOPS, "Any copy using urgency, scarcity, distress, or fear framing."],
    measurementPrerequisites: COMMON_MEASUREMENT_PREREQS,
    status: "BLOCKED",
    activated: false,
  },
  {
    id: "equity-sell-vs-rent",
    label: "Equity and sell-vs-rent",
    objective: "Support owners comparing selling, holding, or renting, using written trade-off reasoning.",
    destinations: ["/answers", "/investing", "/assessments"],
    primaryConversionAction: "Assessment completion comparing sell, hold, and rent.",
    negativeConcepts: [
      "Mortgage-refinance and HELOC product queries.",
      "Investment-course, seminar, and coaching queries.",
      "Stock-market and non-property investment queries.",
    ],
    budgetGuardrail: NO_SPEND_GUARDRAIL,
    stopConditions: [...COMMON_STOPS, "Any return, appreciation, or yield projection appears in copy or on a destination."],
    measurementPrerequisites: COMMON_MEASUREMENT_PREREQS,
    status: "BLOCKED",
    activated: false,
  },
];

export interface PaidBlueprint {
  platform: PaidPlatform;
  label: string;
  intent: string;
  /** Governed destinations that already exist. No new pages are implied. */
  destinations: string[];
  audienceBasis: string;
  /** Platform-specific housing policy wording. Never cross-applied. */
  housingCompliance: string;
  measurement: string;
  clusters: SearchClusterId[];
  status: "BLOCKED";
  activated: false;
}

export const PAID_BLUEPRINTS: PaidBlueprint[] = [
  {
    platform: "google-search",
    label: "Google Search — high-intent decision questions",
    intent: "Capture people already searching a specific decision question, not brand or generic 'realtor near me' terms.",
    destinations: ["/sellers", "/probate", "/inherited-property", "/downsizing", "/distressed-property", "/answers", "/guides", "/assessments", "/investing"],
    audienceBasis: "Keyword intent only. No demographic, ZIP-code, or life-event audience targeting of housing-related campaigns. Radius targeting (>=1 km) would be permitted by Google, but is excluded by internal Legacy Forge policy.",
    housingCompliance:
      "Google: US/Canada housing ads are a restricted personalized-advertising category. Google applies personalized-advertising restrictions for housing and prohibits targeting or exclusion by age, gender, parental status, marital status, and ZIP code, and restricts detailed-interest and similar-audience targeting. Radius targeting is NOT prohibited by Google: it is permitted provided the radius is at least 1 km (about 0.6 mi). Google does not use Meta's 'Special Ad Category' label; do not apply that term here. INTERNAL POLICY (Legacy Forge, stricter than Google requires): we use broad geography only and no radius targeting on housing campaigns.",
    measurement:
      "Enhanced conversions for leads must be designed around Google Data Manager / API-compatible first-party conversion measurement with consented, hashed first-party data — not a deprecated legacy-only offline click-ID import assumption. Nothing is connected, configured, or sent today.",
    clusters: ["seller-intent", "probate-inherited", "downsizing", "distressed-preforeclosure", "equity-sell-vs-rent"],
    status: "BLOCKED",
    activated: false,
  },
  {
    platform: "google-pmax",
    label: "Performance Max — deferred",
    intent: "Not recommended before organic and search-intent baselines exist. Listed for completeness only.",
    destinations: [],
    audienceBasis: "Not defined. Automated placements make housing-policy compliance harder to evidence.",
    housingCompliance:
      "Google: the same current housing personalized-ad targeting restrictions apply, and automated placement and audience expansion make them harder to evidence. Deferred for that reason.",
    measurement: "Not applicable while activation is blocked. Would inherit the same Data Manager / API-compatible first-party conversion design.",
    clusters: [],
    status: "BLOCKED",
    activated: false,
  },
  {
    platform: "meta",
    label: "Meta — educational reach",
    intent: "Distribute educational answers and guides. Never a listing or valuation offer.",
    destinations: ["/guides", "/local-guides", "/answers"],
    audienceBasis: "Broad geography only. No age, gender, ZIP-code, or detailed targeting of housing audiences.",
    housingCompliance:
      "Meta: the Housing Special Ad Category is mandatory where applicable. It restricts age, gender, and detailed targeting, limits geographic targeting to a minimum 15-mile radius or broader area, and disables standard lookalike audiences. This is Meta policy only and must never be described as a Google requirement.",
    measurement:
      "Future readiness only: measurement and optimization would use the Meta Conversions API with consented server-side events plus CRM lead-quality signals, so optimization reflects qualified outcomes rather than raw form fills. No pixel, dataset, CAPI endpoint, or CRM signal is connected or sent today.",
    clusters: [],
    status: "BLOCKED",
    activated: false,
  },
  {
    platform: "local-services",
    label: "Local Services / verified listings — deferred",
    intent: "Requires business verification and a live production domain.",
    destinations: [],
    audienceBasis: "Service-area based. Not configurable before domain activation.",
    housingCompliance: "Google: verification-gated; current housing personalized-ad targeting restrictions apply on activation.",
    measurement: "Not applicable while activation is blocked.",
    clusters: [],
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

/** The hard activation gate. Every item must be evidenced before any spend. */
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
    id: "analytics",
    label: "Consent-safe production analytics live",
    detail: "Analytics must respect recorded consent state before any measurement tag fires. No production analytics property is connected.",
    met: false,
    blocks: "all",
  },
  {
    id: "measurement",
    label: "Primary conversion measurement defined and verified",
    detail:
      "One primary conversion action per cluster, instrumented and verified end to end, with enhanced conversions for leads designed around Data Manager / API-compatible first-party measurement. Not connected.",
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
    label: "Policy and compliance review signed off",
    detail:
      "Platform-specific housing review: Google's current housing personalized-ad targeting restrictions, and Meta's Housing Special Ad Category where applicable. Plus fair-housing copy review.",
    met: false,
    blocks: ["meta", "google-search", "google-pmax", "local-services"],
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
  "Platform-specific housing compliance: Meta's Housing Special Ad Category where applicable; Google's current housing personalized-ad targeting restrictions. The two are not interchangeable.",
  "No age, gender, familial-status, marital-status, disability, national-origin, or ZIP-code targeting on housing campaigns. Radius targeting is permitted by Google at >=1 km, but internal Legacy Forge policy excludes it.",
  "No exclusion audiences built from demographic or neighbourhood proxies.",
  "Educational destinations only. No listing, valuation, or 'what's your home worth' offer.",
  "No results, ratings, testimonials, or market statistics in ad copy unless verified, sourced, and dated.",
  "No urgency, scarcity, or fear framing.",
  "Every landing destination must already exist in the governed inventory. Paid activity never adds pages.",
  "Spend caps set before any campaign is enabled; daily review for the first 14 days of any future activation.",
  "Measurement is first-party and consent-gated: no measurement event may fire before consent is recorded.",
];

export interface PaidReadinessReport {
  generatedAt: string;
  activation: typeof PAID_ACTIVATION_STATUS;
  blueprints: number;
  clusters: number;
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
    clusters: SEARCH_CLUSTERS.length,
    prerequisites: PAID_PREREQUISITES,
    unmet,
    guardrails: PAID_GUARDRAILS.length,
    status: "READINESS_DOCUMENTED",
    detail: `Paid acquisition is documented as a blueprint only. ${unmet} of ${PAID_PREREQUISITES.length} activation-gate items are unmet and activation remains BLOCKED. No account, campaign, audience, pixel, conversion, or spend exists.`,
  };
}
