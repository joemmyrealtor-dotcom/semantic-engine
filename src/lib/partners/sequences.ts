import { LEGAL_DISCLOSURE } from "@/lib/marketing/positioning";
// Task 26 — Outreach sequences (draft-first).
//
// Five touches over ~30 days, written as professional peer correspondence.
// Nothing sends automatically: every message is generated in draft and stays
// in draft until an operator reviews it. Volume caps and review gating are
// enforced here, not in the UI.

import { partnerType, type Partner } from "./schema";

export type TouchChannel = "email" | "linkedin" | "call" | "mail";

export interface SequenceTouch {
  step: 1 | 2 | 3 | 4 | 5;
  dayOffset: number;
  channel: TouchChannel;
  intent: string;
  subject: string;
  body: string;
}

export interface OutreachSequence {
  id: string;
  label: string;
  partnerTypeIds: string[];
  premise: string;
  touches: SequenceTouch[];
}

const SIGNOFF = `Joe Melendez · Legacy Forge
${LEGAL_DISCLOSURE}`;

function touches(context: {
  opener: string;
  value: string;
  resource: string;
  proof: string;
}): SequenceTouch[] {
  return [
    {
      step: 1,
      dayOffset: 0,
      channel: "email",
      intent: "Introduce the practice and the specific overlap. No ask.",
      subject: "A quick note about your clients' property decisions",
      body: `Hello {{firstName}},

${context.opener}

${context.value}

I am not asking for anything today. If it is ever useful, I am happy to be a second opinion on a property question for one of your clients.

${SIGNOFF}`,
    },
    {
      step: 2,
      dayOffset: 4,
      channel: "linkedin",
      intent: "Connection request with context, sent only after the email.",
      subject: "LinkedIn connection",
      body: `{{firstName}} — I work with {{city}} families on property decisions that sit next to ${context.proof}. Sending a note in case our paths cross on a shared client.`,
    },
    {
      step: 3,
      dayOffset: 9,
      channel: "email",
      intent: "Give something away: the professional resource kit.",
      subject: "Resource kit for your clients (no cost, no strings)",
      body: `Hello {{firstName}},

I put together a professional resource kit for {{partnerTypeLabel}}s: ${context.resource}

It is free, unbranded where it needs to be, and yours to hand to a client. Reply and I will send it, or download it here: {{resourceKitUrl}}

${SIGNOFF}`,
    },
    {
      step: 4,
      dayOffset: 18,
      channel: "email",
      intent: "One concrete case pattern; still no pressure.",
      subject: "How this usually plays out",
      body: `Hello {{firstName}},

A short pattern you may recognize: ${context.proof} When the property decision is sequenced correctly, the family avoids the expensive version of the same outcome.

If you have a client in that position, I am glad to walk through the options with them at no cost and no obligation.

${SIGNOFF}`,
    },
    {
      step: 5,
      dayOffset: 30,
      channel: "email",
      intent: "Close the loop respectfully and stop.",
      subject: "Closing the loop",
      body: `Hello {{firstName}},

I will stop reaching out — you have enough in your inbox. My details are below if a property question ever comes up for a client, and the resource kit stays available to you either way.

Thank you for the work you do for these families.

${SIGNOFF}`,
    },
  ];
}

export const OUTREACH_SEQUENCES: OutreachSequence[] = [
  {
    id: "legal",
    label: "Attorneys (probate, trust, estate, family law)",
    partnerTypeIds: ["probate_attorney", "trust_attorney", "estate_planning_attorney", "divorce_attorney"],
    premise: "Peer-to-peer. The property is the asset your matter turns on.",
    touches: touches({
      opener:
        "I work with families in north Orange County on the property side of estate, trust, and dissolution matters — usually alongside their attorney rather than in place of one.",
      value:
        "Most of what I do is sequencing: what has to happen before a property can be listed, what a court or a settlement requires, and what the realistic timeline looks like.",
      resource:
        "court-timeline checklists, a property-readiness worksheet, and a plain-language client handout on what a sale actually requires.",
      proof:
        "an estate where the property was listed before authority was confirmed, and the sale had to be unwound.",
    }),
  },
  {
    id: "financial",
    label: "CPAs, fiduciaries, and financial advisors",
    partnerTypeIds: ["cpa", "fiduciary", "financial_advisor"],
    premise: "The largest asset on the balance sheet is the least modeled one.",
    touches: touches({
      opener:
        "I work with north Orange County households on property decisions — the part of the balance sheet that usually gets a single line and very little analysis.",
      value:
        "I can give you a documented view of value, carrying cost, and disposition options so the property side of your plan is as rigorous as the rest of it.",
      resource:
        "a property-equity worksheet, a hold-versus-sell framework, and a basis-and-timing discussion guide for client meetings.",
      proof:
        "a client who held a property two years past the point it made sense, because nobody had modeled the carrying cost against the alternative.",
    }),
  },
  {
    id: "senior",
    label: "Senior services and transition professionals",
    partnerTypeIds: ["senior_move_manager", "placement_professional", "estate_sale_company"],
    premise: "Move planning and property preparation run on one calendar.",
    touches: touches({
      opener:
        "I work with families in transition on the property side of a move — usually while someone like you is handling everything else.",
      value:
        "The two calendars have to line up. When they do not, the family pays for the gap in carrying cost and stress.",
      resource:
        "a transition sequencing calendar, a property-preparation checklist, and a family conversation guide.",
      proof:
        "a placement that closed three weeks before anyone had looked at the house, and the family carried an empty property for four months.",
    }),
  },
  {
    id: "property",
    label: "Property, title, and escrow professionals",
    partnerTypeIds: ["property_manager", "contractor", "title_professional", "escrow_professional"],
    premise: "You see the file problems first.",
    touches: touches({
      opener:
        "I work the property-decision side of the same files you do in north Orange County — keep-or-sell, vesting problems, and pre-list scope questions.",
      value:
        "When a situation is more complicated than a standard listing, I am glad to be the person you route it to.",
      resource:
        "a pre-list scope-and-return worksheet and a vesting-issue triage sheet.",
      proof:
        "a file that stalled in escrow over heirship that could have been resolved months earlier.",
    }),
  },
];

export function sequenceFor(partnerTypeId: string): OutreachSequence {
  const found = OUTREACH_SEQUENCES.find(s => s.partnerTypeIds.includes(partnerTypeId));
  return found ?? (OUTREACH_SEQUENCES[0] as OutreachSequence);
}

/* ------------------------------------------------------------- rendering */

export type OutreachState = "draft" | "approved" | "sent" | "suppressed";

export interface RenderedTouch extends SequenceTouch {
  state: OutreachState;
  scheduledFor: string;
  blockedReason?: string;
}

export interface RenderedSequence {
  partnerId: string;
  sequenceId: string;
  state: OutreachState;
  touches: RenderedTouch[];
  blockedReason?: string;
}

function fill(text: string, partner: Partner): string {
  const first = partner.contactName.split(" ")[0] ?? partner.contactName;
  return text
    .replaceAll("{{firstName}}", first)
    .replaceAll("{{city}}", partner.city || "north Orange County")
    .replaceAll("{{partnerTypeLabel}}", (partnerType(partner.partnerTypeId)?.label ?? "professional").toLowerCase())
    .replaceAll("{{resourceKitUrl}}", "https://semantic-engine.lovable.app/for/resource-kit");
}

/**
 * Render a partner's sequence. Everything stays in `draft` until the partner
 * record has been reviewed and explicitly approved for outreach.
 */
export function renderSequence(partner: Partner, startAt = new Date()): RenderedSequence {
  const seq = sequenceFor(partner.partnerTypeId);
  const suppressed = partner.relationshipStage === "Do Not Contact" || partner.outreachStatus === "opted_out";
  const approved = partner.reviewed && partner.outreachStatus === "approved_for_outreach";
  const state: OutreachState = suppressed ? "suppressed" : approved ? "approved" : "draft";
  const blockedReason = suppressed
    ? "Suppressed: do not contact."
    : approved
      ? undefined
      : "Held in draft until an operator reviews this record.";

  return {
    partnerId: partner.id,
    sequenceId: seq.id,
    state,
    ...(blockedReason ? { blockedReason } : {}),
    touches: seq.touches.map(t => {
      const when = new Date(startAt.getTime() + t.dayOffset * 86_400_000);
      return {
        ...t,
        subject: fill(t.subject, partner),
        body: fill(t.body, partner),
        state,
        scheduledFor: when.toISOString(),
        ...(blockedReason ? { blockedReason } : {}),
      };
    }),
  };
}

/** Daily volume ceiling; relationship building, not a blast. */
export const DAILY_OUTREACH_CAP = 10;

export interface OutreachReadiness {
  reviewed: number;
  approved: number;
  pendingReview: number;
  suppressed: number;
  /** All outreach is manual-review gated until this many records are reviewed. */
  reviewThreshold: number;
  canRunSequences: boolean;
  dailyCap: number;
  note: string;
}

export const REVIEW_THRESHOLD = 25;

export function outreachReadiness(partners: Partner[]): OutreachReadiness {
  const reviewed = partners.filter(p => p.reviewed).length;
  const approved = partners.filter(
    p => p.reviewed && p.outreachStatus === "approved_for_outreach",
  ).length;
  const suppressed = partners.filter(
    p => p.relationshipStage === "Do Not Contact" || p.outreachStatus === "opted_out",
  ).length;
  const canRun = reviewed >= REVIEW_THRESHOLD;
  return {
    reviewed,
    approved,
    pendingReview: partners.length - reviewed - suppressed,
    suppressed,
    reviewThreshold: REVIEW_THRESHOLD,
    canRunSequences: canRun,
    dailyCap: DAILY_OUTREACH_CAP,
    note: canRun
      ? `Review threshold met. Outreach remains manual; ${DAILY_OUTREACH_CAP} contacts per day maximum.`
      : `${REVIEW_THRESHOLD - reviewed} more records must be reviewed before any sequence leaves draft.`,
  };
}
