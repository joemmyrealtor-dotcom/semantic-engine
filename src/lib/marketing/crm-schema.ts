// Task 24 — HubSpot lead-capture architecture (canonical CRM contract).
//
// This module is the single source of truth for the HubSpot object model:
// contact properties, pipelines, and pipeline stages. Every conversion
// surface in the app maps into these names — no page-specific integrations.

export type CrmPropertyType = "string" | "number" | "boolean" | "enumeration" | "datetime";

export interface CrmPropertyDefinition {
  /** Internal HubSpot property name. */
  name: string;
  label: string;
  type: CrmPropertyType;
  group: "attribution" | "situation" | "qualification" | "consent" | "identity";
  description: string;
  options?: string[];
  /** True when the value may contain personally identifiable information. */
  pii?: boolean;
}

/** Standardized HubSpot contact properties. */
export const CRM_CONTACT_PROPERTIES: CrmPropertyDefinition[] = [
  // identity
  { name: "firstname", label: "First name", type: "string", group: "identity", description: "Contact first name.", pii: true },
  { name: "email", label: "Email", type: "string", group: "identity", description: "Primary email address.", pii: true },
  { name: "phone", label: "Phone", type: "string", group: "identity", description: "Primary phone number.", pii: true },

  // attribution
  { name: "hs_lead_source", label: "Lead source", type: "string", group: "attribution", description: "Conversion surface that created the contact." },
  { name: "lf_original_source", label: "Original source", type: "string", group: "attribution", description: "First-touch source, never overwritten." },
  { name: "lf_original_medium", label: "Original medium", type: "string", group: "attribution", description: "First-touch medium, never overwritten." },
  { name: "lf_original_campaign", label: "Original campaign", type: "string", group: "attribution", description: "First-touch campaign, never overwritten." },
  { name: "lf_latest_landing_page", label: "Latest landing page", type: "string", group: "attribution", description: "Landing page of the most recent campaign touch." },
  { name: "lf_latest_referrer", label: "Latest referrer", type: "string", group: "attribution", description: "Referrer of the most recent touch." },
  { name: "lf_delivery_key", label: "Delivery key", type: "string", group: "attribution", description: "Idempotency key of the conversion that last updated this contact." },

  { name: "hs_campaign", label: "Campaign", type: "string", group: "attribution", description: "Marketing campaign attached to the conversion." },
  { name: "utm_source", label: "UTM source", type: "string", group: "attribution", description: "Latest-touch utm_source." },
  { name: "utm_medium", label: "UTM medium", type: "string", group: "attribution", description: "Latest-touch utm_medium." },
  { name: "utm_campaign", label: "UTM campaign", type: "string", group: "attribution", description: "Latest-touch utm_campaign." },
  { name: "utm_content", label: "UTM content", type: "string", group: "attribution", description: "Latest-touch utm_content." },
  { name: "utm_term", label: "UTM term", type: "string", group: "attribution", description: "Latest-touch utm_term." },
  { name: "lf_landing_page", label: "Landing page", type: "string", group: "attribution", description: "First page of the originating session." },
  { name: "lf_referrer", label: "Referrer", type: "string", group: "attribution", description: "Document referrer of the originating session." },
  { name: "lf_first_seen_at", label: "First seen at", type: "datetime", group: "attribution", description: "First-touch timestamp." },
  { name: "lf_submitted_at", label: "Submitted at", type: "datetime", group: "attribution", description: "Conversion timestamp." },
  { name: "lf_referral_source", label: "Referral source", type: "string", group: "attribution", description: "Named referral partner or introducer." },

  // situation
  { name: "city", label: "City", type: "string", group: "situation", description: "Stated city or submarket." },
  { name: "lf_situation", label: "Situation", type: "enumeration", group: "situation", description: "Entry path the contact self-selected.", options: ["sellers", "buyers", "probate", "inherited", "downsizing", "distressed", "investing"] },
  { name: "lf_property_address", label: "Property address", type: "string", group: "situation", description: "Subject property when the contact identifies one.", pii: true },
  { name: "lf_timeline", label: "Timeline", type: "enumeration", group: "situation", description: "Stated decision timeline.", options: ["0-90", "3-6", "6-12", "researching"] },
  { name: "lf_motivation", label: "Motivation", type: "string", group: "situation", description: "Stated reason for the move." },
  { name: "lf_lead_magnet", label: "Lead magnet", type: "string", group: "situation", description: "Guide that produced the conversion." },
  { name: "lf_guide_slug", label: "Guide slug", type: "string", group: "situation", description: "URL slug of the guide that produced the conversion." },

  { name: "lf_assessment_result", label: "Assessment result", type: "string", group: "situation", description: "Assessment identifier plus outcome summary." },
  { name: "lf_readiness_level", label: "Readiness level", type: "enumeration", group: "situation", description: "Assessment readiness classification.", options: ["Ready", "Nearly Ready", "Needs Planning", "Action Required"] },

  // qualification
  { name: "lf_lead_score", label: "Lead score", type: "number", group: "qualification", description: "Internal 0-100 scoring model output." },
  { name: "lf_lead_classification", label: "Lead classification", type: "enumeration", group: "qualification", description: "Scoring band.", options: ["Hot", "Qualified", "Nurture", "Long-term"] },
  { name: "lf_lead_signals", label: "Lead signals", type: "string", group: "qualification", description: "Semicolon-separated scoring signals." },
  { name: "lf_consultation_requested", label: "Consultation requested", type: "boolean", group: "qualification", description: "Contact explicitly asked for a consultation." },

  // consent
  { name: "lf_consent", label: "Marketing consent", type: "boolean", group: "consent", description: "Explicit opt-in captured on the form." },
  { name: "lf_consent_at", label: "Consent timestamp", type: "datetime", group: "consent", description: "When consent was captured." },
  { name: "lf_consent_text", label: "Consent text", type: "string", group: "consent", description: "Exact consent language shown at capture time." },
];

export type CrmPipelineId =
  | "seller"
  | "probate"
  | "downsizing"
  | "distressed"
  | "buyer"
  | "investor"
  | "referral-partner";

export interface CrmPipeline {
  id: CrmPipelineId;
  label: string;
  /** Situations routed into this pipeline. */
  situations: string[];
  stages: string[];
}

const CLIENT_STAGES = [
  "New inquiry",
  "Qualified",
  "Consultation scheduled",
  "Plan delivered",
  "Engaged",
  "Closed won",
  "Closed lost",
];

export const CRM_PIPELINES: CrmPipeline[] = [
  { id: "seller", label: "Seller", situations: ["sellers"], stages: CLIENT_STAGES },
  { id: "probate", label: "Probate / inherited", situations: ["probate", "inherited"], stages: ["New inquiry", "Authority confirmed", "Qualified", "Consultation scheduled", "Plan delivered", "Engaged", "Closed won", "Closed lost"] },
  { id: "downsizing", label: "Downsizing", situations: ["downsizing"], stages: CLIENT_STAGES },
  { id: "distressed", label: "Distressed property", situations: ["distressed"], stages: ["New inquiry", "Urgency triaged", "Qualified", "Consultation scheduled", "Plan delivered", "Engaged", "Closed won", "Closed lost"] },
  { id: "buyer", label: "Buyer", situations: ["buyers"], stages: CLIENT_STAGES },
  { id: "investor", label: "Investor", situations: ["investing"], stages: CLIENT_STAGES },
  {
    id: "referral-partner",
    label: "Referral partner",
    situations: ["referral"],
    stages: ["Identified", "Contacted", "Meeting held", "Agreement in place", "Referrals flowing", "Dormant"],
  },
];

/** Route a situation into its pipeline. Unknown situations fall back to seller. */
export function pipelineForSituation(situation: string): CrmPipeline {
  return (
    CRM_PIPELINES.find(p => p.situations.includes(situation)) ??
    (CRM_PIPELINES[0] as CrmPipeline)
  );
}

/** Property names that must never appear in analytics payloads. */
export const PII_PROPERTY_NAMES: string[] = CRM_CONTACT_PROPERTIES.filter(p => p.pii).map(
  p => p.name,
);
