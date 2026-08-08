// Task 26 — Referral-partner data model.
//
// One canonical partner record shared by Apollo research, HubSpot handoff,
// outreach sequencing, LinkedIn tracking, and the referral dashboard.
// Apollo researches and qualifies; HubSpot owns the relationship. There is
// exactly one partner record per professional — no parallel databases.

import { z } from "zod";

/* ------------------------------------------------------------------ types */

export type PartnerCategory =
  | "legal"
  | "financial"
  | "senior"
  | "property"
  | "transaction";

export interface PartnerTypeDefinition {
  id: string;
  label: string;
  category: PartnerCategory;
  /** Which professional entry page speaks to this type. */
  audience: ProfessionalAudience;
  /** Why this profession sits near a property decision. */
  referralContext: string;
}

export type ProfessionalAudience =
  | "attorneys"
  | "cpas-fiduciaries"
  | "financial-advisors"
  | "senior-services"
  | "property-managers";

export const PARTNER_TYPES: PartnerTypeDefinition[] = [
  {
    id: "probate_attorney",
    label: "Probate attorney",
    category: "legal",
    audience: "attorneys",
    referralContext:
      "Estates almost always contain real property, and the sale sequencing has to match court authority and timelines.",
  },
  {
    id: "estate_planning_attorney",
    label: "Estate-planning attorney",
    category: "legal",
    audience: "attorneys",
    referralContext:
      "Plans get written around property that may need to be sold, retitled, or divided later.",
  },
  {
    id: "trust_attorney",
    label: "Trust attorney",
    category: "legal",
    audience: "attorneys",
    referralContext:
      "Trustees carry a duty of care on property decisions and need documented, defensible process.",
  },
  {
    id: "divorce_attorney",
    label: "Divorce attorney",
    category: "legal",
    audience: "attorneys",
    referralContext:
      "The marital residence is usually the largest divisible asset and the most emotionally contested one.",
  },
  {
    id: "cpa",
    label: "CPA",
    category: "financial",
    audience: "cpas-fiduciaries",
    referralContext:
      "Basis, exclusions, exchanges, and timing all change the after-tax outcome of a sale.",
  },
  {
    id: "fiduciary",
    label: "Professional fiduciary",
    category: "financial",
    audience: "cpas-fiduciaries",
    referralContext:
      "Fiduciaries need documented valuation, marketing, and disposition process for every property.",
  },
  {
    id: "financial_advisor",
    label: "Financial advisor",
    category: "financial",
    audience: "financial-advisors",
    referralContext:
      "Property equity is often the largest line on the balance sheet and the least modeled one.",
  },
  {
    id: "senior_move_manager",
    label: "Senior move manager",
    category: "senior",
    audience: "senior-services",
    referralContext:
      "Move planning and property preparation must be sequenced together or the family absorbs the cost.",
  },
  {
    id: "placement_professional",
    label: "Assisted-living placement professional",
    category: "senior",
    audience: "senior-services",
    referralContext:
      "Placement decisions are frequently funded by the equity in the home being left behind.",
  },
  {
    id: "property_manager",
    label: "Property manager",
    category: "property",
    audience: "property-managers",
    referralContext:
      "Owners reach a keep-or-sell decision point, and managers are the trusted voice in the room.",
  },
  {
    id: "contractor",
    label: "Contractor",
    category: "property",
    audience: "property-managers",
    referralContext:
      "Pre-list scope decisions determine whether improvement spend returns or evaporates.",
  },
  {
    id: "estate_sale_company",
    label: "Estate-sale company",
    category: "senior",
    audience: "senior-services",
    referralContext:
      "Contents clearing and property listing share one calendar; misalignment costs weeks.",
  },
  {
    id: "title_professional",
    label: "Title professional",
    category: "transaction",
    audience: "property-managers",
    referralContext:
      "Vesting, liens, and heirship issues surface early and decide whether a sale can close at all.",
  },
  {
    id: "escrow_professional",
    label: "Escrow professional",
    category: "transaction",
    audience: "property-managers",
    referralContext:
      "Escrow sees the file problems first and can route complex situations before they stall.",
  },
];

export const PARTNER_TYPE_IDS = PARTNER_TYPES.map(t => t.id);

export function partnerType(id: string): PartnerTypeDefinition | undefined {
  return PARTNER_TYPES.find(t => t.id === id);
}

export function partnerTypesForAudience(audience: ProfessionalAudience) {
  return PARTNER_TYPES.filter(t => t.audience === audience);
}

/* ------------------------------------------------------------- geography */

export interface TargetMarket {
  city: string;
  county: "Orange County" | "Los Angeles County";
  /** 1 = core launch market, 2 = Orange County expansion, 3 = LA County edge. */
  wave: 1 | 2 | 3;
}

export const TARGET_GEOGRAPHY: TargetMarket[] = [
  { city: "Brea", county: "Orange County", wave: 1 },
  { city: "La Habra", county: "Orange County", wave: 1 },
  { city: "Fullerton", county: "Orange County", wave: 1 },
  { city: "Whittier", county: "Los Angeles County", wave: 1 },
  { city: "La Mirada", county: "Los Angeles County", wave: 1 },
  { city: "Yorba Linda", county: "Orange County", wave: 1 },
  { city: "Orange", county: "Orange County", wave: 1 },
  { city: "Placentia", county: "Orange County", wave: 2 },
  { city: "Anaheim", county: "Orange County", wave: 2 },
  { city: "Villa Park", county: "Orange County", wave: 2 },
  { city: "Tustin", county: "Orange County", wave: 2 },
  { city: "Santa Ana", county: "Orange County", wave: 2 },
  { city: "Irvine", county: "Orange County", wave: 2 },
  { city: "Costa Mesa", county: "Orange County", wave: 2 },
  { city: "Huntington Beach", county: "Orange County", wave: 2 },
  { city: "Newport Beach", county: "Orange County", wave: 2 },
  { city: "Mission Viejo", county: "Orange County", wave: 2 },
  { city: "La Palma", county: "Orange County", wave: 2 },
  { city: "Buena Park", county: "Orange County", wave: 2 },
  { city: "Cerritos", county: "Los Angeles County", wave: 3 },
  { city: "Downey", county: "Los Angeles County", wave: 3 },
  { city: "Diamond Bar", county: "Los Angeles County", wave: 3 },
  { city: "Walnut", county: "Los Angeles County", wave: 3 },
  { city: "Hacienda Heights", county: "Los Angeles County", wave: 3 },
  { city: "Long Beach", county: "Los Angeles County", wave: 3 },
];

export const CORE_MARKETS = TARGET_GEOGRAPHY.filter(m => m.wave === 1).map(m => m.city);

export function marketFor(city: string): TargetMarket | undefined {
  const c = city.trim().toLowerCase();
  return TARGET_GEOGRAPHY.find(m => m.city.toLowerCase() === c);
}

/* ------------------------------------------------------------- lifecycle */

export const RELATIONSHIP_STAGES = [
  "Identified",
  "Qualified",
  "Outreach Ready",
  "Contacted",
  "Engaged",
  "Meeting Scheduled",
  "Relationship Established",
  "Referral Partner",
  "Nurture",
  "Do Not Contact",
] as const;

export type RelationshipStage = (typeof RELATIONSHIP_STAGES)[number];

/** Stages that permit outreach at all. */
export const CONTACTABLE_STAGES: RelationshipStage[] = [
  "Outreach Ready",
  "Contacted",
  "Engaged",
  "Meeting Scheduled",
  "Relationship Established",
  "Referral Partner",
  "Nurture",
];

export type ReferralFitTier = "Priority A" | "Priority B" | "Priority C" | "Research";

export type OutreachConsentStatus =
  | "not_contacted"
  | "review_pending"
  | "approved_for_outreach"
  | "opted_out";

export type LinkedInStatus =
  | "not_sent"
  | "request_drafted"
  | "request_sent"
  | "connected"
  | "declined";

/* ------------------------------------------------------------ the record */

export interface Partner {
  id: string;
  contactName: string;
  company: string;
  role: string;
  partnerTypeId: string;
  city: string;
  county: string;
  email: string;
  phone: string;
  website: string;
  linkedinUrl: string;
  /** Apollo record identity — the research system of record. */
  apolloId: string;
  serviceArea: string[];
  referralFitTier: ReferralFitTier;
  relationshipStage: RelationshipStage;
  lastContactAt: string;
  nextAction: string;
  nextActionDueAt: string;
  notes: string;
  leadSource: string;
  outreachStatus: OutreachConsentStatus;
  linkedinStatus: LinkedInStatus;
  /** HubSpot owns the ongoing relationship once the handoff runs. */
  hubspotContactId: string;
  owner: string;
  /** Manual quality review — outreach stays in draft until this is true. */
  reviewed: boolean;
  createdAt: string;
  updatedAt: string;
}

export const partnerSchema = z.object({
  id: z.string().min(1).max(80),
  contactName: z.string().trim().min(1, { message: "Contact name is required" }).max(120),
  company: z.string().trim().max(160).default(""),
  role: z.string().trim().max(120).default(""),
  partnerTypeId: z.string().refine(v => PARTNER_TYPE_IDS.includes(v), {
    message: "Unknown partner type",
  }),
  city: z.string().trim().max(80).default(""),
  county: z.string().trim().max(80).default(""),
  email: z.string().trim().max(255).default(""),
  phone: z.string().trim().max(40).default(""),
  website: z.string().trim().max(300).default(""),
  linkedinUrl: z.string().trim().max(300).default(""),
  apolloId: z.string().trim().max(120).default(""),
  serviceArea: z.array(z.string().max(80)).default([]),
  referralFitTier: z.enum(["Priority A", "Priority B", "Priority C", "Research"]),
  relationshipStage: z.enum(RELATIONSHIP_STAGES),
  lastContactAt: z.string().max(40).default(""),
  nextAction: z.string().trim().max(200).default(""),
  nextActionDueAt: z.string().max(40).default(""),
  notes: z.string().trim().max(2000).default(""),
  leadSource: z.string().trim().max(80).default("apollo"),
  outreachStatus: z.enum([
    "not_contacted",
    "review_pending",
    "approved_for_outreach",
    "opted_out",
  ]),
  linkedinStatus: z.enum(["not_sent", "request_drafted", "request_sent", "connected", "declined"]),
  hubspotContactId: z.string().trim().max(80).default(""),
  owner: z.string().trim().max(120).default("Joe Melendez"),
  reviewed: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PartnerInput = Partial<Partner> & { contactName: string; partnerTypeId: string };

/** Stable identity key used for deduplication across research passes. */
export function partnerIdentityKey(p: {
  apolloId?: string;
  email?: string;
  linkedinUrl?: string;
  contactName?: string;
  company?: string;
}): string {
  if (p.apolloId) return `apollo:${p.apolloId.trim().toLowerCase()}`;
  if (p.email) return `email:${p.email.trim().toLowerCase()}`;
  if (p.linkedinUrl) {
    return `li:${p.linkedinUrl.trim().toLowerCase().replace(/\/+$/, "")}`;
  }
  return `name:${(p.contactName ?? "").trim().toLowerCase()}@${(p.company ?? "")
    .trim()
    .toLowerCase()}`;
}
