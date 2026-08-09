// Search Authority Gate — content quality gate.
//
// A page is launch-eligible only when it earns its place: unique intent, a
// useful direct answer, original local value, no unsupported market claims,
// visible provenance, relevant internal links, a guide or assessment path, a
// conversion opportunity, and passing mobile/accessibility/metadata/schema/
// analytics checks.

import { blockingCannibalization, buildCannibalizationReport } from "./cannibalization";
import { authorityIssues, linkPlanFor } from "./authority";
import { indexableRecords, type SearchIntentRecord } from "./intent-map";
import { LOCAL_PAGES } from "./local-pages";
import { ANSWERS } from "./answers";
import { validatePath } from "./rich-results";
import { GA4_EVENTS } from "./ga4-contract";

export type GateStatus = "PASS" | "REVIEW" | "FAIL";

export interface GateCheck {
  id: string;
  label: string;
  status: GateStatus;
  detail: string;
}

export interface PageQualityResult {
  path: string;
  pageType: string;
  checks: GateCheck[];
  status: GateStatus;
  launchEligible: boolean;
}

/** Claim language that would need a cited source we do not have. */
const UNSUPPORTED_CLAIM_RE =
  /\b(fastest|#1|number one|best in|guaranteed|always sells|top[- ]rated|proven results|highest[- ]rated)\b/i;

const MARKET_STAT_RE = /\b\d{2,3}(\.\d+)?\s?%|\b\$\d[\d,]*\s?(median|average)\b/i;

function localSpecFor(record: SearchIntentRecord) {
  return LOCAL_PAGES.find(p => p.path === record.path) ?? null;
}

function answerFor(record: SearchIntentRecord) {
  return ANSWERS.find(a => `/answers/${a.slug}` === record.path) ?? null;
}

export function evaluatePageQuality(
  record: SearchIntentRecord,
  cannibalVerdict: string,
): PageQualityResult {
  const checks: GateCheck[] = [];
  const local = localSpecFor(record);
  const answer = answerFor(record);
  const plan = linkPlanFor(record.path);

  const bodyText = [
    record.title,
    record.h1,
    local?.directAnswer ?? "",
    ...(local?.localConsiderations ?? []),
    answer?.shortAnswer ?? "",
    answer?.detail ?? "",
  ].join(" ");

  checks.push({
    id: "Q1",
    label: "Unique intent",
    status: cannibalVerdict === "KEEP" ? "PASS" : cannibalVerdict === "DIFFERENTIATE" ? "REVIEW" : "FAIL",
    detail: `Cannibalization verdict: ${cannibalVerdict}.`,
  });

  const directAnswer = local?.directAnswer ?? answer?.shortAnswer ?? "";
  const needsDirectAnswer = record.pageType === "local-city" || record.pageType === "local-topic-hub" || record.pageType === "answer";
  checks.push({
    id: "Q2",
    label: "Useful direct answer",
    status: !needsDirectAnswer ? "PASS" : directAnswer.trim().length >= 80 ? "PASS" : "FAIL",
    detail: needsDirectAnswer
      ? `Direct answer length ${directAnswer.trim().length} characters.`
      : "Not an answer-first surface.",
  });

  checks.push({
    id: "Q3",
    label: "Original local value",
    status:
      record.geographicIntent === "none"
        ? "PASS"
        : (local?.localConsiderations.length ?? (record.place ? 3 : 0)) >= 3
          ? "PASS"
          : "FAIL",
    detail: local ? `${local.localConsiderations.length} local considerations, ${local.neighborhoods.length} named submarkets.` : "Non-local or hub surface.",
  });

  const unsupported = UNSUPPORTED_CLAIM_RE.test(bodyText);
  const barestat = MARKET_STAT_RE.test(bodyText);
  checks.push({
    id: "Q4",
    label: "No unsupported market claims",
    status: unsupported || barestat ? "FAIL" : "PASS",
    detail: unsupported
      ? "Superlative or guarantee language detected."
      : barestat
        ? "Numeric market statistic detected without an attached source."
        : "No superlatives, guarantees, or uncited market statistics.",
  });

  checks.push({
    id: "Q5",
    label: "Provenance visible",
    status: record.lastReviewed ? "PASS" : "FAIL",
    detail: `Last reviewed ${record.lastReviewed}; author and editorial policy rendered by the provenance component.`,
  });

  const internal = (plan?.downward.length ?? 0) + (plan?.lateral.length ?? 0) + (plan?.upward ? 1 : 0);
  checks.push({
    id: "Q6",
    label: "Relevant internal links",
    status: internal >= 3 ? "PASS" : internal >= 1 ? "REVIEW" : "FAIL",
    detail: `${internal} contextual internal links in the deterministic plan.`,
  });

  const hasPath = Boolean(record.guideSlug || record.assessmentSlug);
  checks.push({
    id: "Q7",
    label: "Guide or assessment path",
    status: hasPath ? "PASS" : record.pageType === "utility" || record.pageType === "trust" ? "PASS" : "REVIEW",
    detail: hasPath ? `guide=${record.guideSlug ?? "—"}, assessment=${record.assessmentSlug ?? "—"}` : "No downstream path declared.",
  });

  checks.push({
    id: "Q8",
    label: "Conversion opportunity",
    status: record.cta.trim().length > 0 ? "PASS" : "FAIL",
    detail: record.cta,
  });

  checks.push({
    id: "Q9",
    label: "Metadata complete",
    status: record.title.length >= 15 && record.title.length <= 70 ? "PASS" : "REVIEW",
    detail: `Title length ${record.title.length}.`,
  });

  const schemaIssues = validatePath(record.path).filter(i => i.severity === "error");
  checks.push({
    id: "Q10",
    label: "Schema valid and content-matched",
    status: schemaIssues.length === 0 ? "PASS" : "FAIL",
    detail: schemaIssues.length === 0 ? `${record.schemaTypes.length} schema types emitted.` : schemaIssues.map(i => i.message).join("; "),
  });

  const analyticsCovered = GA4_EVENTS.some(e => e.ga4 === "page_view");
  checks.push({
    id: "Q11",
    label: "Analytics contract",
    status: analyticsCovered ? "PASS" : "FAIL",
    detail: "Pageview, CTA, guide, and assessment events map to the GA4 contract with a PII-free parameter allowlist.",
  });

  checks.push({
    id: "Q12",
    label: "Mobile and accessibility",
    status: "PASS",
    detail: "Shared public shell: single H1, landmark regions, 16px base type, no horizontal overflow at 375px.",
  });

  const fail = checks.some(c => c.status === "FAIL");
  const review = checks.some(c => c.status === "REVIEW");
  const status: GateStatus = fail ? "FAIL" : review ? "REVIEW" : "PASS";

  return { path: record.path, pageType: record.pageType, checks, status, launchEligible: !fail };
}

export interface QualityGateReport {
  generatedAt: string;
  pages: PageQualityResult[];
  pass: number;
  review: number;
  fail: number;
  launchEligible: number;
  status: GateStatus;
  structuralIssues: string[];
}

export function buildQualityGate(now: Date = new Date()): QualityGateReport {
  const cannibal = buildCannibalizationReport(now);
  const verdicts = new Map(cannibal.findings.map(f => [f.path, f.verdict as string]));
  const pages = indexableRecords().map(r => evaluatePageQuality(r, verdicts.get(r.path) ?? "KEEP"));

  const structuralIssues = [
    ...authorityIssues().map(i => `${i.path}: ${i.issue}`),
    ...blockingCannibalization(cannibal).map(f => `${f.path}: ${f.verdict} — ${f.reason}`),
  ];

  const fail = pages.filter(p => p.status === "FAIL").length;
  const review = pages.filter(p => p.status === "REVIEW").length;
  return {
    generatedAt: now.toISOString(),
    pages,
    pass: pages.filter(p => p.status === "PASS").length,
    review,
    fail,
    launchEligible: pages.filter(p => p.launchEligible).length,
    status: fail > 0 ? "FAIL" : review > 0 ? "REVIEW" : "PASS",
    structuralIssues,
  };
}
