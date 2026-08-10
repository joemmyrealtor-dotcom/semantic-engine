// External Authority Plan — citations and earned links.
//
// Real entity authority: consistent NAP citations, professional relationships,
// and community presence. Not bulk backlinks. Nothing here buys, exchanges, or
// automates a link, and no outreach is sent from this module.

import { absoluteUrl } from "./site";
import { BRAND } from "./positioning";

export type AuthorityChannel =
  | "referral-partner"
  | "chamber"
  | "community-organization"
  | "local-publication"
  | "attorney"
  | "cpa"
  | "fiduciary"
  | "senior-services"
  | "title-escrow"
  | "local-directory";

export const CHANNEL_LABEL: Record<AuthorityChannel, string> = {
  "referral-partner": "Professional referral partners",
  chamber: "Local chambers of commerce",
  "community-organization": "Community organizations",
  "local-publication": "Local publications",
  attorney: "Attorneys",
  cpa: "CPAs and tax advisors",
  fiduciary: "Professional fiduciaries",
  "senior-services": "Senior-service providers",
  "title-escrow": "Title and escrow partners",
  "local-directory": "Relevant local directories",
};

export type LinkBasis = "editorial" | "membership" | "profile" | "contribution" | "resource-exchange";

export interface AuthorityPlay {
  channel: AuthorityChannel;
  /** What we give before we ask for anything. */
  contribution: string;
  /** Why a link would be earned, not requested. */
  basis: LinkBasis;
  landingUrl: string;
  cadence: string;
  /** Signals that make this play worth doing at all. */
  qualitySignals: string[];
  disallowed: string[];
}

const NEVER = [
  "No paid links, link exchanges, or reciprocal-link agreements.",
  "No directory submissions to sites that exist only to host links.",
  "No guest posts written for anchor text rather than readers.",
];

export const AUTHORITY_PLAYS: AuthorityPlay[] = [
  {
    channel: "referral-partner",
    contribution: "Co-authored client-facing resources and the professional resource kit.",
    basis: "resource-exchange",
    landingUrl: absoluteUrl("/for/attorneys"),
    cadence: "Rolling; one relationship at a time from the reviewed Apollo cohort.",
    qualitySignals: ["Named professional with a verifiable practice", "Local to Orange or LA County", "Serves the same client situations"],
    disallowed: NEVER,
  },
  {
    channel: "chamber",
    contribution: "Member profile plus one educational session per year on probate and downsizing property decisions.",
    basis: "membership",
    landingUrl: absoluteUrl("/home"),
    cadence: "Annual membership; quarterly participation.",
    qualitySignals: ["Real dues-paying membership", "Physical local presence", "Profile carries consistent NAP"],
    disallowed: NEVER,
  },
  {
    channel: "community-organization",
    contribution: "Free workshops for senior centers, estate-planning groups, and faith communities.",
    basis: "contribution",
    landingUrl: absoluteUrl("/downsizing"),
    cadence: "One workshop per quarter.",
    qualitySignals: ["Organization serves the actual service area", "Workshop is educational, not a listing pitch"],
    disallowed: NEVER,
  },
  {
    channel: "local-publication",
    contribution: "Source commentary and data-free explainers on probate and inherited-property process.",
    basis: "editorial",
    landingUrl: absoluteUrl("/probate"),
    cadence: "Respond to reporter requests; two proactive pitches per quarter.",
    qualitySignals: ["Named editorial staff", "Publishes original local reporting"],
    disallowed: [...NEVER, "No paid placements presented as editorial."],
  },
  {
    channel: "attorney",
    contribution: "Probate timeline checklists and personal-representative property guides for their clients.",
    basis: "resource-exchange",
    landingUrl: absoluteUrl("/for/attorneys"),
    cadence: "Monthly relationship review.",
    qualitySignals: ["Active bar membership", "Probate, estate, or family practice"],
    disallowed: [...NEVER, "No fee-sharing or referral compensation of any kind."],
  },
  {
    channel: "cpa",
    contribution: "1031 and basis-step-up decision worksheets for client conversations.",
    basis: "resource-exchange",
    landingUrl: absoluteUrl("/for/cpas"),
    cadence: "Quarterly, weighted to Q1 and Q4.",
    qualitySignals: ["Licensed CPA or EA", "Serves property-owning clients"],
    disallowed: NEVER,
  },
  {
    channel: "fiduciary",
    contribution: "Property-disposition process documentation for conservatorship and trust administration.",
    basis: "resource-exchange",
    landingUrl: absoluteUrl("/for/fiduciaries"),
    cadence: "Quarterly.",
    qualitySignals: ["PFAC membership or licensed fiduciary", "Administers local estates"],
    disallowed: NEVER,
  },
  {
    channel: "senior-services",
    contribution: "Downsizing sequencing guides for move managers, placement advisors, and care providers.",
    basis: "resource-exchange",
    landingUrl: absoluteUrl("/downsizing"),
    cadence: "Quarterly.",
    qualitySignals: ["Serves seniors in the named cities", "No compensation attached to referrals"],
    disallowed: NEVER,
  },
  {
    channel: "title-escrow",
    contribution: "Joint explainers on holding title, vesting changes, and escrow timelines.",
    basis: "editorial",
    landingUrl: absoluteUrl("/guides"),
    cadence: "Two joint resources per year.",
    qualitySignals: ["Licensed title or escrow operation", "Local branch presence"],
    disallowed: [...NEVER, "No RESPA-violating arrangements: nothing of value for referrals."],
  },
  {
    channel: "local-directory",
    contribution: "Accurate, complete profile with consistent NAP and the canonical website URL.",
    basis: "profile",
    landingUrl: absoluteUrl("/home"),
    cadence: "Audit twice a year.",
    qualitySignals: ["Directory has genuine local users", "Editorial review before listing"],
    disallowed: [...NEVER, "No mass-submission services."],
  },
];

/** Name/address/phone consistency is the citation foundation. */
export interface NapRecord {
  name: string;
  brand: string;
  advisor: string;
  website: string;
  serviceArea: readonly string[];
  /** Address and phone are operator-supplied; never invented here. */
  address: string | null;
  phone: string | null;
}

export function napRecord(): NapRecord {
  return {
    name: `${BRAND.name} — ${BRAND.publisher}`,
    brand: BRAND.name,
    advisor: BRAND.advisor,
    website: absoluteUrl("/home"),
    serviceArea: BRAND.serviceArea,
    address: null,
    phone: null,
  };
}

export interface CitationTarget {
  id: string;
  channel: AuthorityChannel;
  name: string;
  /** Prepared only — no outreach has been sent. */
  status: "PROSPECT";
  requiresManualQualification: true;
}

/** Named, permanent citation surfaces worth maintaining accurately. */
export const CITATION_TARGETS: CitationTarget[] = [
  { id: "gbp", channel: "local-directory", name: "Google Business Profile", status: "PROSPECT", requiresManualQualification: true },
  { id: "bing-places", channel: "local-directory", name: "Bing Places", status: "PROSPECT", requiresManualQualification: true },
  { id: "apple-business", channel: "local-directory", name: "Apple Business Connect", status: "PROSPECT", requiresManualQualification: true },
  { id: "yelp", channel: "local-directory", name: "Yelp", status: "PROSPECT", requiresManualQualification: true },
  { id: "chamber-lahabra", channel: "chamber", name: "La Habra Area Chamber of Commerce", status: "PROSPECT", requiresManualQualification: true },
  { id: "chamber-brea", channel: "chamber", name: "Brea Chamber of Commerce", status: "PROSPECT", requiresManualQualification: true },
  { id: "chamber-fullerton", channel: "chamber", name: "Fullerton Chamber of Commerce", status: "PROSPECT", requiresManualQualification: true },
];

export interface ExternalAuthorityPlan {
  generatedAt: string;
  nap: NapRecord;
  plays: AuthorityPlay[];
  targets: CitationTarget[];
  napComplete: boolean;
  blockers: string[];
  status: "READY" | "REVIEW";
  outreachSent: false;
}

export function buildExternalAuthorityPlan(now: Date = new Date()): ExternalAuthorityPlan {
  const nap = napRecord();
  const blockers: string[] = [];
  if (!nap.address) blockers.push("No verified business address on file; citations must not publish an inconsistent or invented NAP.");
  if (!nap.phone) blockers.push("No verified business phone on file.");
  return {
    generatedAt: now.toISOString(),
    nap,
    plays: AUTHORITY_PLAYS,
    targets: CITATION_TARGETS,
    napComplete: blockers.length === 0,
    blockers,
    status: blockers.length === 0 ? "READY" : "REVIEW",
    outreachSent: false,
  };
}
