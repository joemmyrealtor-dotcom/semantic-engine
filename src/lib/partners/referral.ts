// Task 26 — Secure referral intake.
//
// A professional sends a client to Joe. The submission is validated, mapped
// through the same lead pipeline as every other conversion (so scoring,
// attribution, dedupe, retry, and pipeline routing are identical), and the
// referring professional is recorded on both sides of the relationship.

import { z } from "zod";
import { captureLead, type LeadCaptureOutcome } from "@/lib/marketing/lead-capture";
import { trackAction } from "@/lib/marketing/analytics";
import { PARTNER_TYPE_IDS, partnerType } from "./schema";
import { logActivity, loadPartners, upsertPartner } from "./store";

export const REFERRAL_URGENCY = [
  { value: "0-90", label: "Active — decision within 90 days" },
  { value: "3-6", label: "Approaching — three to six months" },
  { value: "6-12", label: "Planning — six to twelve months" },
  { value: "researching", label: "Exploratory — no timeline yet" },
] as const;

export const REFERRAL_SITUATIONS = [
  { value: "probate", label: "Probate or estate administration" },
  { value: "trust", label: "Trust administration" },
  { value: "divorce", label: "Divorce or dissolution" },
  { value: "downsizing", label: "Downsizing or senior transition" },
  { value: "distressed", label: "Distressed or time-pressured sale" },
  { value: "sellers", label: "Standard sale" },
  { value: "buyers", label: "Purchase" },
  { value: "investing", label: "Investment property decision" },
] as const;

export const referralSchema = z.object({
  // Referring professional
  partnerName: z.string().trim().min(1, { message: "Please enter your name" }).max(120),
  partnerFirm: z.string().trim().max(160).optional().or(z.literal("")),
  partnerEmail: z.string().trim().email({ message: "Enter a valid email address" }).max(255),
  partnerTypeId: z
    .string()
    .refine(v => PARTNER_TYPE_IDS.includes(v), { message: "Please choose your profession" }),

  // Client being referred
  clientFirstName: z.string().trim().min(1, { message: "Please enter the client's first name" }).max(60),
  clientEmail: z.string().trim().email({ message: "Enter a valid client email" }).max(255),
  clientPhone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9()+\-.\s]*$/, { message: "Phone can contain digits and () + - . only" })
    .optional()
    .or(z.literal("")),
  clientCity: z.string().trim().min(1, { message: "Please enter the client's city" }).max(80),
  situation: z.string().trim().min(1, { message: "Please choose the situation" }).max(60),
  urgency: z.string().trim().min(1, { message: "Please choose the timing" }).max(30),
  context: z.string().trim().max(600).optional().or(z.literal("")),
  // The professional confirms the client agreed to the introduction.
  clientPermission: z.literal(true, {
    message: "Please confirm the client agreed to this introduction",
  }),
});

export type ReferralValues = z.infer<typeof referralSchema>;

export const REFERRAL_PERMISSION_TEXT =
  "I confirm this client agreed to be introduced to Joe Melendez, and that I am not sharing information I am not permitted to share.";

export interface ReferralOutcome {
  lead: LeadCaptureOutcome;
  partnerId: string;
  partnerCreated: boolean;
}

/**
 * Submit a professional referral. Routes to the situation-matched HubSpot
 * pipeline and links the client record to the referring professional.
 */
export async function submitReferral(values: ReferralValues): Promise<ReferralOutcome> {
  const label = partnerType(values.partnerTypeId)?.label ?? "professional";
  const attribution = `${values.partnerName}${values.partnerFirm ? ` — ${values.partnerFirm}` : ""} (${label})`;

  const lead = await captureLead({
    values: {
      firstName: values.clientFirstName,
      email: values.clientEmail,
      phone: values.clientPhone ?? "",
      city: values.clientCity,
      situation: values.situation,
      timeline: values.urgency,
      propertyAddress: "",
      motivation: values.context ?? "",
      referralSource: attribution.slice(0, 120),
      consultationRequested: true,
      consent: true,
    },
    leadSource: "partner-referral",
    campaign: `referral:${values.partnerTypeId}`,
    formId: `referral:${values.partnerTypeId}`,
  });

  // Keep the referring professional in the partner store, deduplicated.
  const { partner, created } = upsertPartner(
    {
      contactName: values.partnerName,
      company: values.partnerFirm ?? "",
      partnerTypeId: values.partnerTypeId,
      email: values.partnerEmail,
      city: values.clientCity,
      leadSource: "referral-intake",
      relationshipStage: "Referral Partner",
      reviewed: true,
      outreachStatus: "approved_for_outreach",
    },
    loadPartners(),
  );
  logActivity({
    partnerId: partner.id,
    kind: "referral_received",
    detail: `${values.situation} referral, ${values.urgency}`,
  });

  // PII-free analytics: profession and situation only.
  trackAction("partner_referral_submitted", {
    situation: values.situation,
    label: values.partnerTypeId,
    leadClassification: lead.score.classification,
  });

  return { lead, partnerId: partner.id, partnerCreated: created };
}
