// Task 32 — Review and proof OPERATIONS.
//
// Extends ./proof.ts. The ledger, verification rules, request workflow, and
// case-study templates continue to live there. This module adds the
// operational layer: eligibility, request cadence caps, DRAFT request
// templates, an intake checklist, asset eligibility, and an operator
// readiness report.
//
// HARD RULE, inherited from proof.ts: nothing here fabricates a review,
// rating, quote, client name, outcome, or result. Templates contain
// placeholders, never invented content, and nothing is ever sent from here.

import {
  CASE_STUDY_TEMPLATES,
  PROOF_CATEGORY_LABEL,
  PROOF_LEDGER,
  REVIEW_REQUEST_WORKFLOW,
  proofViolations,
  publishableProof,
  socialProofAssets,
  type ProofCategory,
  type ProofRecord,
} from "./proof";

export const PROOF_CATEGORIES = Object.keys(PROOF_CATEGORY_LABEL) as ProofCategory[];

/* ---------------------------------------------------------- eligibility */

export interface EngagementRecord {
  id: string;
  category: ProofCategory;
  /** ISO date the engagement closed. Requests are never sent before this. */
  closedAt: string | null;
  /** Verbal or written permission to ask, recorded by the advisor. */
  permissionToAsk: boolean;
  /** ISO timestamps of requests already sent for this engagement. */
  requestsSent: string[];
  /** True when a review has already been captured for this engagement. */
  reviewCaptured: boolean;
}

/** One initial request, at most one reminder. Nothing beyond that, ever. */
export const MAX_REQUESTS_PER_ENGAGEMENT = 2;
export const REMINDER_DELAY_DAYS = 7;

export type EligibilityState = "ELIGIBLE_INITIAL" | "ELIGIBLE_REMINDER" | "WAIT" | "INELIGIBLE" | "COMPLETE";

export interface EligibilityResult {
  engagementId: string;
  state: EligibilityState;
  reason: string;
}

export function requestEligibility(engagement: EngagementRecord, now: Date = new Date()): EligibilityResult {
  const base = { engagementId: engagement.id };
  if (engagement.reviewCaptured) return { ...base, state: "COMPLETE", reason: "A review is already on file for this engagement." };
  if (!engagement.closedAt) return { ...base, state: "INELIGIBLE", reason: "Engagement has not closed. Requests are never sent mid-engagement." };
  if (!engagement.permissionToAsk) return { ...base, state: "INELIGIBLE", reason: "Permission to ask has not been recorded." };
  if (engagement.requestsSent.length >= MAX_REQUESTS_PER_ENGAGEMENT) {
    return { ...base, state: "COMPLETE", reason: "Initial request and reminder both sent. No further contact." };
  }
  if (engagement.requestsSent.length === 0) return { ...base, state: "ELIGIBLE_INITIAL", reason: "Closed engagement with recorded permission." };

  const last = new Date(engagement.requestsSent[engagement.requestsSent.length - 1]!);
  const days = (now.getTime() - last.getTime()) / 86_400_000;
  return days >= REMINDER_DELAY_DAYS
    ? { ...base, state: "ELIGIBLE_REMINDER", reason: `Initial request sent ${Math.floor(days)} days ago.` }
    : { ...base, state: "WAIT", reason: `Reminder allowed ${REMINDER_DELAY_DAYS} days after the initial request.` };
}

/* ------------------------------------------------------ request templates */

export type RequestChannel = "email" | "text" | "phone-note";
export type RequestStage = "initial" | "reminder";

export interface RequestTemplate {
  id: string;
  channel: RequestChannel;
  stage: RequestStage;
  category: ProofCategory;
  subject?: string;
  /** Placeholders only. No client names, no suggested review wording. */
  body: string;
  status: "DRAFT";
  /** Explicit: this module has no transport. */
  activated: false;
  rules: string[];
}

const NEUTRALITY_RULES = [
  "Ask every client, regardless of expected sentiment. No gating.",
  "No incentive, discount, gift, or reciprocal review is offered.",
  "Do not suggest wording, rating, or content. The review is theirs.",
  "One initial request and at most one reminder. Then stop.",
  "Send only after permission to ask has been recorded with a date.",
];

const CATEGORY_CONTEXT: Record<ProofCategory, string> = {
  seller: "the sale we worked through together",
  buyer: "the purchase we worked through together",
  probate: "the probate matter we worked through together",
  "inherited-property": "the inherited-property decision we worked through together",
  downsizing: "the downsizing move we worked through together",
  investor: "the investment decision we worked through together",
  "referral-partner": "our working relationship",
};

function templateBody(channel: RequestChannel, stage: RequestStage, category: ProofCategory): string {
  const context = CATEGORY_CONTEXT[category];
  if (channel === "phone-note") {
    return stage === "initial"
      ? `Call note (operator script, not a send):\n- Reference ${context}.\n- Ask directly whether they would be willing to leave an honest public review.\n- If yes, record the date and the answer, then send the link once.\n- If no or unsure, thank them and close the topic. Do not raise it again.`
      : `Call note (operator script, not a send):\n- Only if the initial request was accepted and ${REMINDER_DELAY_DAYS}+ days have passed.\n- One short check-in. If there is no response, close the loop permanently.`;
  }
  const opening =
    stage === "initial"
      ? `Hi {{first_name}} — thank you again for trusting me with ${context}.`
      : `Hi {{first_name}} — following up once on my earlier note about ${context}.`;
  const ask =
    stage === "initial"
      ? "If you are willing, an honest review would help other people in a similar position find a clear explanation before they decide. Whatever you write is entirely up to you."
      : "If you would still like to leave a review, the link is below. If not, no problem at all — this is the last note about it.";
  const link = "{{review_link}}";
  const close = `— ${"{{advisor_name}}"}\nEducational only — not legal, tax, or financial advice. Equal Housing Opportunity.`;

  if (channel === "text") return `${opening}\n\n${ask}\n\n${link}\n\n${close}`;
  return `${opening}\n\n${ask}\n\n${link}\n\nIf anything about the process could have been better, reply to this message directly and tell me — that feedback is just as useful.\n\n${close}`;
}

export function requestTemplates(): RequestTemplate[] {
  const channels: RequestChannel[] = ["email", "text", "phone-note"];
  const stages: RequestStage[] = ["initial", "reminder"];
  const out: RequestTemplate[] = [];
  for (const category of PROOF_CATEGORIES) {
    for (const channel of channels) {
      for (const stage of stages) {
        out.push({
          id: `rr-${category}-${channel}-${stage}`,
          channel,
          stage,
          category,
          ...(channel === "email"
            ? { subject: stage === "initial" ? "A quick question about your experience" : "One last note — no response needed" }
            : {}),
          body: templateBody(channel, stage, category),
          status: "DRAFT",
          activated: false,
          rules: NEUTRALITY_RULES,
        });
      }
    }
  }
  return out;
}

/* -------------------------------------------------------- response policy */

export const RESPONSE_WORKFLOW: { id: string; label: string; detail: string }[] = [
  { id: "sla", label: "72-hour reply", detail: "Every review receives a reply within 72 hours, positive or negative." },
  { id: "positive", label: "Positive review", detail: "Thank them specifically. Never restate or embellish the outcome they described." },
  { id: "critical", label: "Critical review", detail: "Reply factually, acknowledge the experience, and move the conversation offline. No argument, no client detail in public." },
  { id: "confidentiality", label: "Confidentiality", detail: "Never disclose transaction details, addresses, or family circumstances in a public reply." },
  { id: "log", label: "Log", detail: "Record the reply date in the ledger entry so the response SLA is auditable." },
];

/* ------------------------------------------------------- intake checklist */

export const CASE_STUDY_INTAKE_CHECKLIST: { id: string; label: string; required: boolean }[] = [
  { id: "release", label: "Signed written release covering every published detail", required: true },
  { id: "anonymisation", label: "Anonymisation decision recorded (named vs anonymous)", required: true },
  { id: "figures", label: "Every figure traced to a document in the transaction file", required: true },
  { id: "no-projection", label: "No projections, averages, or 'typical results' language", required: true },
  { id: "counsel", label: "Legal/tax statements removed or attributed to the client's own counsel", required: true },
  { id: "review", label: "Advisor review and date recorded", required: true },
  { id: "sources", label: "Sources and dates section completed", required: true },
];

export function caseStudyIntakeComplete(completedIds: string[]): boolean {
  return CASE_STUDY_INTAKE_CHECKLIST.filter(i => i.required).every(i => completedIds.includes(i.id));
}

/* ------------------------------------------------------------- readiness */

export interface CategoryReadiness {
  category: ProofCategory;
  label: string;
  publishable: number;
  /** Renderable only when a verified, consented record exists. */
  renderable: boolean;
  status: "COVERED" | "EMPTY";
}

export interface ProofOperationsReport {
  generatedAt: string;
  ledgerSize: number;
  publishable: number;
  categories: CategoryReadiness[];
  blocked: { id: string; reason: string }[];
  workflowSteps: number;
  responseSteps: number;
  templates: number;
  caseStudyTemplates: number;
  renderableAssets: number;
  /** Operator to-do list. Never auto-executed. */
  nextOperatorActions: string[];
  status: "READY" | "AWAITING_SOURCE_DATA" | "BLOCKED";
  detail: string;
}

export function buildProofOperationsReport(
  now: Date = new Date(),
  ledger: ProofRecord[] = PROOF_LEDGER,
): ProofOperationsReport {
  const violations = proofViolations(ledger);
  const publishable = publishableProof();
  const categories: CategoryReadiness[] = PROOF_CATEGORIES.map(category => {
    const count = publishable.filter(r => r.category === category).length;
    return {
      category,
      label: PROOF_CATEGORY_LABEL[category],
      publishable: count,
      renderable: count > 0,
      status: count > 0 ? "COVERED" : "EMPTY",
    };
  });

  const empty = categories.filter(c => c.status === "EMPTY");
  const status = violations.length > 0 ? "BLOCKED" : publishable.length === 0 ? "AWAITING_SOURCE_DATA" : "READY";

  const nextOperatorActions = [
    ...(violations.length > 0
      ? ["Resolve or remove every ledger entry that fails verification or consent before anything renders."]
      : []),
    "Record closed engagements with a permission-to-ask date so eligibility can be computed.",
    "Send the initial review request manually from the DRAFT template. One reminder maximum.",
    "Capture each review verbatim into the ledger with its source URL and authored date.",
    "Obtain separate written consent before reusing any review on the website or in social assets.",
    ...(empty.length > 0
      ? [`No verified proof yet for: ${empty.map(c => c.label).join(", ")}. These categories render nothing until real records exist.`]
      : []),
  ];

  return {
    generatedAt: now.toISOString(),
    ledgerSize: ledger.length,
    publishable: publishable.length,
    categories,
    blocked: violations.map(v => ({ id: v.id, reason: v.reason })),
    workflowSteps: REVIEW_REQUEST_WORKFLOW.length,
    responseSteps: RESPONSE_WORKFLOW.length,
    templates: requestTemplates().length,
    caseStudyTemplates: CASE_STUDY_TEMPLATES.length,
    renderableAssets: socialProofAssets().filter(a => a.renderable).length,
    nextOperatorActions,
    status,
    detail:
      status === "AWAITING_SOURCE_DATA"
        ? "The request, verification, consent, and response workflow is operational. The verified ledger is empty, so no proof renders anywhere — by design, not omission."
        : status === "BLOCKED"
          ? `${violations.length} ledger entries fail verification or consent.`
          : `${publishable.length} verified, consented records available.`,
  };
}
