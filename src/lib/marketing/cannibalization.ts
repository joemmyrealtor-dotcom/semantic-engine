// Search Authority Gate — cannibalization audit.
//
// Compares every indexable URL against every other for query-intent overlap,
// title/H1 similarity, semantic overlap, internal-link competition, canonical
// conflicts, and city/topic duplication.
//
// This module only FLAGS. It performs no redirects, no deletions, and no
// index changes. Acting on a verdict is a separate, authorized decision.

import { indexableRecords, type SearchIntentRecord } from "./intent-map";
import { absoluteUrl } from "./site";

export type CannibalVerdict = "KEEP" | "DIFFERENTIATE" | "CONSOLIDATE" | "NOINDEX" | "REDIRECT";

/**
 * How much a flagged overlap actually matters. A DIFFERENTIATE finding is not
 * uniformly serious: two pages sharing a head term with matching geography are
 * a real conflict, while a loose thematic overlap between a statewide
 * explainer and a city page is tolerable and needs no action before launch.
 */
export type CannibalizationSeverity = "CRITICAL" | "MATERIAL" | "ACCEPTABLE" | "NONE";

const SEVERITY_RANK: Record<CannibalizationSeverity, number> = {
  NONE: 0,
  ACCEPTABLE: 1,
  MATERIAL: 2,
  CRITICAL: 3,
};

const VERDICT_SEVERITY: Record<CannibalVerdict, number> = {
  KEEP: 0,
  DIFFERENTIATE: 1,
  CONSOLIDATE: 2,
  NOINDEX: 3,
  REDIRECT: 4,
};


const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "for", "on", "with", "my", "your", "i",
  "is", "are", "do", "does", "how", "what", "when", "should", "can", "it", "you", "we",
  "legacy", "forge", "jm", "advisory", "press",
]);

export function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP.has(w)),
  );
}

export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / new Set([...ta, ...tb]).size;
}

export interface CannibalPair {
  a: string;
  b: string;
  verdict: CannibalVerdict;
  titleSimilarity: number;
  h1Similarity: number;
  semanticOverlap: number;
  sameePrimaryIntent: boolean;
  samePrimaryKeyword: boolean;
  sameGeography: boolean;
  internalLinkCompetition: boolean;
  canonicalConflict: boolean;
  reason: string;
}

export interface CannibalFinding {
  url: string;
  path: string;
  pageType: string;
  verdict: CannibalVerdict;
  competitors: string[];
  reason: string;
}

export interface CannibalReport {
  generatedAt: string;
  comparedUrls: number;
  pairs: CannibalPair[];
  findings: CannibalFinding[];
  counts: Record<CannibalVerdict, number>;
  /** No automatic action is taken — always false in this build. */
  actionsApplied: boolean;
}

function semanticText(r: SearchIntentRecord): string {
  return [r.title, r.h1, r.primaryKeyword, ...r.secondaryKeywords, r.place ?? ""].join(" ");
}

function commercialWeight(r: SearchIntentRecord): number {
  const byStage = { conversion: 4, decision: 3, consideration: 2, awareness: 1 }[r.funnelStage];
  const byType = r.pageType === "situation-pillar" || r.pageType === "local-topic-hub" ? 2 : 0;
  return byStage + byType;
}

function comparePair(a: SearchIntentRecord, b: SearchIntentRecord): CannibalPair | null {
  const titleSimilarity = similarity(a.title, b.title);
  const h1Similarity = similarity(a.h1, b.h1);
  const semanticOverlap = similarity(semanticText(a), semanticText(b));
  const samePrimaryKeyword = a.primaryKeyword.trim() !== "" && a.primaryKeyword === b.primaryKeyword;
  const sameePrimaryIntent = a.intent === b.intent && a.funnelStage === b.funnelStage;
  const sameGeography = a.geographicIntent === b.geographicIntent && (a.place ?? "") === (b.place ?? "");
  const internalLinkCompetition =
    a.parentHub !== null && a.parentHub === b.parentHub && semanticOverlap >= 0.4;
  const canonicalConflict = absoluteUrl(a.path) === absoluteUrl(b.path);

  const overlapping = samePrimaryKeyword || semanticOverlap >= 0.4 || titleSimilarity >= 0.6;
  if (!overlapping) return null;

  let verdict: CannibalVerdict = "KEEP";
  let reason = "Overlap noted but each page holds a distinct intent.";

  if (canonicalConflict) {
    verdict = "REDIRECT";
    reason = "Two records resolve to the same canonical URL.";
  } else if (samePrimaryKeyword && sameGeography && titleSimilarity >= 0.8) {
    verdict = "REDIRECT";
    reason = "Same primary keyword, same geography, near-identical title.";
  } else if (samePrimaryKeyword && sameGeography && sameePrimaryIntent) {
    verdict = "CONSOLIDATE";
    reason = "Same keyword, geography, and funnel stage — one page should own the query.";
  } else if (semanticOverlap >= 0.7 && sameGeography) {
    verdict = "CONSOLIDATE";
    reason = "Semantic overlap above 0.70 with matching geography.";
  } else if (semanticOverlap >= 0.5 || (titleSimilarity >= 0.6 && sameGeography)) {
    verdict = "DIFFERENTIATE";
    reason = "Meaningful overlap; sharpen the angle, title, and internal anchors.";
  } else if (internalLinkCompetition) {
    verdict = "DIFFERENTIATE";
    reason = "Both pages compete for links from the same hub.";
  }

  return {
    a: a.path,
    b: b.path,
    verdict,
    titleSimilarity: round(titleSimilarity),
    h1Similarity: round(h1Similarity),
    semanticOverlap: round(semanticOverlap),
    sameePrimaryIntent,
    samePrimaryKeyword,
    sameGeography,
    internalLinkCompetition,
    canonicalConflict,
    reason,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildCannibalizationReport(now: Date = new Date()): CannibalReport {
  const records = indexableRecords();
  const pairs: CannibalPair[] = [];

  for (let i = 0; i < records.length; i += 1) {
    for (let j = i + 1; j < records.length; j += 1) {
      const pair = comparePair(records[i]!, records[j]!);
      if (pair && pair.verdict !== "KEEP") pairs.push(pair);
    }
  }

  const byPath = new Map<string, { verdict: CannibalVerdict; competitors: Set<string>; reason: string }>();
  for (const r of records) byPath.set(r.path, { verdict: "KEEP", competitors: new Set(), reason: "No competing page found." });

  for (const pair of pairs) {
    const a = records.find(r => r.path === pair.a)!;
    const b = records.find(r => r.path === pair.b)!;
    // The weaker commercial page absorbs the harsher verdict.
    const weaker = commercialWeight(a) <= commercialWeight(b) ? a : b;
    const stronger = weaker === a ? b : a;

    for (const [page, verdict] of [
      [weaker, pair.verdict] as const,
      [stronger, pair.verdict === "REDIRECT" || pair.verdict === "CONSOLIDATE" ? "DIFFERENTIATE" : pair.verdict] as const,
    ]) {
      const entry = byPath.get(page.path)!;
      entry.competitors.add(page === weaker ? stronger.path : weaker.path);
      if (VERDICT_SEVERITY[verdict] > VERDICT_SEVERITY[entry.verdict]) {
        entry.verdict = verdict;
        entry.reason = pair.reason;
      }
    }
  }

  const findings: CannibalFinding[] = records.map(r => {
    const entry = byPath.get(r.path)!;
    return {
      url: r.url,
      path: r.path,
      pageType: r.pageType,
      verdict: entry.verdict,
      competitors: [...entry.competitors].sort(),
      reason: entry.reason,
    };
  });

  const counts = findings.reduce(
    (acc, f) => ({ ...acc, [f.verdict]: acc[f.verdict] + 1 }),
    { KEEP: 0, DIFFERENTIATE: 0, CONSOLIDATE: 0, NOINDEX: 0, REDIRECT: 0 } as Record<CannibalVerdict, number>,
  );

  return {
    generatedAt: now.toISOString(),
    comparedUrls: records.length,
    pairs,
    findings,
    counts,
    actionsApplied: false,
  };
}

/** Pages that must be resolved by hand before launch. */
export function blockingCannibalization(report = buildCannibalizationReport()): CannibalFinding[] {
  return report.findings.filter(f => f.verdict === "REDIRECT" || f.verdict === "CONSOLIDATE");
}
