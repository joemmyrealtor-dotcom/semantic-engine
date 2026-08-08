// Task 26 — Apollo → HubSpot handoff (client side).
//
// Builds the partner property map, deduplicates against what HubSpot already
// holds, and records the resulting contact id back onto the partner record.

import { partnerType, type Partner } from "./schema";
import { scoreForPartner } from "./scoring";
import { logActivity, updatePartner } from "./store";
import {
  upsertPartnerContact,
  type PartnerHandoffResult,
} from "./hubspot.functions";

/** Partner-specific HubSpot contact properties. */
export const PARTNER_CRM_PROPERTIES = [
  "email",
  "firstname",
  "lastname",
  "company",
  "jobtitle",
  "city",
  "state",
  "website",
  "phone",
  "hs_lead_source",
  "lifecyclestage",
  "lf_partner_type",
  "lf_partner_tier",
  "lf_partner_stage",
  "lf_partner_service_area",
  "lf_partner_linkedin",
  "lf_partner_owner",
  "lf_partner_first_seen_at",
  "lf_partner_key",
] as const;

export function partnerContactProperties(p: Partner): Record<string, string | number | boolean> {
  const parts = p.contactName.trim().split(/\s+/);
  const score = scoreForPartner(p);
  return {
    firstname: parts[0] ?? p.contactName,
    lastname: parts.slice(1).join(" "),
    company: p.company,
    jobtitle: p.role || (partnerType(p.partnerTypeId)?.label ?? ""),
    city: p.city,
    state: "CA",
    website: p.website,
    phone: p.phone,
    hs_lead_source: "apollo-referral-research",
    lifecyclestage: "other",
    lf_partner_type: p.partnerTypeId,
    lf_partner_tier: score.tier,
    lf_partner_stage: p.relationshipStage,
    lf_partner_service_area: p.serviceArea.join("; "),
    lf_partner_linkedin: p.linkedinUrl,
    lf_partner_owner: p.owner,
    lf_partner_first_seen_at: p.createdAt,
  };
}

export function partnerIdempotencyKey(p: Partner): string {
  return `partner:${(p.email || p.apolloId || p.id).toLowerCase()}:${p.relationshipStage}:${p.referralFitTier}`;
}

export type PartnerHandoffFn = (input: {
  data: { email: string; properties: Record<string, string | number | boolean>; idempotencyKey: string };
}) => Promise<PartnerHandoffResult>;

/** Sync one partner. Records without an email are skipped, never guessed. */
export async function handoffPartner(
  partner: Partner,
  send: PartnerHandoffFn = input => upsertPartnerContact(input),
): Promise<PartnerHandoffResult> {
  if (!partner.email) {
    return {
      ok: false,
      mode: "test",
      action: "skipped",
      message: "No email on this record — research it before handing off.",
    };
  }
  const result = await send({
    data: {
      email: partner.email,
      properties: partnerContactProperties(partner),
      idempotencyKey: partnerIdempotencyKey(partner),
    },
  });
  if (result.contactId) {
    updatePartner(partner.id, { hubspotContactId: result.contactId });
  }
  logActivity({
    partnerId: partner.id,
    kind: "hubspot_handoff",
    detail: `${result.action}${result.contactId ? ` (${result.contactId})` : ""} — ${result.mode}`,
  });
  return result;
}

export interface BatchHandoffSummary {
  attempted: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

/** Batch sync for reviewed partners only. Never syncs unreviewed research. */
export async function handoffReviewedPartners(
  partners: Partner[],
  send: PartnerHandoffFn = input => upsertPartnerContact(input),
): Promise<BatchHandoffSummary> {
  const summary: BatchHandoffSummary = { attempted: 0, created: 0, updated: 0, skipped: 0, failed: 0 };
  for (const p of partners.filter(x => x.reviewed && x.relationshipStage !== "Do Not Contact")) {
    summary.attempted += 1;
    const r = await handoffPartner(p, send);
    if (!r.ok) summary.failed += 1;
    else if (r.action === "created") summary.created += 1;
    else if (r.action === "updated") summary.updated += 1;
    else summary.skipped += 1;
  }
  return summary;
}
