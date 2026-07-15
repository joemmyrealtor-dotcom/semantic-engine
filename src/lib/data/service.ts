import type {
  Concept, Framework, KnowledgeObject, KnowledgeObjectType,
  PublicationBlueprint, ChapterBlueprint, Release, ClientTool, DataSnapshot,
  PublicationStage, StageHistoryEntry, PresentationLink,
  ClientToolkit, ClientToolkitSection, AIPack, AIPackModule, AIPackEvaluationCase,
  ManufacturingStage,
} from "./schema";
import { ID_PATTERNS, PUBLICATION_STAGES } from "./schema";
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
    if (p.archived) continue;
    nodes.push({ id: p.id, label: p.title, kind: "Publication" });
    for (const ch of p.chapters) {
      nodes.push({ id: ch.id, label: ch.title, kind: "Chapter" });
      edges.push({ from: p.id, to: ch.id, kind: "contains-chapter" });
      for (const cId of ch.conceptIds) edges.push({ from: ch.id, to: cId, kind: "publishes-concept" });
      for (const fId of ch.frameworkIds) edges.push({ from: ch.id, to: fId, kind: "publishes-framework" });
      for (const kId of ch.knowledgeObjectIds) edges.push({ from: ch.id, to: kId, kind: "publishes-ko" });
      for (const tId of ch.clientToolIds) edges.push({ from: ch.id, to: tId, kind: "publishes-tool" });
    }
  }
  for (const tk of s.clientToolkits ?? []) {
    if (tk.archived) continue;
    nodes.push({ id: tk.id, label: tk.title, kind: "Client Toolkit" });
    for (const cId of tk.conceptIds) edges.push({ from: tk.id, to: cId, kind: "toolkit-concept" });
    for (const fId of tk.frameworkIds) edges.push({ from: tk.id, to: fId, kind: "toolkit-framework" });
    for (const kId of tk.knowledgeObjectIds) edges.push({ from: tk.id, to: kId, kind: "toolkit-ko" });
    for (const tId of tk.clientToolIds) edges.push({ from: tk.id, to: tId, kind: "toolkit-tool" });
    for (const pId of tk.publicationIds) edges.push({ from: tk.id, to: pId, kind: "toolkit-publication" });
    for (const sec of tk.sections) {
      nodes.push({ id: sec.id, label: sec.title, kind: "Toolkit Section" });
      edges.push({ from: tk.id, to: sec.id, kind: "contains-section" });
      for (const cId of sec.conceptIds) edges.push({ from: sec.id, to: cId, kind: "section-concept" });
      for (const fId of sec.frameworkIds) edges.push({ from: sec.id, to: fId, kind: "section-framework" });
      for (const kId of sec.knowledgeObjectIds) edges.push({ from: sec.id, to: kId, kind: "section-ko" });
      for (const tId of sec.clientToolIds) edges.push({ from: sec.id, to: tId, kind: "section-tool" });
      for (const pId of sec.publicationIds) edges.push({ from: sec.id, to: pId, kind: "section-publication" });
    }
  }
  for (const ap of s.aiPacks ?? []) {
    if (ap.archived) continue;
    nodes.push({ id: ap.id, label: ap.title, kind: "AI Pack" });
    for (const cId of ap.conceptIds) edges.push({ from: ap.id, to: cId, kind: "pack-concept" });
    for (const fId of ap.frameworkIds) edges.push({ from: ap.id, to: fId, kind: "pack-framework" });
    for (const kId of ap.knowledgeObjectIds) edges.push({ from: ap.id, to: kId, kind: "pack-ko" });
    for (const pId of ap.publicationIds) edges.push({ from: ap.id, to: pId, kind: "pack-publication" });
    for (const tkId of ap.clientToolkitIds) edges.push({ from: ap.id, to: tkId, kind: "pack-toolkit" });
    for (const prId of ap.promptIds) edges.push({ from: ap.id, to: prId, kind: "pack-prompt" });
    for (const agId of ap.agentIds) edges.push({ from: ap.id, to: agId, kind: "pack-agent" });
    for (const m of ap.modules) {
      nodes.push({ id: m.id, label: m.title, kind: "AI Pack Module" });
      edges.push({ from: ap.id, to: m.id, kind: "contains-module" });
      if (m.referenceId) edges.push({ from: m.id, to: m.referenceId, kind: `module-${m.kind.toLowerCase().replace(/\s+/g, "-")}` });
    }
    for (const ev of ap.evaluationCases) {
      nodes.push({ id: ev.id, label: ev.title, kind: "Evaluation Case" });
      edges.push({ from: ap.id, to: ev.id, kind: "contains-evaluation" });
      for (const cId of ev.coversConceptIds) edges.push({ from: ev.id, to: cId, kind: "covers-concept" });
      for (const fId of ev.coversFrameworkIds) edges.push({ from: ev.id, to: fId, kind: "covers-framework" });
    }
  }
  for (const r of s.releases) {
    nodes.push({ id: r.id, label: r.name, kind: "Release" });
    for (const m of r.manifest) for (const id of m.ids) edges.push({ from: r.id, to: id, kind: `releases-${m.entityType}` });
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
    clientToolkits: obj.clientToolkits ?? [],
    aiPacks: obj.aiPacks ?? [],
  };
  return { snapshot: snap, errors, brokenReferences: detectBrokenReferences(snap) };
}

// ===================================================================
// Workstream 2 — Publication Manufacturing Studio
// ===================================================================

export function nextPublicationId(s: DataSnapshot): string {
  const n = s.publications
    .map(p => Number(p.id.replace("PL-", "")))
    .filter(x => !Number.isNaN(x))
    .reduce((m, x) => Math.max(m, x), 100);
  return `PL-${String(n + 1).padStart(3, "0")}`;
}

export function nextChapterId(s: DataSnapshot): string {
  const all: number[] = [];
  for (const p of s.publications) for (const ch of p.chapters) {
    const n = Number(ch.id.replace("CH-", ""));
    if (!Number.isNaN(n)) all.push(n);
  }
  const n = all.reduce((m, x) => Math.max(m, x), 0);
  return `CH-${String(n + 1).padStart(3, "0")}`;
}

export function duplicatePublication(source: PublicationBlueprint, newId: string, s: DataSnapshot): PublicationBlueprint {
  let seq = 0;
  for (const p of s.publications) for (const ch of p.chapters) {
    const n = Number(ch.id.replace("CH-", "")); if (!Number.isNaN(n)) seq = Math.max(seq, n);
  }
  const now = new Date().toISOString();
  // Deterministic remap old chapter id → new chapter id so parent hierarchy is preserved.
  const idMap = new Map<string, string>();
  for (const ch of source.chapters) {
    seq += 1;
    idMap.set(ch.id, `CH-${String(seq).padStart(3, "0")}`);
  }
  const cloneChapters = source.chapters.map(ch => ({
    ...ch,
    id: idMap.get(ch.id)!,
    parentChapterId: ch.parentChapterId ? (idMap.get(ch.parentChapterId) ?? null) : null,
  }));
  return {
    ...source,
    id: newId,
    title: `${source.title} (Copy)`,
    version: "0.1.0",
    status: "Draft",
    manufacturingStage: "Draft",
    archived: false,
    chapters: cloneChapters,
    stageHistory: [{ stage: "Draft", at: now, actor: source.owner || source.steward, note: `Duplicated from ${source.id}.` }],
    createdAt: now,
    updatedAt: now,
  };
}

// -------- Chapter hierarchy integrity --------
/** True if `candidateAncestor` is an ancestor of `chapterId` (or equal). */
export function isChapterAncestor(chapters: ChapterBlueprint[], candidateAncestor: string, chapterId: string): boolean {
  if (candidateAncestor === chapterId) return true;
  const byId = new Map(chapters.map(c => [c.id, c] as const));
  let cur = byId.get(chapterId);
  const seen = new Set<string>();
  while (cur?.parentChapterId) {
    if (seen.has(cur.parentChapterId)) return false;
    seen.add(cur.parentChapterId);
    if (cur.parentChapterId === candidateAncestor) return true;
    cur = byId.get(cur.parentChapterId);
  }
  return false;
}

/** Returns true if setting `chapterId.parent = newParentId` would create a cycle. */
export function wouldCreateChapterCycle(chapters: ChapterBlueprint[], chapterId: string, newParentId: string | null): boolean {
  if (!newParentId) return false;
  if (newParentId === chapterId) return true;
  return isChapterAncestor(chapters, chapterId, newParentId);
}

/** Depth-first list of descendant ids for a chapter (excluding itself). */
export function chapterDescendantIds(chapters: ChapterBlueprint[], chapterId: string): string[] {
  const out: string[] = [];
  const walk = (id: string) => {
    for (const ch of chapters) if (ch.parentChapterId === id) { out.push(ch.id); walk(ch.id); }
  };
  walk(chapterId);
  return out;
}

/** Move `chapterId` to index `newIndex` within its siblings (same parent), preserving hierarchy. */
export function moveChapter(chapters: ChapterBlueprint[], chapterId: string, newParentId: string | null, newIndex: number): ChapterBlueprint[] {
  if (wouldCreateChapterCycle(chapters, chapterId, newParentId)) return chapters;
  const moving = chapters.find(c => c.id === chapterId);
  if (!moving) return chapters;
  const updated = chapters.map(c => c.id === chapterId ? { ...c, parentChapterId: newParentId } : c);
  const siblings = updated
    .filter(c => c.parentChapterId === newParentId)
    .sort((a, b) => a.order - b.order);
  const without = siblings.filter(c => c.id !== chapterId);
  const target = Math.max(0, Math.min(newIndex, without.length));
  const reordered = [...without.slice(0, target), updated.find(c => c.id === chapterId)!, ...without.slice(target)];
  const orderMap = new Map(reordered.map((c, i) => [c.id, (i + 1) * 10] as const));
  return updated.map(c => orderMap.has(c.id) ? { ...c, order: orderMap.get(c.id)! } : c);
}

// -------- Coverage intelligence --------
export interface PublicationCoverage {
  missingConcepts: string[];
  missingFrameworks: string[];
  missingKnowledgeObjects: string[];
  missingClientTools: string[];
  duplicateReferences: { kind: string; id: string; count: number }[];
  brokenReferences: { source: string; targetId: string; kind: string }[];
  chaptersWithoutObjectives: string[];
  canonicalConceptRatio: number;   // 0..1 (share of concepts referenced that are Canonical/Approved)
  humanReviewRatio: number;        // 0..1 (share of referenced KOs with human review complete)
  coveragePercent: number;         // aggregate
  readinessScore: number;          // 0..100
  editorialScore: number;          // 0..100
  canonicalCompliance: number;     // 0..100
}

export function publicationCoverage(p: PublicationBlueprint, s: DataSnapshot): PublicationCoverage {
  const conceptIds = new Set<string>();
  const frameworkIds = new Set<string>();
  const koIds = new Set<string>();
  const toolIds = new Set<string>();
  const refCounts = new Map<string, { kind: string; count: number }>();
  const bumpDup = (kind: string, id: string) => {
    const key = `${kind}:${id}`;
    const cur = refCounts.get(key) ?? { kind, count: 0 };
    cur.count += 1;
    refCounts.set(key, cur);
  };
  const chaptersWithoutObjectives: string[] = [];
  for (const ch of p.chapters) {
    if (ch.learningObjectives.length === 0) chaptersWithoutObjectives.push(ch.id);
    for (const id of ch.conceptIds) { conceptIds.add(id); bumpDup("concept", id); }
    for (const id of ch.frameworkIds) { frameworkIds.add(id); bumpDup("framework", id); }
    for (const id of ch.knowledgeObjectIds) { koIds.add(id); bumpDup("ko", id); }
    for (const id of ch.clientToolIds) { toolIds.add(id); bumpDup("tool", id); }
  }
  const missingConcepts = [...conceptIds].filter(id => !s.concepts.some(c => c.id === id));
  const missingFrameworks = [...frameworkIds].filter(id => !s.frameworks.some(f => f.id === id));
  const missingKnowledgeObjects = [...koIds].filter(id => !s.knowledgeObjects.some(k => k.id === id));
  const missingClientTools = [...toolIds].filter(id => !s.clientTools.some(t => t.id === id));

  const duplicateReferences = [...refCounts.entries()]
    .filter(([, v]) => v.count > 1)
    .map(([k, v]) => ({ kind: v.kind, id: k.split(":")[1], count: v.count }));

  const brokenReferences: PublicationCoverage["brokenReferences"] = [
    ...missingConcepts.map(id => ({ source: p.id, targetId: id, kind: "concept" })),
    ...missingFrameworks.map(id => ({ source: p.id, targetId: id, kind: "framework" })),
    ...missingKnowledgeObjects.map(id => ({ source: p.id, targetId: id, kind: "knowledge-object" })),
    ...missingClientTools.map(id => ({ source: p.id, targetId: id, kind: "client-tool" })),
  ];

  const presentConcepts = [...conceptIds].filter(id => s.concepts.some(c => c.id === id));
  const canonicalConceptRatio = presentConcepts.length === 0 ? 0 :
    presentConcepts.filter(id => {
      const c = s.concepts.find(x => x.id === id)!;
      return c.status === "Canonical" || c.status === "Approved";
    }).length / presentConcepts.length;

  const referencedKOs = s.knowledgeObjects.filter(k => koIds.has(k.id));
  const humanReviewRatio = referencedKOs.length === 0 ? 1 :
    referencedKOs.filter(k => k.humanReviewCompleted).length / referencedKOs.length;

  // Coverage % = fraction of chapter-declared refs that resolve.
  const totalRefs = conceptIds.size + frameworkIds.size + koIds.size + toolIds.size;
  const resolved = totalRefs - brokenReferences.length;
  const coveragePercent = totalRefs === 0 ? 0 : Math.round((resolved / totalRefs) * 100);

  const editorialScore = Math.round(
    100
    - (chaptersWithoutObjectives.length * 10)
    - (duplicateReferences.length * 3)
    - Math.max(0, (p.chapters.length === 0 ? 30 : 0))
  );
  const canonicalCompliance = Math.round(canonicalConceptRatio * 100);
  const readinessScore = Math.round(
    coveragePercent * 0.4 + canonicalCompliance * 0.3 + humanReviewRatio * 100 * 0.2 + Math.max(0, editorialScore) * 0.1
  );

  return {
    missingConcepts, missingFrameworks, missingKnowledgeObjects, missingClientTools,
    duplicateReferences, brokenReferences, chaptersWithoutObjectives,
    canonicalConceptRatio, humanReviewRatio, coveragePercent,
    readinessScore, editorialScore: Math.max(0, editorialScore), canonicalCompliance,
  };
}

// Canonical assets defined in the repository but NOT referenced by any active publication.
export function unusedCanonicalAssets(s: DataSnapshot) {
  const used = { concept: new Set<string>(), framework: new Set<string>(), ko: new Set<string>(), tool: new Set<string>() };
  for (const p of s.publications) if (!p.archived) for (const ch of p.chapters) {
    ch.conceptIds.forEach(id => used.concept.add(id));
    ch.frameworkIds.forEach(id => used.framework.add(id));
    ch.knowledgeObjectIds.forEach(id => used.ko.add(id));
    ch.clientToolIds.forEach(id => used.tool.add(id));
  }
  const isCanonical = (st: string) => st === "Canonical";
  return {
    concepts: s.concepts.filter(c => isCanonical(c.status) && !used.concept.has(c.id)).map(c => c.id),
    frameworks: s.frameworks.filter(f => isCanonical(f.status) && !used.framework.has(f.id)).map(f => f.id),
    knowledgeObjects: s.knowledgeObjects.filter(k => isCanonical(k.status) && !used.ko.has(k.id)).map(k => k.id),
    clientTools: s.clientTools.filter(t => isCanonical(t.status) && !used.tool.has(t.id)).map(t => t.id),
  };
}

// -------- Manufacturing workflow --------
export interface PromotionResult {
  ok: boolean;
  blockers: string[];
  nextStage: PublicationStage | null;
}

export function validatePublicationPromotion(
  p: PublicationBlueprint, target: PublicationStage, s: DataSnapshot,
): PromotionResult {
  const cov = publicationCoverage(p, s);
  const blockers: string[] = [];
  if (p.chapters.length === 0) blockers.push("Publication has no chapters.");
  if (cov.brokenReferences.length > 0) blockers.push(`${cov.brokenReferences.length} broken references must be resolved.`);
  const targetIdx = PUBLICATION_STAGES.indexOf(target);
  if (target === "QA" || target === "Canonical" || target === "Released") {
    if (cov.chaptersWithoutObjectives.length > 0) blockers.push(`Chapters missing learning objectives: ${cov.chaptersWithoutObjectives.join(", ")}.`);
    if (cov.humanReviewRatio < 1) blockers.push("Referenced AI-generated knowledge objects require human review completion.");
    // Chapter stage alignment: every chapter must be at least one stage behind the publication target.
    const minChapterIdx = Math.max(0, targetIdx - 1);
    const lagging = p.chapters.filter(c => PUBLICATION_STAGES.indexOf(c.manufacturingStage) < minChapterIdx);
    if (lagging.length > 0) blockers.push(`Chapters not yet at ${PUBLICATION_STAGES[minChapterIdx]}: ${lagging.map(c => c.id).join(", ")}.`);
  }
  if (target === "Canonical" || target === "Released") {
    if (cov.canonicalCompliance < 80) blockers.push(`Canonical compliance ${cov.canonicalCompliance}% below 80% threshold.`);
    if (cov.readinessScore < 85) blockers.push(`Readiness score ${cov.readinessScore} below 85 threshold.`);
    const chapterLag = p.chapters.filter(c => PUBLICATION_STAGES.indexOf(c.manufacturingStage) < targetIdx);
    if (target === "Canonical" && chapterLag.length > 0) blockers.push(`Chapters below Canonical: ${chapterLag.map(c => c.id).join(", ")}.`);
  }
  if (target === "Released") {
    if (!p.effectiveDate) blockers.push("Effective date required for Released stage.");
  }
  return { ok: blockers.length === 0, blockers, nextStage: blockers.length === 0 ? target : null };
}

/** Returns true when the transition is a normal single-step adjacent move (forward or backward by one). */
export function isAdjacentStageTransition(from: PublicationStage, to: PublicationStage): boolean {
  const a = PUBLICATION_STAGES.indexOf(from);
  const b = PUBLICATION_STAGES.indexOf(to);
  return Math.abs(a - b) === 1;
}

export function appendStageHistory(p: PublicationBlueprint, stage: PublicationStage, actor: string, note?: string): StageHistoryEntry[] {
  return [...p.stageHistory, { stage, at: new Date().toISOString(), actor, note }];
}

// -------- Release integration --------
export interface PublicationReleaseReport {
  publicationId: string;
  title: string;
  stage: PublicationStage;
  coveragePercent: number;
  readinessScore: number;
  brokenReferences: number;
  missingKnowledgeObjects: number;
  canonicalCompliance: number;
  humanReviewComplete: boolean;
  eligible: boolean;
  blockers: string[];
}

export function releasePublicationReports(r: Release, s: DataSnapshot): PublicationReleaseReport[] {
  const pubIds = new Set(r.manifest.filter(m => m.entityType === "publications").flatMap(m => m.ids));
  return s.publications
    .filter(p => pubIds.has(p.id))
    .map(p => {
      const cov = publicationCoverage(p, s);
      const eligibility = validatePublicationPromotion(p, "Canonical", s);
      return {
        publicationId: p.id,
        title: p.title,
        stage: p.manufacturingStage,
        coveragePercent: cov.coveragePercent,
        readinessScore: cov.readinessScore,
        brokenReferences: cov.brokenReferences.length,
        missingKnowledgeObjects: cov.missingKnowledgeObjects.length,
        canonicalCompliance: cov.canonicalCompliance,
        humanReviewComplete: cov.humanReviewRatio >= 1,
        eligible: eligibility.ok,
        blockers: eligibility.blockers,
      };
    });
}

// -------- Chapter helpers --------
export function reorderChapters(chapters: ChapterBlueprint[], fromIndex: number, toIndex: number): ChapterBlueprint[] {
  const arr = [...chapters];
  const [moved] = arr.splice(fromIndex, 1);
  arr.splice(toIndex, 0, moved);
  return arr.map((c, i) => ({ ...c, order: (i + 1) * 10 }));
}

export function chapterTree(chapters: ChapterBlueprint[]): { chapter: ChapterBlueprint; depth: number }[] {
  const sorted = [...chapters].sort((a, b) => a.order - b.order);
  const byParent = new Map<string | null, ChapterBlueprint[]>();
  for (const c of sorted) {
    const key = c.parentChapterId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  const out: { chapter: ChapterBlueprint; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const ch of byParent.get(parent) ?? []) {
      out.push({ chapter: ch, depth });
      walk(ch.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

// Marker used by unused-asset detector when nothing references an asset.
export const _WS2_STAGES: readonly PublicationStage[] = PUBLICATION_STAGES;
// Marker export retained so schema import survives tree-shaking.
export type { PresentationLink, ChapterBlueprint };
