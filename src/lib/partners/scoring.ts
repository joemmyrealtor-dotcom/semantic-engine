// Task 26 — Referral-partner scoring.
//
// Ten weighted signals produce an internal score. The professional never
// sees a numeric score — only Legacy Forge operators see tiers, and the
// public surfaces show nothing at all. This avoids fake precision in a
// judgement that is ultimately relational.

import {
  PARTNER_TYPES,
  marketFor,
  partnerType,
  type Partner,
  type ReferralFitTier,
} from "./schema";

export type ScoreFactorId =
  | "geography"
  | "profession"
  | "homeowner_facing"
  | "probate_estate_exposure"
  | "senior_exposure"
  | "transaction_frequency"
  | "local_presence"
  | "referral_potential"
  | "credibility"
  | "existing_relationship";

export interface ScoreFactor {
  id: ScoreFactorId;
  label: string;
  /** 0..1 strength for this partner. */
  strength: number;
  weight: number;
  rationale: string;
}

export interface PartnerScore {
  tier: ReferralFitTier;
  /** Internal only. Never rendered on a professional-facing surface. */
  internalPoints: number;
  factors: ScoreFactor[];
  summary: string;
}

export interface PartnerScoreSignals {
  partnerTypeId: string;
  city?: string;
  serviceArea?: string[];
  role?: string;
  website?: string;
  linkedinUrl?: string;
  yearsInMarket?: number;
  existingRelationship?: boolean;
  credibilityMarkers?: string[];
  emailPresent?: boolean;
}

/** Per-profession exposure profile (0..1 on each axis). */
const PROFILES: Record<
  string,
  { probate: number; senior: number; homeowner: number; frequency: number; referral: number }
> = {
  probate_attorney: { probate: 1, senior: 0.8, homeowner: 0.9, frequency: 0.8, referral: 1 },
  estate_planning_attorney: { probate: 0.8, senior: 0.9, homeowner: 0.9, frequency: 0.5, referral: 0.9 },
  trust_attorney: { probate: 0.9, senior: 0.85, homeowner: 0.9, frequency: 0.6, referral: 0.9 },
  divorce_attorney: { probate: 0.2, senior: 0.2, homeowner: 1, frequency: 0.8, referral: 0.85 },
  cpa: { probate: 0.6, senior: 0.6, homeowner: 0.8, frequency: 0.6, referral: 0.8 },
  fiduciary: { probate: 0.95, senior: 0.9, homeowner: 0.9, frequency: 0.8, referral: 0.95 },
  financial_advisor: { probate: 0.5, senior: 0.8, homeowner: 0.8, frequency: 0.5, referral: 0.85 },
  senior_move_manager: { probate: 0.5, senior: 1, homeowner: 1, frequency: 0.8, referral: 0.8 },
  placement_professional: { probate: 0.4, senior: 1, homeowner: 0.9, frequency: 0.7, referral: 0.75 },
  property_manager: { probate: 0.3, senior: 0.3, homeowner: 1, frequency: 0.7, referral: 0.7 },
  contractor: { probate: 0.2, senior: 0.3, homeowner: 0.9, frequency: 0.6, referral: 0.5 },
  estate_sale_company: { probate: 0.7, senior: 0.9, homeowner: 0.9, frequency: 0.7, referral: 0.6 },
  title_professional: { probate: 0.6, senior: 0.3, homeowner: 0.9, frequency: 0.9, referral: 0.6 },
  escrow_professional: { probate: 0.5, senior: 0.3, homeowner: 0.9, frequency: 0.9, referral: 0.6 },
};

const DEFAULT_PROFILE = { probate: 0.3, senior: 0.3, homeowner: 0.5, frequency: 0.4, referral: 0.4 };

const WEIGHTS: Record<ScoreFactorId, number> = {
  geography: 16,
  profession: 14,
  homeowner_facing: 10,
  probate_estate_exposure: 12,
  senior_exposure: 8,
  transaction_frequency: 8,
  local_presence: 8,
  referral_potential: 12,
  credibility: 7,
  existing_relationship: 5,
};

function geographyStrength(signals: PartnerScoreSignals): { strength: number; why: string } {
  const home = signals.city ? marketFor(signals.city) : undefined;
  const area = (signals.serviceArea ?? []).map(c => marketFor(c)).filter(Boolean);
  if (home?.wave === 1) return { strength: 1, why: `${signals.city} is a core launch market.` };
  if (home?.wave === 2) return { strength: 0.75, why: `${signals.city} is in the Orange County expansion wave.` };
  if (home?.wave === 3) return { strength: 0.55, why: `${signals.city} is in the adjacent Los Angeles County wave.` };
  if (area.some(a => a?.wave === 1)) return { strength: 0.7, why: "Serves a core launch market from outside it." };
  if (area.length > 0) return { strength: 0.45, why: "Serves part of the target geography." };
  return { strength: 0.1, why: "Outside the current target geography." };
}

/** Profession weighting: legal and fiduciary roles sit closest to the decision. */
function professionStrength(typeId: string): { strength: number; why: string } {
  const def = partnerType(typeId);
  if (!def) return { strength: 0.2, why: "Unrecognized profession." };
  const byCategory: Record<string, number> = {
    legal: 1,
    financial: 0.85,
    senior: 0.8,
    transaction: 0.6,
    property: 0.6,
  };
  return {
    strength: byCategory[def.category] ?? 0.5,
    why: def.referralContext,
  };
}

export function scorePartner(signals: PartnerScoreSignals): PartnerScore {
  const profile = PROFILES[signals.partnerTypeId] ?? DEFAULT_PROFILE;
  const geo = geographyStrength(signals);
  const prof = professionStrength(signals.partnerTypeId);
  const years = signals.yearsInMarket ?? 0;
  const credibility = Math.min(
    1,
    (signals.credibilityMarkers?.length ?? 0) * 0.3 +
      (signals.website ? 0.25 : 0) +
      (signals.linkedinUrl ? 0.2 : 0),
  );
  const presence = Math.min(1, (years >= 10 ? 0.6 : years >= 4 ? 0.4 : 0.15) + (signals.website ? 0.25 : 0) + (geo.strength >= 0.75 ? 0.2 : 0));

  const factors: ScoreFactor[] = [
    { id: "geography", label: "Geographic relevance", strength: geo.strength, weight: WEIGHTS.geography, rationale: geo.why },
    { id: "profession", label: "Profession", strength: prof.strength, weight: WEIGHTS.profession, rationale: prof.why },
    { id: "homeowner_facing", label: "Homeowner-facing role", strength: profile.homeowner, weight: WEIGHTS.homeowner_facing, rationale: "Advises people who own the property in question." },
    { id: "probate_estate_exposure", label: "Probate or estate exposure", strength: profile.probate, weight: WEIGHTS.probate_estate_exposure, rationale: "Frequency of estate-driven property decisions in their book." },
    { id: "senior_exposure", label: "Senior-client exposure", strength: profile.senior, weight: WEIGHTS.senior_exposure, rationale: "Share of clients in transition, downsizing, or care planning." },
    { id: "transaction_frequency", label: "Transaction frequency", strength: profile.frequency, weight: WEIGHTS.transaction_frequency, rationale: "How often their work reaches an actual sale or purchase." },
    { id: "local_presence", label: "Local presence", strength: presence, weight: WEIGHTS.local_presence, rationale: years ? `${years} years visible in market.` : "Establishing local footprint." },
    { id: "referral_potential", label: "Referral potential", strength: profile.referral, weight: WEIGHTS.referral_potential, rationale: "Realistic volume of clients who need a property decision." },
    { id: "credibility", label: "Professional credibility", strength: credibility, weight: WEIGHTS.credibility, rationale: (signals.credibilityMarkers ?? []).join("; ") || "Public professional footprint." },
    { id: "existing_relationship", label: "Existing relationship", strength: signals.existingRelationship ? 1 : 0, weight: WEIGHTS.existing_relationship, rationale: signals.existingRelationship ? "Prior working relationship." : "No prior relationship." },
  ];

  const total = factors.reduce((sum, f) => sum + f.strength * f.weight, 0);
  const max = factors.reduce((sum, f) => sum + f.weight, 0);
  const internalPoints = Math.round((total / max) * 100);

  // Contactability gates the top tier: a partner we cannot reach is research.
  const reachable = Boolean(signals.emailPresent || signals.linkedinUrl);
  const tier = tierFor(internalPoints, reachable);

  return {
    tier,
    internalPoints,
    factors,
    summary: summaryFor(tier, geo.why, prof.why),
  };
}

export function tierFor(points: number, reachable: boolean): ReferralFitTier {
  if (!reachable) return "Research";
  if (points >= 75) return "Priority A";
  if (points >= 60) return "Priority B";
  if (points >= 45) return "Priority C";
  return "Research";
}

function summaryFor(tier: ReferralFitTier, geoWhy: string, profWhy: string): string {
  const lead: Record<ReferralFitTier, string> = {
    "Priority A": "Strong fit — approach first.",
    "Priority B": "Good fit — approach after Priority A.",
    "Priority C": "Possible fit — low-effort nurture.",
    Research: "Needs more research before any outreach.",
  };
  return `${lead[tier]} ${geoWhy} ${profWhy}`;
}

export function scoreForPartner(p: Partner): PartnerScore {
  return scorePartner({
    partnerTypeId: p.partnerTypeId,
    city: p.city,
    serviceArea: p.serviceArea,
    role: p.role,
    website: p.website,
    linkedinUrl: p.linkedinUrl,
    emailPresent: Boolean(p.email),
  });
}

export const TIER_ORDER: ReferralFitTier[] = [
  "Priority A",
  "Priority B",
  "Priority C",
  "Research",
];

export const SCOREABLE_TYPE_IDS = PARTNER_TYPES.map(t => t.id);
