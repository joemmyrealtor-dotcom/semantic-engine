// Client-acquisition readiness — governed next actions per public URL.
//
// Every indexable page owes the visitor exactly one obvious next move. This
// module derives that move deterministically from the search intent map and
// the existing governed destinations. It creates no new pages, no new
// routes, and no new claims: every destination here already exists.
//
// Four governed action kinds:
//   learn    — read the next explanatory asset (guide, answer, hub)
//   evaluate — run a structured self-assessment
//   talk     — start a human conversation (contact page, phone, email)
//   refer    — hand a client to, or come from, a professional referral path

import { LICENSE } from "./positioning";
import { indexablePaths, NON_INDEXABLE_PUBLIC_PATHS } from "./indexation";
import { indexableRecords, type SearchIntentRecord } from "./intent-map";

export type NextActionKind = "learn" | "evaluate" | "talk" | "refer";

export interface NextAction {
  kind: NextActionKind;
  /** Descriptive label — never "learn more" or "click here". */
  label: string;
  /** Route path, or a tel:/mailto: href for direct-contact actions. */
  to: string;
  /** Why this action belongs on this page. */
  rationale: string;
}

/** Public routes that are legitimate CTA destinations but not indexable. */
export const NON_INDEXABLE_CTA_TARGETS = NON_INDEXABLE_PUBLIC_PATHS.filter(p => p !== "/");

/** Every destination a public CTA is allowed to point at. */
export function governedDestinations(): Set<string> {
  return new Set([...indexablePaths(), ...NON_INDEXABLE_CTA_TARGETS]);
}

export function isDirectContactHref(to: string): boolean {
  return to === LICENSE.phoneHref || to === LICENSE.emailHref;
}

export function isValidDestination(to: string): boolean {
  return isDirectContactHref(to) || governedDestinations().has(to);
}

/**
 * High intent means the visitor is choosing, not browsing: commercial or
 * transactional search intent, or a decision/conversion funnel stage.
 */
export function isHighIntent(record: SearchIntentRecord): boolean {
  return (
    record.intent === "commercial" ||
    record.intent === "transactional" ||
    record.funnelStage === "decision" ||
    record.funnelStage === "conversion"
  );
}

/** Page types that are legal/utility surfaces, exempt from an evaluate path. */
const UTILITY_TYPES = new Set(["utility", "trust"]);

const REFER_PAGE_TYPES = new Set(["professional"]);
const REFER_PATHS = new Set(["/probate", "/inherited-property", "/attorney-partners", "/refer"]);

function learnAction(record: SearchIntentRecord): NextAction {
  if (record.guideSlug) {
    return {
      kind: "learn",
      label: "Read the full guide",
      to: `/guides/${record.guideSlug}`,
      rationale: "Situation-matched guide declared in the intent map.",
    };
  }
  const supporting = record.supportingPages.find(p => p !== record.path && governedDestinations().has(p));
  if (supporting) {
    return {
      kind: "learn",
      label: "Continue in this section",
      to: supporting,
      rationale: "First governed supporting page for this hub.",
    };
  }
  const parent = record.parentHub && record.parentHub !== record.path ? record.parentHub : "/resources";
  return {
    kind: "learn",
    label: "Browse the resource library",
    to: governedDestinations().has(parent) ? parent : "/resources",
    rationale: "Parent hub keeps the visitor inside the topic cluster.",
  };
}

function evaluateAction(record: SearchIntentRecord): NextAction {
  if (record.assessmentSlug && record.path !== `/assessments/${record.assessmentSlug}`) {
    return {
      kind: "evaluate",
      label: "Take the readiness assessment",
      to: `/assessments/${record.assessmentSlug}`,
      rationale: "Situation-matched assessment declared in the intent map.",
    };
  }
  return {
    kind: "evaluate",
    label: "Find the right assessment",
    to: "/assessments",
    rationale: "Assessment hub routes the visitor to the matching tool.",
  };
}

function talkActions(record: SearchIntentRecord): NextAction[] {
  if (record.path === "/contact") {
    return [
      {
        kind: "talk",
        label: `Call ${LICENSE.phone}`,
        to: LICENSE.phoneHref,
        rationale: "Direct-contact page exposes the licensee's phone line.",
      },
      {
        kind: "talk",
        label: `Email ${LICENSE.email}`,
        to: LICENSE.emailHref,
        rationale: "Direct-contact page exposes the licensee's email.",
      },
    ];
  }
  return [
    {
      kind: "talk",
      label: "Talk through your situation",
      to: "/contact",
      rationale: "Governed conversation path; no timing or outcome is promised.",
    },
  ];
}

/** The governed next actions for one indexable page, in presentation order. */
export function nextActionsFor(record: SearchIntentRecord): NextAction[] {
  const actions: NextAction[] = [];
  const utility = UTILITY_TYPES.has(record.pageType);

  const learn = learnAction(record);
  if (learn.to !== record.path) actions.push(learn);

  if (!utility) {
    const evaluate = evaluateAction(record);
    if (evaluate.to !== record.path) actions.push(evaluate);
  }

  if (isHighIntent(record) || !utility) actions.push(...talkActions(record));

  if (REFER_PAGE_TYPES.has(record.pageType) || REFER_PATHS.has(record.path)) {
    if (record.path !== "/refer") {
      actions.push({
        kind: "refer",
        label: "Refer a client or a family",
        to: "/refer",
        rationale: "Professional and fiduciary audiences need a handoff path.",
      });
    }
  }

  return actions.filter(a => a.to !== record.path);
}

/**
 * High-intent public paths that carry the mobile conversion bar. Derived, not
 * hand-listed, so the set cannot drift from the intent map.
 */
export function mobileConversionPaths(): string[] {
  return indexableRecords()
    .filter(r => isHighIntent(r) && !UTILITY_TYPES.has(r.pageType) && r.path !== "/contact")
    .map(r => r.path)
    .sort();
}

const MOBILE_BAR_SET = new Set([...mobileConversionPaths(), "/refer"]);

export function showsMobileConversionBar(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return MOBILE_BAR_SET.has(clean);
}

/** The two destinations the mobile bar is allowed to offer for a path. */
export function mobileBarActions(pathname: string): NextAction[] {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const record = indexableRecords().find(r => r.path === clean);
  const evaluate = record
    ? evaluateAction(record)
    : { kind: "evaluate" as const, label: "Find the right assessment", to: "/assessments", rationale: "Assessment hub." };
  return [
    evaluate,
    {
      kind: "talk",
      label: "Talk to Joe",
      to: "/contact",
      rationale: "Governed conversation path.",
    },
  ];
}
