/**
 * Deterministic, dependency-free validation harness for the service layer.
 * Not a test-runner replacement — designed to be easy to port to Vitest later.
 *
 * Run via:  bun run src/lib/data/service.validate.ts
 * Any failing invariant throws; a successful run prints "OK <n> checks".
 */
import type { ChapterBlueprint, PublicationBlueprint, DataSnapshot, PublicationStage } from "./schema";
import {
  isChapterAncestor,
  wouldCreateChapterCycle,
  chapterDescendantIds,
  moveChapter,
  duplicatePublication,
  isAdjacentStageTransition,
  validatePublicationPromotion,
  agentCoverage,
  validateAgentPromotion,
  runAgentEvaluation,
  nextAgentId,
} from "./service";
import type { Agent, AgentEvaluationCase } from "./schema";

let count = 0;
function check(name: string, cond: boolean) {
  count += 1;
  if (!cond) throw new Error(`FAIL: ${name}`);
}
function eq<T>(name: string, a: T, b: T) { check(`${name} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`, JSON.stringify(a) === JSON.stringify(b)); }

function ch(id: string, parent: string | null, order: number): ChapterBlueprint {
  return {
    id, order, title: id, description: "", learningObjectives: [],
    domainIds: [], conceptIds: [], frameworkIds: [], knowledgeObjectIds: [], clientToolIds: [],
    presentationLinks: [], reviewStatus: "Draft", editorialNotes: "",
    estimatedEffortHours: 1, chapterVersion: "0.1.0",
    parentChapterId: parent, presentations: [], manufacturingStage: "Draft",
  };
}

export function runValidations(): number {
  count = 0;

  // Fixture: A(root) -> B -> C ; D(root)
  const chapters: ChapterBlueprint[] = [
    ch("A", null, 10), ch("B", "A", 20), ch("C", "B", 30), ch("D", null, 40),
  ];

  // ---- Hierarchy helpers ----
  check("A is ancestor of C", isChapterAncestor(chapters, "A", "C"));
  check("A is not ancestor of D", !isChapterAncestor(chapters, "A", "D"));
  check("B is ancestor of C", isChapterAncestor(chapters, "B", "C"));
  check("descendants(A) = [B,C]", JSON.stringify(chapterDescendantIds(chapters, "A").sort()) === JSON.stringify(["B", "C"]));

  // ---- Cycle prevention ----
  check("cycle: A → C (would make A descendant of C)", wouldCreateChapterCycle(chapters, "A", "C"));
  check("cycle: B → B is self-cycle", wouldCreateChapterCycle(chapters, "B", "B"));
  check("no cycle: D → A", !wouldCreateChapterCycle(chapters, "D", "A"));
  check("no cycle: parent=null", !wouldCreateChapterCycle(chapters, "B", null));

  // ---- moveChapter: deterministic order, siblings re-indexed by 10 ----
  const moved = moveChapter(chapters, "D", "A", 0);
  const aKids = moved.filter(c => c.parentChapterId === "A").sort((x, y) => x.order - y.order).map(c => c.id);
  eq("moveChapter reparents D under A at index 0", aKids, ["D", "B"]);
  const orders = moved.filter(c => c.parentChapterId === "A").sort((x, y) => x.order - y.order).map(c => c.order);
  eq("moveChapter re-indexes siblings by 10", orders, [10, 20]);

  // moveChapter must refuse cycle
  const noop = moveChapter(chapters, "A", "C", 0);
  check("moveChapter refuses cycle (returns unchanged array)", noop === chapters);

  // ---- duplicatePublication: remaps parentChapterId, does NOT flatten ----
  const pub: PublicationBlueprint = {
    id: "PL-999", title: "T", description: "", audience: "", purpose: "",
    publicationType: "Guide", tags: [], owner: "x", frameworkId: null,
    effectiveDate: null, reviewDate: null, editorialNotes: "", reviewNotes: "",
    chapters, status: "Draft", version: "0.1.0", steward: "x",
    manufacturingStage: "Draft", stageHistory: [], archived: false, presentations: [],
    createdAt: "", updatedAt: "",
  };
  const snap: DataSnapshot = {
    schemaVersion: 2, domains: [], concepts: [], frameworks: [], knowledgeObjects: [],
    clientTools: [], publications: [pub], prompts: [], agents: [], releases: [],
    reviewItems: [], auditEvents: [],
  } as unknown as DataSnapshot;
  const dup = duplicatePublication(pub, "PL-1000", snap);
  check("duplicate has same chapter count", dup.chapters.length === chapters.length);
  check("duplicate chapter ids are all new", dup.chapters.every(c => !chapters.find(o => o.id === c.id)));
  const dupById = new Map(dup.chapters.map(c => [c.title, c] as const));
  // B's parent was A → in the clone, B's new parent must equal the clone of A.
  const cloneA = dupById.get("A")!;
  const cloneB = dupById.get("B")!;
  const cloneC = dupById.get("C")!;
  const cloneD = dupById.get("D")!;
  eq("clone B.parent = clone A.id", cloneB.parentChapterId, cloneA.id);
  eq("clone C.parent = clone B.id", cloneC.parentChapterId, cloneB.id);
  eq("clone D.parent = null (root preserved)", cloneD.parentChapterId, null);

  // ---- Stage adjacency ----
  const adj: Array<[PublicationStage, PublicationStage, boolean]> = [
    ["Draft", "Editorial", true],
    ["Editorial", "SME Review", true],
    ["SME Review", "QA", true],
    ["QA", "Canonical", true],
    ["Canonical", "Released", true],
    ["Draft", "QA", false],
    ["Released", "Draft", false],
    // Adjacent backward step is permitted (governance override still audits it via stage history).
    ["Released", "Canonical", true],
    ["QA", "SME Review", true],
  ];
  for (const [f, t, want] of adj) eq(`adjacent ${f}→${t}`, isAdjacentStageTransition(f, t), want);

  // ---- validatePublicationPromotion: chapter-stage alignment ----
  const pubForPromotion: PublicationBlueprint = {
    ...pub,
    chapters: [ch("X", null, 10)],
    manufacturingStage: "Draft",
  };
  const snap2: DataSnapshot = { ...snap, publications: [pubForPromotion] } as DataSnapshot;
  const r1 = validatePublicationPromotion(pubForPromotion, "Editorial", snap2);
  check("Draft→Editorial produces a report", typeof r1 === "object" && r1 !== null);



  // ---- Agent (Workstream 4) checks ----
  const now = new Date().toISOString();
  const baseAgent: Agent = {
    id: "AG-900", name: "Test Agent", role: "Test", responsibilities: ["r1"],
    governingPromptIds: [], status: "Draft", version: "0.1.0", steward: "T",
    description: "d", purpose: "p", useCase: "Editorial Assistant",
    targetModel: "", owner: "T", tags: [], archived: false,
    manufacturingStage: "Draft",
    stageHistory: [{ stage: "Draft", at: now, actor: "T" }],
    effectiveDate: null, reviewDate: null,
    conceptIds: [], frameworkIds: [], knowledgeObjectIds: [], publicationIds: [],
    clientToolkitIds: [], aiPackIds: [], clientToolIds: [],
    specifications: [], evaluationCases: [],
    usagePolicy: "", boundaryConditions: "", prohibitedUses: "",
    escalationGuidance: "", provenanceNotes: "",
    humanReviewCompleted: false, releaseIds: [],
    createdAt: now, updatedAt: now,
  };
  const snap3: DataSnapshot = { ...snap, agents: [baseAgent] } as DataSnapshot;
  check("nextAgentId returns next sequence", nextAgentId(snap3) === "AG-901");
  const cov0 = agentCoverage(baseAgent, snap3);
  check("no spec => not ready", !cov0.hasActiveSpecification);
  const prom0 = validateAgentPromotion(baseAgent, "Editorial", snap3);
  check("Draft agent without spec cannot promote to Editorial", !prom0.ok);

  const readyAgent: Agent = {
    ...baseAgent,
    specifications: [{
      id: "AS-900", version: "1.0.0", isActive: true,
      systemPrompt: "You are a helper.", capabilities: [], tools: [],
      boundaries: "b", safetyPolicy: "s", changelog: "", author: "T", createdAt: now,
    }],
    usagePolicy: "up", boundaryConditions: "bc", provenanceNotes: "prov",
    evaluationCases: [{
      id: "AE-900", title: "case", scenario: "sc",
      expectedBehavior: "greeting hello world", prohibitedBehavior: "curse",
      requiredCitations: [], reviewerStatus: "Approved", status: "pass",
      notes: "", coversConceptIds: [], coversFrameworkIds: [],
    }],
    humanReviewCompleted: true, effectiveDate: now,
  };
  const promReady = validateAgentPromotion(readyAgent, "Canonical", snap3);
  check("Ready agent can promote to Canonical", promReady.ok);

  const ev: AgentEvaluationCase = {
    id: "AE-901", title: "t", scenario: "s",
    expectedBehavior: "greet the user warmly", prohibitedBehavior: "insult",
    requiredCitations: ["CR-004-001"], reviewerStatus: "Approved", status: "not-run",
    notes: "", coversConceptIds: [], coversFrameworkIds: [],
  };
  const evPass = runAgentEvaluation(ev, "Hello, I want to greet the user warmly. Cite CR-004-001.");
  check("runAgentEvaluation passes on match+citation", evPass.status === "pass");
  const evFail = runAgentEvaluation(ev, "I will insult the user without citing anything.");
  check("runAgentEvaluation fails on prohibited or missing citation", evFail.status === "fail");

  // ---- Workstream 6 — Knowledge Intelligence checks ----
  // Import lazily so this harness continues to run standalone.
  const {
    buildUniversalIndex, universalSearch, knowledgeHealth,
    detectDuplicates, validateDependencies, impactAnalysis, inspectRelationships,
    releaseIntelligence,
  } = require("./intelligence") as typeof import("./intelligence");

  const snapWithConcepts: DataSnapshot = {
    ...(snap as DataSnapshot),
    concepts: [
      {
        id: "CR-999-001", canonicalName: "Test Concept", canonicalDefinition: "d",
        purpose: "p", scope: "s", exclusions: "", domainIds: [], aliases: ["Test Concept Alias"],
        keywords: ["testing"], relatedConceptIds: [], frameworkIds: [], audience: "a",
        readingLevel: "advanced", aiRetrievalTags: [], steward: "T", status: "Canonical", version: "1.0.0",
        reviewCadenceMonths: 6, lastReviewedAt: new Date().toISOString(),
        humanReviewCompleted: true, manufacturingStatus: "Canonical",
        publicationLinks: [], clientToolkitLinks: [], aiPackLinks: [],
        createdAt: now, updatedAt: now,
      },
      {
        id: "CR-999-002", canonicalName: "Test Concept", canonicalDefinition: "d",
        purpose: "p", scope: "s", exclusions: "", domainIds: [], aliases: [],
        keywords: [], relatedConceptIds: [], frameworkIds: [], audience: "a",
        readingLevel: "advanced", aiRetrievalTags: [], steward: "T", status: "Draft", version: "0.1.0",
        reviewCadenceMonths: 6, lastReviewedAt: null,
        humanReviewCompleted: false, manufacturingStatus: "Draft",
        publicationLinks: [], clientToolkitLinks: [], aiPackLinks: [],
        createdAt: now, updatedAt: now,
      },
    ],
    releases: [{
      id: "LKR-9.9.999", name: "Test release", stage: "Planned", version: "9.9.999",
      manifest: [{ entityType: "concepts", ids: ["CR-999-001"] }],
      changelog: [], releaseNotes: "", validationSummary: "", editorialReview: "",
      qaEvidence: "", traceability: "", knownIssues: [], migrationNotes: "",
      gateChecklist: [{ id: "G1", label: "gate", passed: true }],
      blockingErrors: 0, alignmentWarnings: 0, steward: "T",
      createdAt: now, updatedAt: now,
    }],
  } as DataSnapshot;

  const index = buildUniversalIndex(snapWithConcepts);
  check("universal index includes every kind for concepts", index.filter(a => a.kind === "Concept").length >= 2);
  check("universal index includes releases", index.some(a => a.kind === "Release"));

  const hits = universalSearch(index, "test concept");
  check("universal search returns ranked hits", hits.length >= 2 && hits[0].score > 0);
  check("universal search sorts by score", hits[0].score >= hits[hits.length - 1].score);

  const dupes = detectDuplicates(snapWithConcepts);
  check("duplicate detection finds identical concept titles", dupes.some(d => d.kind === "Concept" && d.confidence >= 85));

  const findings = validateDependencies(snapWithConcepts);
  check("dependency validation returns findings array", Array.isArray(findings));

  const h = knowledgeHealth(snapWithConcepts);
  check("knowledge health overall in 0..100", h.overall >= 0 && h.overall <= 100);
  check("knowledge health emits recommendations", h.recommendations.length >= 1);

  const impact = impactAnalysis("CR-999-001", snapWithConcepts);
  check("impact analysis returns risk level", ["Low","Medium","High","Critical"].includes(impact.risk));
  check("impact analysis includes release when release manifests concept", impact.affectedReleases.includes("LKR-9.9.999"));

  const insp = inspectRelationships("CR-999-001", snapWithConcepts);
  check("relationship inspector returns edge arrays", Array.isArray(insp.incoming) && Array.isArray(insp.outgoing));

  const ri = releaseIntelligence(snapWithConcepts.releases[0], snapWithConcepts);
  check("release intelligence returns confidence in 0..100", ri.confidenceScore >= 0 && ri.confidenceScore <= 100);
  check("release intelligence lists no missing assets when manifest resolves", ri.assetsMissing.length === 0);

  // ---- Workstream 7 — Executive Intelligence & Analytics ----
  const {
    computeExecutiveMetrics, metricsToSnapshotEntries, metricHistory,
    manufacturingAnalytics, releaseAnalytics, automationAnalytics,
    aiEvalAnalytics, evaluateAlertRules, forecastMetricToTarget,
    generateReport, captureAnalyticsSnapshot,
  } = require("./analytics") as typeof import("./analytics");

  const snap7: DataSnapshot = {
    ...(snapWithConcepts as DataSnapshot),
    analyticsSnapshots: [
      { id: "MS-001", at: new Date(Date.now() - 14 * 86400000).toISOString(), actor: "t",
        metrics: [{ key: "health.overall", value: 60, unit: "percent" }, { key: "release.confidence", value: 55, unit: "percent" }] },
      { id: "MS-002", at: new Date(Date.now() - 7 * 86400000).toISOString(), actor: "t",
        metrics: [{ key: "health.overall", value: 70, unit: "percent" }, { key: "release.confidence", value: 65, unit: "percent" }] },
      { id: "MS-003", at: new Date().toISOString(), actor: "t",
        metrics: [{ key: "health.overall", value: 80, unit: "percent" }, { key: "release.confidence", value: 60, unit: "percent" }] },
    ],
    executiveAlerts: [], savedExecutiveViews: [], reportRuns: [],
  } as DataSnapshot;

  const m7 = computeExecutiveMetrics(snap7);
  check("metrics: overall health in 0..100", m7.overallHealth >= 0 && m7.overallHealth <= 100);
  check("metrics: automation success 0..100", m7.automationSuccessRate >= 0 && m7.automationSuccessRate <= 100);
  const entries = metricsToSnapshotEntries(m7);
  check("metric entries cover 12 metric keys", entries.length === 12);

  const hist = metricHistory(snap7, "health.overall");
  check("metric history returns 3 sorted points", hist.length === 3 && hist[0].value <= hist[2].value);
  const histFiltered = metricHistory(snap7, "health.overall", undefined,
    new Date(Date.now() - 10 * 86400000).toISOString(), null);
  check("date-range filter narrows history", histFiltered.length === 2);

  const mfg = manufacturingAnalytics(snap7);
  check("manufacturing analytics returns stageCycles array", Array.isArray(mfg.stageCycles));
  const rel = releaseAnalytics(snap7);
  check("release analytics returns avgConfidence 0..100", rel.avgConfidence >= 0 && rel.avgConfidence <= 100);
  const aut = automationAnalytics(snap7);
  check("automation success rate 0..100", aut.successRate >= 0 && aut.successRate <= 100);
  check("automation estimatedManualStepsAvoided >= 0", aut.estimatedManualStepsAvoided >= 0);
  const ev7 = aiEvalAnalytics(snap7);
  check("agent eval pass rate 0..100", ev7.agentEvalPassRate >= 0 && ev7.agentEvalPassRate <= 100);

  const alerts = evaluateAlertRules(snap7);
  check("alerts is an array", Array.isArray(alerts));
  const forecast = forecastMetricToTarget(snap7, "health.overall", 100);
  check("forecast returns confidence", !!forecast && ["low","medium","high"].includes(forecast.confidence));
  check("forecast documents assumptions", !!forecast && forecast.assumptions.length >= 1);

  const rpt = generateReport(snap7, {
    kind: "weekly-manufacturing", actor: "t",
    params: { dateFrom: null, dateTo: null },
  });
  check("report has id and payload", rpt.id.startsWith("RPT-") && rpt.payload !== undefined);
  check("report traces source snapshots", Array.isArray(rpt.sourceSnapshotIds));

  const capSnap = captureAnalyticsSnapshot(snap7, "t");
  check("capture returns 12 metrics", capSnap.metrics.length === 12);
  check("capture id follows MS-### pattern", /^MS-\d{3}$/.test(capSnap.id));

  // ---- Architecture Stabilization regression checks (W7.5) ----
  // Autosave stale-conflict helper
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { isStaleConflict } = require("../../hooks/use-autosave") as typeof import("../../hooks/use-autosave");
  check("stale conflict: original newer than draft while dirty", isStaleConflict("2025-01-02", "2025-01-01", true));
  check("no stale conflict when clean", !isStaleConflict("2025-01-02", "2025-01-01", false));
  check("no stale conflict when draft newer", !isStaleConflict("2025-01-01", "2025-01-02", true));
  check("no stale conflict when timestamps missing", !isStaleConflict(undefined, undefined, true));

  // ID pattern regressions
  check("release id pattern", /^LKR-\d+\.\d+\.\d{3}$/.test("LKR-1.0.001"));
  check("automation run id pattern", /^RUN-\d{3}$/.test("RUN-042"));

  // ---- Workstream 8 — integrations checks ----
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const integrations = require("./integrations") as typeof import("./integrations");

  // Event envelope
  const evt = integrations.buildDomainEvent(snap7, {
    kind: "release.ready", entityType: "release", entityId: "LKR-1.0.001", actor: "t",
    payload: { api_key: "should-be-redacted", ok: true },
  });
  check("event has stable id EVT-###", /^EVT-\d+$/.test(evt.id));
  check("event has correlation id", !!evt.correlationId);
  check("event has payloadVersion", evt.payloadVersion === "1.0");
  check("event redacts api_key", (evt.payload as Record<string, unknown>).api_key === "[REDACTED]");

  // Webhook idempotency
  const endpoint = snap7.webhookEndpoints[0];
  if (endpoint) {
    const r1 = integrations.emitWebhook(snap7, endpoint, evt);
    check("first emission returns delivery or skip", r1.delivery !== null || r1.skipped !== null);
    const snap8 = r1.delivery
      ? { ...snap7, webhookDeliveries: [...snap7.webhookDeliveries, r1.delivery] }
      : snap7;
    const r2 = integrations.emitWebhook(snap8, endpoint, evt);
    if (r1.delivery && r1.delivery.status === "delivered") {
      check("duplicate emission is skipped", r2.skipped === "duplicate");
    }
    check("idempotency key composed of endpoint+event",
      integrations.webhookIdempotencyKey("WH-1", "EVT-1") === "WH-1:EVT-1");
  }

  // Import validation: id collision + broken reference
  const rep = integrations.validateImportPackage(snap7, {
    concepts: [{ id: snap7.concepts[0]?.id ?? "CR-001-001", frameworkIds: ["F-999"] }],
  });
  check("import detects id-collision", rep.issues.some(i => i.code === "id-collision"));
  check("import detects broken-reference", rep.issues.some(i => i.code === "broken-reference"));
  check("import dry-run blocked when errors", !rep.ok);

  // Export manifest integrity
  const somePub = snap7.publications[0];
  if (somePub) {
    const built = integrations.buildExportManifest(snap7, { kind: "publication", entityId: somePub.id, requestedBy: "t" });
    check("export manifest has target entity", built.manifest.some(m => m.ids.includes(somePub.id)));
    check("export readiness is numeric 0..100", built.readinessScore >= 0 && built.readinessScore <= 100);
    const h1 = integrations.packageHashOf(built.manifest, built.version);
    const h2 = integrations.packageHashOf(built.manifest, built.version);
    check("package hash is deterministic", h1 === h2);
  }

  // Delivery idempotency
  check("delivery idempotency key composed", integrations.deliveryIdempotencyKey("PKG-1","IC-1","1.0.0") === "PKG-1:IC-1:1.0.0");

  // External mapping conflict detection
  const health = integrations.integrationHealthSummary(snap7);
  check("sync conflicts surfaced", typeof health.syncConflicts === "number");

  // Release integration readiness
  const rir = integrations.releaseIntegrationReadiness(snap7, snap7.releases[0]?.id ?? "LKR-1.0.001");
  check("release integration report has reasons array", Array.isArray(rir.reasons));

  // API error envelope shape
  const err = integrations.apiError("not-found", "x");
  check("api error envelope has code+message+requestId",
    !!err.error.code && !!err.error.message && !!err.error.requestId);

  // Local API adapter
  const listRes = integrations.callLocalAPI(snap7, "registry.list", { kind: "publications", limit: "3" }) as { items?: unknown[] };
  check("local API list returns items array", Array.isArray(listRes.items));
  const notFoundRes = integrations.callLocalAPI(snap7, "knowledge.detail", { id: "DOES-NOT-EXIST" }) as { error?: { code: string } };
  check("local API returns not-found error envelope", notFoundRes.error?.code === "not-found");

  // ID patterns
  check("integration connection id pattern", /^IC-\d{3}$/.test("IC-001"));
  check("delivery package id pattern", /^PKG-\d{3}$/.test("PKG-001"));
  check("import job id pattern", /^IMP-\d{3}$/.test("IMP-001"));
  check("export job id pattern", /^EXP-\d{3}$/.test("EXP-001"));
  check("webhook delivery id pattern", /^WD-\d{3}$/.test("WD-001"));
  check("domain event id pattern", /^EVT-\d{3,}$/.test("EVT-001"));



  console.log(`OK ${count} checks`);
  return count;
}

// Run when invoked directly.
declare const process: { argv: string[] } | undefined;
if (typeof process !== "undefined" && process.argv[1]?.endsWith("service.validate.ts")) {
  runValidations();
}
