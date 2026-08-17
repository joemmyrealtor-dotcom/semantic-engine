// Task 36 — Launch, pre-launch, and reactivation campaign drafts.
//
// Every asset in this module is DRAFT and NOT ACTIVATED. There is no
// transport, no scheduler, and no external write. Copy uses placeholders and
// never asserts results, ratings, client outcomes, market statistics, or
// urgency. Reactivation messaging is useful-first and opt-out respecting.

import { CTA_BY_RUNG, type CtaRung } from "./brand-system";

export type CampaignPhase = "pre-launch" | "launch" | "reactivation" | "referral-partner";
export type AssetChannel = "email" | "social" | "sms" | "call-script" | "landing-copy";

export interface CampaignAsset {
  id: string;
  phase: CampaignPhase;
  channel: AssetChannel;
  audience: string;
  subject?: string;
  body: string;
  ctaRung: CtaRung;
  ctaLabel: string;
  ctaPath: string;
  status: "DRAFT";
  activated: false;
  guardrails: string[];
}

const BASE_GUARDRAILS = [
  "Educational only — not legal, tax, or financial advice.",
  "Equal Housing Opportunity. Fair-housing safe language throughout.",
  "No results, ratings, testimonials, or market statistics unless sourced and dated.",
  "No urgency, scarcity, or fear framing.",
  "One-click opt-out on every list message; opt-outs honoured immediately.",
];

const SIGNOFF = "— {{advisor_name}}, JM Advisory Press\nEducational only. Not legal, tax, or financial advice. Equal Housing Opportunity.\nUnsubscribe: {{unsubscribe_link}}";

function asset(
  id: string,
  phase: CampaignPhase,
  channel: AssetChannel,
  audience: string,
  body: string,
  ctaRung: CtaRung,
  ctaPath: string,
  subject?: string,
  extraGuardrails: string[] = [],
): CampaignAsset {
  return {
    id,
    phase,
    channel,
    audience,
    ...(subject ? { subject } : {}),
    body,
    ctaRung,
    ctaLabel: CTA_BY_RUNG[ctaRung].label,
    ctaPath,
    status: "DRAFT",
    activated: false,
    guardrails: [...BASE_GUARDRAILS, ...extraGuardrails],
  };
}

export const CAMPAIGN_ASSETS: CampaignAsset[] = [
  /* ------------------------------------------------------- pre-launch */
  asset(
    "pre-launch-email-1",
    "pre-launch",
    "email",
    "Existing contacts who have opted in",
    `Hi {{first_name}},\n\nI've been writing down the answers I give most often about selling, inherited property, probate, and downsizing — the ones that usually take a whole phone call to explain properly.\n\nThey're going into one place shortly. No pitch attached; the point is that you can read the reasoning before you talk to anyone, including me.\n\nIf there's a question you'd want answered plainly, reply and tell me. I'd rather write what's actually useful.\n\n${SIGNOFF}`,
    "learn",
    "/answers",
    "Something I've been writing",
  ),
  asset(
    "pre-launch-social-1",
    "pre-launch",
    "social",
    "General local audience",
    `Most real estate questions don't need a sales call. They need a straight answer and the reasoning behind it.\n\nI'm publishing the answers I give most often — sellers, buyers, inherited property, probate, downsizing — written so you can decide for yourself.\n\nNo ratings, no results claims, no urgency. Just the reasoning.`,
    "learn",
    "/answers",
    undefined,
    ["Three topical tags maximum. No hashtag stacking."],
  ),
  asset(
    "pre-launch-call-script",
    "pre-launch",
    "call-script",
    "Referral professionals",
    `Operator script (not a send):\n1. Purpose: tell them a reference library is going live that their clients can read without being sold to.\n2. Ask what question their clients ask them most often that isn't really their job to answer.\n3. Offer to write that answer as a public page they can send.\n4. Do not ask for referrals on this call. Log the conversation and the requested topic.`,
    "refer",
    "/attorney-partners",
    undefined,
    ["No referral ask on a first conversation."],
  ),

  /* ----------------------------------------------------------- launch */
  asset(
    "launch-email-1",
    "launch",
    "email",
    "Opted-in list",
    `Hi {{first_name}},\n\nThe reference library is live. It covers the questions that come up before a decision is made: what a sale actually costs, what has to happen with an inherited property, how probate changes a timeline, and what downsizing looks like when the numbers matter.\n\nEvery page answers the question first, then explains the reasoning and what would change the answer.\n\nStart wherever your question is. If you'd rather talk it through, that option is there too — but the reading comes first.\n\n${SIGNOFF}`,
    "learn",
    "/answers",
    "The reference library is live",
  ),
  asset(
    "launch-email-2",
    "launch",
    "email",
    "Opted-in list — situational follow-up",
    `Hi {{first_name}},\n\nOne thing people ask after reading: "which of this applies to me?"\n\nThere's a short readiness assessment for that. It asks about your situation, timeline, and constraints, then tells you which decisions are actually in front of you. It takes a few minutes and you get the result immediately.\n\nYour answers stay in your browser unless you choose to send them.\n\n${SIGNOFF}`,
    "evaluate",
    "/assessments",
    "Which part actually applies to you",
  ),
  asset(
    "launch-social-1",
    "launch",
    "social",
    "General local audience",
    `New: a set of plain answers to the real estate questions that usually cost you a phone call.\n\nEach one answers the question in the first paragraph, then explains the reasoning and what would change it.\n\nEducational only. Not legal, tax, or financial advice.`,
    "learn",
    "/answers",
  ),
  asset(
    "launch-landing-copy",
    "launch",
    "landing-copy",
    "Search and referral arrivals",
    `Read the reasoning before you decide.\n\nClear, sourced answers on selling, buying, inherited property, probate, and downsizing — written so you can evaluate your own situation first and talk to someone second.\n\nWhat you'll find: the answer, the reasoning behind it, and what would change it.`,
    "learn",
    "/answers",
    undefined,
    ["Do not modify the governed home route with this copy; drafts only."],
  ),

  /* ---------------------------------------------------- reactivation */
  asset(
    "reactivation-email-1",
    "reactivation",
    "email",
    "Past clients and sphere",
    `Hi {{first_name}},\n\nNo pitch here — I put together the written answers to the questions that came up most often while we worked together, including the ones that show up years later: what changes with an inherited property, how a downsize is usually sequenced, and what a sale actually costs end to end.\n\nIf any of it is useful to you or to someone you'd normally have to explain it to, it's all there to read or forward.\n\nIf you'd rather not hear from me at all, the unsubscribe link below works immediately and I won't follow up.\n\n${SIGNOFF}`,
    "learn",
    "/resources",
    "Something useful, no strings",
    ["Never ask a past client if they are thinking of selling.", "Maximum one touch every two weeks."],
  ),
  asset(
    "reactivation-email-2",
    "reactivation",
    "email",
    "Past clients — annual context",
    `Hi {{first_name}},\n\nOnce a year I send the one thing worth checking: whether your property records, title, and ownership details still reflect your actual situation. It costs nothing to check and it's the item that causes the most avoidable friction later.\n\nThe walkthrough is written up here. If yours is already in order, ignore this entirely.\n\n${SIGNOFF}`,
    "learn",
    "/resources",
    "The one annual check worth doing",
    ["No market commentary, no valuation offer, no listing prompt."],
  ),
  asset(
    "reactivation-sms-1",
    "reactivation",
    "sms",
    "Past clients who opted into text",
    `Hi {{first_name}} — {{advisor_name}}. Wrote up the inherited-property and probate questions people ask me most; sending in case it's useful to you or someone you know: {{link}}. Reply STOP and I won't text again.`,
    "learn",
    "/answers",
    undefined,
    ["Text only where an explicit text opt-in is recorded.", "STOP honoured immediately."],
  ),

  /* -------------------------------------------------- referral partner */
  asset(
    "partner-email-1",
    "referral-partner",
    "email",
    "Attorneys, CPAs, fiduciaries",
    `Hi {{first_name}},\n\nYour clients ask you property questions that aren't really yours to answer. I've written those answers as plain reference pages — probate timelines, inherited-property options, what a sale costs, what has to happen before a court date.\n\nThey're sendable as-is, with no lead capture in front of them and no pitch inside them. If a client wants to talk to someone afterwards, that's their call, not a funnel.\n\nIf there's a question you field constantly that isn't covered, tell me and I'll write it.\n\n${SIGNOFF}`,
    "refer",
    "/attorney-partners",
    "Reference pages your clients can actually use",
    ["No fee, incentive, or reciprocal-referral arrangement is offered or implied."],
  ),
  asset(
    "partner-call-script",
    "referral-partner",
    "call-script",
    "Referral professionals",
    `Operator script (not a send):\n1. Confirm what kinds of matters they handle and where property questions slow them down.\n2. Offer the relevant reference pages by name. Send only what applies.\n3. State plainly: no fee, no incentive, no expectation of reciprocity.\n4. Ask what to write next. Log the answer and the date.\n5. Follow up once, in writing, within two weeks. Then leave it.`,
    "refer",
    "/attorney-partners",
    undefined,
    ["Never imply an existing volume of partner relationships."],
  ),
];

export interface CampaignReadiness {
  generatedAt: string;
  total: number;
  byPhase: Record<CampaignPhase, number>;
  byChannel: Record<string, number>;
  activated: number;
  violations: string[];
  status: "DRAFT_READY" | "BLOCKED";
  detail: string;
}

const BANNED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b\d+\s*(?:5-star|star)\b/i, reason: "Implies a rating." },
  { pattern: /\b(?:hundreds|thousands|dozens) of (?:clients|families|homes|sales)\b/i, reason: "Unsourced volume claim." },
  { pattern: /\bguarantee(?:d|s)?\b/i, reason: "Guarantee language." },
  { pattern: /\b(?:act now|limited time|don't miss|last chance|hurry)\b/i, reason: "Urgency framing." },
  { pattern: /\b(?:best|top|#1|number one) (?:agent|realtor|advisor)\b/i, reason: "Unsubstantiated superiority claim." },
  { pattern: /\bthinking of selling\b/i, reason: "Listing prompt to past clients." },
];

export function campaignViolations(assets: CampaignAsset[] = CAMPAIGN_ASSETS): string[] {
  const violations: string[] = [];
  for (const a of assets) {
    if (a.status !== "DRAFT" || a.activated !== false) violations.push(`${a.id}: asset is not in DRAFT / not-activated state.`);
    for (const { pattern, reason } of BANNED_PATTERNS) {
      if (pattern.test(a.body) || (a.subject && pattern.test(a.subject))) violations.push(`${a.id}: ${reason}`);
    }
    if (a.channel === "email" && !a.body.includes("{{unsubscribe_link}}")) {
      violations.push(`${a.id}: email asset has no unsubscribe link.`);
    }
    if (a.channel === "sms" && !/STOP/.test(a.body)) {
      violations.push(`${a.id}: text asset has no STOP opt-out.`);
    }
  }
  return violations;
}

export function buildCampaignReadiness(now: Date = new Date()): CampaignReadiness {
  const byPhase = { "pre-launch": 0, launch: 0, reactivation: 0, "referral-partner": 0 } as Record<CampaignPhase, number>;
  const byChannel: Record<string, number> = {};
  for (const a of CAMPAIGN_ASSETS) {
    byPhase[a.phase] += 1;
    byChannel[a.channel] = (byChannel[a.channel] ?? 0) + 1;
  }
  const violations = campaignViolations();
  return {
    generatedAt: now.toISOString(),
    total: CAMPAIGN_ASSETS.length,
    byPhase,
    byChannel,
    activated: CAMPAIGN_ASSETS.filter(a => a.activated).length,
    violations,
    status: violations.length === 0 ? "DRAFT_READY" : "BLOCKED",
    detail:
      violations.length === 0
        ? "All campaign assets are drafted, compliant, and NOT ACTIVATED. Activation requires Owner authorization and a verified delivery path."
        : `${violations.length} campaign assets fail the copy or opt-out guardrails.`,
  };
}
