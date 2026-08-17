// Task 37 — Launch, pre-launch, education, and reactivation campaign system.
//
// CANONICAL TASK NUMBERING: Task 35 = dashboard/metric registry, Task 36 =
// planning targets (growth-targets.ts), Task 37 = this campaign system.
//
// Every asset in this module is DRAFT and NOT ACTIVATED. There is no
// transport, no scheduler, no send, and no external write. Day offsets are
// deterministic planning metadata only — they schedule nothing. Copy uses
// placeholders and never asserts results, ratings, client outcomes, market
// statistics, or urgency. Reactivation messaging is useful-first and
// opt-out respecting.

import { CTA_BY_RUNG, type CtaRung } from "./brand-system";

export type CampaignPhase = "pre-launch" | "launch" | "education" | "reactivation" | "referral-partner" | "post-launch";

/** Required deterministic coverage tracks for the launch system. */
export type CampaignTrack =
  | "prelaunch-14-day"
  | "launch-day"
  | "education-30-day"
  | "database-reactivation"
  | "sphere-announcement"
  | "referral-professional-announcement"
  | "social-countdown"
  | "guide-assessment-promotion"
  | "local-press-pitch"
  | "post-launch-followup";

export const REQUIRED_TRACKS: CampaignTrack[] = [
  "prelaunch-14-day",
  "launch-day",
  "education-30-day",
  "database-reactivation",
  "sphere-announcement",
  "referral-professional-announcement",
  "social-countdown",
  "guide-assessment-promotion",
  "local-press-pitch",
  "post-launch-followup",
];

/** Explicit audience segments the system must cover. */
export type AudienceSegment =
  | "past-clients"
  | "sphere-database"
  | "active-leads"
  | "referral-professionals"
  | "new-organic-visitors";

export const REQUIRED_SEGMENTS: AudienceSegment[] = [
  "past-clients",
  "sphere-database",
  "active-leads",
  "referral-professionals",
  "new-organic-visitors",
];

export const SEGMENT_LABEL: Record<AudienceSegment, string> = {
  "past-clients": "Past clients",
  "sphere-database": "Sphere / database",
  "active-leads": "Active leads",
  "referral-professionals": "Referral professionals",
  "new-organic-visitors": "New organic visitors",
};

export type AssetChannel = "email" | "social" | "sms" | "call-script" | "landing-copy" | "press-pitch";

export interface CampaignAsset {
  id: string;
  phase: CampaignPhase;
  track: CampaignTrack;
  channel: AssetChannel;
  /** Free-text description of who receives it. */
  audience: string;
  /** Canonical segments this asset addresses. */
  segments: AudienceSegment[];
  /**
   * Deterministic planning offset in days relative to launch day (day 0).
   * Negative = pre-launch. This is metadata for review only: nothing is
   * scheduled, queued, or sent from it.
   */
  dayOffset: number;
  subject?: string;
  body: string;
  ctaRung: CtaRung;
  ctaLabel: string;
  ctaPath: string;
  status: "DRAFT";
  activated: false;
  guardrails: string[];
  /** Reusable BPC 10140.6 licensee/responsible-broker disclosure. */
  legalDisclosure: string;
}

const BASE_GUARDRAILS = [
  "Educational only — not legal, tax, or financial advice.",
  "Equal Housing Opportunity. Fair-housing safe language throughout.",
  "No results, ratings, testimonials, or market statistics unless sourced and dated.",
  "No urgency, scarcity, or fear framing.",
  "One-click opt-out on every list message; opt-outs honoured immediately.",
  "DRAFT only: no send, no schedule, no external write.",
];

/**
 * Reusable first-point-of-contact disclosure (BPC 10140.6 / 10015.4):
 * licensee name, license number, and responsible broker identity must appear
 * on solicitation material. Every DRAFT asset exposes it via
 * `legalDisclosure` so no future asset can omit it.
 */
export const CAMPAIGN_LEGAL_DISCLOSURE = LEGAL_DISCLOSURE;

const SIGNOFF = `— ${LICENSE.advisorName}, Legacy Forge\n${CAMPAIGN_LEGAL_DISCLOSURE}\nEducational only. Not legal, tax, or financial advice.\nUnsubscribe: {{unsubscribe_link}}`;

interface AssetInput {
  id: string;
  phase: CampaignPhase;
  track: CampaignTrack;
  channel: AssetChannel;
  audience: string;
  segments: AudienceSegment[];
  dayOffset: number;
  body: string;
  ctaRung: CtaRung;
  ctaPath: string;
  subject?: string;
  extraGuardrails?: string[];
}

function asset(input: AssetInput): CampaignAsset {
  return {
    id: input.id,
    phase: input.phase,
    track: input.track,
    channel: input.channel,
    audience: input.audience,
    segments: input.segments,
    dayOffset: input.dayOffset,
    ...(input.subject ? { subject: input.subject } : {}),
    body: input.body,
    ctaRung: input.ctaRung,
    ctaLabel: CTA_BY_RUNG[input.ctaRung].label,
    ctaPath: input.ctaPath,
    status: "DRAFT",
    activated: false,
    guardrails: [...BASE_GUARDRAILS, ...(input.extraGuardrails ?? [])],
  };
}

export const CAMPAIGN_ASSETS: CampaignAsset[] = [
  /* ------------------------------------------- pre-launch: 14-day run-up */
  asset({
    id: "prelaunch-d14-email-announce",
    phase: "pre-launch",
    track: "prelaunch-14-day",
    channel: "email",
    audience: "Opted-in sphere and database",
    segments: ["sphere-database", "active-leads"],
    dayOffset: -14,
    subject: "Something I've been writing",
    body: `Hi {{first_name}},\n\nI've been writing down the answers I give most often about selling, inherited property, probate, and downsizing — the ones that usually take a whole phone call to explain properly.\n\nThey're going into one place shortly. No pitch attached; the point is that you can read the reasoning before you talk to anyone, including me.\n\nIf there's a question you'd want answered plainly, reply and tell me. I'd rather write what's actually useful.\n\n${SIGNOFF}`,
    ctaRung: "learn",
    ctaPath: "/answers",
  }),
  asset({
    id: "prelaunch-d10-partner-call",
    phase: "pre-launch",
    track: "prelaunch-14-day",
    channel: "call-script",
    audience: "Referral professionals",
    segments: ["referral-professionals"],
    dayOffset: -10,
    body: `Operator script (not a send):\n1. Purpose: tell them a reference library is going live that their clients can read without being sold to.\n2. Ask what question their clients ask them most often that isn't really their job to answer.\n3. Offer to write that answer as a public page they can send.\n4. Do not ask for referrals on this call. Log the conversation and the requested topic.`,
    ctaRung: "refer",
    ctaPath: "/attorney-partners",
    extraGuardrails: ["No referral ask on a first conversation."],
  }),
  asset({
    id: "prelaunch-d7-social-countdown-1",
    phase: "pre-launch",
    track: "social-countdown",
    channel: "social",
    audience: "General local audience",
    segments: ["new-organic-visitors", "sphere-database"],
    dayOffset: -7,
    body: `One week out. Most real estate questions don't need a sales call — they need a straight answer and the reasoning behind it.\n\nI'm publishing the answers I give most often: sellers, buyers, inherited property, probate, downsizing.\n\nNo ratings, no results claims, no urgency. Just the reasoning.`,
    ctaRung: "learn",
    ctaPath: "/answers",
    extraGuardrails: ["Three topical tags maximum. No hashtag stacking."],
  }),
  asset({
    id: "prelaunch-d3-social-countdown-2",
    phase: "pre-launch",
    track: "social-countdown",
    channel: "social",
    audience: "General local audience",
    segments: ["new-organic-visitors"],
    dayOffset: -3,
    body: `Three days out. A sample of what's coming: what a sale actually costs end to end, what has to happen with an inherited property, and how probate changes a timeline.\n\nEach answer states the answer first, then the reasoning, then what would change it.\n\nEducational only. Not legal, tax, or financial advice.`,
    ctaRung: "learn",
    ctaPath: "/answers",
  }),
  asset({
    id: "prelaunch-d2-sphere-announcement",
    phase: "pre-launch",
    track: "sphere-announcement",
    channel: "email",
    audience: "Sphere and personal database",
    segments: ["sphere-database"],
    dayOffset: -2,
    subject: "Going live this week",
    body: `Hi {{first_name}},\n\nThe reference library I mentioned goes live this week. It's written so you can read the reasoning yourself before deciding anything, and so you can forward a specific answer to someone who needs it.\n\nNothing is asked of you here. If it's useful, use it.\n\n${SIGNOFF}`,
    ctaRung: "learn",
    ctaPath: "/resources",
    extraGuardrails: ["Maximum one sphere touch every two weeks."],
  }),
  asset({
    id: "prelaunch-d1-active-leads",
    phase: "pre-launch",
    track: "prelaunch-14-day",
    channel: "email",
    audience: "Active leads in conversation",
    segments: ["active-leads"],
    dayOffset: -1,
    subject: "The written version of what we discussed",
    body: `Hi {{first_name}},\n\nTomorrow the written versions of the things we've talked through go live — the sequencing, the costs, and what usually changes the answer.\n\nIf you'd rather read it before we next speak, that's the intent. Your questions shape what gets written next.\n\n${SIGNOFF}`,
    ctaRung: "evaluate",
    ctaPath: "/assessments",
  }),

  /* ---------------------------------------------------------- launch day */
  asset({
    id: "launch-d0-email-list",
    phase: "launch",
    track: "launch-day",
    channel: "email",
    audience: "Opted-in list",
    segments: ["sphere-database", "active-leads"],
    dayOffset: 0,
    subject: "The reference library is live",
    body: `Hi {{first_name}},\n\nThe reference library is live. It covers the questions that come up before a decision is made: what a sale actually costs, what has to happen with an inherited property, how probate changes a timeline, and what downsizing looks like when the numbers matter.\n\nEvery page answers the question first, then explains the reasoning and what would change the answer.\n\nStart wherever your question is. If you'd rather talk it through, that option is there too — but the reading comes first.\n\n${SIGNOFF}`,
    ctaRung: "learn",
    ctaPath: "/answers",
  }),
  asset({
    id: "launch-d0-social",
    phase: "launch",
    track: "launch-day",
    channel: "social",
    audience: "General local audience",
    segments: ["new-organic-visitors"],
    dayOffset: 0,
    body: `Live now: a set of plain answers to the real estate questions that usually cost you a phone call.\n\nEach one answers the question in the first paragraph, then explains the reasoning and what would change it.\n\nEducational only. Not legal, tax, or financial advice.`,
    ctaRung: "learn",
    ctaPath: "/answers",
  }),
  asset({
    id: "launch-d0-landing-copy",
    phase: "launch",
    track: "launch-day",
    channel: "landing-copy",
    audience: "Search and referral arrivals",
    segments: ["new-organic-visitors"],
    dayOffset: 0,
    body: `Read the reasoning before you decide.\n\nClear, sourced answers on selling, buying, inherited property, probate, and downsizing — written so you can evaluate your own situation first and talk to someone second.\n\nWhat you'll find: the answer, the reasoning behind it, and what would change it.`,
    ctaRung: "learn",
    ctaPath: "/answers",
    extraGuardrails: ["Do not modify the governed home route with this copy; drafts only."],
  }),
  asset({
    id: "launch-d1-partner-announcement",
    phase: "referral-partner",
    track: "referral-professional-announcement",
    channel: "email",
    audience: "Attorneys, CPAs, fiduciaries",
    segments: ["referral-professionals"],
    dayOffset: 1,
    subject: "Reference pages your clients can actually use",
    body: `Hi {{first_name}},\n\nYour clients ask you property questions that aren't really yours to answer. I've written those answers as plain reference pages — probate timelines, inherited-property options, what a sale costs, what has to happen before a court date.\n\nThey're sendable as-is, with no lead capture in front of them and no pitch inside them. If a client wants to talk to someone afterwards, that's their call, not a funnel.\n\nIf there's a question you field constantly that isn't covered, tell me and I'll write it.\n\n${SIGNOFF}`,
    ctaRung: "refer",
    ctaPath: "/attorney-partners",
    extraGuardrails: ["No fee, incentive, or reciprocal-referral arrangement is offered or implied."],
  }),
  asset({
    id: "launch-d2-press-pitch",
    phase: "launch",
    track: "local-press-pitch",
    channel: "press-pitch",
    audience: "Local press, community newsletters, neighbourhood associations",
    segments: ["new-organic-visitors", "referral-professionals"],
    dayOffset: 2,
    subject: "A free local reference on probate, inherited property, and downsizing",
    body: `Hi {{editor_name}},\n\nI've published a free reference library covering the property questions local residents deal with under pressure: probate timelines, inherited property, downsizing sequencing, and what a sale actually costs.\n\nIt is educational, has no lead capture in front of it, and makes no claims about outcomes or market performance. If any of it is useful to your readers, it is free to link or quote with attribution.\n\nI'm happy to write a plain-language column on any of these topics, or answer reader questions in writing, at no cost.\n\n${SIGNOFF}`,
    ctaRung: "learn",
    ctaPath: "/resources",
    extraGuardrails: [
      "Pitch only. No paid placement, no advertorial, no exchange of value.",
      "No claim of local market leadership, rankings, or transaction volume.",
    ],
  }),

  /* ------------------------------------------------- 30-day education arc */
  asset({
    id: "education-d3-answers",
    phase: "education",
    track: "education-30-day",
    channel: "email",
    audience: "Opted-in list — education sequence 1 of 4",
    segments: ["sphere-database", "active-leads", "new-organic-visitors"],
    dayOffset: 3,
    subject: "What a sale actually costs, line by line",
    body: `Hi {{first_name}},\n\nFirst in a short series. This one walks the cost side of a sale line by line — what is negotiable, what is not, and where the estimates people repeat tend to be wrong.\n\nNo numbers are invented; where a figure depends on your situation, the page says so and explains what changes it.\n\n${SIGNOFF}`,
    ctaRung: "learn",
    ctaPath: "/answers",
  }),
  asset({
    id: "education-d10-guide-promotion",
    phase: "education",
    track: "guide-assessment-promotion",
    channel: "email",
    audience: "Opted-in list — education sequence 2 of 4",
    segments: ["sphere-database", "active-leads"],
    dayOffset: 10,
    subject: "The written guides, if you want the long version",
    body: `Hi {{first_name}},\n\nSecond in the series. Some questions are too long for a page, so they exist as guides: probate sequencing, inherited-property options, and the downsizing walkthrough.\n\nThey're free and there's no call attached to reading one.\n\n${SIGNOFF}`,
    ctaRung: "learn",
    ctaPath: "/guides",
  }),
  asset({
    id: "education-d17-assessment-promotion",
    phase: "education",
    track: "guide-assessment-promotion",
    channel: "email",
    audience: "Opted-in list — education sequence 3 of 4",
    segments: ["active-leads", "sphere-database"],
    dayOffset: 17,
    subject: "Which part actually applies to you",
    body: `Hi {{first_name}},\n\nOne thing people ask after reading: "which of this applies to me?"\n\nThere's a short readiness assessment for that. It asks about your situation, timeline, and constraints, then tells you which decisions are actually in front of you. It takes a few minutes and you get the result immediately.\n\nYour answers stay in your browser unless you choose to send them.\n\n${SIGNOFF}`,
    ctaRung: "evaluate",
    ctaPath: "/assessments",
  }),
  asset({
    id: "education-d24-social",
    phase: "education",
    track: "education-30-day",
    channel: "social",
    audience: "General local audience",
    segments: ["new-organic-visitors"],
    dayOffset: 24,
    body: `A question worth answering before you need it: what happens to a property when the owner dies without a will in place?\n\nThe written answer covers the sequence, who has authority to act, and what usually delays it.\n\nEducational only. Not legal, tax, or financial advice.`,
    ctaRung: "learn",
    ctaPath: "/probate",
  }),
  asset({
    id: "education-d30-close",
    phase: "education",
    track: "education-30-day",
    channel: "email",
    audience: "Opted-in list — education sequence 4 of 4",
    segments: ["sphere-database", "active-leads"],
    dayOffset: 30,
    subject: "Last one in this series",
    body: `Hi {{first_name}},\n\nLast in the series. If a question you have still isn't answered anywhere on the site, reply and tell me — that's how the next pages get chosen.\n\nIf the series wasn't useful, the unsubscribe link below works immediately.\n\n${SIGNOFF}`,
    ctaRung: "learn",
    ctaPath: "/resources",
  }),

  /* ---------------------------------------- past-client / database reactivation */
  asset({
    id: "reactivation-d5-past-clients",
    phase: "reactivation",
    track: "database-reactivation",
    channel: "email",
    audience: "Past clients",
    segments: ["past-clients"],
    dayOffset: 5,
    subject: "Something useful, no strings",
    body: `Hi {{first_name}},\n\nNo pitch here — I put together the written answers to the questions that came up most often while we worked together, including the ones that show up years later: what changes with an inherited property, how a downsize is usually sequenced, and what a sale actually costs end to end.\n\nIf any of it is useful to you or to someone you'd normally have to explain it to, it's all there to read or forward.\n\nIf you'd rather not hear from me at all, the unsubscribe link below works immediately and I won't follow up.\n\n${SIGNOFF}`,
    ctaRung: "learn",
    ctaPath: "/resources",
    extraGuardrails: ["Never ask a past client if they are thinking of selling.", "Maximum one touch every two weeks."],
  }),
  asset({
    id: "reactivation-d20-annual-check",
    phase: "reactivation",
    track: "database-reactivation",
    channel: "email",
    audience: "Past clients — annual context",
    segments: ["past-clients"],
    dayOffset: 20,
    subject: "The one annual check worth doing",
    body: `Hi {{first_name}},\n\nOnce a year I send the one thing worth checking: whether your property records, title, and ownership details still reflect your actual situation. It costs nothing to check and it's the item that causes the most avoidable friction later.\n\nThe walkthrough is written up here. If yours is already in order, ignore this entirely.\n\n${SIGNOFF}`,
    ctaRung: "learn",
    ctaPath: "/resources",
    extraGuardrails: ["No market commentary, no valuation offer, no listing prompt."],
  }),
  asset({
    id: "reactivation-d12-sms",
    phase: "reactivation",
    track: "database-reactivation",
    channel: "sms",
    audience: "Past clients and sphere who opted into text",
    segments: ["past-clients", "sphere-database"],
    dayOffset: 12,
    body: `Hi {{first_name}} — {{advisor_name}}. Wrote up the inherited-property and probate questions people ask me most; sending in case it's useful to you or someone you know: {{link}}. Reply STOP and I won't text again.`,
    ctaRung: "learn",
    ctaPath: "/answers",
    extraGuardrails: ["Text only where an explicit text opt-in is recorded.", "STOP honoured immediately."],
  }),

  /* ------------------------------------------------------ post-launch follow-up */
  asset({
    id: "postlaunch-d14-partner-followup",
    phase: "post-launch",
    track: "post-launch-followup",
    channel: "call-script",
    audience: "Referral professionals contacted at launch",
    segments: ["referral-professionals"],
    dayOffset: 14,
    body: `Operator script (not a send):\n1. Confirm what kinds of matters they handle and where property questions slow them down.\n2. Offer the relevant reference pages by name. Send only what applies.\n3. State plainly: no fee, no incentive, no expectation of reciprocity.\n4. Ask what to write next. Log the answer and the date.\n5. Follow up once, in writing, within two weeks. Then leave it.`,
    ctaRung: "refer",
    ctaPath: "/attorney-partners",
    extraGuardrails: ["Never imply an existing volume of partner relationships."],
  }),
  asset({
    id: "postlaunch-d21-active-leads",
    phase: "post-launch",
    track: "post-launch-followup",
    channel: "email",
    audience: "Active leads who engaged during launch",
    segments: ["active-leads"],
    dayOffset: 21,
    subject: "Anything still unanswered?",
    body: `Hi {{first_name}},\n\nYou read a few of the pages. If the part you actually needed wasn't there, tell me which question it was and I'll write it properly.\n\nIf you'd rather talk it through instead, that's available whenever it's useful to you — there's no sequence behind this message.\n\n${SIGNOFF}`,
    ctaRung: "talk",
    ctaPath: "/contact",
  }),
  asset({
    id: "postlaunch-d45-organic-recap",
    phase: "post-launch",
    track: "post-launch-followup",
    channel: "social",
    audience: "General local audience",
    segments: ["new-organic-visitors"],
    dayOffset: 45,
    body: `Six weeks of written answers so far. The most-read ones: inherited property, probate timelines, and what a sale actually costs.\n\nIf the question you have isn't covered, say so and it gets written.\n\nEducational only. Not legal, tax, or financial advice.`,
    ctaRung: "learn",
    ctaPath: "/answers",
    extraGuardrails: ["No traffic, ranking, or engagement statistics may be stated as numbers without a sourced, dated record."],
  }),
];

export interface CampaignReadiness {
  generatedAt: string;
  total: number;
  byPhase: Record<CampaignPhase, number>;
  byTrack: Record<CampaignTrack, number>;
  bySegment: Record<AudienceSegment, number>;
  byChannel: Record<string, number>;
  timeline: { id: string; dayOffset: number; track: CampaignTrack }[];
  missingTracks: CampaignTrack[];
  missingSegments: AudienceSegment[];
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
    if (a.segments.length === 0) violations.push(`${a.id}: asset has no audience segment.`);
    if (!Number.isInteger(a.dayOffset)) violations.push(`${a.id}: asset has no deterministic day offset.`);
  }
  return violations;
}

export function buildCampaignReadiness(now: Date = new Date()): CampaignReadiness {
  const byPhase = {
    "pre-launch": 0,
    launch: 0,
    education: 0,
    reactivation: 0,
    "referral-partner": 0,
    "post-launch": 0,
  } as Record<CampaignPhase, number>;
  const byTrack = Object.fromEntries(REQUIRED_TRACKS.map(t => [t, 0])) as Record<CampaignTrack, number>;
  const bySegment = Object.fromEntries(REQUIRED_SEGMENTS.map(s => [s, 0])) as Record<AudienceSegment, number>;
  const byChannel: Record<string, number> = {};

  for (const a of CAMPAIGN_ASSETS) {
    byPhase[a.phase] += 1;
    byTrack[a.track] = (byTrack[a.track] ?? 0) + 1;
    byChannel[a.channel] = (byChannel[a.channel] ?? 0) + 1;
    for (const s of a.segments) bySegment[s] = (bySegment[s] ?? 0) + 1;
  }

  const missingTracks = REQUIRED_TRACKS.filter(t => (byTrack[t] ?? 0) === 0);
  const missingSegments = REQUIRED_SEGMENTS.filter(s => (bySegment[s] ?? 0) === 0);
  const violations = [
    ...campaignViolations(),
    ...missingTracks.map(t => `coverage: required track "${t}" has no drafted asset.`),
    ...missingSegments.map(s => `coverage: required audience segment "${s}" has no drafted asset.`),
  ];

  const timeline = CAMPAIGN_ASSETS.map(a => ({ id: a.id, dayOffset: a.dayOffset, track: a.track })).sort(
    (a, b) => a.dayOffset - b.dayOffset || a.id.localeCompare(b.id),
  );

  return {
    generatedAt: now.toISOString(),
    total: CAMPAIGN_ASSETS.length,
    byPhase,
    byTrack,
    bySegment,
    byChannel,
    timeline,
    missingTracks,
    missingSegments,
    activated: CAMPAIGN_ASSETS.filter(a => a.activated).length,
    violations,
    status: violations.length === 0 ? "DRAFT_READY" : "BLOCKED",
    detail:
      violations.length === 0
        ? "All campaign assets are drafted, compliant, and NOT ACTIVATED. Day offsets are planning metadata only. Activation requires Owner authorization and a verified delivery path."
        : `${violations.length} campaign issues: copy, opt-out, or coverage gaps.`,
  };
}
