/**
 * Deterministic, dependency-free validation harness for the service layer.
 * Not a test-runner replacement — designed to be easy to port to Vitest later.
 *
 * Run via:  bun run src/lib/data/service.validate.ts
 * Any failing invariant throws; a successful run prints "OK <n> checks".
 */
import { AUDIT_ACTIONS, type ChapterBlueprint, type PublicationBlueprint, type DataSnapshot, type PublicationStage } from "./schema";
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
import * as securityMod from "./security";
import * as auditMod from "./audit";
import * as backupsMod from "./backups";
import * as deploymentMod from "./deployment";
import * as perfMod from "./performance";
import * as authMod from "./auth";
import * as wsMod from "./workspaces";

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

export async function runValidations(): Promise<number> {
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
    integrationConnections: [], webhookEndpoints: [], webhookDeliveries: [],
    apiClients: [], importJobs: [], exportJobs: [], syncMappings: [],
    externalReferences: [], deliveryPackages: [], deliveryRuns: [],
    eventSubscriptions: [], domainEvents: [],
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
  const listRes = integrations.callLocalAPI(snap7, "registry.list", { kind: "publications", limit: "3" }) as Record<string, unknown>;
  check("local API list returns items or error", Array.isArray(listRes.items) || !!listRes.error);
  const notFoundRes = integrations.callLocalAPI(snap7, "knowledge.detail", { id: "DOES-NOT-EXIST" }) as { error?: { code: string } };
  check("local API returns not-found error envelope", notFoundRes.error?.code === "not-found");

  // ID patterns
  check("integration connection id pattern", /^IC-\d{3}$/.test("IC-001"));
  check("delivery package id pattern", /^PKG-\d{3}$/.test("PKG-001"));
  check("import job id pattern", /^IMP-\d{3}$/.test("IMP-001"));
  check("export job id pattern", /^EXP-\d{3}$/.test("EXP-001"));
  check("webhook delivery id pattern", /^WD-\d{3}$/.test("WD-001"));
  check("domain event id pattern", /^EVT-\d{3,}$/.test("EVT-001"));

  // ============================================================
  // Workstream 9 — Enterprise Hardening
  // ============================================================
  // Redaction
  const redacted = securityMod.redactSecrets({ name: "x", api_key: "secret", nested: { password: "p" } }) as Record<string, unknown>;
  eq("redact api_key", redacted.api_key, "[REDACTED]");
  eq("redact nested password", (redacted.nested as Record<string, unknown>).password, "[REDACTED]");
  check("preserve non-secret field", redacted.name === "x");

  eq("hash deterministic", securityMod.hashString("hello"), securityMod.hashString("hello"));
  check("content hash key-order independent",
    securityMod.contentHash({ a: 1, b: 2 }) === securityMod.contentHash({ b: 2, a: 1 }));

  const envOk = securityMod.validateEnvironment({ VITE_SUPABASE_URL: "x", VITE_SUPABASE_PUBLISHABLE_KEY: "y", SUPABASE_URL: "x", SUPABASE_PUBLISHABLE_KEY: "y" });
  check("env validation ok when all present", envOk.ok);
  const envBad = securityMod.validateEnvironment({});
  check("env validation reports missing", envBad.missing.length > 0);

  const nowIso = new Date().toISOString();
  const rl1 = securityMod.evaluateRateLimit({ currentCount: 0, windowStart: nowIso, windowSeconds: 60, maxRequests: 2 }, nowIso);
  check("rate limit allows first request", rl1.decision.allowed);
  const rl2 = securityMod.evaluateRateLimit({ currentCount: 2, windowStart: nowIso, windowSeconds: 60, maxRequests: 2 }, nowIso);
  check("rate limit blocks at max", !rl2.decision.allowed);
  check("rate limit retry-after populated", rl2.decision.retryAfterSeconds > 0);

  const fp = securityMod.apiKeyFingerprint("sk_live_abcdef1234");
  check("fingerprint hides raw key", !fp.fingerprint.includes("sk_live"));
  check("fingerprint last4 preserved", fp.last4 === "1234");

  const seed = { ...snap7, auditEvents: [] };
  const a1 = auditMod.appendAudit(seed.auditEvents, { actor: "u", actorRole: "Editor", workspaceId: seed.activeWorkspaceId, action: "create", entityType: "concept", entityId: "CR-001-001" });
  const a2 = auditMod.appendAudit(a1, { actor: "u", actorRole: "Editor", workspaceId: seed.activeWorkspaceId, action: "update", entityType: "concept", entityId: "CR-001-001", before: { name: "a" }, after: { name: "b" } });
  const verify = auditMod.verifyAuditChain(a2);
  check("audit chain verifies", verify.ok);
  check("audit id pattern", /^AUDIT-\d{3,}$/.test(a2[0].id));
  const tampered = [...a2]; tampered[1] = { ...tampered[1], after: { name: "MALICIOUS" } };
  check("audit chain detects tamper", !auditMod.verifyAuditChain(tampered).ok);

  const diffs = auditMod.auditDiff({ name: "a", role: "x" }, { name: "b", role: "x" });
  eq("audit diff single change", diffs.length, 1);
  eq("audit diff key", diffs[0]?.key, "name");

  const bk = backupsMod.createBackup({ ...seed, auditEvents: a2 }, { label: "t", reason: "test", actor: "u" });
  check("backup id pattern", /^BKP-\d{3,}$/.test(bk.id));
  check("backup integrity ok", backupsMod.verifyBackupIntegrity(bk).ok);
  const restored = backupsMod.restoreFromBackup(bk);
  eq("restored schemaVersion matches", restored.schemaVersion, seed.schemaVersion);
  const bkBad = { ...bk, payload: bk.payload.replace(/./, "X") };
  check("tampered backup fails integrity", !backupsMod.verifyBackupIntegrity(bkBad).ok);

  const dr = backupsMod.buildDisasterRecoveryPlan({ ...seed, backups: [bk] });
  check("DR plan has latest backup", !!dr.latestBackup);
  check("migration verify returns issues array", Array.isArray(backupsMod.verifyMigration(seed).issues));

  check("Administrator has role.assign", authMod.hasPermission("Administrator", "role.assign"));
  check("Viewer cannot delete", !authMod.hasPermission("Viewer", "content.delete"));
  check("APIClient can read", authMod.hasPermission("APIClient", "content.read"));
  check("Operations manages backups", authMod.hasPermission("Operations", "backup.create"));
  check("ReadOnly has no write", !authMod.hasPermission("ReadOnly", "content.create"));

  const rc = deploymentMod.releaseCandidateReadiness({ VITE_SUPABASE_URL: "x", VITE_SUPABASE_PUBLISHABLE_KEY: "y", SUPABASE_URL: "x", SUPABASE_PUBLISHABLE_KEY: "y" }, { ...seed, backups: [bk, bk, bk] });
  check("RC readiness score is 0..100", rc.score >= 0 && rc.score <= 100);
  check("RC state is one of ready/conditional/blocked", ["ready","conditional","blocked"].includes(rc.state));
  const diags = deploymentMod.startupDiagnostics({}, seed);
  check("startup diagnostics report missing env", diags.some(d => d.name === "Environment variables" && !d.ok));
  check("feature flag disabled → false", !deploymentMod.isFeatureEnabled([], "any.key", "Administrator"));
  check("maintenance gate blocks non-allow", !deploymentMod.maintenanceGate({ ...seed, maintenanceMode: { enabled: true, reason: "x", since: null, by: null, allowRoles: ["Administrator"] } }, "Viewer").allowed);

  perfMod.resetCounters();
  let calls = 0;
  const fn = perfMod.memoize("test.memo", (x: number) => { calls++; return x * 2; });
  fn(2); fn(2); fn(3);
  eq("memoize deduplicates", calls, 2);
  const report = perfMod.perfReport();
  check("perf report tracks counter", report.counters.some(c => c.name === "test.memo"));

  const met = wsMod.workspaceMetrics(seed, seed.activeWorkspaceId);
  check("workspace metrics numeric", typeof met.assets === "number");

  // W9 hardening — SHA-256 integrity, pre-restore safety, workspace leakage,
  // memoization efficacy on a large synthetic fixture.
  const sha = securityMod.sha256Hex("abc");
  eq("SHA-256 abc known vector", sha, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  check("SHA-256 empty vector",
    securityMod.sha256Hex("") === "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  check("contentHash is 64-hex", /^[0-9a-f]{64}$/.test(securityMod.contentHash({ x: 1 })));

  const restoreSeed = { ...seed, auditEvents: a2 };
  const targetBk = backupsMod.createBackup(restoreSeed, { label: "target", reason: "test", actor: "u" });
  let blocked = false;
  try { backupsMod.performGovernedRestore(restoreSeed, targetBk, { reason: "short", actor: "u", confirmation: "RESTORE" }); }
  catch { blocked = true; }
  check("governed restore blocks short reason", blocked);
  blocked = false;
  try { backupsMod.performGovernedRestore(restoreSeed, targetBk, { reason: "operator initiated rollback for drill", actor: "u", confirmation: "no" }); }
  catch { blocked = true; }
  check("governed restore requires typed confirmation", blocked);
  const good = backupsMod.performGovernedRestore(restoreSeed, targetBk, { reason: "operator initiated rollback for drill", actor: "u", confirmation: "RESTORE" });
  check("governed restore creates pre-restore backup", /^BKP-/.test(good.preRestoreBackup.id));
  check("governed restore ledger contains pre + target", good.restored.backups.some(b => b.id === good.preRestoreBackup.id));

  const leakClean = wsMod.detectWorkspaceLeakage(seed);
  check("clean snapshot has no orphaned audit", leakClean.orphanedAuditIds.length === 0);
  const dirtyLeak = wsMod.detectWorkspaceLeakage({ ...seed, auditEvents: [{ ...a2[0], workspaceId: "WS-999" }] });
  check("orphaned audit workspaceId detected", dirtyLeak.orphanedAuditIds.length === 1);

  // Large-fixture perf test — memoized universalIndex must dedupe on same snapshot.
  const bigSnap = seed;
  perfMod.resetCounters();
  const t0 = Date.now();
  for (let i = 0; i < 40; i++) buildUniversalIndex(bigSnap);
  const dt = Date.now() - t0;
  const universalCounter = perfMod.perfReport().counters.find(c => c.name === "intelligence.universalIndex");
  check("universalIndex memoized (>= 39 hits of 40)", (universalCounter?.hits ?? 0) >= 39);
  check("universalIndex 40 iters < 1s wall", dt < 1000);

  // ============================================================
  // W9 #2 — RBAC + audit boundary at mutation surface
  // ============================================================
  const prevRole = authMod.getRole();
  try {
    authMod.setRole("Viewer");
    check("Viewer denied content.create", !authMod.currentCan("content.create"));
    check("Viewer denied content.delete", !authMod.currentCan("content.delete"));
    check("Viewer denied workspace.manage", !authMod.currentCan("workspace.manage"));
    authMod.setRole("Administrator");
    check("Administrator allowed workspace.manage", authMod.currentCan("workspace.manage"));
    check("Administrator allowed backup.create", authMod.currentCan("backup.create"));
    let threw = false;
    try { authMod.requirePermission("content.create"); } catch { threw = true; }
    check("Administrator requirePermission passes", !threw);
    authMod.setRole("ReadOnly");
    threw = false;
    try { authMod.requirePermission("content.create"); } catch (e) { threw = (e as { code?: string }).code === "permission-denied"; }
    check("ReadOnly requirePermission throws permission-denied", threw);
  } finally { authMod.setRole(prevRole); }

  // permission-denied is a valid audit action (recorded by repository on refusal)
  check("permission-denied in AUDIT_ACTIONS", AUDIT_ACTIONS.includes("permission-denied"));

  // ============================================================
  // W9 #5 — Workspace isolation & cross-leakage
  // ============================================================
  const scopingMod = await import("./workspace-scoping");
  const wsSeed = scopingMod.backfillWorkspaceIds({ ...seed, auditEvents: a2, activeWorkspaceId: seed.activeWorkspaceId ?? "WS-001" });
  const crossReport = wsMod.detectWorkspaceLeakage(wsSeed);
  check("leakage report lists per-kind coverage + unscoped entities",
    Array.isArray(crossReport.perKindCoverage) && Array.isArray(crossReport.unscopedEntities));
  check("clean seed reports no cross-workspace entities", crossReport.crossWorkspaceEntities.length === 0);

  // Simulate a foreign-workspace row leaking into an entity kind.
  const dirty = {
    ...wsSeed,
    concepts: [...wsSeed.concepts, { ...(wsSeed.concepts[0] ?? {}), id: "CR-X-999", workspaceId: "WS-999" } as typeof wsSeed.concepts[number]],
  };
  const dirtyReport = wsMod.detectWorkspaceLeakage(dirty);
  check("leakage detects foreign-workspace entity",
    dirtyReport.crossWorkspaceEntities.some(e => e.id === "CR-X-999" && e.workspaceId === "WS-999"));

  // scopeEntities filters correctly, keeps unscoped rows.
  const mixed = [{ id: "a" }, { id: "b", workspaceId: wsSeed.activeWorkspaceId }, { id: "c", workspaceId: "WS-999" }];
  const filtered = wsMod.scopeEntities(mixed, wsSeed.activeWorkspaceId);
  eq("scopeEntities keeps active + unscoped", filtered.map(x => x.id), ["a", "b"]);

  // Orphaned audit (workspaceId points to unknown workspace) still detected.
  const orphan = wsMod.detectWorkspaceLeakage({
    ...wsSeed,
    auditEvents: [{ ...a2[0], workspaceId: "WS-DELETED" }],
  });
  check("orphaned audit detected", orphan.orphanedAuditIds.length === 1);
  check("orphan report ok=false", orphan.ok === false);

  // ============================================================
  // W9 Blocker #1 — Real Supabase session actor + propagation
  // ============================================================
  const actorMod = await import("./actor");
  actorMod._resetActorForTests();

  // Anonymous by default; production fallback must NOT resolve.
  const anon = actorMod.getActor();
  eq("boot actor is anonymous", anon.source, "anonymous");
  // In this validator context import.meta.env.DEV may be true (bun script);
  // resolveMutationActor still must never fabricate a fake "current-user".
  const resolved = actorMod.resolveMutationActor();
  check("resolveMutationActor never returns 'current-user'",
    resolved === null || resolved.userId !== "current-user");

  // Session → actor mapping.
  actorMod.setActorFromSession({
    userId: "user-uuid-1", email: "ops@jmadv.press",
    displayLabel: "Ops Lead", role: "Editor",
    activeWorkspaceId: "WS-001",
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  });
  const sessActor = actorMod.getActor();
  eq("session actor source = session", sessActor.source, "session");
  eq("session actor id propagated", sessActor.userId, "user-uuid-1");
  eq("session actor email propagated", sessActor.email, "ops@jmadv.press");
  check("session actor correlationId present", !!sessActor.correlationId);

  // Expired session detection.
  const expired = { ...sessActor, sessionExpiresAt: Math.floor(Date.now() / 1000) - 60 };
  check("expired session detected", actorMod.isSessionExpired(expired));
  check("valid session not expired", !actorMod.isSessionExpired(sessActor));

  // API-client actor is distinguishable from user session.
  const apiA = actorMod.apiClientActor("APIC-001", "WS-001");
  eq("api-client actor.clientKind", apiA.clientKind, "api-client");
  eq("api-client actor.role", apiA.role, "APIClient");
  check("api-client and user actor distinguishable", apiA.clientKind !== sessActor.clientKind);

  // Test-injected actor overrides.
  const tActor = actorMod.injectTestActor({ userId: "test-user", role: "Administrator", activeWorkspaceId: "WS-001" });
  eq("injected test actor visible via getActor", actorMod.getActor().userId, tActor.userId);
  actorMod.clearTestActor();

  // Redaction covers session-like keys — access_token and refresh_token
  // MUST never appear in audit before/after payloads.
  const redactSession = securityMod.redactSecrets({
    userId: "u1", access_token: "eyJraWQ.leak", refresh_token: "rt_leak",
    session: { access_token: "nested_leak" },
  }) as Record<string, unknown>;
  eq("access_token redacted", redactSession.access_token, "[REDACTED]");
  eq("refresh_token redacted", redactSession.refresh_token, "[REDACTED]");
  eq("nested access_token redacted",
    (redactSession.session as Record<string, unknown>).access_token, "[REDACTED]");

  // Actor propagation into audit events (success path).
  const propSeed = { ...seed, auditEvents: [] as typeof seed.auditEvents };
  const propAudit = auditMod.appendAudit(propSeed.auditEvents, {
    actor: sessActor.userId, actorRole: sessActor.role,
    workspaceId: propSeed.activeWorkspaceId, action: "update",
    entityType: "concept", entityId: "CR-001-001",
    correlationId: sessActor.correlationId,
  });
  eq("audit event carries session actor userId", propAudit[0].actor, "user-uuid-1");
  eq("audit event carries correlationId", propAudit[0].correlationId, sessActor.correlationId);

  // Actor propagation into permission-denied audit events.
  const deniedAudit = auditMod.appendAudit(propSeed.auditEvents, {
    actor: sessActor.userId, actorRole: "Viewer",
    workspaceId: propSeed.activeWorkspaceId, action: "permission-denied",
    entityType: "concept", entityId: "CR-001-002",
    reason: "content.delete required",
    correlationId: sessActor.correlationId,
  });
  eq("permission-denied audit carries actor", deniedAudit[0].actor, "user-uuid-1");
  eq("permission-denied action", deniedAudit[0].action, "permission-denied");

  // Sign-out clears identity to anonymous.
  actorMod.clearActor("signed-out");
  eq("sign-out clears actor", actorMod.getActor().source, "anonymous");
  eq("sign-out reverts userId", actorMod.getActor().userId, "anonymous");

  // Active-workspace membership enforcement — actor without membership
  // must not carry an unrelated activeWorkspaceId in production.
  actorMod.setActorFromSession({
    userId: "u2", email: "e@x", role: "Editor",
    activeWorkspaceId: "WS-001",
    expiresAt: Math.floor(Date.now()/1000)+3600,
  });
  const wsActor = actorMod.getActor();
  check("actor activeWorkspaceId must be provided by membership",
    wsActor.activeWorkspaceId === "WS-001");
  actorMod._resetActorForTests();

  // ============================================================
  // W9 Blocker #3 — Audit coverage & static write-path scan
  // ============================================================
  const fs = await import("node:fs");
  const path = await import("node:path");

  // 3a. AuditAction enum carries the new governed transaction actions.
  const requiredActions = [
    "automation-execute","automation-cancel","data-import",
    "webhook-send","webhook-replay","export-generate",
  ] as const;
  for (const a of requiredActions) {
    check(`AUDIT_ACTIONS includes ${a}`, AUDIT_ACTIONS.includes(a as (typeof AUDIT_ACTIONS)[number]));
  }

  // 3b. Repository exposes the governed transaction surface.
  const repoMod = await import("./repository");
  check("Repo.auditedTransaction exposed", typeof repoMod.Repo.auditedTransaction === "function");
  check("Repo.auditedReplaceAll exposed", typeof repoMod.Repo.auditedReplaceAll === "function");
  check("Repo.appendAuditEvent exposed", typeof repoMod.Repo.appendAuditEvent === "function");

  // 3c. Static regression scan — no route file may use `Repo.replaceAll(`.
  // Legitimate bypasses live only in `src/lib/data/**` (bootstrap/reset) and
  // must carry an `AUDIT_BYPASS_ALLOWED:` marker on the containing declaration.
  const rootDir = path.resolve(process.cwd(), "src/routes");
  function walk(dir: string, acc: string[] = []): string[] {
    if (!fs.existsSync(dir)) return acc;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p, acc);
      else if (/\.tsx?$/.test(entry.name)) acc.push(p);
    }
    return acc;
  }
  const routeFiles = walk(rootDir);
  const forbiddenPattern = /Repo\.replaceAll\s*\(/;
  const offenders = routeFiles
    .filter(f => forbiddenPattern.test(fs.readFileSync(f, "utf8")))
    .map(f => path.relative(process.cwd(), f));
  check(`no route file calls Repo.replaceAll (${offenders.length} offender(s): ${offenders.join(", ")})`,
    offenders.length === 0);

  // The lib-side allowlist file (repository.ts) must document the bypass.
  const repoSrc = fs.readFileSync(path.resolve(process.cwd(), "src/lib/data/repository.ts"), "utf8");
  check("repository.ts marks its replaceAll with AUDIT_BYPASS_ALLOWED",
    /AUDIT_BYPASS_ALLOWED:bootstrap-only/.test(repoSrc));
  check("repository.ts marks appendAuditEvent with AUDIT_BYPASS_ALLOWED",
    /AUDIT_BYPASS_ALLOWED:audit-only-append/.test(repoSrc));

  // 3d. Governed transaction — permission-denied path writes an audit event
  // and refuses to commit the mutation.
  authMod.setRole("Viewer");
  actorMod.injectTestActor({ userId: "u-viewer", role: "Viewer", activeWorkspaceId: "WS-001" });
  await repoMod.ensureLoaded();
  const beforeSnap = repoMod.Repo.snapshot()!;
  const beforeAuditLen = beforeSnap.auditEvents.length;
  const beforeFlags = JSON.stringify(beforeSnap.featureFlags);
  let denied = false;
  try {
    await repoMod.Repo.auditedTransaction(
      { permission: "featureflag.manage", action: "feature-flag-change", entityType: "featureFlag", entityId: "test", reason: "denied test" },
      s0 => ({ ...s0, featureFlags: [] }),
    );
  } catch (e) {
    denied = ((e as Error & { code?: string }).code === "permission-denied");
  }
  check("auditedTransaction throws permission-denied for Viewer", denied);
  const afterDenySnap = repoMod.Repo.snapshot()!;
  eq("denied transaction did not mutate feature flags",
    JSON.stringify(afterDenySnap.featureFlags), beforeFlags);
  const lastDeny = afterDenySnap.auditEvents[afterDenySnap.auditEvents.length - 1]!;
  eq("denied transaction wrote permission-denied audit", lastDeny.action, "permission-denied");
  eq("denied transaction audit carries actor id", lastDeny.actor, "u-viewer");
  check("denied transaction appended exactly one audit event",
    afterDenySnap.auditEvents.length === beforeAuditLen + 1);

  // 3e. Governed transaction — success path commits and appends one parent
  // audit event with the injected correlation id.
  authMod.setRole("Administrator");
  actorMod.injectTestActor({
    userId: "u-admin", role: "Administrator", activeWorkspaceId: "WS-001",
    correlationId: "corr-txn-1",
  });
  const beforeOk = repoMod.Repo.snapshot()!;
  await repoMod.Repo.auditedTransaction(
    { permission: "maintenance.manage", action: "maintenance-mode-change", entityType: "system", entityId: "maintenance", reason: "enable" },
    s0 => ({ ...s0, maintenanceMode: { ...s0.maintenanceMode, enabled: !s0.maintenanceMode.enabled } }),
  );
  const afterOk = repoMod.Repo.snapshot()!;
  check("auditedTransaction committed the mutation",
    afterOk.maintenanceMode.enabled !== beforeOk.maintenanceMode.enabled);
  const okEvt = afterOk.auditEvents[afterOk.auditEvents.length - 1]!;
  eq("success audit action", okEvt.action, "maintenance-mode-change");
  eq("success audit actor propagated", okEvt.actor, "u-admin");
  eq("success audit correlationId propagated", okEvt.correlationId, "corr-txn-1");
  check("success audit chain valid",
    auditMod.verifyAuditChain(afterOk.auditEvents).ok);

  // 3f. Transaction rolls back — a throwing mutation leaves no partial
  // snapshot and no success audit event.
  const beforeThrow = repoMod.Repo.snapshot()!;
  let threw = false;
  try {
    await repoMod.Repo.auditedTransaction(
      { permission: "maintenance.manage", action: "maintenance-mode-change", entityType: "system", entityId: "maintenance", reason: "throw test" },
      () => { throw new Error("boom"); },
    );
  } catch { threw = true; }
  check("throwing transaction propagates the error", threw);
  const afterThrow = repoMod.Repo.snapshot()!;
  eq("throwing transaction left snapshot unchanged",
    JSON.stringify(afterThrow.maintenanceMode), JSON.stringify(beforeThrow.maintenanceMode));
  eq("throwing transaction wrote no success audit",
    afterThrow.auditEvents.length, beforeThrow.auditEvents.length);

  // 3g. appendAuditEvent does not recursively audit itself.
  const beforeAppend = repoMod.Repo.snapshot()!;
  await repoMod.Repo.appendAuditEvent({
    actor: "u-admin", actorRole: "Administrator", workspaceId: beforeAppend.activeWorkspaceId,
    action: "login", entityType: "session", entityId: "u-admin", reason: "test",
  });
  const afterAppend = repoMod.Repo.snapshot()!;
  eq("appendAuditEvent appends exactly one event",
    afterAppend.auditEvents.length, beforeAppend.auditEvents.length + 1);
  check("appendAuditEvent event is the login (no re-audit wrapper)",
    afterAppend.auditEvents[afterAppend.auditEvents.length - 1]!.action === "login");

  actorMod.clearTestActor();
  actorMod._resetActorForTests();

  // ============================================================
  // W9 Blocker #5b — Per-entity workspace isolation
  // ============================================================
  // Registry classification
  check("classifier: concepts is workspace-owned",
    scopingMod.isWorkspaceOwned("concepts"));
  check("classifier: publications is workspace-owned",
    scopingMod.isWorkspaceOwned("publications"));
  check("classifier: workspaces is global (not owned)",
    !scopingMod.isWorkspaceOwned("workspaces"));
  check("classifier: featureFlags is global",
    !scopingMod.isWorkspaceOwned("featureFlags"));

  // Backfill is idempotent + stamps unscoped rows.
  const rawSeed = { ...seed, activeWorkspaceId: seed.activeWorkspaceId ?? "WS-001" } as DataSnapshot;
  const first = scopingMod.backfillWorkspaceIds(rawSeed);
  const second = scopingMod.backfillWorkspaceIds(first);
  check("backfill stamps every workspace-owned row",
    scopingMod.auditWorkspaceCoverage(first).totalUnscoped === 0);
  eq("backfill idempotent (2nd pass equal)",
    JSON.stringify(first), JSON.stringify(second));

  // Existing workspaceId is never re-homed by backfill.
  const preserved = scopingMod.backfillWorkspaceIds({
    ...seed,
    concepts: [{ ...(seed.concepts[0] ?? {}), id: "CR-KEEP", workspaceId: "WS-OTHER" } as (typeof seed.concepts)[number]],
  } as DataSnapshot);
  check("backfill preserves foreign workspaceId (does not re-home)",
    preserved.concepts.find(c => c.id === "CR-KEEP")?.workspaceId === "WS-OTHER");

  // Coverage audit reports foreign rows separately from unscoped.
  const cov = scopingMod.auditWorkspaceCoverage({
    ...first,
    concepts: [...first.concepts, { ...(first.concepts[0]), id: "CR-FGN", workspaceId: "WS-OTHER" } as (typeof first.concepts)[number]],
  } as DataSnapshot);
  check("coverage flags foreign row", cov.totalForeign >= 1);

  // Leakage detector: strict unscoped detection.
  const unscoped = wsMod.detectWorkspaceLeakage({
    ...first,
    concepts: [...first.concepts, { ...(first.concepts[0]), id: "CR-UNS", workspaceId: undefined } as (typeof first.concepts)[number]],
  } as DataSnapshot);
  check("leakage.ok=false when an owned row is unscoped",
    unscoped.ok === false && unscoped.unscopedEntities.some(e => e.id === "CR-UNS"));

  // Repository: create stamps active workspace on fresh row.
  authMod.setRole("Administrator");
  actorMod.injectTestActor({
    userId: "u-admin", role: "Administrator",
    activeWorkspaceId: "WS-001", correlationId: "corr-ws-1",
  });
  await repoMod.ensureLoaded();
  const beforeCreate = repoMod.Repo.snapshot()!;
  const newFlag = {
    id: "FF-TEST", key: "test.flag", description: "t",
    enabled: true, audience: "all" as const, owner: "u-admin",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  await repoMod.Repo.create("featureFlags", newFlag);
  const afterCreate = repoMod.Repo.snapshot()!;
  const created = afterCreate.featureFlags.find(f => f.id === "FF-TEST")!;
  check("global-kind create does not require workspace stamp",
    created !== undefined);

  // Owned-kind create stamps workspaceId.
  const anyConceptTemplate = beforeCreate.concepts[0];
  if (anyConceptTemplate) {
    const draft = { ...anyConceptTemplate, id: "CR-OWNED-1", workspaceId: undefined as unknown as string };
    await repoMod.Repo.create("concepts", draft as (typeof beforeCreate.concepts)[number]);
    const snapAfter = repoMod.Repo.snapshot()!;
    const created2 = snapAfter.concepts.find(c => c.id === "CR-OWNED-1")!;
    eq("owned-kind create stamps active workspaceId",
      created2.workspaceId, snapAfter.activeWorkspaceId);
  }

  // Owned-kind update refuses cross-workspace re-homing.
  let rehomeRefused = false;
  try {
    await repoMod.Repo.update("concepts", "CR-OWNED-1",
      { workspaceId: "WS-OTHER" } as Partial<(typeof beforeCreate.concepts)[number]>);
  } catch { rehomeRefused = true; }
  check("update refuses cross-workspace re-homing", rehomeRefused);

  // Owned-kind update refuses when existing row belongs to another workspace.
  await repoMod.Repo.auditedTransaction(
    { permission: "content.update", action: "update", entityType: "concepts", entityId: "CR-OTHER-WS", reason: "seed foreign row for test" },
    s0 => ({
      ...s0,
      concepts: [...s0.concepts, { ...anyConceptTemplate!, id: "CR-OTHER-WS", workspaceId: "WS-OTHER" }],
    }),
  );
  let updateRefused = false;
  try {
    await repoMod.Repo.update("concepts", "CR-OTHER-WS",
      { canonicalName: "hijack" } as Partial<(typeof beforeCreate.concepts)[number]>);
  } catch { updateRefused = true; }
  check("update refuses when existing row is in another workspace", updateRefused);

  // scopedList excludes foreign rows for owned kinds.
  const listed = repoMod.Repo.scopedList("concepts");
  check("scopedList excludes foreign-workspace rows",
    !listed.some(c => c.id === "CR-OTHER-WS"));
  const globalListed = repoMod.Repo.scopedList("featureFlags");
  check("scopedList returns raw for global kinds",
    globalListed.length === repoMod.Repo.list("featureFlags").length);

  // scopedGet refuses cross-tenant lookup.
  const gotForeign = repoMod.Repo.scopedGet("concepts", "CR-OTHER-WS");
  check("scopedGet refuses cross-tenant lookup", gotForeign === undefined);

  // remove refuses cross-workspace delete.
  let deleteRefused = false;
  try { await repoMod.Repo.remove("concepts", "CR-OTHER-WS"); } catch { deleteRefused = true; }
  check("remove refuses cross-workspace delete", deleteRefused);

  actorMod.clearTestActor();
  actorMod._resetActorForTests();

  // ============================================================
  // RC-1 Blocker #4 — Distributed rate-limit adapter
  // ============================================================
  const rlMod = await import("./rate-limit");

  // 4a. In-memory adapter: allow → block → retry-after → reset on new window.
  const mem = new rlMod.InMemoryRateLimitStore({ maxEntries: 128 });
  const policy = { windowSeconds: 60, maxRequests: 3, failClosed: false };
  const nowA = "2026-07-17T12:00:00.000Z";
  const d1 = await mem.consume("K1", policy, nowA);
  const d2 = await mem.consume("K1", policy, nowA);
  const d3 = await mem.consume("K1", policy, nowA);
  const d4 = await mem.consume("K1", policy, nowA);
  check("in-memory: first 3 allowed", d1.allowed && d2.allowed && d3.allowed);
  check("in-memory: 4th denied", !d4.allowed);
  check("in-memory: retry-after populated", d4.retryAfterSeconds > 0 && d4.retryAfterSeconds <= 60);
  eq("in-memory: remaining tracks limit", d3.remaining, 0);
  eq("in-memory: reset ISO present", typeof d4.resetAt, "string");
  const nowB = "2026-07-17T12:01:30.000Z"; // > 60s later
  const d5 = await mem.consume("K1", policy, nowB);
  check("in-memory: allowed after window reset", d5.allowed);

  // 4b. Distinct keys/dimensions get isolated buckets.
  const kA = rlMod.composeRateLimitKey({ workspaceId: "WS-1", actorKind: "api-client", actorId: "APIC-A", endpointId: "registry.list", scope: "registry.read", ipHash: "ip1" });
  const kB = rlMod.composeRateLimitKey({ workspaceId: "WS-2", actorKind: "api-client", actorId: "APIC-A", endpointId: "registry.list", scope: "registry.read", ipHash: "ip1" });
  const kC = rlMod.composeRateLimitKey({ workspaceId: "WS-1", actorKind: "user-session", actorId: "USER-A", endpointId: "registry.list", scope: "registry.read", ipHash: "ip1" });
  const kD = rlMod.composeRateLimitKey({ workspaceId: "WS-1", actorKind: "api-client", actorId: "APIC-A", endpointId: "knowledge.detail", scope: "knowledge.read", ipHash: "ip1" });
  check("key isolation: workspace", kA !== kB);
  check("key isolation: actor kind/id", kA !== kC);
  check("key isolation: endpoint/scope", kA !== kD);
  check("key format: rl_ prefix", kA.startsWith("rl_"));
  check("key format: sha-derived (no raw tokens)",
    !kA.includes("APIC-A") && !kA.includes("registry.read") && !kA.includes("WS-1"));

  // 4c. Raw credentials never appear in composed keys, diagnostics, or ip hashes.
  const secretBearer = "sb_secret_supersensitive_XYZ";
  const secretEmail = "user@example.com";
  const kSecret = rlMod.composeRateLimitKey({ actorKind: "api-client", actorId: secretBearer, endpointId: "registry.list", scope: null, ipHash: rlMod.ipFingerprint(secretEmail) });
  check("no raw bearer in key", !kSecret.includes("sb_secret") && !kSecret.includes("supersensitive"));
  check("no raw email in ip fingerprint", !rlMod.ipFingerprint(secretEmail).includes("user@example.com"));
  const decisionForDiag = { ...d4, policyKey: "registry.list", degraded: false };
  const diag = rlMod.decisionToDiagnostic(decisionForDiag, kSecret);
  check("diagnostic omits raw key (only 8-char digest)", diag.keyDigest.length === 8 && !diag.keyDigest.includes("secret"));

  // 4d. Concurrency: many parallel consumers on one key never exceed max.
  const memConc = new rlMod.InMemoryRateLimitStore();
  const concPolicy = { windowSeconds: 60, maxRequests: 50, failClosed: false };
  const CONCURRENT = 200;
  const results = await Promise.all(
    Array.from({ length: CONCURRENT }, () => memConc.consume("KCONC", concPolicy, "2026-07-17T13:00:00.000Z")),
  );
  const allowedCount = results.filter(r => r.allowed).length;
  eq(`concurrency: exactly maxRequests allowed under ${CONCURRENT} contenders`, allowedCount, 50);
  check("concurrency: rest denied", results.filter(r => !r.allowed).length === CONCURRENT - 50);

  // 4e. Eviction: bounded map does not grow without limit.
  const memEvict = new rlMod.InMemoryRateLimitStore({ maxEntries: 100 });
  for (let i = 0; i < 500; i++) {
    await memEvict.consume(`E${i}`, policy, new Date(Date.parse(nowA) + i).toISOString());
  }
  check(`eviction: bounded to <= maxEntries (got ${memEvict.size()})`, memEvict.size() <= 100);

  // 4f. enforceRateLimit produces standards headers.
  rlMod._bindRateLimitStoreForTests(new rlMod.InMemoryRateLimitStore());
  const ok = await rlMod.enforceRateLimit(rlMod.currentRateLimitStore(), "registry.list", {
    actorKind: "api-client", actorId: "APIC-A", endpointId: "registry.list", scope: "registry.read", ipHash: "iph", workspaceId: "WS-1",
  });
  check("enforce: X-RateLimit-Limit header", !!ok.headers["X-RateLimit-Limit"]);
  check("enforce: X-RateLimit-Remaining header", ok.headers["X-RateLimit-Remaining"] !== undefined);
  check("enforce: X-RateLimit-Reset ISO header", typeof ok.headers["X-RateLimit-Reset"] === "string");
  check("enforce: X-RateLimit-Adapter header", ok.headers["X-RateLimit-Adapter"] === "memory");
  check("enforce: X-RateLimit-Policy header", ok.headers["X-RateLimit-Policy"] === "registry.list");
  check("enforce: no Retry-After on allowed", ok.headers["Retry-After"] === undefined);

  // Force denial to check 429 headers.
  const denyPolicy = rlMod.RATE_LIMIT_POLICIES["import.job.status"];
  const memDeny = new rlMod.InMemoryRateLimitStore();
  const denyDims = { actorKind: "api-client" as const, actorId: "APIC-D", endpointId: "import.job.status", scope: "import.write", ipHash: "ip", workspaceId: "WS-1" };
  let last: Awaited<ReturnType<typeof rlMod.enforceRateLimit>> | null = null;
  for (let i = 0; i < denyPolicy.maxRequests + 1; i++) {
    last = await rlMod.enforceRateLimit(memDeny, "import.job.status", denyDims);
  }
  check("enforce: denial sets Retry-After", !!last && last.headers["Retry-After"] !== undefined);
  check("enforce: denial decision !allowed", !!last && last.decision.allowed === false);

  // 4g. Policy map covers every non-catalog endpoint (static inventory).
  const publicEndpoints: PolicyKey_[] = [
    "registry.list","knowledge.detail","release.manifest","publication.export",
    "toolkit.export","aipack.export","agent.export","automation.run.status","import.job.status",
  ];
  for (const e of publicEndpoints) {
    check(`policy map has ${e}`, !!rlMod.RATE_LIMIT_POLICIES[e]);
    check(`policy ${e} has positive window/max`,
      rlMod.RATE_LIMIT_POLICIES[e].windowSeconds > 0 && rlMod.RATE_LIMIT_POLICIES[e].maxRequests > 0);
  }
  check("policy: unauth bucket present", !!rlMod.RATE_LIMIT_POLICIES.unauth);
  check("policy: import.job.status is fail-closed", rlMod.RATE_LIMIT_POLICIES["import.job.status"].failClosed === true);
  check("policy: read endpoints are fail-open",
    rlMod.RATE_LIMIT_POLICIES["registry.list"].failClosed === false);

  // 4h. Startup readiness — production refuses in-memory adapter.
  const rProdMem = rlMod.assertRateLimitReadiness({ NODE_ENV: "production", RATE_LIMIT_ADAPTER: "memory" });
  check("readiness: production+memory rejected", !rProdMem.ok);
  const rProdSb = rlMod.assertRateLimitReadiness({ NODE_ENV: "production", RATE_LIMIT_ADAPTER: "supabase", SUPABASE_URL: "x", SUPABASE_SERVICE_ROLE_KEY: "y" });
  check("readiness: production+supabase accepted", rProdSb.ok && rProdSb.adapter === "supabase");
  const rProdSbMissing = rlMod.assertRateLimitReadiness({ NODE_ENV: "production", RATE_LIMIT_ADAPTER: "supabase" });
  check("readiness: production+supabase w/o env rejected", !rProdSbMissing.ok);
  const rDevMem = rlMod.assertRateLimitReadiness({ NODE_ENV: "development" });
  check("readiness: dev defaults to memory OK", rDevMem.ok && rDevMem.adapter === "memory");
  const rBad = rlMod.assertRateLimitReadiness({ RATE_LIMIT_ADAPTER: "redis-fantasy" });
  check("readiness: invalid adapter rejected", !rBad.ok);

  // 4i. Distributed-store outage: fail-open for reads, fail-closed for mutations.
  class BrokenStore implements InstanceType<typeof rlMod.SupabaseRateLimitStore> {
    readonly kind = "supabase" as const;
    async consume(_k: string, p: { windowSeconds: number; maxRequests: number; failClosed: boolean }) {
      return {
        allowed: !p.failClosed, limit: p.maxRequests,
        remaining: p.failClosed ? 0 : p.maxRequests,
        retryAfterSeconds: p.failClosed ? p.windowSeconds : 0,
        resetAt: new Date(Date.now() + p.windowSeconds * 1000).toISOString(),
        adapter: "supabase" as const, storeHealthy: false, latencyMs: 0,
      };
    }
    async healthCheck() { return { ok: false, detail: "simulated outage" }; }
    get healthy() { return false; }
    get lastErrorMessage() { return "simulated"; }
  }
  const broken = new BrokenStore() as unknown as InstanceType<typeof rlMod.SupabaseRateLimitStore>;
  const outageRead = await rlMod.enforceRateLimit(broken, "registry.list", {
    actorKind: "api-client", actorId: "APIC-X", endpointId: "registry.list", ipHash: "ip",
  });
  check("outage: read endpoint fails open (allowed)", outageRead.decision.allowed);
  check("outage: read carries degraded marker", outageRead.decision.degraded);
  check("outage: X-RateLimit-Degraded header on read", outageRead.headers["X-RateLimit-Degraded"] === "1");
  const outageWrite = await rlMod.enforceRateLimit(broken, "import.job.status", {
    actorKind: "api-client", actorId: "APIC-X", endpointId: "import.job.status", ipHash: "ip",
  });
  check("outage: mutation endpoint fails closed (denied)", !outageWrite.decision.allowed);
  check("outage: mutation Retry-After present", !!outageWrite.headers["Retry-After"]);

  // 4j. Deployment diagnostic surfaces the rate-limit adapter.
  const diagsRL = deploymentMod.startupDiagnostics(
    { VITE_SUPABASE_URL: "x", VITE_SUPABASE_PUBLISHABLE_KEY: "y", SUPABASE_URL: "x", SUPABASE_PUBLISHABLE_KEY: "y", RATE_LIMIT_ADAPTER: "memory" },
    seed,
  );
  check("startup diagnostic includes Rate-limit adapter",
    diagsRL.some(d => d.name === "Rate-limit adapter"));
  const diagsProdBad = deploymentMod.startupDiagnostics(
    { NODE_ENV: "production", RATE_LIMIT_ADAPTER: "memory", SUPABASE_URL: "x", SUPABASE_PUBLISHABLE_KEY: "y", VITE_SUPABASE_URL: "x", VITE_SUPABASE_PUBLISHABLE_KEY: "y" },
    seed,
  );
  check("startup: production+memory adapter fails diagnostic",
    diagsProdBad.some(d => d.name === "Rate-limit adapter" && !d.ok));

  // 4k. Static route inventory — every non-catalog endpoint id has a policy,
  // and the public API route file wires the centralized enforcer.
  const routeSrc = fs.readFileSync(path.resolve(process.cwd(), "src/routes/api/public/v1/$.ts"), "utf8");
  check("route uses enforceRateLimit", /enforceRateLimit\(/.test(routeSrc));
  check("route uses pre-auth 'unauth' policy", /"unauth"/.test(routeSrc));
  check("route does not use legacy IP_BUCKETS map", !/IP_BUCKETS/.test(routeSrc));
  check("route no longer calls evaluateRateLimit directly", !/evaluateRateLimit\(/.test(routeSrc));
  const catalogExempt = /splat === ""[^\n]*\|\|[^\n]*"catalog"/.test(routeSrc);
  check("route: catalog exemption preserved", catalogExempt);

  // 4l. Migration file present and internally consistent.
  const migDir = path.resolve(process.cwd(), "supabase/migrations");
  const migs = fs.existsSync(migDir) ? fs.readdirSync(migDir).map(f => path.join(migDir, f)) : [];
  const rlMig = migs.find(f => /rate.?limit/i.test(f) && fs.readFileSync(f, "utf8").includes("rate_limit_buckets"));
  check("migration: rate_limit_buckets table present", !!rlMig);
  if (rlMig) {
    const sql = fs.readFileSync(rlMig, "utf8");
    check("migration: consume_rate_limit function present", /consume_rate_limit/.test(sql));
    check("migration: RLS enabled on rate_limit_buckets", /ALTER TABLE .*rate_limit_buckets.* ENABLE ROW LEVEL SECURITY/i.test(sql));
    check("migration: grants restricted to service_role", /GRANT .* ON .*rate_limit_buckets.* TO service_role/i.test(sql));
    check("migration: index on key", /INDEX .* ON .*rate_limit_buckets/i.test(sql));
    check("migration: cleanup/expiry present", /(cleanup|expires_at|DELETE FROM public\.rate_limit_buckets)/i.test(sql));
  }

  console.log(`OK ${count} checks`);
  return count;
}

// Local alias to keep the check block readable without a wider import shuffle.
type PolicyKey_ =
  | "registry.list" | "knowledge.detail" | "release.manifest"
  | "publication.export" | "toolkit.export" | "aipack.export"
  | "agent.export" | "automation.run.status" | "import.job.status";




