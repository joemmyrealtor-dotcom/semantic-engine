/**
 * Workstream 6 — Knowledge Intelligence
 *
 * Read-only analysis over canonical assets. Does NOT mutate the repository,
 * duplicate entities, or replace the graph. Every function accepts an existing
 * DataSnapshot and returns typed intelligence records.
 */

import type {
  DataSnapshot, Concept, Framework, KnowledgeObject, ClientTool,
  PublicationBlueprint, ChapterBlueprint, ClientToolkit, AIPack, Agent,
  AutomationRecipe, Release, Status, ManufacturingStage,
} from "./schema";
import {
  buildGraph, detectBrokenReferences,
  publicationCoverage, toolkitCoverage, aiPackCoverage, agentCoverage,
} from "./service";
import { memoize } from "./performance";
import { fingerprint } from "./security";

// W9 #7 — Snapshot-fingerprinted memoization for hot derived reads.
// Cache key is a cheap non-crypto fingerprint of the counts of every
// entity list; when any count changes, cache misses and recomputes.
// Snapshot-identity keys (WeakMap) would be stricter but the seed
// harness/validation suite reuses object identity across mutations.
function snapKey(s: DataSnapshot): string {
  return fingerprint([
    s.schemaVersion, s.activeWorkspaceId,
    s.domains.length, s.concepts.length, s.frameworks.length,
    s.knowledgeObjects.length, s.clientTools.length, s.publications.length,
    s.clientToolkits.length, s.aiPacks.length, s.agents.length,
    s.automations.length, s.releases.length, s.auditEvents.length,
  ].join("|"));
}
const memoBuildGraph = memoize("intelligence.buildGraph", (_k: string, s: DataSnapshot) => buildGraph(s), 16);
const cachedBuildGraph = (s: DataSnapshot) => memoBuildGraph(snapKey(s), s);


// ============================================================
// PHASE 1/2 — Universal asset registry & search
// ============================================================

export type UniversalKind =
  | "Concept" | "Framework" | "Knowledge Object" | "Publication" | "Chapter"
  | "Client Toolkit" | "AI Pack" | "Agent" | "Automation" | "Release"
  | "Evaluation" | "Presentation" | "Client Tool" | "Prompt" | "Domain";

export interface UniversalAsset {
  id: string;
  kind: UniversalKind;
  title: string;
  description: string;
  owner: string;
  status: Status | string;
  stage: ManufacturingStage | string | null;
  tags: string[];
  keywords: string[];
  updatedAt: string;
  /** Concatenated haystack for full-text search. */
  haystack: string;
  /** Route path for detail navigation. */
  routeTo: string | null;
  routeParams: Record<string, string> | null;
  parentId: string | null;
}

function pushKw(...vals: (string | string[] | undefined | null)[]): string[] {
  const out: string[] = [];
  for (const v of vals) {
    if (!v) continue;
    if (Array.isArray(v)) out.push(...v);
    else out.push(v);
  }
  return out.filter(Boolean);
}

/** Build a flat, searchable index of every canonical asset. */
export function buildUniversalIndex(s: DataSnapshot): UniversalAsset[] {
  const out: UniversalAsset[] = [];
  const H = (parts: (string | undefined | null)[]) =>
    parts.filter(Boolean).join(" \u2022 ").toLowerCase();

  for (const d of s.domains) {
    out.push({
      id: d.id, kind: "Domain", title: d.name, description: d.summary,
      owner: d.steward, status: d.status, stage: null,
      tags: [], keywords: [d.name],
      updatedAt: d.updatedAt,
      haystack: H([d.id, d.name, d.summary, d.steward]),
      routeTo: "/repository", routeParams: null, parentId: null,
    });
  }

  for (const c of s.concepts) {
    out.push({
      id: c.id, kind: "Concept", title: c.canonicalName, description: c.canonicalDefinition,
      owner: c.steward, status: c.status, stage: c.manufacturingStatus,
      tags: c.aiRetrievalTags, keywords: pushKw(c.aliases, c.keywords),
      updatedAt: c.updatedAt,
      haystack: H([c.id, c.canonicalName, c.canonicalDefinition, c.purpose, c.scope, ...c.aliases, ...c.keywords, ...c.aiRetrievalTags, c.steward]),
      routeTo: "/concepts/$id", routeParams: { id: c.id }, parentId: null,
    });
  }

  for (const f of s.frameworks) {
    out.push({
      id: f.id, kind: "Framework", title: f.name, description: f.mission,
      owner: f.steward, status: f.status, stage: null,
      tags: [], keywords: pushKw(f.inputs, f.outputs),
      updatedAt: f.updatedAt,
      haystack: H([f.id, f.name, f.mission, f.decisionSolved, ...f.inputs, ...f.outputs, ...f.decisionFlow, f.steward]),
      routeTo: "/frameworks/$id", routeParams: { id: f.id }, parentId: null,
    });
  }

  for (const k of s.knowledgeObjects) {
    out.push({
      id: k.id, kind: "Knowledge Object", title: k.title, description: k.body.slice(0, 240),
      owner: k.steward, status: k.status, stage: null,
      tags: [k.type], keywords: [k.audience],
      updatedAt: k.updatedAt,
      haystack: H([k.id, k.title, k.body, k.type, k.audience, k.steward]),
      routeTo: "/repository", routeParams: null, parentId: null,
    });
  }

  for (const t of s.clientTools) {
    out.push({
      id: t.id, kind: "Client Tool", title: t.name, description: t.purpose,
      owner: t.steward, status: t.status, stage: null,
      tags: [t.kind], keywords: [],
      updatedAt: t.updatedAt,
      haystack: H([t.id, t.name, t.purpose, t.kind, t.steward]),
      routeTo: "/repository", routeParams: null, parentId: null,
    });
  }

  for (const p of s.publications) {
    out.push({
      id: p.id, kind: "Publication", title: p.title, description: p.description || p.purpose,
      owner: p.owner || p.steward, status: p.status, stage: p.manufacturingStage,
      tags: p.tags, keywords: [p.publicationType, p.audience],
      updatedAt: p.updatedAt,
      haystack: H([p.id, p.title, p.description, p.purpose, p.audience, p.publicationType, ...p.tags, p.owner, p.steward]),
      routeTo: "/publications/$id", routeParams: { id: p.id }, parentId: null,
    });
    for (const ch of p.chapters) {
      out.push({
        id: ch.id, kind: "Chapter", title: ch.title, description: ch.description,
        owner: p.owner || p.steward, status: ch.reviewStatus, stage: ch.manufacturingStage,
        tags: [], keywords: ch.learningObjectives,
        updatedAt: p.updatedAt,
        haystack: H([ch.id, ch.title, ch.description, ...ch.learningObjectives, ch.editorialNotes]),
        routeTo: "/publications/$id", routeParams: { id: p.id }, parentId: p.id,
      });
    }
  }

  for (const tk of s.clientToolkits ?? []) {
    out.push({
      id: tk.id, kind: "Client Toolkit", title: tk.title, description: tk.description || tk.purpose,
      owner: tk.owner || tk.steward, status: tk.status, stage: tk.manufacturingStage,
      tags: tk.tags, keywords: [tk.toolkitType, tk.clientSegment, tk.audience],
      updatedAt: tk.updatedAt,
      haystack: H([tk.id, tk.title, tk.description, tk.purpose, tk.audience, tk.toolkitType, tk.clientSegment, ...tk.tags]),
      routeTo: "/client-toolkits/$id", routeParams: { id: tk.id }, parentId: null,
    });
  }

  for (const ap of s.aiPacks ?? []) {
    out.push({
      id: ap.id, kind: "AI Pack", title: ap.title, description: ap.description || ap.purpose,
      owner: ap.owner || ap.steward, status: ap.manufacturingStage, stage: ap.manufacturingStage,
      tags: ap.tags, keywords: [ap.useCase, ap.targetModel],
      updatedAt: ap.updatedAt,
      haystack: H([ap.id, ap.title, ap.description, ap.purpose, ap.useCase, ap.systemInstructions, ap.usagePolicy, ap.boundaryConditions, ...ap.tags]),
      routeTo: "/ai-packs/$id", routeParams: { id: ap.id }, parentId: null,
    });
    for (const ev of ap.evaluationCases) {
      out.push({
        id: ev.id, kind: "Evaluation", title: ev.title,
        description: ev.scenario, owner: ap.owner || ap.steward,
        status: ev.reviewerStatus, stage: null, tags: [], keywords: [],
        updatedAt: ap.updatedAt,
        haystack: H([ev.id, ev.title, ev.scenario, ev.expectedBehavior, ev.prohibitedBehavior]),
        routeTo: "/ai-packs/$id", routeParams: { id: ap.id }, parentId: ap.id,
      });
    }
  }

  for (const ag of s.agents ?? []) {
    out.push({
      id: ag.id, kind: "Agent", title: ag.name, description: ag.description || ag.purpose,
      owner: ag.owner || ag.steward, status: ag.status, stage: ag.manufacturingStage,
      tags: ag.tags, keywords: [ag.useCase, ag.targetModel, ag.role],
      updatedAt: ag.updatedAt,
      haystack: H([ag.id, ag.name, ag.description, ag.purpose, ag.role, ag.useCase, ag.usagePolicy, ag.boundaryConditions, ...ag.tags]),
      routeTo: "/agents/$id", routeParams: { id: ag.id }, parentId: null,
    });
  }

  for (const pr of s.prompts) {
    out.push({
      id: pr.id, kind: "Prompt", title: pr.name, description: pr.purpose,
      owner: pr.steward, status: pr.status, stage: null,
      tags: [pr.family], keywords: pushKw(pr.inputs, pr.outputs),
      updatedAt: pr.updatedAt,
      haystack: H([pr.id, pr.name, pr.purpose, pr.template, pr.family, ...pr.inputs, ...pr.outputs]),
      routeTo: "/prompts", routeParams: null, parentId: null,
    });
  }

  for (const a of s.automations ?? []) {
    out.push({
      id: a.id, kind: "Automation", title: a.name, description: a.description,
      owner: a.owner || a.steward, status: a.state, stage: null,
      tags: a.tags, keywords: [a.trigger.kind],
      updatedAt: a.updatedAt,
      haystack: H([a.id, a.name, a.description, a.trigger.kind, ...a.tags, ...a.steps.map(x => x.action)]),
      routeTo: "/automations/$id", routeParams: { id: a.id }, parentId: null,
    });
  }

  for (const r of s.releases) {
    out.push({
      id: r.id, kind: "Release", title: r.name, description: r.releaseNotes,
      owner: r.steward, status: r.stage, stage: null, tags: [],
      keywords: [r.version],
      updatedAt: r.updatedAt,
      haystack: H([r.id, r.name, r.releaseNotes, r.stage, r.version, r.validationSummary]),
      routeTo: "/releases/$id", routeParams: { id: r.id }, parentId: null,
    });
  }

  // Presentation links surfaced from publications & toolkits.
  const seenPres = new Set<string>();
  const addPres = (id: string, title: string, url: string, kind: string, updatedAt: string, parent: string) => {
    if (seenPres.has(id)) return;
    seenPres.add(id);
    out.push({
      id, kind: "Presentation", title, description: `${kind} · ${url}`,
      owner: "", status: "", stage: null, tags: [kind], keywords: [],
      updatedAt, haystack: H([id, title, url, kind, parent]),
      routeTo: null, routeParams: null, parentId: parent,
    });
  };
  for (const p of s.publications) for (const pl of p.presentations) addPres(pl.id, pl.title, pl.url, pl.kind, p.updatedAt, p.id);
  for (const tk of s.clientToolkits ?? []) for (const pl of tk.presentations) addPres(pl.id, pl.title, pl.url, pl.kind, tk.updatedAt, tk.id);

  return out;
}

// ============================================================
// PHASE 2 — Universal search (ranked)
// ============================================================

export interface SearchHit {
  asset: UniversalAsset;
  score: number;
  matchedFields: string[];
  highlight: string;
}

export interface SearchOptions {
  kinds?: UniversalKind[];
  owners?: string[];
  stages?: string[];
  statuses?: string[];
  limit?: number;
}

export function universalSearch(index: UniversalAsset[], query: string, opts: SearchOptions = {}): SearchHit[] {
  const q = query.trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  const kinds = opts.kinds ? new Set(opts.kinds) : null;
  const owners = opts.owners ? new Set(opts.owners) : null;
  const stages = opts.stages ? new Set(opts.stages) : null;
  const statuses = opts.statuses ? new Set(opts.statuses) : null;

  const hits: SearchHit[] = [];
  for (const asset of index) {
    if (kinds && !kinds.has(asset.kind)) continue;
    if (owners && !owners.has(asset.owner)) continue;
    if (stages && asset.stage && !stages.has(String(asset.stage))) continue;
    if (statuses && !statuses.has(String(asset.status))) continue;

    if (!q) { hits.push({ asset, score: 0, matchedFields: [], highlight: "" }); continue; }

    let score = 0;
    const matched: string[] = [];
    const idL = asset.id.toLowerCase();
    const titleL = asset.title.toLowerCase();

    for (const t of terms) {
      if (idL === t) { score += 100; matched.push("id"); }
      else if (idL.includes(t)) { score += 40; matched.push("id"); }
      if (titleL === t) { score += 80; matched.push("title"); }
      else if (titleL.startsWith(t)) { score += 50; matched.push("title"); }
      else if (titleL.includes(t)) { score += 25; matched.push("title"); }
      if (asset.tags.some(x => x.toLowerCase().includes(t))) { score += 15; matched.push("tag"); }
      if (asset.keywords.some(x => x.toLowerCase().includes(t))) { score += 12; matched.push("keyword"); }
      if (asset.haystack.includes(t)) { score += 5; matched.push("body"); }
    }
    if (score === 0) continue;

    // Build highlight snippet around first hit in haystack.
    const first = asset.haystack.indexOf(terms[0]);
    const raw = asset.description || asset.title;
    let highlight = raw.slice(0, 200);
    if (first >= 0) {
      const start = Math.max(0, first - 40);
      highlight = "…" + asset.haystack.slice(start, start + 200) + "…";
    }

    hits.push({ asset, score, matchedFields: Array.from(new Set(matched)), highlight });
  }

  hits.sort((a, b) => b.score - a.score || a.asset.id.localeCompare(b.asset.id));
  return opts.limit ? hits.slice(0, opts.limit) : hits;
}

// ============================================================
// PHASE 3/4 — Relationship inspector & Impact analysis
// ============================================================

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export interface RelationshipEdge { from: string; to: string; kind: string }
export interface RelationshipInspection {
  assetId: string;
  incoming: RelationshipEdge[];
  outgoing: RelationshipEdge[];
  neighborKinds: Record<string, number>;
  edgeKinds: Record<string, number>;
}

export function inspectRelationships(assetId: string, s: DataSnapshot): RelationshipInspection {
  const g = cachedBuildGraph(s);
  const incoming = g.edges.filter(e => e.to === assetId);
  const outgoing = g.edges.filter(e => e.from === assetId);
  const nodeById = new Map(g.nodes.map(n => [n.id, n] as const));
  const neighborKinds: Record<string, number> = {};
  const edgeKinds: Record<string, number> = {};
  for (const e of [...incoming, ...outgoing]) {
    edgeKinds[e.kind] = (edgeKinds[e.kind] ?? 0) + 1;
    const other = e.from === assetId ? e.to : e.from;
    const k = nodeById.get(other)?.kind ?? "Unknown";
    neighborKinds[k] = (neighborKinds[k] ?? 0) + 1;
  }
  return { assetId, incoming, outgoing, neighborKinds, edgeKinds };
}

export interface ImpactAnalysis {
  assetId: string;
  dependsOn: string[];        // Assets THIS depends on (outgoing).
  dependedOnBy: string[];     // Assets that depend on THIS (incoming).
  affectedReleases: string[];
  affectedAgents: string[];
  affectedToolkits: string[];
  affectedPublications: string[];
  affectedAutomations: string[];
  affectedAIPacks: string[];
  affectedChapters: string[];
  risk: RiskLevel;
  riskScore: number;
  reasons: string[];
}

/** Trace all downstream assets that would be impacted by change to `assetId`. */
export function impactAnalysis(assetId: string, s: DataSnapshot): ImpactAnalysis {
  const g = cachedBuildGraph(s);
  const inbound = new Map<string, string[]>();
  const outbound = new Map<string, string[]>();
  for (const e of g.edges) {
    if (!inbound.has(e.to)) inbound.set(e.to, []);
    inbound.get(e.to)!.push(e.from);
    if (!outbound.has(e.from)) outbound.set(e.from, []);
    outbound.get(e.from)!.push(e.to);
  }

  // Downstream BFS: everyone whose outgoing edge points at me (they depend on me).
  const dependedOnBy = new Set<string>();
  const dependsOn = new Set<string>();
  const bfs = (start: string, map: Map<string, string[]>, sink: Set<string>) => {
    const q = [start];
    const seen = new Set<string>([start]);
    while (q.length) {
      const cur = q.shift()!;
      for (const n of map.get(cur) ?? []) {
        if (seen.has(n)) continue;
        seen.add(n); sink.add(n); q.push(n);
      }
    }
  };
  bfs(assetId, inbound, dependedOnBy);
  bfs(assetId, outbound, dependsOn);

  const nodeById = new Map(g.nodes.map(n => [n.id, n] as const));
  const bucket = (kind: string) =>
    [...dependedOnBy].filter(id => nodeById.get(id)?.kind === kind);
  const affectedReleases = bucket("Release");
  const affectedAgents = bucket("Agent");
  const affectedToolkits = bucket("Client Toolkit");
  const affectedPublications = bucket("Publication");
  const affectedAutomations = bucket("Automation");
  const affectedAIPacks = bucket("AI Pack");
  const affectedChapters = bucket("Chapter");

  // Risk scoring: canonical downstream + release footprint.
  let riskScore = 0;
  const reasons: string[] = [];
  const canonicalTargets: string[] = [];
  for (const id of dependedOnBy) {
    const p = s.publications.find(x => x.id === id);
    if (p?.manufacturingStage === "Canonical" || p?.manufacturingStage === "Released") canonicalTargets.push(id);
    const tk = s.clientToolkits?.find(x => x.id === id);
    if (tk?.manufacturingStage === "Canonical" || tk?.manufacturingStage === "Released") canonicalTargets.push(id);
    const ap = s.aiPacks?.find(x => x.id === id);
    if (ap?.manufacturingStage === "Canonical" || ap?.manufacturingStage === "Released") canonicalTargets.push(id);
    const ag = s.agents?.find(x => x.id === id);
    if (ag?.manufacturingStage === "Canonical" || ag?.manufacturingStage === "Released") canonicalTargets.push(id);
  }
  riskScore += affectedReleases.length * 25;
  riskScore += canonicalTargets.length * 8;
  riskScore += affectedAgents.length * 4;
  riskScore += affectedToolkits.length * 3;
  riskScore += affectedPublications.length * 3;
  riskScore += affectedAIPacks.length * 4;
  riskScore += affectedAutomations.length * 2;

  if (affectedReleases.length > 0) reasons.push(`${affectedReleases.length} release(s) reference this asset`);
  if (canonicalTargets.length > 0) reasons.push(`${canonicalTargets.length} canonical downstream asset(s)`);
  if (affectedAgents.length > 0) reasons.push(`${affectedAgents.length} agent(s) depend on this asset`);
  if (dependedOnBy.size === 0) reasons.push("No downstream dependents");

  const risk: RiskLevel =
    riskScore >= 60 ? "Critical" :
    riskScore >= 30 ? "High" :
    riskScore >= 10 ? "Medium" : "Low";

  return {
    assetId,
    dependsOn: [...dependsOn],
    dependedOnBy: [...dependedOnBy],
    affectedReleases, affectedAgents, affectedToolkits, affectedPublications,
    affectedAutomations, affectedAIPacks, affectedChapters,
    risk, riskScore, reasons,
  };
}

// ============================================================
// PHASE 5 — Knowledge Health
// ============================================================

export interface HealthScore {
  overall: number;              // 0..100
  brokenReferences: number;
  duplicateReferences: number;
  coverage: number;             // 0..100
  freshness: number;            // 0..100
  reviewStatus: number;         // 0..100
  documentation: number;        // 0..100
  validation: number;           // 0..100
  evaluationCoverage: number;   // 0..100
  automationCoverage: number;   // 0..100
  relationshipCompleteness: number; // 0..100
  recommendations: string[];
  breakdown: Record<string, number>;
}

export function knowledgeHealth(s: DataSnapshot): HealthScore {
  const broken = detectBrokenReferences(s);
  const brokenReferences = broken.length;

  // Duplicates across all publications & toolkits (aggregate).
  let duplicateReferences = 0;
  for (const p of s.publications) duplicateReferences += publicationCoverage(p, s).duplicateReferences.length;
  for (const tk of s.clientToolkits ?? []) duplicateReferences += toolkitCoverage(tk, s).duplicateReferences.length;

  // Coverage: average readiness across canonical-track assets.
  const scores: number[] = [];
  for (const p of s.publications) if (!p.archived) scores.push(publicationCoverage(p, s).readinessScore);
  for (const tk of s.clientToolkits ?? []) if (!tk.archived) scores.push(toolkitCoverage(tk, s).readinessScore);
  for (const ap of s.aiPacks ?? []) if (!ap.archived) scores.push(aiPackCoverage(ap, s).readinessScore);
  for (const ag of s.agents ?? []) if (!ag.archived) scores.push(agentCoverage(ag, s).readinessScore);
  const coverage = scores.length === 0 ? 100 : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  // Freshness: % concepts reviewed within cadence.
  const now = Date.now();
  const fresh = s.concepts.filter(c => {
    if (!c.lastReviewedAt) return false;
    const age = now - new Date(c.lastReviewedAt).getTime();
    return age <= c.reviewCadenceMonths * 30 * 24 * 3600 * 1000;
  }).length;
  const freshness = s.concepts.length === 0 ? 100 : Math.round((fresh / s.concepts.length) * 100);

  // Review status: % of AI-drafted KOs completed.
  const aiKO = s.knowledgeObjects.filter(k => k.promptId);
  const reviewed = aiKO.filter(k => k.humanReviewCompleted).length;
  const reviewStatus = aiKO.length === 0 ? 100 : Math.round((reviewed / aiKO.length) * 100);

  // Documentation quality: concepts with definition + purpose + scope.
  const documented = s.concepts.filter(c => c.canonicalDefinition.trim() && c.purpose.trim() && c.scope.trim()).length;
  const documentation = s.concepts.length === 0 ? 100 : Math.round((documented / s.concepts.length) * 100);

  // Validation: 100 - broken penalty.
  const validation = Math.max(0, 100 - brokenReferences * 5);

  // Evaluation coverage: agents/packs with at least one passing eval.
  const evalTargets = [...(s.agents ?? []), ...(s.aiPacks ?? [])];
  const evalPassing = evalTargets.filter(a =>
    "evaluationCases" in a && a.evaluationCases.length > 0 && a.evaluationCases.some(e => e.status === "pass")
  ).length;
  const evaluationCoverage = evalTargets.length === 0 ? 100 : Math.round((evalPassing / evalTargets.length) * 100);

  // Automation coverage: canonical assets with at least one active automation covering them.
  const active = (s.automations ?? []).filter(a => a.state === "active");
  const covered = new Set<string>();
  for (const a of active) for (const id of a.trigger.entityIds) covered.add(id);
  const canonicalAssets = [
    ...s.concepts.filter(c => c.status === "Canonical").map(c => c.id),
    ...s.frameworks.filter(f => f.status === "Canonical").map(f => f.id),
    ...s.publications.filter(p => p.manufacturingStage === "Canonical" || p.manufacturingStage === "Released").map(p => p.id),
  ];
  const automationCoverage = canonicalAssets.length === 0 ? 100 :
    Math.round((canonicalAssets.filter(id => covered.has(id)).length / canonicalAssets.length) * 100);

  // Relationship completeness: nodes with at least one edge.
  const g = cachedBuildGraph(s);
  const connected = new Set<string>();
  for (const e of g.edges) { connected.add(e.from); connected.add(e.to); }
  const relationshipCompleteness = g.nodes.length === 0 ? 100 :
    Math.round((g.nodes.filter(n => connected.has(n.id)).length / g.nodes.length) * 100);

  const breakdown: Record<string, number> = {
    coverage, freshness, reviewStatus, documentation, validation,
    evaluationCoverage, automationCoverage, relationshipCompleteness,
  };
  const overall = Math.round(
    coverage * 0.20 + freshness * 0.10 + reviewStatus * 0.15 + documentation * 0.10 +
    validation * 0.15 + evaluationCoverage * 0.10 + automationCoverage * 0.10 +
    relationshipCompleteness * 0.10
  );

  const recommendations: string[] = [];
  if (brokenReferences > 0) recommendations.push(`Resolve ${brokenReferences} broken reference${brokenReferences === 1 ? "" : "s"} in the Dependencies view.`);
  if (duplicateReferences > 0) recommendations.push(`Consolidate ${duplicateReferences} duplicate reference${duplicateReferences === 1 ? "" : "s"} across publications and toolkits.`);
  if (freshness < 80) recommendations.push(`Refresh overdue concept reviews (${100 - freshness}% past cadence).`);
  if (reviewStatus < 100) recommendations.push(`Complete human review on ${aiKO.length - reviewed} AI-drafted knowledge object${aiKO.length - reviewed === 1 ? "" : "s"}.`);
  if (documentation < 90) recommendations.push("Strengthen concept documentation: definition, purpose, and scope on every concept.");
  if (evaluationCoverage < 80) recommendations.push("Add passing evaluations to agents and AI packs that have none.");
  if (automationCoverage < 50) recommendations.push("Increase automation coverage over canonical assets.");
  if (recommendations.length === 0) recommendations.push("Repository is healthy. Consider promoting release candidates.");

  return {
    overall,
    brokenReferences, duplicateReferences,
    coverage, freshness, reviewStatus, documentation, validation,
    evaluationCoverage, automationCoverage, relationshipCompleteness,
    recommendations, breakdown,
  };
}

// ============================================================
// PHASE 6 — Duplicate Detection
// ============================================================

export interface DuplicateCandidate {
  kind: UniversalKind;
  a: { id: string; title: string };
  b: { id: string; title: string };
  confidence: number;   // 0..100
  reasons: string[];
}

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenSet(str: string): Set<string> {
  return new Set(normalize(str).split(" ").filter(x => x.length > 2));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect += 1;
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

interface Named { id: string; title: string; body: string }
function compareNamed(items: Named[], threshold = 0.55): { a: Named; b: Named; confidence: number; reasons: string[] }[] {
  const out: { a: Named; b: Named; confidence: number; reasons: string[] }[] = [];
  const norm = items.map(x => ({ ...x, nTitle: normalize(x.title), tks: tokenSet(x.title + " " + x.body) }));
  for (let i = 0; i < norm.length; i++) {
    for (let j = i + 1; j < norm.length; j++) {
      const a = norm[i], b = norm[j];
      const reasons: string[] = [];
      let confidence = 0;
      if (a.nTitle === b.nTitle && a.nTitle.length > 0) { confidence = Math.max(confidence, 95); reasons.push("Identical normalized title"); }
      const jac = jaccard(a.tks, b.tks);
      if (jac >= 0.85) { confidence = Math.max(confidence, 90); reasons.push(`High body overlap (${Math.round(jac * 100)}%)`); }
      else if (jac >= threshold) { confidence = Math.max(confidence, Math.round(jac * 100)); reasons.push(`Body overlap ${Math.round(jac * 100)}%`); }
      if (confidence > 0) out.push({ a, b, confidence, reasons });
    }
  }
  return out;
}

export function detectDuplicates(s: DataSnapshot): DuplicateCandidate[] {
  const out: DuplicateCandidate[] = [];
  const map = <T extends { id: string }>(kind: UniversalKind, arr: T[], getTitle: (x: T) => string, getBody: (x: T) => string) => {
    const items = arr.map(x => ({ id: x.id, title: getTitle(x), body: getBody(x) }));
    for (const r of compareNamed(items)) {
      out.push({ kind, a: { id: r.a.id, title: r.a.title }, b: { id: r.b.id, title: r.b.title }, confidence: r.confidence, reasons: r.reasons });
    }
  };
  map<Concept>("Concept", s.concepts, c => c.canonicalName, c => c.canonicalDefinition + " " + c.purpose + " " + c.aliases.join(" "));
  map<Framework>("Framework", s.frameworks, f => f.name, f => f.mission + " " + f.decisionSolved);
  map<KnowledgeObject>("Knowledge Object", s.knowledgeObjects, k => k.title, k => k.body);
  map<PublicationBlueprint>("Publication", s.publications, p => p.title, p => p.description + " " + p.purpose);
  map<ClientToolkit>("Client Toolkit", s.clientToolkits ?? [], t => t.title, t => t.description + " " + t.purpose);
  map<AIPack>("AI Pack", s.aiPacks ?? [], a => a.title, a => a.description + " " + a.systemInstructions);
  map<Agent>("Agent", s.agents ?? [], a => a.name, a => a.description + " " + a.purpose);
  map<AutomationRecipe>("Automation", s.automations ?? [], a => a.name, a => a.description);
  map<ClientTool>("Client Tool", s.clientTools, c => c.name, c => c.purpose);
  map(
    "Prompt", s.prompts,
    p => p.name,
    p => p.purpose + " " + p.template,
  );

  return out.sort((a, b) => b.confidence - a.confidence);
}

// ============================================================
// PHASE 7 — Dependency Validation
// ============================================================

export type DependencyFindingKind =
  | "broken-link" | "circular-reference" | "missing-reference"
  | "invalid-relationship" | "orphaned-asset" | "unreleased-dependency"
  | "unapproved-dependency";

export interface DependencyFinding {
  kind: DependencyFindingKind;
  source: string;
  target?: string;
  message: string;
  remediation: string;
  severity: "info" | "warn" | "error";
}

export function validateDependencies(s: DataSnapshot): DependencyFinding[] {
  const findings: DependencyFinding[] = [];

  // Broken references.
  for (const b of detectBrokenReferences(s)) {
    findings.push({
      kind: "broken-link", source: b.source, target: b.targetId,
      message: `${b.source} references missing ${b.kind} ${b.targetId}`,
      remediation: `Restore ${b.targetId} or remove the reference from ${b.source}.`,
      severity: "error",
    });
  }

  // Circular references (concept graph).
  const conceptById = new Map(s.concepts.map(c => [c.id, c] as const));
  for (const c of s.concepts) {
    const stack = [...c.relatedConceptIds];
    const seen = new Set<string>([c.id]);
    while (stack.length) {
      const cur = stack.shift()!;
      if (cur === c.id) {
        findings.push({
          kind: "circular-reference", source: c.id, target: cur,
          message: `${c.id} participates in a related-concept cycle`,
          remediation: `Break the cycle by removing one of the ${c.id} ↔ ${cur} references.`,
          severity: "warn",
        });
        break;
      }
      if (seen.has(cur)) continue;
      seen.add(cur);
      const n = conceptById.get(cur);
      if (n) stack.push(...n.relatedConceptIds);
    }
  }

  // Orphaned canonical assets (nothing references them).
  const g = cachedBuildGraph(s);
  const referencedIds = new Set<string>();
  for (const e of g.edges) referencedIds.add(e.to);
  const checkOrphan = (id: string, kind: string, status: string) => {
    if (status !== "Canonical") return;
    if (!referencedIds.has(id)) {
      findings.push({
        kind: "orphaned-asset", source: id,
        message: `${kind} ${id} is Canonical but not referenced by any downstream asset`,
        remediation: `Reference ${id} from a publication, toolkit, or AI pack, or deprecate it.`,
        severity: "info",
      });
    }
  };
  for (const c of s.concepts) checkOrphan(c.id, "Concept", c.status);
  for (const f of s.frameworks) checkOrphan(f.id, "Framework", f.status);
  for (const k of s.knowledgeObjects) checkOrphan(k.id, "Knowledge Object", k.status);
  for (const t of s.clientTools) checkOrphan(t.id, "Client Tool", t.status);

  // Unreleased / unapproved dependencies inside canonical publications, toolkits, packs, agents.
  const stagedRelease = (stage: string) => stage === "Canonical" || stage === "Released";
  const conceptStatus = (id: string) => s.concepts.find(c => c.id === id)?.status ?? "unknown";
  const frameworkStatus = (id: string) => s.frameworks.find(f => f.id === id)?.status ?? "unknown";
  const koStatus = (id: string) => s.knowledgeObjects.find(k => k.id === id)?.status ?? "unknown";
  const flagDep = (source: string, target: string, status: string, ctxLabel: string) => {
    if (status === "unknown") return;
    if (status !== "Canonical" && status !== "Approved") {
      findings.push({
        kind: "unapproved-dependency", source, target,
        message: `${source} (${ctxLabel}) depends on ${target} which is ${status}`,
        remediation: `Promote ${target} to Approved or Canonical, or remove it from ${source}.`,
        severity: "warn",
      });
    } else if (status !== "Canonical") {
      findings.push({
        kind: "unreleased-dependency", source, target,
        message: `${source} depends on approved-but-not-canonical ${target}`,
        remediation: `Advance ${target} to Canonical to unlock full release integrity.`,
        severity: "info",
      });
    }
  };
  const walkPubBundle = (
    id: string, stage: string, cIds: string[], fIds: string[], kIds: string[], label: string,
  ) => {
    if (!stagedRelease(stage)) return;
    for (const cid of cIds) flagDep(id, cid, conceptStatus(cid), label);
    for (const fid of fIds) flagDep(id, fid, frameworkStatus(fid), label);
    for (const kid of kIds) flagDep(id, kid, koStatus(kid), label);
  };
  for (const p of s.publications) {
    for (const ch of p.chapters) walkPubBundle(p.id, p.manufacturingStage, ch.conceptIds, ch.frameworkIds, ch.knowledgeObjectIds, `chapter ${ch.id}`);
  }
  for (const tk of s.clientToolkits ?? []) walkPubBundle(tk.id, tk.manufacturingStage, tk.conceptIds, tk.frameworkIds, tk.knowledgeObjectIds, "toolkit");
  for (const ap of s.aiPacks ?? []) walkPubBundle(ap.id, ap.manufacturingStage, ap.conceptIds, ap.frameworkIds, ap.knowledgeObjectIds, "AI pack");
  for (const ag of s.agents ?? []) walkPubBundle(ag.id, ag.manufacturingStage, ag.conceptIds ?? [], ag.frameworkIds ?? [], ag.knowledgeObjectIds ?? [], "agent");

  return findings;
}

// ============================================================
// PHASE 10 — Release Intelligence
// ============================================================

export interface ReleaseIntelligence {
  releaseId: string;
  assetsIncluded: number;
  assetsMissing: { entityType: string; id: string }[];
  dependencyRisk: RiskLevel;
  dependencyRiskScore: number;
  duplicateRisk: number;
  health: number;
  outstandingReviews: number;
  blockedPromotions: string[];
  confidenceScore: number;      // 0..100
  notes: string[];
}

export function releaseIntelligence(r: Release, s: DataSnapshot): ReleaseIntelligence {
  const known = new Set<string>();
  for (const arr of [s.concepts, s.frameworks, s.knowledgeObjects, s.clientTools, s.publications, s.prompts, s.agents, s.clientToolkits ?? [], s.aiPacks ?? []]) {
    for (const x of arr as { id: string }[]) known.add(x.id);
  }
  const assetsMissing: { entityType: string; id: string }[] = [];
  let assetsIncluded = 0;
  for (const m of r.manifest) {
    for (const id of m.ids) {
      assetsIncluded += 1;
      if (!known.has(id)) assetsMissing.push({ entityType: m.entityType, id });
    }
  }

  // Aggregate impact for every manifest asset → highest risk wins.
  let dependencyRiskScore = 0;
  for (const m of r.manifest) for (const id of m.ids) {
    const impact = impactAnalysis(id, s);
    dependencyRiskScore = Math.max(dependencyRiskScore, impact.riskScore);
  }
  const dependencyRisk: RiskLevel =
    dependencyRiskScore >= 60 ? "Critical" :
    dependencyRiskScore >= 30 ? "High" :
    dependencyRiskScore >= 10 ? "Medium" : "Low";

  const dupes = detectDuplicates(s);
  const manifestIds = new Set(r.manifest.flatMap(m => m.ids));
  const duplicateRisk = dupes.filter(d => manifestIds.has(d.a.id) || manifestIds.has(d.b.id)).length;

  const health = knowledgeHealth(s).overall;
  const outstandingReviews = s.knowledgeObjects.filter(k => k.promptId && !k.humanReviewCompleted).length;

  const blockedPromotions: string[] = [];
  for (const p of s.publications) if (manifestIds.has(p.id) && p.manufacturingStage !== "Canonical" && p.manufacturingStage !== "Released") blockedPromotions.push(p.id);
  for (const tk of s.clientToolkits ?? []) if (manifestIds.has(tk.id) && tk.manufacturingStage !== "Canonical" && tk.manufacturingStage !== "Released") blockedPromotions.push(tk.id);
  for (const ap of s.aiPacks ?? []) if (manifestIds.has(ap.id) && ap.manufacturingStage !== "Canonical" && ap.manufacturingStage !== "Released") blockedPromotions.push(ap.id);
  for (const ag of s.agents ?? []) if (manifestIds.has(ag.id) && ag.manufacturingStage !== "Canonical" && ag.manufacturingStage !== "Released") blockedPromotions.push(ag.id);

  // Confidence: penalize each risk source.
  let confidence = 100;
  confidence -= assetsMissing.length * 15;
  confidence -= { Low: 0, Medium: 8, High: 20, Critical: 35 }[dependencyRisk];
  confidence -= duplicateRisk * 3;
  confidence -= Math.max(0, (85 - health)) * 0.6;
  confidence -= outstandingReviews * 2;
  confidence -= blockedPromotions.length * 6;
  const confidenceScore = Math.max(0, Math.min(100, Math.round(confidence)));

  const notes: string[] = [];
  if (assetsMissing.length) notes.push(`${assetsMissing.length} manifest asset(s) missing from repository.`);
  if (blockedPromotions.length) notes.push(`${blockedPromotions.length} manifest asset(s) not yet Canonical.`);
  if (outstandingReviews) notes.push(`${outstandingReviews} AI-drafted KO(s) awaiting human review.`);
  if (duplicateRisk) notes.push(`${duplicateRisk} manifest asset(s) have duplicate candidates.`);
  if (dependencyRisk !== "Low") notes.push(`Highest dependency risk in manifest: ${dependencyRisk}.`);
  if (notes.length === 0) notes.push("Release intelligence clean.");

  return {
    releaseId: r.id, assetsIncluded, assetsMissing,
    dependencyRisk, dependencyRiskScore, duplicateRisk,
    health, outstandingReviews, blockedPromotions,
    confidenceScore, notes,
  };
}

// ============================================================
// Explorer helpers (Phase 8)
// ============================================================

export type ExplorerView = "graph" | "table" | "cards" | "tree" | "timeline";

export function groupByKind(index: UniversalAsset[]): Record<string, UniversalAsset[]> {
  const out: Record<string, UniversalAsset[]> = {};
  for (const a of index) {
    (out[a.kind] ??= []).push(a);
  }
  return out;
}

export function timelineOrdered(index: UniversalAsset[]): UniversalAsset[] {
  return [...index].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export type { PublicationBlueprint, ChapterBlueprint };
