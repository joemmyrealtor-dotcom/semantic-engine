// Review and Proof Engine.
//
// HARD RULE: this module never fabricates a review, rating, testimonial,
// transaction result, or client claim. It ships an empty verified ledger, the
// consent and request workflow that fills it, and the rendering contract that
// refuses to display anything unverified. Proof that cannot be sourced is not
// displayed at all.

export type ProofCategory =
  | "seller"
  | "buyer"
  | "probate"
  | "inherited-property"
  | "downsizing"
  | "investor"
  | "referral-partner";

export const PROOF_CATEGORY_LABEL: Record<ProofCategory, string> = {
  seller: "Seller reviews",
  buyer: "Buyer reviews",
  probate: "Probate reviews",
  "inherited-property": "Inherited-property reviews",
  downsizing: "Downsizing reviews",
  investor: "Investor reviews",
  "referral-partner": "Referral-partner testimonials",
};

export type ProofSource = "google" | "direct" | "partner" | "case-study";

export interface ProofRecord {
  id: string;
  category: ProofCategory;
  source: ProofSource;
  /** Verbatim text as written by the author. Never edited, never generated. */
  quote: string;
  attribution: string;
  /** ISO date the review was authored. */
  authoredAt: string;
  /** Written permission to publish, recorded by the advisor. */
  consentOnFile: boolean;
  /** Verified against the source platform or a signed release. */
  verified: boolean;
  sourceUrl?: string;
}

/**
 * The verified ledger. Empty by design — entries are added only from real,
 * consented, verifiable reviews. An empty ledger renders nothing.
 */
export const PROOF_LEDGER: ProofRecord[] = [];

export function publishableProof(category?: ProofCategory): ProofRecord[] {
  return PROOF_LEDGER.filter(
    r => r.verified && r.consentOnFile && r.quote.trim().length > 0 && (!category || r.category === category),
  );
}

export interface ProofViolation {
  id: string;
  reason: string;
}

/** Anything unverified, unconsented, or empty is a violation, not a draft. */
export function proofViolations(ledger: ProofRecord[] = PROOF_LEDGER): ProofViolation[] {
  const violations: ProofViolation[] = [];
  for (const record of ledger) {
    if (!record.verified) violations.push({ id: record.id, reason: "Not verified against its source." });
    if (!record.consentOnFile) violations.push({ id: record.id, reason: "No written permission to publish." });
    if (!record.quote.trim()) violations.push({ id: record.id, reason: "Empty quote." });
    if (record.source === "google" && !record.sourceUrl) {
      violations.push({ id: record.id, reason: "Google review has no verifiable source URL." });
    }
  }
  return violations;
}

/* ------------------------------------------------------- request workflow */

export interface RequestStep {
  id: string;
  label: string;
  detail: string;
}

export const REVIEW_REQUEST_WORKFLOW: RequestStep[] = [
  { id: "eligible", label: "Eligibility", detail: "Only after an engagement closes. Logged manually; no automated sends." },
  { id: "ask", label: "Ask", detail: "Ask permission first, in person or by phone. Record the answer with a date." },
  { id: "send", label: "Send", detail: "One message with the direct Google review link. One reminder maximum, seven days later." },
  { id: "neutral", label: "Neutrality", detail: "Every client is asked regardless of expected sentiment. No incentives, no gating, no suggested wording." },
  { id: "capture", label: "Capture", detail: "Copy the review verbatim into the ledger with its source URL and authored date." },
  { id: "consent", label: "Consent to reuse", detail: "Separate written permission is required before a review appears on the website or in social assets." },
  { id: "respond", label: "Respond", detail: "Reply to every review within 72 hours. Negative reviews get a factual reply and an offline path." },
];

/* ------------------------------------------------------------ case studies */

export interface CaseStudySpec {
  slug: string;
  category: ProofCategory;
  title: string;
  /** Section outline. No numbers, outcomes, or client details are supplied. */
  sections: string[];
  /** Preconditions before the page may be written, let alone published. */
  requirements: string[];
  status: "TEMPLATE";
}

const CASE_SECTIONS = [
  "Situation (facts only, anonymised unless the client consents to be named)",
  "Constraints (timeline, court, lender, family, or tax constraints as they were)",
  "Options considered",
  "Decision and why",
  "What happened (only outcomes documented in the file)",
  "What would change the recommendation",
  "Sources and dates",
];

const CASE_REQUIREMENTS = [
  "Signed written release from the client covering every detail published.",
  "Every figure traceable to a document in the transaction file.",
  "No projections, averages, or 'typical results' language.",
  "Reviewed and dated by the advisor before publication.",
];

export const CASE_STUDY_TEMPLATES: CaseStudySpec[] = (
  ["seller", "buyer", "probate", "inherited-property", "downsizing", "investor"] as ProofCategory[]
).map(category => ({
  slug: `${category}-case-study`,
  category,
  title: `${PROOF_CATEGORY_LABEL[category].replace(" reviews", "")} case study`,
  sections: CASE_SECTIONS,
  requirements: CASE_REQUIREMENTS,
  status: "TEMPLATE" as const,
}));

/* ---------------------------------------------------------- social proof */

export interface SocialProofAsset {
  id: string;
  category: ProofCategory;
  format: "testimonial-card" | "quote-graphic" | "partner-quote";
  /** Populated only from a publishable ProofRecord. */
  sourceRecordId: string | null;
  renderable: boolean;
  note: string;
}

export function socialProofAssets(): SocialProofAsset[] {
  const publishable = publishableProof();
  if (publishable.length === 0) {
    return (Object.keys(PROOF_CATEGORY_LABEL) as ProofCategory[]).map(category => ({
      id: `${category}-placeholder`,
      category,
      format: "testimonial-card" as const,
      sourceRecordId: null,
      renderable: false,
      note: "No verified, consented review on file. Nothing renders for this category.",
    }));
  }
  return publishable.map(record => ({
    id: `${record.id}-card`,
    category: record.category,
    format: record.category === "referral-partner" ? ("partner-quote" as const) : ("testimonial-card" as const),
    sourceRecordId: record.id,
    renderable: true,
    note: "Verbatim quote from a verified, consented review.",
  }));
}

export interface ProofReport {
  generatedAt: string;
  totalRecords: number;
  publishable: number;
  byCategory: Record<ProofCategory, number>;
  violations: ProofViolation[];
  caseStudyTemplates: number;
  renderableAssets: number;
  status: "READY" | "EMPTY" | "BLOCKED";
  detail: string;
}

export function buildProofReport(now: Date = new Date()): ProofReport {
  const violations = proofViolations();
  const publishable = publishableProof();
  const byCategory = {} as Record<ProofCategory, number>;
  for (const category of Object.keys(PROOF_CATEGORY_LABEL) as ProofCategory[]) {
    byCategory[category] = publishable.filter(r => r.category === category).length;
  }
  const status = violations.length > 0 ? "BLOCKED" : publishable.length === 0 ? "EMPTY" : "READY";
  return {
    generatedAt: now.toISOString(),
    totalRecords: PROOF_LEDGER.length,
    publishable: publishable.length,
    byCategory,
    violations,
    caseStudyTemplates: CASE_STUDY_TEMPLATES.length,
    renderableAssets: socialProofAssets().filter(a => a.renderable).length,
    status,
    detail:
      status === "EMPTY"
        ? "No verified reviews on file. The site displays no testimonials, ratings, or results — by design, not omission."
        : status === "BLOCKED"
          ? `${violations.length} ledger entries fail verification or consent and must not be published.`
          : `${publishable.length} verified, consented reviews available across ${Object.values(byCategory).filter(Boolean).length} categories.`,
  };
}
