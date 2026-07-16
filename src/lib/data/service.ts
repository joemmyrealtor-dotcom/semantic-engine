import type {
  Concept, Framework, KnowledgeObject, KnowledgeObjectType,
  PublicationBlueprint, ChapterBlueprint, Release, ClientTool, DataSnapshot,
  PublicationStage, StageHistoryEntry, PresentationLink,
  ClientToolkit, ClientToolkitSection, AIPack, AIPackModule, AIPackEvaluationCase,
  ManufacturingStage, Agent, AgentSpecification, AgentEvaluationCase,
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
  for (const ag of s.agents ?? []) {
    if (ag.archived) continue;
    nodes.push({ id: ag.id, label: ag.name || ag.id, kind: "Agent" });
    for (const pId of ag.governingPromptIds) edges.push({ from: ag.id, to: pId, kind: "agent-prompt" });
    for (const cId of ag.conceptIds ?? []) edges.push({ from: ag.id, to: cId, kind: "agent-concept" });
    for (const fId of ag.frameworkIds ?? []) edges.push({ from: ag.id, to: fId, kind: "agent-framework" });
    for (const kId of ag.knowledgeObjectIds ?? []) edges.push({ from: ag.id, to: kId, kind: "agent-ko" });
    for (const pId of ag.publicationIds ?? []) edges.push({ from: ag.id, to: pId, kind: "agent-publication" });
    for (const tkId of ag.clientToolkitIds ?? []) edges.push({ from: ag.id, to: tkId, kind: "agent-toolkit" });
    for (const apId of ag.aiPackIds ?? []) edges.push({ from: ag.id, to: apId, kind: "agent-pack" });
    for (const tId of ag.clientToolIds ?? []) edges.push({ from: ag.id, to: tId, kind: "agent-tool" });
    for (const ev of ag.evaluationCases ?? []) {
      nodes.push({ id: ev.id, label: ev.title, kind: "Agent Evaluation" });
      edges.push({ from: ag.id, to: ev.id, kind: "agent-contains-evaluation" });
      for (const cId of ev.coversConceptIds) edges.push({ from: ev.id, to: cId, kind: "agent-eval-covers-concept" });
      for (const fId of ev.coversFrameworkIds) edges.push({ from: ev.id, to: fId, kind: "agent-eval-covers-framework" });
    }
  }
  for (const r of s.releases) {
    nodes.push({ id: r.id, label: r.name, kind: "Release" });
    for (const m of r.manifest) for (const id of m.ids) edges.push({ from: r.id, to: id, kind: `releases-${m.entityType}` });
  }
  for (const a of s.automations ?? []) {
    if (a.state === "archived") continue;
    nodes.push({ id: a.id, label: a.name, kind: "Automation" });
    for (const eId of a.trigger.entityIds) edges.push({ from: a.id, to: eId, kind: "automates" });
  }
  for (const r of s.automationRuns ?? []) {
    nodes.push({ id: r.id, label: `${r.recipeId} · ${r.status}`, kind: "Automation Run" });
    edges.push({ from: r.id, to: r.recipeId, kind: "run-of" });
    for (const eId of r.entityIds) edges.push({ from: r.id, to: eId, kind: "run-affects" });
  }
  // Workstream 8 — Integration nodes and edges.
  for (const c of s.integrationConnections ?? []) {
    nodes.push({ id: c.id, label: c.name, kind: "Integration Connection" });
    for (const dom of c.domainScope ?? []) edges.push({ from: c.id, to: dom, kind: "connection-scope" });
  }
  for (const w of s.webhookEndpoints ?? []) {
    nodes.push({ id: w.id, label: w.description || w.url, kind: "Webhook Endpoint" });
    edges.push({ from: w.id, to: w.connectionId, kind: "webhook-of" });
  }
  for (const d of s.webhookDeliveries ?? []) {
    nodes.push({ id: d.id, label: `${d.eventKind} · ${d.status}`, kind: "Webhook Delivery" });
    edges.push({ from: d.id, to: d.endpointId, kind: "delivery-endpoint" });
    edges.push({ from: d.id, to: d.eventId, kind: "delivery-event" });
  }
  for (const c of s.apiClients ?? []) nodes.push({ id: c.id, label: c.name, kind: "API Client" });
  for (const j of s.importJobs ?? []) {
    nodes.push({ id: j.id, label: `${j.packageName} · ${j.status}`, kind: "Import Job" });
    if (j.connectionId) edges.push({ from: j.id, to: j.connectionId, kind: "import-connection" });
  }
  for (const j of s.exportJobs ?? []) {
    nodes.push({ id: j.id, label: `${j.kind}:${j.entityId} · ${j.status}`, kind: "Export Job" });
    edges.push({ from: j.id, to: j.entityId, kind: "exports-entity" });
    if (j.packageId) edges.push({ from: j.id, to: j.packageId, kind: "export-package" });
  }
  for (const p of s.deliveryPackages ?? []) {
    nodes.push({ id: p.id, label: p.title, kind: "Delivery Package" });
    edges.push({ from: p.id, to: p.exportJobId, kind: "package-of-export" });
    for (const cn of p.destinationConnectionIds ?? []) edges.push({ from: p.id, to: cn, kind: "package-destination" });
    for (const rId of p.requiredForReleaseIds ?? []) edges.push({ from: rId, to: p.id, kind: "release-requires-package" });
  }
  for (const r of s.deliveryRuns ?? []) {
    nodes.push({ id: r.id, label: `${r.packageId} → ${r.connectionId} · ${r.status}`, kind: "Delivery Run" });
    edges.push({ from: r.id, to: r.packageId, kind: "run-package" });
    edges.push({ from: r.id, to: r.connectionId, kind: "run-connection" });
  }
  for (const m of s.syncMappings ?? []) {
    nodes.push({ id: m.id, label: `${m.internalEntityKind}:${m.internalEntityId} ↔ ${m.externalId}`, kind: "Sync Mapping" });
    edges.push({ from: m.id, to: m.connectionId, kind: "mapping-connection" });
    edges.push({ from: m.id, to: m.internalEntityId, kind: "mapping-internal" });
  }
  for (const x of s.externalReferences ?? []) {
    nodes.push({ id: x.id, label: `${x.provider}:${x.externalId}`, kind: "External Reference" });
    edges.push({ from: x.id, to: x.internalEntityId, kind: "external-refers" });
  }
  for (const e of s.eventSubscriptions ?? []) {
    nodes.push({ id: e.id, label: e.name, kind: "Event Subscription" });
    edges.push({ from: e.id, to: e.connectionId, kind: "subscription-connection" });
  }
  for (const ev of s.domainEvents ?? []) {
    nodes.push({ id: ev.id, label: `${ev.kind}`, kind: "Domain Event" });
    edges.push({ from: ev.id, to: ev.entityId, kind: "event-entity" });
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
  for (const ag of s.agents ?? []) {
    check(ag.id, "prompt", ag.governingPromptIds);
    check(ag.id, "concept", ag.conceptIds ?? []);
    check(ag.id, "framework", ag.frameworkIds ?? []);
    check(ag.id, "knowledge-object", ag.knowledgeObjectIds ?? []);
    check(ag.id, "publication", ag.publicationIds ?? []);
    check(ag.id, "client-toolkit", ag.clientToolkitIds ?? []);
    check(ag.id, "ai-pack", ag.aiPackIds ?? []);
    check(ag.id, "client-tool", ag.clientToolIds ?? []);
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
    automations: obj.automations ?? [],
    automationRuns: obj.automationRuns ?? [],
    analyticsSnapshots: obj.analyticsSnapshots ?? [],
    executiveAlerts: obj.executiveAlerts ?? [],
    savedExecutiveViews: obj.savedExecutiveViews ?? [],
    reportRuns: obj.reportRuns ?? [],
    integrationConnections: obj.integrationConnections ?? [],
    webhookEndpoints: obj.webhookEndpoints ?? [],
    webhookDeliveries: obj.webhookDeliveries ?? [],
    apiClients: obj.apiClients ?? [],
    importJobs: obj.importJobs ?? [],
    exportJobs: obj.exportJobs ?? [],
    syncMappings: obj.syncMappings ?? [],
    externalReferences: obj.externalReferences ?? [],
    deliveryPackages: obj.deliveryPackages ?? [],
    deliveryRuns: obj.deliveryRuns ?? [],
    eventSubscriptions: obj.eventSubscriptions ?? [],
    domainEvents: obj.domainEvents ?? [],
    auditEvents: obj.auditEvents ?? [],
    backups: obj.backups ?? [],
    workspaces: obj.workspaces ?? [{ id: "WS-001", name: "Default", slug: "default", branding: { primary: "#0B1F3A", accent: "#C9A24E", logoInitials: "JM" }, isolated: false, settings: { defaultRole: "Viewer", requireHumanReview: true, retentionDays: 365 }, metrics: { assets: 0, releases: 0, runs: 0 }, archived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
    featureFlags: obj.featureFlags ?? [],
    rateLimitBuckets: obj.rateLimitBuckets ?? [],
    maintenanceMode: obj.maintenanceMode ?? { enabled: false, reason: "", since: null, by: null, allowRoles: ["Administrator","Owner"] },
    activeWorkspaceId: obj.activeWorkspaceId ?? "WS-001",
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

// ===================================================================
// Workstream 3 — Client Toolkits & AI Packs
// ===================================================================

// ---------- ID generation ----------
function maxNum(ids: string[], prefix: string): number {
  return ids
    .filter(id => id.startsWith(prefix))
    .map(id => Number(id.slice(prefix.length)))
    .filter(n => !Number.isNaN(n))
    .reduce((m, n) => Math.max(m, n), 0);
}
export function nextClientToolkitId(s: DataSnapshot): string {
  const n = maxNum(s.clientToolkits.map(x => x.id), "TK-");
  return `TK-${String(n + 1).padStart(3, "0")}`;
}
export function nextToolkitSectionId(s: DataSnapshot): string {
  const all = s.clientToolkits.flatMap(tk => tk.sections.map(sec => sec.id));
  const n = maxNum(all, "TS-");
  return `TS-${String(n + 1).padStart(3, "0")}`;
}
export function nextAIPackId(s: DataSnapshot): string {
  const n = maxNum(s.aiPacks.map(x => x.id), "AP-");
  return `AP-${String(n + 1).padStart(3, "0")}`;
}
export function nextAIPackModuleId(s: DataSnapshot): string {
  const all = s.aiPacks.flatMap(ap => ap.modules.map(m => m.id));
  const n = maxNum(all, "AM-");
  return `AM-${String(n + 1).padStart(3, "0")}`;
}
export function nextEvaluationCaseId(s: DataSnapshot): string {
  const all = s.aiPacks.flatMap(ap => ap.evaluationCases.map(e => e.id));
  const n = maxNum(all, "EV-");
  return `EV-${String(n + 1).padStart(3, "0")}`;
}

// ---------- Generic hierarchy helpers (sections mirror chapters) ----------
export interface HierarchyNode { id: string; parentId: string | null; order: number }

export function isSectionAncestor(items: ClientToolkitSection[], candidateAncestor: string, sectionId: string): boolean {
  if (candidateAncestor === sectionId) return true;
  const byId = new Map(items.map(i => [i.id, i] as const));
  let cur = byId.get(sectionId);
  const seen = new Set<string>();
  while (cur?.parentSectionId) {
    if (seen.has(cur.parentSectionId)) return false;
    seen.add(cur.parentSectionId);
    if (cur.parentSectionId === candidateAncestor) return true;
    cur = byId.get(cur.parentSectionId);
  }
  return false;
}
export function wouldCreateSectionCycle(items: ClientToolkitSection[], sectionId: string, newParentId: string | null): boolean {
  if (!newParentId) return false;
  if (newParentId === sectionId) return true;
  return isSectionAncestor(items, sectionId, newParentId);
}
export function sectionDescendantIds(items: ClientToolkitSection[], sectionId: string): string[] {
  const out: string[] = [];
  const walk = (id: string) => {
    for (const s of items) if (s.parentSectionId === id) { out.push(s.id); walk(s.id); }
  };
  walk(sectionId);
  return out;
}
export function moveSection(items: ClientToolkitSection[], sectionId: string, newParentId: string | null, newIndex: number): ClientToolkitSection[] {
  if (wouldCreateSectionCycle(items, sectionId, newParentId)) return items;
  const moving = items.find(s => s.id === sectionId);
  if (!moving) return items;
  const updated = items.map(s => s.id === sectionId ? { ...s, parentSectionId: newParentId } : s);
  const siblings = updated.filter(s => s.parentSectionId === newParentId).sort((a, b) => a.order - b.order);
  const without = siblings.filter(s => s.id !== sectionId);
  const target = Math.max(0, Math.min(newIndex, without.length));
  const reordered = [...without.slice(0, target), updated.find(s => s.id === sectionId)!, ...without.slice(target)];
  const orderMap = new Map(reordered.map((s, i) => [s.id, (i + 1) * 10] as const));
  return updated.map(s => orderMap.has(s.id) ? { ...s, order: orderMap.get(s.id)! } : s);
}
export function sectionTree(items: ClientToolkitSection[]): { section: ClientToolkitSection; depth: number }[] {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const byParent = new Map<string | null, ClientToolkitSection[]>();
  for (const s of sorted) {
    const key = s.parentSectionId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(s);
  }
  const out: { section: ClientToolkitSection; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const sec of byParent.get(parent) ?? []) {
      out.push({ section: sec, depth });
      walk(sec.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

// ---------- Duplication (hierarchy-preserving) ----------
export function duplicateClientToolkit(source: ClientToolkit, newId: string, s: DataSnapshot): ClientToolkit {
  let seq = maxNum(s.clientToolkits.flatMap(tk => tk.sections.map(x => x.id)), "TS-");
  const idMap = new Map<string, string>();
  for (const sec of source.sections) {
    seq += 1;
    idMap.set(sec.id, `TS-${String(seq).padStart(3, "0")}`);
  }
  const sections = source.sections.map(sec => ({
    ...sec,
    id: idMap.get(sec.id)!,
    parentSectionId: sec.parentSectionId ? (idMap.get(sec.parentSectionId) ?? null) : null,
  }));
  const now = new Date().toISOString();
  return {
    ...source,
    id: newId,
    title: `${source.title} (Copy)`,
    version: "0.1.0",
    status: "Draft",
    manufacturingStage: "Draft",
    archived: false,
    sections,
    stageHistory: [{ stage: "Draft", at: now, actor: source.owner || source.steward, note: `Duplicated from ${source.id}.` }],
    releaseIds: [],
    createdAt: now, updatedAt: now,
  };
}

export function duplicateAIPack(source: AIPack, newId: string, s: DataSnapshot): AIPack {
  let modSeq = maxNum(s.aiPacks.flatMap(a => a.modules.map(m => m.id)), "AM-");
  let evSeq = maxNum(s.aiPacks.flatMap(a => a.evaluationCases.map(e => e.id)), "EV-");
  const modules = source.modules.map(m => { modSeq += 1; return { ...m, id: `AM-${String(modSeq).padStart(3, "0")}` }; });
  const evaluationCases = source.evaluationCases.map(e => { evSeq += 1; return { ...e, id: `EV-${String(evSeq).padStart(3, "0")}`, status: "not-run" as const }; });
  const now = new Date().toISOString();
  return {
    ...source,
    id: newId,
    title: `${source.title} (Copy)`,
    version: "0.1.0",
    manufacturingStage: "Draft",
    archived: false,
    modules,
    evaluationCases,
    stageHistory: [{ stage: "Draft", at: now, actor: source.owner || source.steward, note: `Duplicated from ${source.id}.` }],
    releaseIds: [],
    humanReviewCompleted: false,
    createdAt: now, updatedAt: now,
  };
}

// ---------- Coverage: Client Toolkit ----------
export interface ToolkitCoverage {
  missingConcepts: string[];
  missingFrameworks: string[];
  missingKnowledgeObjects: string[];
  missingClientTools: string[];
  missingPublications: string[];
  brokenReferences: { source: string; targetId: string; kind: string }[];
  duplicateReferences: { kind: string; id: string; count: number }[];
  unusedAssets: string[]; // top-level selected but not used by any section
  sectionsWithoutObjectives: string[];
  sectionsWithoutAssets: string[];
  governingConceptCount: number;
  governingFrameworkCount: number;
  canonicalConceptRatio: number;
  humanReviewRatio: number;
  coveragePercent: number;
  readinessScore: number;
  editorialScore: number;
  canonicalCompliance: number;
}

export function toolkitCoverage(tk: ClientToolkit, s: DataSnapshot): ToolkitCoverage {
  const dup = new Map<string, { kind: string; count: number }>();
  const bump = (kind: string, id: string) => {
    const k = `${kind}:${id}`;
    const cur = dup.get(k) ?? { kind, count: 0 };
    cur.count += 1;
    dup.set(k, cur);
  };
  const conceptIds = new Set<string>();
  const frameworkIds = new Set<string>();
  const koIds = new Set<string>();
  const toolIds = new Set<string>();
  const pubIds = new Set<string>();

  const record = (arr: string[], kind: string, set: Set<string>) => {
    for (const id of arr) { set.add(id); bump(kind, id); }
  };
  record(tk.conceptIds, "concept", conceptIds);
  record(tk.frameworkIds, "framework", frameworkIds);
  record(tk.knowledgeObjectIds, "ko", koIds);
  record(tk.clientToolIds, "tool", toolIds);
  record(tk.publicationIds, "publication", pubIds);

  const sectionsWithoutObjectives: string[] = [];
  const sectionsWithoutAssets: string[] = [];
  const sectionUsage = { concept: new Set<string>(), framework: new Set<string>(), ko: new Set<string>(), tool: new Set<string>(), pub: new Set<string>() };
  for (const sec of tk.sections) {
    if (!sec.objective.trim()) sectionsWithoutObjectives.push(sec.id);
    const total = sec.conceptIds.length + sec.frameworkIds.length + sec.knowledgeObjectIds.length + sec.clientToolIds.length + sec.publicationIds.length;
    if (total === 0) sectionsWithoutAssets.push(sec.id);
    for (const id of sec.conceptIds) { conceptIds.add(id); bump("concept", id); sectionUsage.concept.add(id); }
    for (const id of sec.frameworkIds) { frameworkIds.add(id); bump("framework", id); sectionUsage.framework.add(id); }
    for (const id of sec.knowledgeObjectIds) { koIds.add(id); bump("ko", id); sectionUsage.ko.add(id); }
    for (const id of sec.clientToolIds) { toolIds.add(id); bump("tool", id); sectionUsage.tool.add(id); }
    for (const id of sec.publicationIds) { pubIds.add(id); bump("publication", id); sectionUsage.pub.add(id); }
  }

  const missingConcepts = [...conceptIds].filter(id => !s.concepts.some(c => c.id === id));
  const missingFrameworks = [...frameworkIds].filter(id => !s.frameworks.some(f => f.id === id));
  const missingKnowledgeObjects = [...koIds].filter(id => !s.knowledgeObjects.some(k => k.id === id));
  const missingClientTools = [...toolIds].filter(id => !s.clientTools.some(t => t.id === id));
  const missingPublications = [...pubIds].filter(id => !s.publications.some(p => p.id === id));

  const brokenReferences = [
    ...missingConcepts.map(id => ({ source: tk.id, targetId: id, kind: "concept" })),
    ...missingFrameworks.map(id => ({ source: tk.id, targetId: id, kind: "framework" })),
    ...missingKnowledgeObjects.map(id => ({ source: tk.id, targetId: id, kind: "knowledge-object" })),
    ...missingClientTools.map(id => ({ source: tk.id, targetId: id, kind: "client-tool" })),
    ...missingPublications.map(id => ({ source: tk.id, targetId: id, kind: "publication" })),
  ];

  const duplicateReferences = [...dup.entries()]
    .filter(([, v]) => v.count > 1)
    .map(([k, v]) => ({ kind: v.kind, id: k.split(":")[1], count: v.count }));

  const unusedAssets = [
    ...tk.conceptIds.filter(id => !sectionUsage.concept.has(id)),
    ...tk.frameworkIds.filter(id => !sectionUsage.framework.has(id)),
    ...tk.knowledgeObjectIds.filter(id => !sectionUsage.ko.has(id)),
    ...tk.clientToolIds.filter(id => !sectionUsage.tool.has(id)),
    ...tk.publicationIds.filter(id => !sectionUsage.pub.has(id)),
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

  const totalRefs = conceptIds.size + frameworkIds.size + koIds.size + toolIds.size + pubIds.size;
  const resolved = totalRefs - brokenReferences.length;
  const coveragePercent = totalRefs === 0 ? 0 : Math.round((resolved / totalRefs) * 100);
  const canonicalCompliance = Math.round(canonicalConceptRatio * 100);
  const editorialScore = Math.max(0, Math.round(
    100
    - sectionsWithoutObjectives.length * 10
    - sectionsWithoutAssets.length * 12
    - duplicateReferences.length * 2
    - (tk.sections.length === 0 ? 40 : 0)
  ));
  const readinessScore = Math.round(
    coveragePercent * 0.35 + canonicalCompliance * 0.3 + humanReviewRatio * 100 * 0.2 + editorialScore * 0.15
  );

  return {
    missingConcepts, missingFrameworks, missingKnowledgeObjects, missingClientTools, missingPublications,
    brokenReferences, duplicateReferences, unusedAssets,
    sectionsWithoutObjectives, sectionsWithoutAssets,
    governingConceptCount: conceptIds.size,
    governingFrameworkCount: frameworkIds.size,
    canonicalConceptRatio, humanReviewRatio, coveragePercent,
    readinessScore, editorialScore, canonicalCompliance,
  };
}

export function validateToolkitPromotion(tk: ClientToolkit, target: ManufacturingStage, s: DataSnapshot) {
  const cov = toolkitCoverage(tk, s);
  const blockers: string[] = [];
  if (tk.sections.length === 0) blockers.push("Toolkit has no sections.");
  if (cov.brokenReferences.length > 0) blockers.push(`${cov.brokenReferences.length} broken references must be resolved.`);
  const targetIdx = PUBLICATION_STAGES.indexOf(target);
  if (target === "QA" || target === "Canonical" || target === "Released") {
    if (cov.sectionsWithoutObjectives.length > 0) blockers.push(`Sections missing objective: ${cov.sectionsWithoutObjectives.join(", ")}.`);
    if (cov.sectionsWithoutAssets.length > 0) blockers.push(`Sections missing canonical assets: ${cov.sectionsWithoutAssets.join(", ")}.`);
    if (cov.humanReviewRatio < 1) blockers.push("Referenced knowledge objects require human review completion.");
    const minSectionIdx = Math.max(0, targetIdx - 1);
    const lag = tk.sections.filter(s => PUBLICATION_STAGES.indexOf(s.manufacturingStage) < minSectionIdx);
    if (lag.length > 0) blockers.push(`Sections not yet at ${PUBLICATION_STAGES[minSectionIdx]}: ${lag.map(s => s.id).join(", ")}.`);
  }
  if (target === "Canonical" || target === "Released") {
    if (cov.canonicalCompliance < 80) blockers.push(`Canonical compliance ${cov.canonicalCompliance}% below 80% threshold.`);
    if (cov.readinessScore < 85) blockers.push(`Readiness score ${cov.readinessScore} below 85 threshold.`);
  }
  if (target === "Released") {
    if (!tk.effectiveDate) blockers.push("Effective date required for Released stage.");
  }
  return { ok: blockers.length === 0, blockers, nextStage: blockers.length === 0 ? target : null };
}

// ---------- Coverage: AI Pack ----------
export interface AIPackCoverage {
  missingConcepts: string[];
  missingFrameworks: string[];
  missingKnowledgeObjects: string[];
  missingPublications: string[];
  missingClientToolkits: string[];
  missingPrompts: string[];
  missingAgents: string[];
  brokenReferences: { source: string; targetId: string; kind: string }[];
  brokenModuleReferences: { moduleId: string; targetId: string; kind: string }[];
  brokenEvaluationCitations: { evaluationId: string; targetId: string }[];
  duplicateInstructions: string[];
  modulesWithoutInstructions: string[];
  evaluationCount: number;
  evaluationsReviewed: number;
  evaluationsPassed: number;
  unreviewedEvaluations: string[];
  canonicalConceptRatio: number;
  coveragePercent: number;
  readinessScore: number;
  editorialScore: number;
  canonicalCompliance: number;
  provenanceComplete: boolean;
  hasGovernance: boolean;
  hasSystemInstructions: boolean;
}

export function aiPackCoverage(ap: AIPack, s: DataSnapshot): AIPackCoverage {
  const missingConcepts = ap.conceptIds.filter(id => !s.concepts.some(c => c.id === id));
  const missingFrameworks = ap.frameworkIds.filter(id => !s.frameworks.some(f => f.id === id));
  const missingKnowledgeObjects = ap.knowledgeObjectIds.filter(id => !s.knowledgeObjects.some(k => k.id === id));
  const missingPublications = ap.publicationIds.filter(id => !s.publications.some(p => p.id === id));
  const missingClientToolkits = ap.clientToolkitIds.filter(id => !s.clientToolkits.some(t => t.id === id));
  const missingPrompts = ap.promptIds.filter(id => !s.prompts.some(p => p.id === id));
  const missingAgents = ap.agentIds.filter(id => !s.agents.some(a => a.id === id));

  const brokenReferences = [
    ...missingConcepts.map(id => ({ source: ap.id, targetId: id, kind: "concept" })),
    ...missingFrameworks.map(id => ({ source: ap.id, targetId: id, kind: "framework" })),
    ...missingKnowledgeObjects.map(id => ({ source: ap.id, targetId: id, kind: "knowledge-object" })),
    ...missingPublications.map(id => ({ source: ap.id, targetId: id, kind: "publication" })),
    ...missingClientToolkits.map(id => ({ source: ap.id, targetId: id, kind: "client-toolkit" })),
    ...missingPrompts.map(id => ({ source: ap.id, targetId: id, kind: "prompt" })),
    ...missingAgents.map(id => ({ source: ap.id, targetId: id, kind: "agent" })),
  ];

  const knownIds = new Set<string>();
  for (const arr of [s.concepts, s.frameworks, s.knowledgeObjects, s.publications, s.clientToolkits, s.prompts, s.agents]) {
    for (const x of arr as { id: string }[]) knownIds.add(x.id);
  }
  const brokenModuleReferences = ap.modules
    .filter(m => m.referenceId && !knownIds.has(m.referenceId))
    .map(m => ({ moduleId: m.id, targetId: m.referenceId!, kind: m.kind }));

  const brokenEvaluationCitations: { evaluationId: string; targetId: string }[] = [];
  for (const ev of ap.evaluationCases) {
    for (const cite of ev.requiredCitations) {
      if (!knownIds.has(cite)) brokenEvaluationCitations.push({ evaluationId: ev.id, targetId: cite });
    }
  }

  const modulesWithoutInstructions = ap.modules
    .filter(m => (m.kind === "Instruction" || m.kind === "Policy") && !m.packInstructions.trim())
    .map(m => m.id);

  // Duplicate/conflicting instructions: modules with identical packInstructions text (non-empty).
  const instrCount = new Map<string, string[]>();
  for (const m of ap.modules) {
    const key = m.packInstructions.trim();
    if (!key) continue;
    if (!instrCount.has(key)) instrCount.set(key, []);
    instrCount.get(key)!.push(m.id);
  }
  const duplicateInstructions = [...instrCount.entries()].filter(([, ids]) => ids.length > 1).flatMap(([, ids]) => ids);

  const evaluationCount = ap.evaluationCases.length;
  const evaluationsReviewed = ap.evaluationCases.filter(e => e.reviewerStatus !== "Draft").length;
  const evaluationsPassed = ap.evaluationCases.filter(e => e.status === "pass").length;
  const unreviewedEvaluations = ap.evaluationCases.filter(e => e.reviewerStatus === "Draft").map(e => e.id);

  const presentConcepts = ap.conceptIds.filter(id => s.concepts.some(c => c.id === id));
  const canonicalConceptRatio = presentConcepts.length === 0 ? 0 :
    presentConcepts.filter(id => {
      const c = s.concepts.find(x => x.id === id)!;
      return c.status === "Canonical" || c.status === "Approved";
    }).length / presentConcepts.length;

  const totalRefs = ap.conceptIds.length + ap.frameworkIds.length + ap.knowledgeObjectIds.length +
    ap.publicationIds.length + ap.clientToolkitIds.length + ap.promptIds.length + ap.agentIds.length;
  const resolved = totalRefs - brokenReferences.length;
  const coveragePercent = totalRefs === 0 ? 0 : Math.round((resolved / totalRefs) * 100);
  const canonicalCompliance = Math.round(canonicalConceptRatio * 100);
  const hasGovernance = Boolean(ap.usagePolicy.trim() && ap.boundaryConditions.trim());
  const hasSystemInstructions = Boolean(ap.systemInstructions.trim());
  const provenanceComplete = Boolean(ap.provenanceNotes.trim());

  const editorialScore = Math.max(0, Math.round(
    100
    - modulesWithoutInstructions.length * 12
    - brokenModuleReferences.length * 15
    - brokenEvaluationCitations.length * 5
    - unreviewedEvaluations.length * 4
    - duplicateInstructions.length * 2
    - (hasGovernance ? 0 : 20)
    - (hasSystemInstructions ? 0 : 25)
  ));
  const readinessScore = Math.round(
    coveragePercent * 0.3 + canonicalCompliance * 0.25 + editorialScore * 0.25 +
    (evaluationCount === 0 ? 0 : (evaluationsPassed / evaluationCount) * 100) * 0.2
  );

  return {
    missingConcepts, missingFrameworks, missingKnowledgeObjects,
    missingPublications, missingClientToolkits, missingPrompts, missingAgents,
    brokenReferences, brokenModuleReferences, brokenEvaluationCitations,
    duplicateInstructions, modulesWithoutInstructions,
    evaluationCount, evaluationsReviewed, evaluationsPassed, unreviewedEvaluations,
    canonicalConceptRatio, coveragePercent, readinessScore, editorialScore, canonicalCompliance,
    provenanceComplete, hasGovernance, hasSystemInstructions,
  };
}

export function validateAIPackPromotion(ap: AIPack, target: ManufacturingStage, s: DataSnapshot) {
  const cov = aiPackCoverage(ap, s);
  const blockers: string[] = [];
  if (!cov.hasSystemInstructions) blockers.push("System instructions are required.");
  if (cov.brokenReferences.length > 0) blockers.push(`${cov.brokenReferences.length} broken references must be resolved.`);
  if (cov.brokenModuleReferences.length > 0) blockers.push(`${cov.brokenModuleReferences.length} module references are unresolved.`);
  if (target === "SME Review" || target === "QA" || target === "Canonical" || target === "Released") {
    if (!cov.hasGovernance) blockers.push("Usage policy and boundary conditions are required.");
    if (cov.modulesWithoutInstructions.length > 0) blockers.push(`Instruction/Policy modules missing text: ${cov.modulesWithoutInstructions.join(", ")}.`);
  }
  if (target === "QA" || target === "Canonical" || target === "Released") {
    if (cov.evaluationCount === 0) blockers.push("At least one evaluation case is required.");
    if (cov.unreviewedEvaluations.length > 0) blockers.push(`Unreviewed evaluations: ${cov.unreviewedEvaluations.join(", ")}.`);
  }
  if (target === "Canonical" || target === "Released") {
    if (!cov.provenanceComplete) blockers.push("Provenance notes are required for canonical release.");
    if (cov.canonicalCompliance < 80) blockers.push(`Canonical compliance ${cov.canonicalCompliance}% below 80% threshold.`);
    if (cov.readinessScore < 85) blockers.push(`Readiness score ${cov.readinessScore} below 85 threshold.`);
    if (!ap.humanReviewCompleted) blockers.push("Human review must be completed before canonical release.");
  }
  if (target === "Released") {
    if (!ap.effectiveDate) blockers.push("Effective date required for Released stage.");
  }
  return { ok: blockers.length === 0, blockers, nextStage: blockers.length === 0 ? target : null };
}

// ---------- Release reports ----------
export interface ToolkitReleaseReport {
  toolkitId: string; title: string; stage: ManufacturingStage;
  coveragePercent: number; readinessScore: number;
  brokenReferences: number; canonicalCompliance: number;
  humanReviewComplete: boolean; eligible: boolean; blockers: string[];
}
export function releaseToolkitReports(r: Release, s: DataSnapshot): ToolkitReleaseReport[] {
  const ids = new Set(r.manifest.filter(m => m.entityType === "clientToolkits").flatMap(m => m.ids));
  return s.clientToolkits.filter(t => ids.has(t.id)).map(tk => {
    const cov = toolkitCoverage(tk, s);
    const promo = validateToolkitPromotion(tk, "Canonical", s);
    return {
      toolkitId: tk.id, title: tk.title, stage: tk.manufacturingStage,
      coveragePercent: cov.coveragePercent, readinessScore: cov.readinessScore,
      brokenReferences: cov.brokenReferences.length, canonicalCompliance: cov.canonicalCompliance,
      humanReviewComplete: cov.humanReviewRatio >= 1, eligible: promo.ok, blockers: promo.blockers,
    };
  });
}

export interface AIPackReleaseReport {
  packId: string; title: string; stage: ManufacturingStage;
  coveragePercent: number; readinessScore: number;
  brokenReferences: number; unreviewedEvaluations: number;
  canonicalCompliance: number; humanReviewComplete: boolean;
  eligible: boolean; blockers: string[];
}
export function releaseAIPackReports(r: Release, s: DataSnapshot): AIPackReleaseReport[] {
  const ids = new Set(r.manifest.filter(m => m.entityType === "aiPacks").flatMap(m => m.ids));
  return s.aiPacks.filter(a => ids.has(a.id)).map(ap => {
    const cov = aiPackCoverage(ap, s);
    const promo = validateAIPackPromotion(ap, "Canonical", s);
    return {
      packId: ap.id, title: ap.title, stage: ap.manufacturingStage,
      coveragePercent: cov.coveragePercent, readinessScore: cov.readinessScore,
      brokenReferences: cov.brokenReferences.length + cov.brokenModuleReferences.length,
      unreviewedEvaluations: cov.unreviewedEvaluations.length,
      canonicalCompliance: cov.canonicalCompliance,
      humanReviewComplete: ap.humanReviewCompleted,
      eligible: promo.ok, blockers: promo.blockers,
    };
  });
}

// ---------- Traceability lookup ----------
export function findToolkitsReferencing(s: DataSnapshot, entityId: string): ClientToolkit[] {
  return s.clientToolkits.filter(tk => {
    if ([...tk.conceptIds, ...tk.frameworkIds, ...tk.knowledgeObjectIds, ...tk.clientToolIds, ...tk.publicationIds].includes(entityId)) return true;
    return tk.sections.some(sec =>
      [...sec.conceptIds, ...sec.frameworkIds, ...sec.knowledgeObjectIds, ...sec.clientToolIds, ...sec.publicationIds].includes(entityId)
    );
  });
}
export function findAIPacksReferencing(s: DataSnapshot, entityId: string): AIPack[] {
  return s.aiPacks.filter(ap => {
    const top = [...ap.conceptIds, ...ap.frameworkIds, ...ap.knowledgeObjectIds, ...ap.publicationIds, ...ap.clientToolkitIds, ...ap.promptIds, ...ap.agentIds];
    if (top.includes(entityId)) return true;
    if (ap.modules.some(m => m.referenceId === entityId)) return true;
    return ap.evaluationCases.some(e => e.requiredCitations.includes(entityId));
  });
}

// ===================================================================
// Workstream 4 — Agents (Registry, Studio, Coverage, Promotion)
// ===================================================================

export function nextAgentId(s: DataSnapshot): string {
  const n = maxNum(s.agents.map(a => a.id), "AG-");
  return `AG-${String(n + 1).padStart(3, "0")}`;
}
export function nextAgentSpecId(s: DataSnapshot): string {
  const all = s.agents.flatMap(a => (a.specifications ?? []).map(x => x.id));
  const n = maxNum(all, "AS-");
  return `AS-${String(n + 1).padStart(3, "0")}`;
}
export function nextAgentEvaluationId(s: DataSnapshot): string {
  const all = s.agents.flatMap(a => (a.evaluationCases ?? []).map(x => x.id));
  const n = maxNum(all, "AE-");
  return `AE-${String(n + 1).padStart(3, "0")}`;
}

export function activeAgentSpec(a: Agent): AgentSpecification | null {
  return (a.specifications ?? []).find(s => s.isActive) ?? (a.specifications ?? [])[0] ?? null;
}

export function duplicateAgent(source: Agent, newId: string, s: DataSnapshot): Agent {
  let specSeq = maxNum(s.agents.flatMap(a => (a.specifications ?? []).map(x => x.id)), "AS-");
  let evSeq = maxNum(s.agents.flatMap(a => (a.evaluationCases ?? []).map(x => x.id)), "AE-");
  const specifications = (source.specifications ?? []).map(sp => {
    specSeq += 1; return { ...sp, id: `AS-${String(specSeq).padStart(3, "0")}` };
  });
  const evaluationCases = (source.evaluationCases ?? []).map(ev => {
    evSeq += 1; return { ...ev, id: `AE-${String(evSeq).padStart(3, "0")}`, status: "not-run" as const };
  });
  const now = new Date().toISOString();
  return {
    ...source,
    id: newId,
    name: `${source.name} (Copy)`,
    version: "0.1.0",
    status: "Draft",
    manufacturingStage: "Draft",
    archived: false,
    humanReviewCompleted: false,
    specifications,
    evaluationCases,
    stageHistory: [{ stage: "Draft", at: now, actor: source.owner || source.steward, note: `Duplicated from ${source.id}.` }],
    releaseIds: [],
    createdAt: now, updatedAt: now,
  };
}

export interface AgentCoverage {
  missingPrompts: string[];
  missingConcepts: string[];
  missingFrameworks: string[];
  missingKnowledgeObjects: string[];
  missingPublications: string[];
  missingClientToolkits: string[];
  missingAIPacks: string[];
  missingClientTools: string[];
  brokenReferences: { source: string; targetId: string; kind: string }[];
  evaluationCount: number;
  evaluationsReviewed: number;
  evaluationsPassed: number;
  evaluationsFailed: number;
  unreviewedEvaluations: string[];
  failingEvaluations: string[];
  hasActiveSpecification: boolean;
  hasSystemPrompt: boolean;
  hasGovernance: boolean;
  hasResponsibilities: boolean;
  provenanceComplete: boolean;
  canonicalConceptRatio: number;
  coveragePercent: number;
  readinessScore: number;
  editorialScore: number;
  canonicalCompliance: number;
}

export function agentCoverage(a: Agent, s: DataSnapshot): AgentCoverage {
  const missingPrompts = (a.governingPromptIds ?? []).filter(id => !s.prompts.some(p => p.id === id));
  const missingConcepts = (a.conceptIds ?? []).filter(id => !s.concepts.some(c => c.id === id));
  const missingFrameworks = (a.frameworkIds ?? []).filter(id => !s.frameworks.some(f => f.id === id));
  const missingKnowledgeObjects = (a.knowledgeObjectIds ?? []).filter(id => !s.knowledgeObjects.some(k => k.id === id));
  const missingPublications = (a.publicationIds ?? []).filter(id => !s.publications.some(p => p.id === id));
  const missingClientToolkits = (a.clientToolkitIds ?? []).filter(id => !s.clientToolkits.some(t => t.id === id));
  const missingAIPacks = (a.aiPackIds ?? []).filter(id => !s.aiPacks.some(p => p.id === id));
  const missingClientTools = (a.clientToolIds ?? []).filter(id => !s.clientTools.some(t => t.id === id));

  const brokenReferences = [
    ...missingPrompts.map(id => ({ source: a.id, targetId: id, kind: "prompt" })),
    ...missingConcepts.map(id => ({ source: a.id, targetId: id, kind: "concept" })),
    ...missingFrameworks.map(id => ({ source: a.id, targetId: id, kind: "framework" })),
    ...missingKnowledgeObjects.map(id => ({ source: a.id, targetId: id, kind: "knowledge-object" })),
    ...missingPublications.map(id => ({ source: a.id, targetId: id, kind: "publication" })),
    ...missingClientToolkits.map(id => ({ source: a.id, targetId: id, kind: "client-toolkit" })),
    ...missingAIPacks.map(id => ({ source: a.id, targetId: id, kind: "ai-pack" })),
    ...missingClientTools.map(id => ({ source: a.id, targetId: id, kind: "client-tool" })),
  ];

  const evaluations = a.evaluationCases ?? [];
  const evaluationCount = evaluations.length;
  const evaluationsReviewed = evaluations.filter(e => e.reviewerStatus !== "Draft").length;
  const evaluationsPassed = evaluations.filter(e => e.status === "pass").length;
  const evaluationsFailed = evaluations.filter(e => e.status === "fail").length;
  const unreviewedEvaluations = evaluations.filter(e => e.reviewerStatus === "Draft").map(e => e.id);
  const failingEvaluations = evaluations.filter(e => e.status === "fail").map(e => e.id);

  const spec = activeAgentSpec(a);
  const hasActiveSpecification = !!spec;
  const hasSystemPrompt = !!(spec && spec.systemPrompt.trim());
  const hasGovernance = Boolean(a.usagePolicy?.trim() && a.boundaryConditions?.trim());
  const hasResponsibilities = (a.responsibilities ?? []).length > 0;
  const provenanceComplete = Boolean((a.provenanceNotes ?? "").trim());

  const presentConcepts = (a.conceptIds ?? []).filter(id => s.concepts.some(c => c.id === id));
  const canonicalConceptRatio = presentConcepts.length === 0 ? 1 :
    presentConcepts.filter(id => {
      const c = s.concepts.find(x => x.id === id)!;
      return c.status === "Canonical" || c.status === "Approved";
    }).length / presentConcepts.length;

  const totalRefs = (a.governingPromptIds?.length ?? 0)
    + (a.conceptIds?.length ?? 0) + (a.frameworkIds?.length ?? 0)
    + (a.knowledgeObjectIds?.length ?? 0) + (a.publicationIds?.length ?? 0)
    + (a.clientToolkitIds?.length ?? 0) + (a.aiPackIds?.length ?? 0)
    + (a.clientToolIds?.length ?? 0);
  const resolved = totalRefs - brokenReferences.length;
  const coveragePercent = totalRefs === 0 ? 100 : Math.round((resolved / totalRefs) * 100);
  const canonicalCompliance = Math.round(canonicalConceptRatio * 100);

  const editorialScore = Math.max(0, Math.round(
    100
    - (hasActiveSpecification ? 0 : 25)
    - (hasSystemPrompt ? 0 : 20)
    - (hasGovernance ? 0 : 15)
    - (hasResponsibilities ? 0 : 10)
    - unreviewedEvaluations.length * 5
    - failingEvaluations.length * 10
    - brokenReferences.length * 3
  ));

  const evalScore = evaluationCount === 0 ? 0 : (evaluationsPassed / evaluationCount) * 100;
  const readinessScore = Math.round(
    coveragePercent * 0.25 + canonicalCompliance * 0.2 + editorialScore * 0.3 + evalScore * 0.25
  );

  return {
    missingPrompts, missingConcepts, missingFrameworks, missingKnowledgeObjects,
    missingPublications, missingClientToolkits, missingAIPacks, missingClientTools,
    brokenReferences,
    evaluationCount, evaluationsReviewed, evaluationsPassed, evaluationsFailed,
    unreviewedEvaluations, failingEvaluations,
    hasActiveSpecification, hasSystemPrompt, hasGovernance, hasResponsibilities,
    provenanceComplete, canonicalConceptRatio, coveragePercent,
    readinessScore, editorialScore, canonicalCompliance,
  };
}

export function validateAgentPromotion(a: Agent, target: ManufacturingStage, s: DataSnapshot): PromotionResult {
  const cov = agentCoverage(a, s);
  const blockers: string[] = [];
  if (!a.name.trim()) blockers.push("Agent name is required.");
  if (!cov.hasActiveSpecification) blockers.push("At least one specification is required.");
  if (cov.brokenReferences.length > 0) blockers.push(`${cov.brokenReferences.length} broken references must be resolved.`);
  if (target === "Editorial" || target === "SME Review" || target === "QA" || target === "Canonical" || target === "Released") {
    if (!cov.hasSystemPrompt) blockers.push("Active specification requires a system prompt.");
    if (!cov.hasResponsibilities) blockers.push("Responsibilities are required.");
  }
  if (target === "SME Review" || target === "QA" || target === "Canonical" || target === "Released") {
    if (!cov.hasGovernance) blockers.push("Usage policy and boundary conditions are required.");
  }
  if (target === "QA" || target === "Canonical" || target === "Released") {
    if (cov.evaluationCount === 0) blockers.push("At least one evaluation case is required.");
    if (cov.unreviewedEvaluations.length > 0) blockers.push(`Unreviewed evaluations: ${cov.unreviewedEvaluations.join(", ")}.`);
    if (cov.failingEvaluations.length > 0) blockers.push(`Failing evaluations must be resolved: ${cov.failingEvaluations.join(", ")}.`);
  }
  if (target === "Canonical" || target === "Released") {
    if (!cov.provenanceComplete) blockers.push("Provenance notes required for canonical release.");
    if (cov.canonicalCompliance < 80) blockers.push(`Canonical compliance ${cov.canonicalCompliance}% below 80% threshold.`);
    if (cov.readinessScore < 85) blockers.push(`Readiness score ${cov.readinessScore} below 85 threshold.`);
    if (!a.humanReviewCompleted) blockers.push("Human review must be completed before canonical release.");
  }
  if (target === "Released") {
    if (!a.effectiveDate) blockers.push("Effective date required for Released stage.");
  }
  return { ok: blockers.length === 0, blockers, nextStage: blockers.length === 0 ? target : null };
}

/** Execute an evaluation case: deterministic pass/fail based on captured actual behavior + expected/prohibited signals. */
export function runAgentEvaluation(ev: AgentEvaluationCase, actualBehavior: string): AgentEvaluationCase {
  const text = actualBehavior.toLowerCase();
  const expected = ev.expectedBehavior.toLowerCase().split(/[.\n]/).map(s => s.trim()).filter(Boolean);
  const prohibited = ev.prohibitedBehavior.toLowerCase().split(/[.\n]/).map(s => s.trim()).filter(Boolean);
  const citationsHit = ev.requiredCitations.every(c => actualBehavior.includes(c));
  const expectedHit = expected.length === 0 ? true : expected.some(e => text.includes(e.slice(0, Math.min(24, e.length))));
  const prohibitedHit = prohibited.some(p => p.length > 4 && text.includes(p.slice(0, Math.min(24, p.length))));
  const passed = citationsHit && expectedHit && !prohibitedHit;
  return { ...ev, status: passed ? "pass" : "fail", notes: `${ev.notes}\n[${new Date().toISOString()}] ${passed ? "PASS" : "FAIL"} — ${passed ? "expected behavior matched" : (prohibitedHit ? "prohibited behavior detected" : !citationsHit ? "required citations missing" : "expected behavior missing")}`.trim() };
}

export interface AgentReleaseReport {
  agentId: string; name: string; stage: ManufacturingStage;
  coveragePercent: number; readinessScore: number;
  brokenReferences: number; unreviewedEvaluations: number;
  failingEvaluations: number;
  canonicalCompliance: number; humanReviewComplete: boolean;
  eligible: boolean; blockers: string[];
}
export function releaseAgentReports(r: Release, s: DataSnapshot): AgentReleaseReport[] {
  const ids = new Set(r.manifest.filter(m => m.entityType === "agents").flatMap(m => m.ids));
  return s.agents.filter(a => ids.has(a.id)).map(a => {
    const cov = agentCoverage(a, s);
    const promo = validateAgentPromotion(a, "Canonical", s);
    return {
      agentId: a.id, name: a.name, stage: a.manufacturingStage ?? "Draft",
      coveragePercent: cov.coveragePercent, readinessScore: cov.readinessScore,
      brokenReferences: cov.brokenReferences.length,
      unreviewedEvaluations: cov.unreviewedEvaluations.length,
      failingEvaluations: cov.failingEvaluations.length,
      canonicalCompliance: cov.canonicalCompliance,
      humanReviewComplete: a.humanReviewCompleted,
      eligible: promo.ok, blockers: promo.blockers,
    };
  });
}

export function findAgentsReferencing(s: DataSnapshot, entityId: string): Agent[] {
  return s.agents.filter(a => {
    const all = [
      ...(a.governingPromptIds ?? []),
      ...(a.conceptIds ?? []), ...(a.frameworkIds ?? []),
      ...(a.knowledgeObjectIds ?? []), ...(a.publicationIds ?? []),
      ...(a.clientToolkitIds ?? []), ...(a.aiPackIds ?? []), ...(a.clientToolIds ?? []),
    ];
    if (all.includes(entityId)) return true;
    return (a.evaluationCases ?? []).some(e => e.coversConceptIds.includes(entityId) || e.coversFrameworkIds.includes(entityId));
  });
}

// Type re-exports for consumers
export type { ClientToolkit, ClientToolkitSection, AIPack, AIPackModule, AIPackEvaluationCase, Agent, AgentSpecification, AgentEvaluationCase };

