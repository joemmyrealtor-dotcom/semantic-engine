// Discovery Measurement Pack — GA4 event contract.
//
// Maps the marketing events already instrumented in analytics.ts onto GA4
// event names and a strict parameter allowlist. PII never reaches a
// parameter: email, phone, name, and address keys are rejected by contract,
// not by convention.

import type { MarketingEventName } from "./analytics";

export interface Ga4EventSpec {
  /** Internal event name already emitted by the app. */
  internal: MarketingEventName;
  /** GA4 event name. snake_case, <= 40 chars. */
  ga4: string;
  /** True when this is a key conversion in GA4. */
  keyConversion: boolean;
  /** Allowed parameter keys. Anything else is dropped. */
  parameters: string[];
  description: string;
}

export const GA4_PARAM_ALLOWLIST = [
  "page_path",
  "page_type",
  "situation",
  "city",
  "guide_id",
  "assessment_id",
  "assessment_result",
  "readiness_level",
  "lead_tier",
  "lead_score",
  "partner_audience",
  "channel",
  "source",
  "medium",
  "campaign",
  "content",
  "original_source",
  "original_campaign",
  "landing_page",
] as const;

export const GA4_FORBIDDEN_PARAMS = [
  "email",
  "phone",
  "name",
  "first_name",
  "last_name",
  "address",
  "street",
  "user_email",
  "user_phone",
  "ip",
  "user_id_email",
] as const;

export const GA4_EVENTS: Ga4EventSpec[] = [
  { internal: "lead_magnet_downloaded", ga4: "guide_download", keyConversion: true, parameters: ["guide_id", "situation", "page_path", "source", "medium", "campaign"], description: "A guide PDF/markdown was delivered." },
  { internal: "assessment_started", ga4: "assessment_started", keyConversion: true, parameters: ["assessment_id", "situation", "page_path"], description: "The first assessment question was answered." },
  { internal: "assessment_completed", ga4: "assessment_completed", keyConversion: true, parameters: ["assessment_id", "assessment_result", "readiness_level", "lead_tier"], description: "The assessment produced a readiness result." },
  { internal: "contact_submitted", ga4: "contact_submitted", keyConversion: true, parameters: ["page_path", "situation", "source", "medium", "campaign"], description: "The contact form was submitted." },
  { internal: "consultation_clicked", ga4: "consultation_request", keyConversion: true, parameters: ["page_path", "page_type", "city", "situation"], description: "A consultation CTA was clicked." },
  { internal: "partner_referral_submitted", ga4: "referral_submitted", keyConversion: true, parameters: ["partner_audience", "page_path"], description: "A professional submitted a referral." },
  { internal: "partner_kit_requested", ga4: "professional_resource_request", keyConversion: true, parameters: ["partner_audience", "page_path"], description: "A professional requested the resource kit." },
  { internal: "phone_clicked", ga4: "phone_click", keyConversion: true, parameters: ["page_path", "page_type"], description: "A tel: link was clicked." },
  { internal: "email_clicked", ga4: "email_click", keyConversion: true, parameters: ["page_path", "page_type"], description: "A mailto: link was clicked." },
  { internal: "page_view", ga4: "page_view", keyConversion: false, parameters: ["page_path", "page_type", "city", "situation"], description: "Standard pageview." },
  { internal: "lead_magnet_viewed", ga4: "guide_view", keyConversion: false, parameters: ["guide_id", "page_path"], description: "A guide landing page was viewed." },
  { internal: "local_guide_viewed", ga4: "local_page_view", keyConversion: false, parameters: ["city", "page_path", "page_type"], description: "A local SEO page was viewed." },
  { internal: "assessment_result_viewed", ga4: "assessment_result_view", keyConversion: false, parameters: ["assessment_id", "readiness_level"], description: "The result screen was rendered." },
  { internal: "partner_page_viewed", ga4: "professional_page_view", keyConversion: false, parameters: ["partner_audience", "page_path"], description: "A professional entry page was viewed." },
];

export const GA4_KEY_CONVERSIONS = GA4_EVENTS.filter(e => e.keyConversion).map(e => e.ga4);

export function ga4SpecFor(internal: MarketingEventName): Ga4EventSpec | undefined {
  return GA4_EVENTS.find(e => e.internal === internal);
}

export interface Ga4ValidationResult {
  valid: boolean;
  event: string | null;
  payload: Record<string, string | number>;
  dropped: string[];
  errors: string[];
}

const PII_VALUE_RE = /[^\s@]+@[^\s@]+\.[^\s@]+|\+?\d[\d\-.\s()]{7,}\d/;

/** Builds a GA4-safe payload, dropping unknown keys and rejecting PII. */
export function buildGa4Payload(
  internal: MarketingEventName,
  props: Record<string, unknown>,
): Ga4ValidationResult {
  const spec = ga4SpecFor(internal);
  const errors: string[] = [];
  const dropped: string[] = [];
  const payload: Record<string, string | number> = {};

  if (!spec) {
    return { valid: false, event: null, payload, dropped, errors: [`No GA4 mapping for "${internal}".`] };
  }

  for (const [key, value] of Object.entries(props)) {
    if ((GA4_FORBIDDEN_PARAMS as readonly string[]).includes(key)) {
      errors.push(`Forbidden PII parameter "${key}".`);
      continue;
    }
    if (!spec.parameters.includes(key)) {
      dropped.push(key);
      continue;
    }
    if (typeof value === "number") {
      payload[key] = value;
      continue;
    }
    const text = String(value ?? "");
    if (PII_VALUE_RE.test(text)) {
      errors.push(`Parameter "${key}" contains a value that looks like PII.`);
      continue;
    }
    payload[key] = text;
  }

  return { valid: errors.length === 0, event: spec.ga4, payload, dropped, errors };
}
