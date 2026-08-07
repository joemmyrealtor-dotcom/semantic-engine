// Task 22A — Lead capture: validation and HubSpot-ready payload shaping.

import { z } from "zod";
import { readAttribution, type Attribution } from "./attribution";
import type { LeadQualification } from "./assessments";

export const TIMELINE_OPTIONS = [
  { value: "0-90", label: "Within 90 days" },
  { value: "3-6", label: "Three to six months" },
  { value: "6-12", label: "Six to twelve months" },
  { value: "researching", label: "Still researching" },
] as const;

export const leadFormSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, { message: "Please enter your first name" })
    .max(60, { message: "First name must be under 60 characters" }),
  email: z
    .string()
    .trim()
    .email({ message: "Enter a valid email address" })
    .max(255, { message: "Email must be under 255 characters" }),
  phone: z
    .string()
    .trim()
    .max(30, { message: "Phone must be under 30 characters" })
    .regex(/^[0-9()+\-.\s]*$/, { message: "Phone can contain digits and () + - . only" })
    .optional()
    .or(z.literal("")),
  city: z
    .string()
    .trim()
    .min(1, { message: "Please enter your city" })
    .max(80, { message: "City must be under 80 characters" }),
  situation: z.string().trim().min(1, { message: "Please choose your situation" }).max(60),
  timeline: z.string().trim().min(1, { message: "Please choose a timeline" }).max(30),
  consent: z.literal(true, { message: "Please agree before continuing" }),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;

export interface CrmLeadPayload {
  firstname: string;
  email: string;
  phone: string;
  city: string;
  lf_situation: string;
  lf_timeline: string;
  lf_guide_id: string;
  lf_guide_slug: string;
  lf_assessment_id: string;
  lf_readiness_level: string;
  lf_lead_tier: string;
  lf_lead_score: number;
  lf_lead_signals: string;
  lf_consent: boolean;
  lf_consent_at: string;
  hs_lead_source: string;
  hs_campaign: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  lf_referrer: string;
  lf_landing_page: string;
  lf_first_seen_at: string;
  lf_submitted_at: string;
}

export function buildCrmLeadPayload(input: {
  values: LeadFormValues;
  guideId?: string;
  guideSlug?: string;
  assessmentId?: string;
  readinessLevel?: string;
  qualification?: LeadQualification;
  leadSource: string;
  campaign: string;
  attribution?: Attribution | null;
}): CrmLeadPayload {
  const attr = input.attribution ?? readAttribution();
  const now = new Date().toISOString();
  return {
    firstname: input.values.firstName,
    email: input.values.email,
    phone: input.values.phone ?? "",
    city: input.values.city,
    lf_situation: input.values.situation,
    lf_timeline: input.values.timeline,
    lf_guide_id: input.guideId ?? "",
    lf_guide_slug: input.guideSlug ?? "",
    lf_assessment_id: input.assessmentId ?? "",
    lf_readiness_level: input.readinessLevel ?? "",
    lf_lead_tier: input.qualification?.tier ?? "",
    lf_lead_score: input.qualification?.points ?? 0,
    lf_lead_signals: (input.qualification?.signals ?? []).join("; "),
    lf_consent: input.values.consent,
    lf_consent_at: now,
    hs_lead_source: input.leadSource,
    hs_campaign: input.campaign,
    utm_source: attr?.source ?? "direct",
    utm_medium: attr?.medium ?? "none",
    utm_campaign: attr?.campaign ?? "(none)",
    utm_content: attr?.content ?? "",
    utm_term: attr?.term ?? "",
    lf_referrer: attr?.referrer ?? "",
    lf_landing_page: attr?.landingPage ?? "",
    lf_first_seen_at: attr?.firstSeenAt ?? now,
    lf_submitted_at: now,
  };
}

const STORE_KEY = "lf.leads.v1";

/**
 * Queue the payload locally. The HubSpot transport lands in Task 25;
 * until then submissions are retained so nothing is lost.
 */
export function queueLead(payload: CrmLeadPayload): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const list = raw ? (JSON.parse(raw) as CrmLeadPayload[]) : [];
    list.push(payload);
    window.localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    /* storage unavailable — submission is best-effort until CRM transport exists */
  }
}

export function queuedLeads(): CrmLeadPayload[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as CrmLeadPayload[]) : [];
  } catch {
    return [];
  }
}

export const CONSENT_TEXT =
  "I agree to receive the requested guide and related follow-up from Legacy Forge / JM Advisory Press. I can unsubscribe at any time. My information is not sold.";
