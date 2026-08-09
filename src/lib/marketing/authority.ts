// Search Authority Gate — authority hierarchy and internal PageRank controls.
//
// Every content family gets one parent. Children link upward; hubs link down
// to their strongest children only. Internal link equity is deliberately
// unequal: commercial hubs and high-intent pages receive more contextual
// links than long-tail answer pages.

import { indexableRecords, getIntentRecord, type SearchIntentRecord } from "./intent-map";

export type AuthorityTier = "T1" | "T2" | "T3" | "T4";

/** Contextual internal links a page is entitled to receive, by tier. */
export const TIER_LINK_BUDGET: Record<AuthorityTier, number> = {
  T1: 12,
  T2: 8,
  T3: 4,
  T4: 2,
};

export const TIER_LABEL: Record<AuthorityTier, string> = {
  T1: "Commercial hub — maximum internal authority",
  T2: "High-intent conversion surface",
  T3: "Supporting content",
  T4: "Long-tail and utility",
};

export function tierFor(record: SearchIntentRecord): AuthorityTier {
  switch (record.pageType) {
    case "home":
    case "situation-pillar":
    case "local-topic-hub":
      return "T1";
    case "local-city":
    case "assessment":
    case "professional":
      return "T2";
    case "guide":
    case "local-hub":
    case "library-hub":
      return "T3";
    default:
      return "T4";
  }
}

export interface AuthorityNode {
  path: string;
  title: string;
  pageType: string;
  tier: AuthorityTier;
  parent: string | null;
  children: string[];
  /** Deterministic 0–100 share of internal link emphasis. */
  weight: number;
  linkBudget: number;
  /** Children this hub should link to, strongest first. */
  featuredChildren: string[];
  /** The upward link every child page must render. */
  upwardLink: string | null;
}

const TIER_WEIGHT: Record<AuthorityTier, number> = { T1: 100, T2: 65, T3: 40, T4: 15 };

const STAGE_BONUS: Record<SearchIntentRecord["funnelStage"], number> = {
  conversion: 15,
  decision: 10,
  consideration: 5,
  awareness: 0,
};

export function scoreAuthority(record: SearchIntentRecord): number {
  const tier = tierFor(record);
  const geo = record.geographicIntent === "city" ? 5 : record.geographicIntent === "county" ? 8 : 0;
  return Math.min(100, TIER_WEIGHT[tier] + STAGE_BONUS[record.funnelStage] + geo);
}

export function buildAuthorityGraph(): AuthorityNode[] {
  const records = indexableRecords();
  const childrenOf = new Map<string, SearchIntentRecord[]>();
  for (const r of records) {
    if (!r.parentHub) continue;
    if (!childrenOf.has(r.parentHub)) childrenOf.set(r.parentHub, []);
    childrenOf.get(r.parentHub)!.push(r);
  }

  return records.map(r => {
    const tier = tierFor(r);
    const kids = (childrenOf.get(r.path) ?? []).slice().sort((a, b) => scoreAuthority(b) - scoreAuthority(a));
    return {
      path: r.path,
      title: r.title,
      pageType: r.pageType,
      tier,
      parent: r.parentHub,
      children: kids.map(k => k.path),
      weight: scoreAuthority(r),
      linkBudget: TIER_LINK_BUDGET[tier],
      featuredChildren: kids.slice(0, tier === "T1" ? 6 : 3).map(k => k.path),
      upwardLink: r.parentHub,
    };
  });
}

export function authorityNode(path: string): AuthorityNode | undefined {
  return buildAuthorityGraph().find(n => n.path === path);
}

export interface AuthorityIssue {
  path: string;
  issue: string;
}

/** Structural problems in the hierarchy — orphans, missing parents, cycles. */
export function authorityIssues(): AuthorityIssue[] {
  const nodes = buildAuthorityGraph();
  const known = new Set(nodes.map(n => n.path));
  const issues: AuthorityIssue[] = [];

  for (const node of nodes) {
    if (node.parent === null && node.path !== "/home") {
      issues.push({ path: node.path, issue: "No parent hub declared." });
      continue;
    }
    if (node.parent && !known.has(node.parent)) {
      issues.push({ path: node.path, issue: `Parent hub ${node.parent} is not an indexable page.` });
    }
    // Cycle detection walking upward.
    const seen = new Set<string>([node.path]);
    let cursor = node.parent;
    let depth = 0;
    while (cursor && depth < 12) {
      if (seen.has(cursor)) {
        issues.push({ path: node.path, issue: `Hierarchy cycle through ${cursor}.` });
        break;
      }
      seen.add(cursor);
      cursor = getIntentRecord(cursor)?.parentHub ?? null;
      depth += 1;
    }
  }
  return issues;
}

export interface LinkEquityRow {
  tier: AuthorityTier;
  label: string;
  pages: number;
  /** Share of total internal link emphasis, 0–1. */
  share: number;
}

/** Proof that link equity is concentrated, not spread evenly across 126 URLs. */
export function linkEquityDistribution(): LinkEquityRow[] {
  const nodes = buildAuthorityGraph();
  const total = nodes.reduce((sum, n) => sum + n.weight, 0) || 1;
  const tiers: AuthorityTier[] = ["T1", "T2", "T3", "T4"];
  return tiers.map(tier => {
    const rows = nodes.filter(n => n.tier === tier);
    return {
      tier,
      label: TIER_LABEL[tier],
      pages: rows.length,
      share: Math.round((rows.reduce((s, n) => s + n.weight, 0) / total) * 1000) / 1000,
    };
  });
}

/** The deterministic link plan a page should render. */
export interface LinkPlan {
  path: string;
  upward: string | null;
  downward: string[];
  lateral: string[];
  conversion: string[];
}

export function linkPlanFor(path: string): LinkPlan | null {
  const record = getIntentRecord(path);
  const node = authorityNode(path);
  if (!record || !node) return null;
  return {
    path,
    upward: node.upwardLink,
    downward: node.featuredChildren,
    lateral: record.supportingPages.filter(p => p !== node.upwardLink).slice(0, 4),
    conversion: [
      ...(record.assessmentSlug ? [`/assessments/${record.assessmentSlug}`] : []),
      "/contact",
    ],
  };
}
