import type {
  Concept, Framework, KnowledgeObject, KnowledgeObjectType,
  PublicationBlueprint, Release, ClientTool, DataSnapshot,
} from "./schema";
import { ID_PATTERNS } from "./schema";
import { Repo } from "./repository";

// ---------- Validation ----------
export function validateConceptId(id: string) { return ID_PATTERNS.concept.test(id); }
export function findDuplicateCanonical(concepts: Concept[], candidate: Pick<Concept, "id" | "canonicalName">) {
  const norm = candidate.canonicalName.trim().toLowerCase();
  return concepts.filter(c => c.id !== candidate.id && c.canonicalName.trim().toLowerCase() === norm);
}

// ---------- Relationship graph ----------
export interface GraphNode { id: string; label: string; kind: string }
export interface GraphEdge { from: string; to: string; kind: string }

export function buildGraph(s: DataSnapshot): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  for (const d of s.domains) nodes.push({ id: d.id, label: d.name, kind: "Domain" });
  for (const c of s.concepts) {
    nodes.push({ id: c.id, label: c.canonicalName, kind: "Concept" });
    for (const dId of c.domainIds) edges.push({ from: c.id, to: dId, kind: "in-domain" });
    for (const rId of c.relatedConceptIds) edges.push({ from: c.id, to: rId, kind: "related-to" });
  }
  for (const f of s.frameworks) {
    nodes.push({ id: f.id, label: f.name, kind: "Framework" });
    for (const cId of f.governingConceptIds) edges.push({ from: f.id, to: cId, kind: "governs" });
    for (const tId of f.clientToolIds) edges.push({ from: f.id, to: tId, kind: "derives-tool" });
    for (const pId of f.publicationIds) edges.push({ from: f.id, to: pId, kind: "used-in" });
  }
  for (const k of s.knowledgeObjects) {
    nodes.push({ id: k.id, label: k.title, kind: "Knowledge" });
    for (const cId of k.sourceConceptIds) edges.push({ from: k.id, to: cId, kind: "from-concept" });
    for (const fId of k.sourceFrameworkIds) edges.push({ from: k.id, to: fId, kind: "from-framework" });
  }
  for (const t of s.clientTools) {
    nodes.push({ id: t.id, label: t.name, kind: "Client Tool" });
    for (const cId of t.sourceConceptIds) edges.push({ from: t.id, to: cId, kind: "sources-concept" });
    for (const fId of t.sourceFrameworkIds) edges.push({ from: t.id, to: fId, kind: "sources-framework" });
  }
  for (const p of s.publications) {
    nodes.push({ id: p.id, label: p.title, kind: "Publication" });
    for (const ch of p.chapters) {
      for (const cId of ch.conceptIds) edges.push({ from: p.id, to: cId, kind: "publishes-concept" });
      for (const fId of ch.frameworkIds) edges.push({ from: p.id, to: fId, kind: "publishes-framework" });
    }
  }
  return { nodes, edges };
}

export function detectBrokenReferences(s: DataSnapshot): { source: string; targetId: string; kind: string }[] {
  const known = new Set<string>();
  for (const arr of [s.domains, s.concepts, s.frameworks, s.knowledgeObjects, s.clientTools, s.publications, s.prompts, s.agents, s.releases]) {
    for (const x of arr as { id: string }[]) known.add(x.id);
  }
  for (const p of s.publications) for (const ch of p.chapters) known.add(ch.id);
  const broken: { source: string; targetId: string; kind: string }[] = [];
  const check = (source: string, kind: string, ids: string[]) => {
    for (const id of ids) if (!known.has(id)) broken.push({ source, targetId: id, kind });
  };
  for (const c of s.concepts) {
    check(c.id, "domain", c.domainIds);
    check(c.id, "related-concept", c.relatedConceptIds);
    check(c.id, "framework", c.frameworkIds);
  }
  for (const f of s.frameworks) {
    check(f.id, "concept", f.governingConceptIds);
    check(f.id, "client-tool", f.clientToolIds);
    check(f.id, "publication", f.publicationIds);
    check(f.id, "framework-dependency", f.dependencyIds);
  }
  for (const k of s.knowledgeObjects) {
    check(k.id, "concept", k.sourceConceptIds);
    check(k.id, "framework", k.sourceFrameworkIds);
  }
  for (const t of s.clientTools) {
    check(t.id, "concept", t.sourceConceptIds);
    check(t.id, "framework", t.sourceFrameworkIds);
    check(t.id, "knowledge-object", t.sourceKnowledgeObjectIds);
  }
  return broken;
}

// ---------- Coverage detection ----------
export function frameworkCoverage(f: Framework, allConcepts: Concept[]) {
  const total = f.governingConceptIds.length;
  const approved = f.governingConceptIds.filter(cid => {
    const c = allConcepts.find(x => x.id === cid);
    return c && (c.status === "Canonical" || c.status === "Approved");
  }).length;
  return { total, approved, ratio: total === 0 ? 0 : approved / total };
}

export function chapterCoverageGaps(chapter: PublicationBlueprint["chapters"][number], s: DataSnapshot) {
  const gaps: string[] = [];
  for (const cid of chapter.conceptIds) {
    const c = s.concepts.find(x => x.id === cid);
    if (!c) gaps.push(`Missing concept ${cid}`);
    else if (c.status !== "Canonical" && c.status !== "Approved") gaps.push(`Concept ${cid} is ${c.status}`);
  }
  for (const fid of chapter.frameworkIds) {
    const f = s.frameworks.find(x => x.id === fid);
    if (!f) gaps.push(`Missing framework ${fid}`);
  }
  if (chapter.learningObjectives.length === 0) gaps.push("No learning objectives");
  return gaps;
}

// ---------- Knowledge Object Factory (deterministic local demo) ----------
const KO_TEMPLATES: { type: KnowledgeObjectType; title: (n: string) => string; body: (n: string, def: string) => string }[] = [
  { type: "Definition", title: n => `${n} — Canonical Definition`, body: (_n, def) => def },
  { type: "Why It Matters", title: n => `Why ${n} matters`, body: n => `${n} anchors decisions that would otherwise drift under pressure. Without it, buyers substitute urgency for judgment.` },
  { type: "Principle", title: n => `Principle: ${n}`, body: n => `${n} is codified before it is applied. Codification precedes negotiation.` },
  { type: "Example", title: n => `Example: applying ${n}`, body: n => `A household applies ${n} by documenting the specific values that make the decision defensible in writing before the moment of commitment.` },
  { type: "Scenario", title: n => `Scenario: ${n} under pressure`, body: n => `Under competitive market pressure, ${n} keeps the buyer from ratifying terms that violate pre-committed limits.` },
  { type: "Joe's Strategy", title: n => `Joe's Strategy™: Anchor ${n}`, body: n => `Reduce ${n} to a single page reviewed before every decision moment.` },
  { type: "Mistake Alert", title: n => `Mistake Alert™: Drifting from ${n}`, body: n => `The common failure is treating ${n} as a preference rather than a pre-commitment.` },
  { type: "FAQ", title: n => `FAQ: How firm should ${n} be?`, body: n => `Firm enough that violating ${n} requires deliberate re-decision, not casual concession.` },
  { type: "Reflection Question", title: n => `Reflection: What would erode ${n}?`, body: n => `Which conditions would tempt you to abandon ${n}, and how will you respond?` },
];

export interface KoDraftPlan {
  types: KnowledgeObjectType[];
  conceptIds: string[];
  frameworkIds: string[];
  promptId: string;
}

export function generateDraftKnowledgeObjects(plan: KoDraftPlan): KnowledgeObject[] {
  const s = Repo.snapshot();
  if (!s) return [];
  const drafts: KnowledgeObject[] = [];
  const existingIds = s.knowledgeObjects.map(k => k.id);
  let n = existingIds
    .map(id => Number(id.replace("KO-", "")))
    .filter(x => !Number.isNaN(x))
    .reduce((max, x) => Math.max(max, x), 0);
  const now = new Date().toISOString();
  for (const cid of plan.conceptIds) {
    const concept = s.concepts.find(c => c.id === cid);
    if (!concept) continue;
    for (const type of plan.types) {
      const tmpl = KO_TEMPLATES.find(t => t.type === type) ?? KO_TEMPLATES[0];
      n += 1;
      drafts.push({
        id: `KO-${String(n).padStart(6, "0")}`,
        type,
        title: tmpl.title(concept.canonicalName),
        body: tmpl.body(concept.canonicalName, concept.canonicalDefinition),
        sourceConceptIds: [cid],
        sourceFrameworkIds: plan.frameworkIds,
        promptId: plan.promptId,
        generatedAt: now,
        humanReviewRequired: true,
        humanReviewCompleted: false,
        audience: concept.audience,
        status: "Draft",
        version: "0.1.0",
        steward: "Knowledge Object Curator (AG-002)",
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return drafts;
}

// ---------- Client Tool Factory ----------
export interface ClientToolDraftPlan {
  kind: ClientTool["kind"];
  name: string;
  conceptIds: string[];
  frameworkIds: string[];
  koIds: string[];
  promptId: string;
}
export function generateDraftClientTool(plan: ClientToolDraftPlan): ClientTool {
  const s = Repo.snapshot();
  const existing = s?.clientTools ?? [];
  const prefix = plan.kind === "Worksheet" ? "W" : plan.kind === "Checklist" ? "C" : "DT";
  const nums = existing
    .filter(t => t.id.startsWith(prefix + "-"))
    .map(t => Number(t.id.split("-")[1]))
    .filter(x => !Number.isNaN(x));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  const now = new Date().toISOString();
  return {
    id: `${prefix}-${String(n).padStart(3, "0")}`,
    kind: plan.kind,
    name: plan.name,
    purpose: `Draft ${plan.kind.toLowerCase()} generated from approved sources for editorial review.`,
    sourceConceptIds: plan.conceptIds,
    sourceFrameworkIds: plan.frameworkIds,
    sourceKnowledgeObjectIds: plan.koIds,
    promptId: plan.promptId,
    status: "Draft",
    version: "0.1.0",
    humanReviewCompleted: false,
    steward: "Publication Builder (AG-005)",
    createdAt: now,
    updatedAt: now,
  };
}

// ---------- Release gate ----------
export function evaluateReleaseGate(r: Release) {
  const gates = r.gateChecklist;
  const passed = gates.filter(g => g.passed).length;
  const readyForCanonical = passed === gates.length && r.blockingErrors === 0;
  return { total: gates.length, passed, readyForCanonical };
}

// ---------- Import / Export ----------
export function exportSnapshot(s: DataSnapshot): string {
  return JSON.stringify({ ...s, exportedAt: new Date().toISOString() }, null, 2);
}

export interface ImportResult {
  snapshot: DataSnapshot | null;
  errors: string[];
  brokenReferences: { source: string; targetId: string; kind: string }[];
}

export function parseImport(json: string): ImportResult {
  const errors: string[] = [];
  let parsed: unknown;
  try { parsed = JSON.parse(json); }
  catch (e) { return { snapshot: null, errors: [`Invalid JSON: ${(e as Error).message}`], brokenReferences: [] }; }
  const requiredKeys: (keyof DataSnapshot)[] = ["domains","concepts","frameworks","knowledgeObjects","clientTools","publications","prompts","agents","releases"];
  const obj = parsed as Partial<DataSnapshot>;
  for (const k of requiredKeys) {
    if (!Array.isArray(obj[k])) errors.push(`Missing or invalid array: ${k}`);
  }
  if (errors.length) return { snapshot: null, errors, brokenReferences: [] };
  const snap: DataSnapshot = {
    schemaVersion: obj.schemaVersion ?? 1,
    exportedAt: obj.exportedAt ?? new Date().toISOString(),
    domains: obj.domains!, concepts: obj.concepts!, frameworks: obj.frameworks!,
    knowledgeObjects: obj.knowledgeObjects!, clientTools: obj.clientTools!,
    publications: obj.publications!, prompts: obj.prompts!, agents: obj.agents!, releases: obj.releases!,
  };
  return { snapshot: snap, errors, brokenReferences: detectBrokenReferences(snap) };
}
