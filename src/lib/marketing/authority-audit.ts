// Search Authority Gate — sitewide URL state audit.
//
// Every indexable URL receives exactly one state. Advisory only: this module
// never executes a redirect, deletion, noindex change, or consolidation. It
// produces the decision record a human acts on.

import { indexableRecords, type SearchIntentRecord } from "./intent-map";
import { buildCannibalizationReport, type CannibalReport } from "./cannibalization";
import { buildAuthorityGraph, authorityNode, linkPlanFor, tierFor, TIER_LINK_BUDGET } from "./authority";
import { buildQualityGate, type PageQualityResult } from "./quality-gate";
import { validatePath } from "./rich-results";
import { LOCAL_PAGES } from "./local-pages";
import { ANSWERS } from "./answers";

export type UrlState = "KEEP" | "IMPROVE" | "CONSOLIDATE" | "NOINDEX" | "REDIRECT" | "REVIEW";

export type AuditDimension =
  | "cannibalization"
  | "duplicate-intent"
  | "weak-internal-links"
  | "orphan"
  | "overlinked-low-value"
  | "thin-content"
  | "missing-conversion-path"
  | "schema-content-mismatch"
  | "weak-provenance"
  | "no-strategic-purpose";

export interface AuditSignal {
  dimension: AuditDimension;
  severity: "info" | "warn" | "error";
  detail: string;
}

export interface UrlAudit {
  path: string;
  pageType: string;
  tier: ReturnType<typeof tierFor>;
  state: UrlState;
  rationale: string;
  signals: AuditSignal[];
  /** True when acting on this row requires an explicit human authorization. */
  requiresAuthorization: boolean;
}

const STATE_RANK: Record<UrlState, number> = {
  KEEP: 0,
  IMPROVE: 1,
  REVIEW: 2,
  CONSOLIDATE: 3,
  NOINDEX: 4,
  REDIRECT: 5,
};

function inboundCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const node of buildAuthorityGraph()) {
    const plan = linkPlanFor(node.path);
    if (!plan) continue;
    for (const target of [...plan.downward, ...plan.lateral, ...(plan.upward ? [plan.upward] : [])]) {
      counts.set(target, (counts.get(target) ?? 0) + 1);
    }
  }
  return counts;
}

function bodyDepth(record: SearchIntentRecord): number {
  const local = LOCAL_PAGES.find(p => p.path === record.path);
  if (local) {
    return (
      local.directAnswer.length +
      local.keyFactors.join(" ").length +
      local.localConsiderations.join(" ").length +
      local.decisionPath.join(" ").length
    );
  }
  const answer = ANSWERS.find(a => `/answers/${a.slug}` === record.path);
  if (answer) return answer.shortAnswer.length + answer.detail.length;
  return Number.POSITIVE_INFINITY; // hand-authored routes are reviewed elsewhere
}

export function auditUrl(
  record: SearchIntentRecord,
  ctx: {
    cannibal: CannibalReport;
    quality: PageQualityResult | undefined;
    inbound: Map<string, number>;
  },
): UrlAudit {
  const signals: AuditSignal[] = [];
  const finding = ctx.cannibal.findings.find(f => f.path === record.path);
  const plan = linkPlanFor(record.path);
  const node = authorityNode(record.path);
  const tier = tierFor(record);
  const inbound = ctx.inbound.get(record.path) ?? 0;
  const outbound = (plan?.downward.length ?? 0) + (plan?.lateral.length ?? 0) + (plan?.upward ? 1 : 0);

  let rank = 0;
  const escalate = (next: UrlState) => {
    if (STATE_RANK[next] > rank) rank = STATE_RANK[next];
  };
  const currentState = (): UrlState =>
    (Object.keys(STATE_RANK) as UrlState[]).find(k => STATE_RANK[k] === rank) ?? "KEEP";

  if (finding && finding.verdict !== "KEEP") {
    signals.push({
      dimension: "cannibalization",
      severity: finding.verdict === "DIFFERENTIATE" ? "warn" : "error",
      detail: `${finding.verdict}: ${finding.reason}`,
    });
    escalate(
      finding.verdict === "DIFFERENTIATE"
        ? "IMPROVE"
        : finding.verdict === "CONSOLIDATE"
          ? "CONSOLIDATE"
          : finding.verdict === "REDIRECT"
            ? "REDIRECT"
            : "NOINDEX",
    );
  }

  const twins = indexableRecords().filter(
    r => r.path !== record.path && r.primaryKeyword === record.primaryKeyword,
  );
  if (twins.length > 0) {
    signals.push({
      dimension: "duplicate-intent",
      severity: "error",
      detail: `Shares primary keyword "${record.primaryKeyword}" with ${twins.map(t => t.path).join(", ")}.`,
    });
    escalate("CONSOLIDATE");
  }

  if (inbound === 0) {
    signals.push({ dimension: "orphan", severity: "error", detail: "No internal page links to this URL in the deterministic link plan." });
    escalate("IMPROVE");
  } else if (inbound === 1 && tier !== "T4") {
    signals.push({ dimension: "weak-internal-links", severity: "warn", detail: `Only ${inbound} internal inbound link for a ${tier} page.` });
    escalate("IMPROVE");
  }

  const budget = TIER_LINK_BUDGET[tier];
  if (outbound > budget) {
    signals.push({
      dimension: "overlinked-low-value",
      severity: "warn",
      detail: `${outbound} outbound internal links exceeds the ${tier} budget of ${budget}.`,
    });
    escalate("IMPROVE");
  }

  const depth = bodyDepth(record);
  if (depth < 900) {
    signals.push({ dimension: "thin-content", severity: "error", detail: `Body depth ${depth} characters is below the 900-character floor for an indexable page.` });
    escalate("IMPROVE");
  }

  if (!record.cta || record.cta.trim().length === 0) {
    signals.push({ dimension: "missing-conversion-path", severity: "error", detail: "No conversion opportunity declared." });
    escalate("IMPROVE");
  } else if (!record.guideSlug && !record.assessmentSlug && record.pageType !== "utility" && record.pageType !== "trust") {
    signals.push({ dimension: "missing-conversion-path", severity: "warn", detail: "CTA present but no guide or assessment path." });
    escalate("REVIEW");
  }

  const schemaErrors = validatePath(record.path).filter(i => i.severity === "error");
  if (schemaErrors.length > 0) {
    signals.push({ dimension: "schema-content-mismatch", severity: "error", detail: schemaErrors.map(i => i.message).join("; ") });
    escalate("IMPROVE");
  }

  if (!record.lastReviewed) {
    signals.push({ dimension: "weak-provenance", severity: "error", detail: "No review date; author and editorial provenance cannot be rendered." });
    escalate("IMPROVE");
  }

  const purposeless =
    record.funnelStage === "awareness" &&
    !record.guideSlug &&
    !record.assessmentSlug &&
    (node?.weight ?? 0) < 20 &&
    record.pageType !== "trust" &&
    record.pageType !== "utility";
  if (purposeless) {
    signals.push({ dimension: "no-strategic-purpose", severity: "warn", detail: "Indexable but carries no downstream path and low authority score." });
    escalate("REVIEW");
  }

  const quality = ctx.quality;
  if (quality?.status === "FAIL") {
    signals.push({ dimension: "thin-content", severity: "error", detail: `Quality gate FAIL: ${quality.checks.filter(c => c.status === "FAIL").map(c => c.label).join(", ")}.` });
    escalate("IMPROVE");
  }

  const state = currentState();
  const rationale =
    state === "KEEP"
      ? "Distinct intent, linked, sufficient depth, valid schema, and a declared conversion path."
      : signals.map(s => s.detail).join(" ");

  return {
    path: record.path,
    pageType: record.pageType,
    tier,
    state,
    rationale,
    signals,
    requiresAuthorization: state === "CONSOLIDATE" || state === "REDIRECT" || state === "NOINDEX",
  };
}

export interface AuthorityAuditReport {
  generatedAt: string;
  urls: UrlAudit[];
  counts: Record<UrlState, number>;
  /** Rows that would change the live index if executed. Never auto-applied. */
  pendingAuthorization: UrlAudit[];
  dimensionCounts: Record<AuditDimension, number>;
  status: "PASS" | "REVIEW" | "BLOCKED";
  executed: false;
}

export function buildAuthorityAudit(now: Date = new Date()): AuthorityAuditReport {
  const cannibal = buildCannibalizationReport(now);
  const quality = buildQualityGate(now);
  const qualityByPath = new Map(quality.pages.map(p => [p.path, p]));
  const inbound = inboundCounts();

  const urls = indexableRecords().map(record =>
    auditUrl(record, { cannibal, quality: qualityByPath.get(record.path), inbound }),
  );

  const counts = { KEEP: 0, IMPROVE: 0, CONSOLIDATE: 0, NOINDEX: 0, REDIRECT: 0, REVIEW: 0 } as Record<UrlState, number>;
  for (const url of urls) counts[url.state] += 1;

  const dimensionCounts = {} as Record<AuditDimension, number>;
  for (const url of urls) {
    for (const signal of url.signals) {
      dimensionCounts[signal.dimension] = (dimensionCounts[signal.dimension] ?? 0) + 1;
    }
  }

  const structural = counts.CONSOLIDATE + counts.REDIRECT + counts.NOINDEX;
  return {
    generatedAt: now.toISOString(),
    urls,
    counts,
    pendingAuthorization: urls.filter(u => u.requiresAuthorization),
    dimensionCounts,
    status: structural > 0 ? "BLOCKED" : counts.IMPROVE + counts.REVIEW > 0 ? "REVIEW" : "PASS",
    executed: false,
  };
}
