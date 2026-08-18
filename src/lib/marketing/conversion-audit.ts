// Client-acquisition readiness — 126-URL conversion path audit.
//
// Deterministic and advisory. It reads the intent map plus the governed next
// actions and reports whether every indexable URL can actually convert a
// visitor into a qualified conversation. It changes no route, adds no page,
// publishes nothing, and asserts no measured performance.

import { indexableRecords, type SearchIntentRecord } from "./intent-map";
import {
  isDirectContactHref,
  isHighIntent,
  isValidDestination,
  mobileConversionPaths,
  nextActionsFor,
  showsMobileConversionBar,
  type NextAction,
} from "./conversion-paths";
import { LICENSE } from "./positioning";
import { PUBLIC_LEGAL_NAV, PUBLIC_NAV } from "./content";

export type ConversionFinding =
  | "no-next-action"
  | "broken-cta-destination"
  | "high-intent-without-talk"
  | "high-intent-without-evaluate"
  | "educational-without-learn"
  | "self-referential-only"
  | "orphan"
  | "missing-mobile-cta";

export interface ConversionIssue {
  finding: ConversionFinding;
  severity: "warn" | "error";
  detail: string;
}

export interface PageConversionAudit {
  path: string;
  pageType: string;
  intent: SearchIntentRecord["intent"];
  funnelStage: SearchIntentRecord["funnelStage"];
  highIntent: boolean;
  actions: NextAction[];
  kinds: string[];
  hasTalkPath: boolean;
  hasEvaluatePath: boolean;
  hasLearnPath: boolean;
  mobileBar: boolean;
  issues: ConversionIssue[];
  status: "READY" | "REVIEW" | "BLOCKED";
}

export interface ConversionAuditReport {
  generatedAt: string;
  pages: PageConversionAudit[];
  total: number;
  ready: number;
  review: number;
  blocked: number;
  brokenCtaCount: number;
  orphanCount: number;
  highIntentPages: number;
  highIntentWithTalk: number;
  directContactCoverage: { phone: string; email: string; exposedOn: string[] };
  mobileCtaPaths: string[];
  findingCounts: Record<string, number>;
  status: "READY" | "REVIEW" | "BLOCKED";
}

function inboundMap(records: SearchIntentRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  // Shell navigation links every page in the primary and legal menus.
  for (const nav of [...PUBLIC_NAV, ...PUBLIC_LEGAL_NAV]) {
    counts.set(nav.to, (counts.get(nav.to) ?? 0) + 1);
  }
  // A hub renders its own children, so a declared parentHub is a real
  // inbound link from that hub to this page.
  for (const record of records) {
    if (record.parentHub && record.parentHub !== record.path) {
      counts.set(record.path, (counts.get(record.path) ?? 0) + 1);
    }
  }
  for (const record of records) {
    const targets = new Set<string>([
      ...record.supportingPages,
      ...(record.parentHub ? [record.parentHub] : []),
      ...nextActionsFor(record).map(a => a.to),
    ]);
    for (const target of targets) {
      if (target === record.path) continue;
      counts.set(target, (counts.get(target) ?? 0) + 1);
    }
  }
  return counts;
}

export function auditPageConversion(
  record: SearchIntentRecord,
  inbound: number,
): PageConversionAudit {
  const actions = nextActionsFor(record);
  const issues: ConversionIssue[] = [];
  const kinds = [...new Set(actions.map(a => a.kind))];
  const highIntent = isHighIntent(record);

  if (actions.length === 0) {
    issues.push({
      finding: "no-next-action",
      severity: "error",
      detail: "Indexable page exposes no governed next action.",
    });
  }

  for (const action of actions) {
    if (!isValidDestination(action.to)) {
      issues.push({
        finding: "broken-cta-destination",
        severity: "error",
        detail: `CTA "${action.label}" points at ${action.to}, which is not a governed public destination.`,
      });
    }
    if (action.to === record.path) {
      issues.push({
        finding: "self-referential-only",
        severity: "error",
        detail: `CTA "${action.label}" points back at this page.`,
      });
    }
  }

  const hasTalkPath = kinds.includes("talk");
  const hasEvaluatePath = kinds.includes("evaluate");
  const hasLearnPath = kinds.includes("learn");

  if (highIntent && !hasTalkPath) {
    issues.push({
      finding: "high-intent-without-talk",
      severity: "error",
      detail: "Decision-intent page offers no path into a conversation.",
    });
  }
  const isEvaluateHub = record.path === "/assessments";
  if (highIntent && !hasEvaluatePath && !isEvaluateHub && record.pageType !== "utility" && record.pageType !== "trust") {
    issues.push({
      finding: "high-intent-without-evaluate",
      severity: "error",
      detail: "Decision-intent page offers no structured self-evaluation path.",
    });
  }
  if (!highIntent && !hasLearnPath) {
    issues.push({
      finding: "educational-without-learn",
      severity: "warn",
      detail: "Educational page offers no further reading step.",
    });
  }

  if (inbound === 0) {
    issues.push({
      finding: "orphan",
      severity: "error",
      detail: "No other governed page routes a visitor to this URL.",
    });
  }

  const mobileBar = showsMobileConversionBar(record.path);
  if (highIntent && record.pageType !== "utility" && record.pageType !== "trust" && record.path !== "/contact" && !mobileBar) {
    issues.push({
      finding: "missing-mobile-cta",
      severity: "warn",
      detail: "High-intent page is not covered by the mobile conversion bar.",
    });
  }

  const hasError = issues.some(i => i.severity === "error");
  return {
    path: record.path,
    pageType: record.pageType,
    intent: record.intent,
    funnelStage: record.funnelStage,
    highIntent,
    actions,
    kinds,
    hasTalkPath,
    hasEvaluatePath,
    hasLearnPath,
    mobileBar,
    issues,
    status: hasError ? "BLOCKED" : issues.length > 0 ? "REVIEW" : "READY",
  };
}

export function buildConversionAudit(now: Date = new Date()): ConversionAuditReport {
  const records = indexableRecords();
  const inbound = inboundMap(records);
  const pages = records.map(r => auditPageConversion(r, inbound.get(r.path) ?? 0));

  const findingCounts: Record<string, number> = {};
  for (const page of pages) {
    for (const issue of page.issues) {
      findingCounts[issue.finding] = (findingCounts[issue.finding] ?? 0) + 1;
    }
  }

  const highIntentPages = pages.filter(p => p.highIntent);
  const exposedOn = pages
    .filter(p => p.actions.some(a => isDirectContactHref(a.to)))
    .map(p => p.path);

  const blocked = pages.filter(p => p.status === "BLOCKED").length;
  const review = pages.filter(p => p.status === "REVIEW").length;

  return {
    generatedAt: now.toISOString(),
    pages,
    total: pages.length,
    ready: pages.filter(p => p.status === "READY").length,
    review,
    blocked,
    brokenCtaCount: findingCounts["broken-cta-destination"] ?? 0,
    orphanCount: findingCounts["orphan"] ?? 0,
    highIntentPages: highIntentPages.length,
    highIntentWithTalk: highIntentPages.filter(p => p.hasTalkPath).length,
    directContactCoverage: { phone: LICENSE.phone, email: LICENSE.email, exposedOn },
    mobileCtaPaths: mobileConversionPaths(),
    findingCounts,
    status: blocked > 0 ? "BLOCKED" : review > 0 ? "REVIEW" : "READY",
  };
}
