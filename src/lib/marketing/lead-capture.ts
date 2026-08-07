// Task 24 — Reusable lead-capture service.
//
// Every public conversion (contact form, lead magnet, assessment handoff,
// consultation request, local guide CTA) goes through captureLead(). There
// is exactly one CRM mapping, one scoring pass, and one analytics event.

import { z } from "zod";
import { readAttribution, readLatestAttribution, type Attribution } from "./attribution";
import type { LeadQualification } from "./assessments";
import { pipelineForSituation } from "./crm-schema";
import { scoreLead, intentVisitCount, type LeadScore } from "./lead-scoring";
import { trackAction } from "./analytics";
import { submitCrmLead } from "./lead-capture.functions";
import {
  enqueueDelivery,
  flushQueue,
  isBulkDeliveryPaused,
  sendRecord,

  idempotencyKeyFor,
  type LeadDelivery,
  type Transport,
} from "./lead-queue";


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
  propertyAddress: z
    .string()
    .trim()
    .max(160, { message: "Address must be under 160 characters" })
    .optional()
    .or(z.literal("")),
  motivation: z
    .string()
    .trim()
    .max(600, { message: "Please keep this under 600 characters" })
    .optional()
    .or(z.literal("")),
  referralSource: z
    .string()
    .trim()
    .max(120, { message: "Please keep this under 120 characters" })
    .optional()
    .or(z.literal("")),
  consultationRequested: z.boolean().optional(),
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
  lf_motivation: string;
  lf_property_address: string;
  lf_lead_magnet: string;
  lf_guide_slug: string;
  lf_assessment_result: string;
  lf_readiness_level: string;
  lf_lead_score: number;
  lf_lead_classification: string;
  lf_lead_signals: string;
  lf_consultation_requested: boolean;
  lf_referral_source: string;
  lf_consent: boolean;
  lf_consent_at: string;
  lf_consent_text: string;
  hs_lead_source: string;
  hs_campaign: string;
  lf_original_source: string;
  lf_original_medium: string;
  lf_original_campaign: string;
  lf_latest_landing_page: string;
  lf_latest_referrer: string;

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

export interface LeadCaptureInput {
  values: LeadFormValues;
  /** Conversion surface, e.g. "guide:seller-decision" or "contact". */
  leadSource: string;
  campaign: string;
  formId: string;
  guideId?: string;
  guideSlug?: string;
  assessmentId?: string;
  readinessLevel?: string;
  qualification?: LeadQualification;
  attribution?: Attribution | null;
}

export function buildCrmLeadPayload(
  input: LeadCaptureInput & { score?: LeadScore },
): CrmLeadPayload {
  const first = input.attribution ?? readAttribution();
  const last = readLatestAttribution() ?? first;
  const now = new Date().toISOString();
  const score = input.score ?? scoreLeadFor(input);
  const v = input.values;

  return {
    firstname: v.firstName,
    email: v.email,
    phone: v.phone ?? "",
    city: v.city,
    lf_situation: v.situation,
    lf_timeline: v.timeline,
    lf_motivation: v.motivation ?? "",
    lf_property_address: v.propertyAddress ?? "",
    lf_lead_magnet: input.guideId ?? "",
    lf_guide_slug: input.guideSlug ?? "",
    lf_assessment_result: input.assessmentId
      ? `${input.assessmentId}: ${input.readinessLevel ?? "n/a"}`
      : "",
    lf_readiness_level: input.readinessLevel ?? "",
    lf_lead_score: score.points,
    lf_lead_classification: score.classification,
    lf_lead_signals: [...score.signals, ...(input.qualification?.signals ?? [])].join("; "),
    lf_consultation_requested: Boolean(v.consultationRequested),
    lf_referral_source: v.referralSource ?? "",
    lf_consent: v.consent,
    lf_consent_at: now,
    lf_consent_text: CONSENT_TEXT,
    hs_lead_source: input.leadSource,
    hs_campaign: input.campaign,
    lf_original_source: first?.source ?? "direct",
    utm_source: last?.source ?? "direct",
    utm_medium: last?.medium ?? "none",
    utm_campaign: last?.campaign ?? "(none)",
    utm_content: last?.content ?? "",
    utm_term: last?.term ?? "",
    lf_original_medium: first?.medium ?? "none",
    lf_original_campaign: first?.campaign ?? "(none)",
    lf_latest_landing_page: last?.landingPage ?? "",
    lf_latest_referrer: last?.referrer ?? "",
    lf_referrer: first?.referrer ?? "",
    lf_landing_page: first?.landingPage ?? "",
    lf_first_seen_at: first?.firstSeenAt ?? now,
    lf_submitted_at: now,

  };
}

export function scoreLeadFor(input: LeadCaptureInput): LeadScore {
  const v = input.values;
  return scoreLead({
    timeline: v.timeline,
    situation: v.situation,
    city: v.city,
    ...(v.motivation ? { motivation: v.motivation } : {}),
    ...(v.propertyAddress ? { propertyAddress: v.propertyAddress } : {}),
    consultationRequested: Boolean(v.consultationRequested),
    assessmentCompleted: Boolean(input.assessmentId),
    ...(input.readinessLevel ? { readinessLevel: input.readinessLevel } : {}),
    intentVisits: intentVisitCount(),
  });
}

export interface LeadCaptureOutcome {
  payload: CrmLeadPayload;
  score: LeadScore;
  pipeline: string;
  delivery: LeadDelivery;
  duplicate: boolean;
}

/** The transport used by the delivery queue: one HubSpot upsert per record. */
export const hubspotTransport: Transport = record =>
  submitCrmLead({
    data: {
      properties: record.payload as unknown as Record<string, string | number | boolean>,
      pipeline: record.pipeline,
      formId: record.formId,
      idempotencyKey: record.idempotencyKey,
    },
  });

/**
 * The single conversion entry point. Scores, maps, retains, enqueues,
 * flushes, and emits exactly one analytics event.
 */
export async function captureLead(
  input: LeadCaptureInput,
  transport: Transport = hubspotTransport,
): Promise<LeadCaptureOutcome> {
  const score = scoreLeadFor(input);
  const payload = buildCrmLeadPayload({ ...input, score });
  const pipeline = pipelineForSituation(input.values.situation).id;

  queueLead(payload);

  const idempotencyKey = idempotencyKeyFor({
    email: input.values.email,
    formId: input.formId,
    ...(input.guideId ? { guideId: input.guideId } : {}),
    ...(input.assessmentId ? { assessmentId: input.assessmentId } : {}),
  });
  const { record, duplicate } = enqueueDelivery({
    payload,
    pipeline,
    formId: input.formId,
    idempotencyKey,
  });

  // While bulk delivery is paused (default), deliver only this conversion —
  // never drain historical queue records implicitly. A record that is already
  // delivered (or waiting on backoff) is left untouched.
  const dueNow = dueRecords().some(r => r.id === record.id);
  const delivery = isBulkDeliveryPaused()
    ? dueNow
      ? await sendRecord(record, transport)
      : record
    : ((await flushQueue(transport)).find(r => r.id === record.id) ?? record);



  if (!duplicate) {
    trackAction(input.assessmentId || input.guideId ? "lead_submitted" : "contact_submitted", {
      situation: input.values.situation,
      city: input.values.city,
      ...(input.guideId ? { leadMagnet: input.guideId, guideId: input.guideId } : {}),
      ...(input.assessmentId ? { assessmentId: input.assessmentId } : {}),
      ...(input.readinessLevel ? { readinessLevel: input.readinessLevel } : {}),
      leadClassification: score.classification,
      leadScore: score.points,
      label: input.formId,
    });
  }

  return { payload, score, pipeline, delivery, duplicate };
}


const STORE_KEY = "lf.leads.v1";

/** Retain the payload locally so nothing is lost if the CRM is unreachable. */
export function queueLead(payload: CrmLeadPayload): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const list = raw ? (JSON.parse(raw) as CrmLeadPayload[]) : [];
    list.push(payload);
    window.localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    /* storage unavailable — submission already went to the CRM transport */
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
