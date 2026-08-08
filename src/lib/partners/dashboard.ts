// Task 26 — Referral dashboard model.
//
// Read-only metrics over the partner store: network growth, relationship
// pipeline, referral conversion, and outreach readiness.

import { RELATIONSHIP_STAGES, partnerType, type Partner, type RelationshipStage } from "./schema";
import { TIER_ORDER } from "./scoring";
import { buildCohortCoverage, tierBreakdown } from "./apollo";
import { outreachReadiness, type OutreachReadiness } from "./sequences";
import { loadActivity, loadPartners, type PartnerActivity } from "./store";

export interface StageRow {
  stage: RelationshipStage;
  count: number;
}

export interface TypeRow {
  partnerTypeId: string;
  label: string;
  count: number;
  priorityA: number;
  established: number;
  referrals: number;
}

export interface ReferralDashboard {
  totalPartners: number;
  reachable: number;
  handedOff: number;
  stages: StageRow[];
  tiers: { tier: string; count: number }[];
  types: TypeRow[];
  cohort: ReturnType<typeof buildCohortCoverage>;
  outreach: OutreachReadiness;
  activity: PartnerActivity[];
  conversion: {
    identified: number;
    contacted: number;
    engaged: number;
    established: number;
    referring: number;
    contactRate: number;
    engagementRate: number;
    referralRate: number;
  };
  referralsReceived: number;
  /** Nothing has been sent yet — reported honestly rather than estimated. */
  revenue: {
    referralsReceived: number;
    referralsConverted: number;
    note: string;
  };
}

const ESTABLISHED: RelationshipStage[] = ["Relationship Established", "Referral Partner"];

function rate(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

export function buildReferralDashboard(
  partners: Partner[] = loadPartners(),
  activity: PartnerActivity[] = loadActivity(),
): ReferralDashboard {
  const stages = RELATIONSHIP_STAGES.map(stage => ({
    stage,
    count: partners.filter(p => p.relationshipStage === stage).length,
  }));

  const tiersRaw = tierBreakdown(partners);
  const tiers = TIER_ORDER.map(t => ({ tier: t, count: tiersRaw[t] }));

  const referralEvents = activity.filter(a => a.kind === "referral_received");
  const referringIds = new Set(referralEvents.map(a => a.partnerId));

  const types: TypeRow[] = [];
  for (const p of partners) {
    let row = types.find(t => t.partnerTypeId === p.partnerTypeId);
    if (!row) {
      row = {
        partnerTypeId: p.partnerTypeId,
        label: partnerType(p.partnerTypeId)?.label ?? p.partnerTypeId,
        count: 0,
        priorityA: 0,
        established: 0,
        referrals: 0,
      };
      types.push(row);
    }
    row.count += 1;
    if (p.referralFitTier === "Priority A") row.priorityA += 1;
    if (ESTABLISHED.includes(p.relationshipStage)) row.established += 1;
    if (referringIds.has(p.id)) row.referrals += 1;
  }
  types.sort((a, b) => b.count - a.count);

  const contacted = partners.filter(p =>
    ["Contacted", "Engaged", "Meeting Scheduled", ...ESTABLISHED].includes(p.relationshipStage),
  ).length;
  const engaged = partners.filter(p =>
    ["Engaged", "Meeting Scheduled", ...ESTABLISHED].includes(p.relationshipStage),
  ).length;
  const established = partners.filter(p => ESTABLISHED.includes(p.relationshipStage)).length;
  const referring = referringIds.size;

  return {
    totalPartners: partners.length,
    reachable: partners.filter(p => p.email || p.linkedinUrl).length,
    handedOff: partners.filter(p => p.hubspotContactId).length,
    stages,
    tiers,
    types,
    cohort: buildCohortCoverage(partners),
    outreach: outreachReadiness(partners),
    activity: activity.slice(0, 40),
    conversion: {
      identified: partners.length,
      contacted,
      engaged,
      established,
      referring,
      contactRate: rate(contacted, partners.length),
      engagementRate: rate(engaged, contacted),
      referralRate: rate(referring, established),
    },
    referralsReceived: referralEvents.length,
    revenue: {
      referralsReceived: referralEvents.length,
      referralsConverted: 0,
      note: "Referral revenue is reported only from closed transactions recorded in the CRM. No projected or modeled revenue is shown.",
    },
  };
}
