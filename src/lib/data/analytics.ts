/**
 * Workstream 7 — Executive Intelligence & Analytics
 *
 * Deterministic derivation of manufacturing, release, automation, evaluation,
 * knowledge, workload, and forecast metrics from the existing repository.
 * Historical snapshots are stored in DataSnapshot.analyticsSnapshots.
 * No source-of-truth duplication.
 */
import type {
  DataSnapshot, AnalyticsSnapshot, MetricSnapshot, ExecutiveAlert,
  ExecutiveAlertRuleKey, ExecutiveAlertSeverity, ReportRun, ReportKind,
  Release, PublicationBlueprint, ClientToolkit, AIPack, Agent, AutomationRun,
  StageHistoryEntry, PublicationStage,
} from "./schema";
import {
  publicationCoverage, toolkitCoverage, aiPackCoverage, agentCoverage,
  evaluateReleaseGate, detectBrokenReferences,
} from "./service";
import { knowledgeHealth, releaseIntelligence } from "./intelligence";
import { memoize } from "./performance";

function snapKey(s: DataSnapshot): string {
  const n = (a?: unknown[]) => (a?.length ?? 0);
  return [
    n(s.domains), n(s.concepts), n(s.frameworks), n(s.knowledgeObjects),
    n(s.publications), n(s.clientToolkits), n(s.aiPacks), n(s.agents),
    n(s.automations), n(s.automationRuns), n(s.releases), n(s.auditEvents),
    n(s.analyticsSnapshots),
  ].join("|");
}

// ---------- Utilities ----------
const DAY_MS = 24 * 3600 * 1000;
const avg = (xs: number[]) => xs.length === 0 ? 0 : Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const iso = (d: Date | number) => new Date(d).toISOString();

export function nextAnalyticsSnapshotId(s: DataSnapshot): string {
  const n = (s.analyticsSnapshots ?? []).length + 1;
  return `MS-${String(n).padStart(3, "0")}`;
}
export function nextExecutiveAlertId(s: DataSnapshot): string {
  const n = (s.executiveAlerts ?? []).length + 1;
  return `EA-${String(n).padStart(3, "0")}`;
}
export function nextSavedViewId(s: DataSnapshot): string {
  const n = (s.savedExecutiveViews ?? []).length + 1;
  return `SV-${String(n).padStart(3, "0")}`;
}
export function nextReportRunId(s: DataSnapshot): string {
  const n = (s.reportRuns ?? []).length + 1;
  return `RPT-${String(n).padStart(3, "0")}`;
}

// ---------- Current metric derivation ----------
export interface ExecutiveMetrics {
  overallHealth: number;
  knowledgeHealth: number;
  publicationReadiness: number;
  toolkitReadiness: number;
  aiPackReadiness: number;
  agentReadiness: number;
  automationSuccessRate: number;
  releaseConfidence: number;
  pendingApprovals: number;
  overdueReviews: number;
  brokenReferences: number;
  blockedReleases: number;
}

export function computeExecutiveMetrics(s: DataSnapshot): ExecutiveMetrics {
  const health = knowledgeHealth(s);
  const pubReady = avg(s.publications.filter(p => !p.archived).map(p => publicationCoverage(p, s).readinessScore));
  const tkReady = avg((s.clientToolkits ?? []).filter(t => !t.archived).map(t => toolkitCoverage(t, s).readinessScore));
  const apReady = avg((s.aiPacks ?? []).filter(a => !a.archived).map(a => aiPackCoverage(a, s).readinessScore));
  const agReady = avg((s.agents ?? []).filter(a => !a.archived).map(a => agentCoverage(a, s).readinessScore));

  const runs = s.automationRuns ?? [];
  const finished = runs.filter(r => r.status === "succeeded" || r.status === "failed");
  const automationSuccessRate = finished.length === 0 ? 100
    : Math.round((finished.filter(r => r.status === "succeeded").length / finished.length) * 100);

  const releaseConfs = s.releases.map(r => releaseIntelligence(r, s).confidenceScore);
  const releaseConfidence = releaseConfs.length ? avg(releaseConfs) : 0;

  const pendingApprovals = runs.filter(r => r.status === "waiting-approval").length;
  const overdueReviews = s.concepts.filter(c => {
    if (!c.lastReviewedAt) return true;
    const last = new Date(c.lastReviewedAt).getTime();
    return Date.now() - last > c.reviewCadenceMonths * 30 * DAY_MS;
  }).length;
  const brokenReferences = detectBrokenReferences(s).length;
  const blockedReleases = s.releases.filter(r => {
    const g = evaluateReleaseGate(r);
    return g.passed < g.total || r.blockingErrors > 0;
  }).length;

  return {
    overallHealth: health.overall,
    knowledgeHealth: health.overall,
    publicationReadiness: pubReady,
    toolkitReadiness: tkReady,
    aiPackReadiness: apReady,
    agentReadiness: agReady,
    automationSuccessRate,
    releaseConfidence,
    pendingApprovals,
    overdueReviews,
    brokenReferences,
    blockedReleases,
  };
}

export function metricsToSnapshotEntries(m: ExecutiveMetrics): MetricSnapshot[] {
  return [
    { key: "health.overall", value: m.overallHealth, unit: "percent" },
    { key: "knowledge.health", value: m.knowledgeHealth, unit: "percent" },
    { key: "publication.readiness", value: m.publicationReadiness, unit: "percent" },
    { key: "toolkit.readiness", value: m.toolkitReadiness, unit: "percent" },
    { key: "aipack.readiness", value: m.aiPackReadiness, unit: "percent" },
    { key: "agent.readiness", value: m.agentReadiness, unit: "percent" },
    { key: "automation.successRate", value: m.automationSuccessRate, unit: "percent" },
    { key: "release.confidence", value: m.releaseConfidence, unit: "percent" },
    { key: "approvals.pending", value: m.pendingApprovals, unit: "count" },
    { key: "reviews.overdue", value: m.overdueReviews, unit: "count" },
    { key: "references.broken", value: m.brokenReferences, unit: "count" },
    { key: "releases.blocked", value: m.blockedReleases, unit: "count" },
  ];
}

export function captureAnalyticsSnapshot(s: DataSnapshot, actor: string, note?: string): AnalyticsSnapshot {
  return {
    id: nextAnalyticsSnapshotId(s),
    at: new Date().toISOString(),
    actor,
    metrics: metricsToSnapshotEntries(computeExecutiveMetrics(s)),
    note,
  };
}

// ---------- Trend/history helpers ----------
export interface TrendPoint { at: string; value: number; snapshotId: string }
export function metricHistory(s: DataSnapshot, key: string, scope?: string, dateFrom?: string | null, dateTo?: string | null): TrendPoint[] {
  const from = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
  const to = dateTo ? new Date(dateTo).getTime() : Infinity;
  const out: TrendPoint[] = [];
  for (const snap of s.analyticsSnapshots ?? []) {
    const t = new Date(snap.at).getTime();
    if (t < from || t > to) continue;
    for (const m of snap.metrics) {
      if (m.key !== key) continue;
      if (scope && m.scope !== scope) continue;
      out.push({ at: snap.at, value: m.value, snapshotId: snap.id });
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

export function trendSlope(points: TrendPoint[]): number {
  if (points.length < 2) return 0;
  return points[points.length - 1]!.value - points[0]!.value;
}

// ---------- Manufacturing analytics ----------
export interface StageCycleSummary {
  entityKind: string;
  stage: PublicationStage;
  count: number;
  avgDays: number;
}

function stageCyclesFrom(entries: StageHistoryEntry[]): Record<string, number[]> {
  // Returns map of stage → array of days spent in that stage.
  const sorted = [...entries].sort((a, b) => a.at.localeCompare(b.at));
  const out: Record<string, number[]> = {};
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i]!;
    const nxt = sorted[i + 1]!;
    const days = (new Date(nxt.at).getTime() - new Date(cur.at).getTime()) / DAY_MS;
    if (days >= 0) (out[cur.stage] ??= []).push(days);
  }
  return out;
}

export function manufacturingAnalytics(s: DataSnapshot): {
  stageCycles: StageCycleSummary[];
  bottlenecks: StageCycleSummary[];
  releasedThisPeriod: number;
  workInProgressAgingDays: number;
  reworkCount: number;
} {
  const kinds: [string, { stageHistory: StageHistoryEntry[]; manufacturingStage?: PublicationStage }[]][] = [
    ["Publication", s.publications],
    ["Client Toolkit", s.clientToolkits ?? []],
    ["AI Pack", s.aiPacks ?? []],
    ["Agent", s.agents ?? []],
  ];
  const bucket: Record<string, Record<string, number[]>> = {};
  for (const [kind, items] of kinds) {
    bucket[kind] = {};
    for (const it of items) {
      const cycles = stageCyclesFrom(it.stageHistory ?? []);
      for (const [stage, days] of Object.entries(cycles)) {
        (bucket[kind][stage] ??= []).push(...days);
      }
    }
  }
  const stageCycles: StageCycleSummary[] = [];
  for (const [kind, byStage] of Object.entries(bucket)) {
    for (const [stage, days] of Object.entries(byStage)) {
      stageCycles.push({
        entityKind: kind, stage: stage as PublicationStage,
        count: days.length,
        avgDays: days.length ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10 : 0,
      });
    }
  }
  const bottlenecks = [...stageCycles].sort((a, b) => b.avgDays - a.avgDays).slice(0, 5);

  const releasedThisPeriod = s.releases.filter(r => r.stage === "Canonical").length;

  // WIP aging: average days since latest stage transition for non-released assets.
  const wipDays: number[] = [];
  const nowT = Date.now();
  for (const [, items] of kinds) {
    for (const it of items) {
      const last = (it.stageHistory ?? []).slice(-1)[0];
      if (!last) continue;
      if (it.manufacturingStage === "Released") continue;
      wipDays.push((nowT - new Date(last.at).getTime()) / DAY_MS);
    }
  }
  const workInProgressAgingDays = wipDays.length ? Math.round(wipDays.reduce((a, b) => a + b, 0) / wipDays.length) : 0;

  // Rework: any stage backward movement.
  const stageOrder: PublicationStage[] = ["Draft","Editorial","SME Review","QA","Canonical","Released"];
  const rankOf: Record<string, number> = Object.fromEntries(stageOrder.map((s, i) => [s, i]));
  let reworkCount = 0;
  for (const [, items] of kinds) {
    for (const it of items) {
      const hist = (it.stageHistory ?? []);
      for (let i = 1; i < hist.length; i++) {
        if ((rankOf[hist[i]!.stage] ?? 0) < (rankOf[hist[i - 1]!.stage] ?? 0)) reworkCount++;
      }
    }
  }

  return { stageCycles, bottlenecks, releasedThisPeriod, workInProgressAgingDays, reworkCount };
}

// ---------- Team & workload analytics (record-based, not workforce monitoring) ----------
export interface WorkloadRow { owner: string; assigned: number; pendingReview: number; overdue: number }
export function teamWorkload(s: DataSnapshot): WorkloadRow[] {
  const rows = new Map<string, WorkloadRow>();
  const bump = (owner: string, key: keyof Omit<WorkloadRow, "owner">) => {
    if (!owner) return;
    const r = rows.get(owner) ?? { owner, assigned: 0, pendingReview: 0, overdue: 0 };
    r[key] += 1;
    rows.set(owner, r);
  };
  const nowT = Date.now();
  for (const c of s.concepts) {
    bump(c.steward, "assigned");
    if (!c.humanReviewCompleted) bump(c.steward, "pendingReview");
    if (!c.lastReviewedAt || nowT - new Date(c.lastReviewedAt).getTime() > c.reviewCadenceMonths * 30 * DAY_MS) {
      bump(c.steward, "overdue");
    }
  }
  for (const p of s.publications) {
    bump(p.owner ?? p.steward, "assigned");
    if (p.manufacturingStage === "SME Review" || p.manufacturingStage === "QA") bump(p.owner ?? p.steward, "pendingReview");
  }
  for (const a of s.agents ?? []) {
    bump(a.owner ?? a.steward, "assigned");
    if (!a.humanReviewCompleted) bump(a.owner ?? a.steward, "pendingReview");
  }
  for (const tk of s.clientToolkits ?? []) bump(tk.steward, "assigned");
  for (const ap of s.aiPacks ?? []) bump(ap.steward, "assigned");
  return [...rows.values()].sort((a, b) => b.assigned - a.assigned);
}

// ---------- Release analytics ----------
export interface ReleaseAnalytics {
  cadenceDays: number | null;
  blocked: number;
  blockerCategories: Record<string, number>;
  avgManifestSize: number;
  avgConfidence: number;
}
export function releaseAnalytics(s: DataSnapshot): ReleaseAnalytics {
  const releases = [...s.releases].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let cadenceDays: number | null = null;
  if (releases.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < releases.length; i++) {
      gaps.push((new Date(releases[i]!.createdAt).getTime() - new Date(releases[i - 1]!.createdAt).getTime()) / DAY_MS);
    }
    cadenceDays = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  }
  const blockerCategories: Record<string, number> = {};
  let blocked = 0;
  const manifestSizes: number[] = [];
  const confidences: number[] = [];
  for (const r of s.releases) {
    manifestSizes.push(r.manifest.reduce((a, m) => a + m.ids.length, 0));
    const gate = evaluateReleaseGate(r);
    if (gate.passed < gate.total || r.blockingErrors > 0) {
      blocked++;
      for (const g of r.gateChecklist) if (!g.passed) blockerCategories[g.label] = (blockerCategories[g.label] ?? 0) + 1;
    }
    confidences.push(releaseIntelligence(r, s).confidenceScore);
  }
  return {
    cadenceDays, blocked, blockerCategories,
    avgManifestSize: manifestSizes.length ? Math.round(manifestSizes.reduce((a, b) => a + b, 0) / manifestSizes.length) : 0,
    avgConfidence: confidences.length ? avg(confidences) : 0,
  };
}

// ---------- Automation & operations analytics ----------
export interface AutomationAnalytics {
  successRate: number;
  totalRuns: number;
  succeeded: number;
  failed: number;
  waitingApproval: number;
  cancelled: number;
  avgDurationSeconds: number | null;
  humanInterventionRate: number;
  estimatedManualStepsAvoided: number;
  worstRecipes: { recipeId: string; failures: number }[];
}
export function automationAnalytics(s: DataSnapshot): AutomationAnalytics {
  const runs: AutomationRun[] = s.automationRuns ?? [];
  const succeeded = runs.filter(r => r.status === "succeeded").length;
  const failed = runs.filter(r => r.status === "failed").length;
  const waitingApproval = runs.filter(r => r.status === "waiting-approval").length;
  const cancelled = runs.filter(r => r.status === "cancelled").length;
  const finished = succeeded + failed;
  const successRate = finished === 0 ? 100 : Math.round((succeeded / finished) * 100);
  const durations: number[] = [];
  for (const r of runs) {
    if (r.startedAt && r.completedAt) {
      durations.push((new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 1000);
    }
  }
  const avgDurationSeconds = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
  const withApprovals = runs.filter(r => r.approvals && r.approvals.length > 0).length;
  const humanInterventionRate = runs.length === 0 ? 0 : Math.round((withApprovals / runs.length) * 100);

  // Transparent estimate: each successful step ~= 1 avoided manual step.
  const estimatedManualStepsAvoided = runs
    .filter(r => r.status === "succeeded")
    .reduce((a, r) => a + (r.stepRuns?.filter(sr => sr.status === "succeeded").length ?? 0), 0);

  const failsByRecipe = new Map<string, number>();
  for (const r of runs) if (r.status === "failed") failsByRecipe.set(r.recipeId, (failsByRecipe.get(r.recipeId) ?? 0) + 1);
  const worstRecipes = [...failsByRecipe.entries()]
    .map(([recipeId, failures]) => ({ recipeId, failures }))
    .sort((a, b) => b.failures - a.failures).slice(0, 5);

  return { successRate, totalRuns: runs.length, succeeded, failed, waitingApproval, cancelled,
    avgDurationSeconds, humanInterventionRate, estimatedManualStepsAvoided, worstRecipes };
}

// ---------- AI / Evaluation analytics ----------
export interface EvalAnalytics {
  agentEvalPassRate: number;
  agentEvalNotRun: number;
  aiPackEvalPassRate: number;
  aiPackEvalNotRun: number;
  agentHumanReviewCompleted: number;
  agentHumanReviewPending: number;
  agentStageDistribution: Record<string, number>;
  aiPackStageDistribution: Record<string, number>;
}
export function aiEvalAnalytics(s: DataSnapshot): EvalAnalytics {
  const agents = s.agents ?? [];
  const packs = s.aiPacks ?? [];
  let agPass = 0, agTotal = 0, agNR = 0;
  for (const a of agents) for (const e of a.evaluationCases ?? []) {
    agTotal++;
    if (e.status === "pass") agPass++;
    if (e.status === "not-run") agNR++;
  }
  let apPass = 0, apTotal = 0, apNR = 0;
  for (const p of packs) for (const e of p.evaluationCases ?? []) {
    apTotal++;
    if (e.status === "pass") apPass++;
    if (e.status === "not-run") apNR++;
  }
  const agentStageDistribution: Record<string, number> = {};
  const aiPackStageDistribution: Record<string, number> = {};
  for (const a of agents) agentStageDistribution[a.manufacturingStage] = (agentStageDistribution[a.manufacturingStage] ?? 0) + 1;
  for (const p of packs) aiPackStageDistribution[p.manufacturingStage] = (aiPackStageDistribution[p.manufacturingStage] ?? 0) + 1;
  return {
    agentEvalPassRate: agTotal === 0 ? 0 : Math.round((agPass / agTotal) * 100),
    agentEvalNotRun: agNR,
    aiPackEvalPassRate: apTotal === 0 ? 0 : Math.round((apPass / apTotal) * 100),
    aiPackEvalNotRun: apNR,
    agentHumanReviewCompleted: agents.filter(a => a.humanReviewCompleted).length,
    agentHumanReviewPending: agents.filter(a => !a.humanReviewCompleted).length,
    agentStageDistribution, aiPackStageDistribution,
  };
}

// ---------- Forecasting (deterministic) ----------
export interface Forecast {
  metric: string;
  scope?: string;
  currentValue: number;
  target: number;
  slopePerWeek: number;
  weeksToTarget: number | null;
  confidence: "low" | "medium" | "high";
  dataWindowWeeks: number;
  assumptions: string[];
  limitations: string[];
}
export function forecastMetricToTarget(s: DataSnapshot, key: string, target: number, scope?: string): Forecast | null {
  const points = metricHistory(s, key, scope);
  if (points.length === 0) return null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const weeks = Math.max(1, (new Date(last.at).getTime() - new Date(first.at).getTime()) / (7 * DAY_MS));
  const slopePerWeek = (last.value - first.value) / weeks;
  let weeksToTarget: number | null = null;
  if (slopePerWeek === 0) weeksToTarget = last.value >= target ? 0 : null;
  else {
    const delta = target - last.value;
    const w = delta / slopePerWeek;
    weeksToTarget = w >= 0 && Number.isFinite(w) ? Math.ceil(w) : null;
  }
  const confidence: Forecast["confidence"] = points.length >= 8 ? "high" : points.length >= 4 ? "medium" : "low";
  return {
    metric: key, scope, currentValue: last.value, target,
    slopePerWeek: Math.round(slopePerWeek * 10) / 10,
    weeksToTarget,
    confidence,
    dataWindowWeeks: Math.round(weeks * 10) / 10,
    assumptions: [
      "Linear extrapolation of observed slope",
      "No corrective interventions modeled",
      "Snapshot cadence approximated as weekly",
    ],
    limitations: [
      "Forecast is directional only; not a commitment",
      "Sensitive to sample size and outliers",
    ],
  };
}

// ---------- Alert evaluation ----------
export interface AlertRuleResult {
  ruleKey: ExecutiveAlertRuleKey;
  severity: ExecutiveAlertSeverity;
  title: string;
  message: string;
  entityIds: string[];
  metricKey: string | null;
  observedValue: number | null;
  threshold: number | null;
  explanation: string;
}

export function evaluateAlertRules(s: DataSnapshot): AlertRuleResult[] {
  const m = computeExecutiveMetrics(s);
  const out: AlertRuleResult[] = [];

  if (m.releaseConfidence < 70 && s.releases.length > 0) {
    const risky = s.releases.filter(r => releaseIntelligence(r, s).confidenceScore < 70).map(r => r.id);
    out.push({
      ruleKey: "release-at-risk", severity: "critical",
      title: "One or more releases below confidence threshold",
      message: `Average release confidence ${m.releaseConfidence}% (threshold 70%).`,
      entityIds: risky, metricKey: "release.confidence",
      observedValue: m.releaseConfidence, threshold: 70,
      explanation: "release.confidence aggregated across all releases fell below 70%.",
    });
  }
  const freshHist = metricHistory(s, "health.freshness");
  if (freshHist.length >= 2 && trendSlope(freshHist) < 0 && freshHist[freshHist.length - 1]!.value < 75) {
    out.push({
      ruleKey: "health-degradation", severity: "warning",
      title: "Knowledge freshness trending down",
      message: `Freshness fell to ${freshHist[freshHist.length - 1]!.value}% (threshold 75%).`,
      entityIds: [], metricKey: "health.freshness",
      observedValue: freshHist[freshHist.length - 1]!.value, threshold: 75,
      explanation: "Rule fires when health.freshness < 75 and 12-week slope is negative.",
    });
  }
  if (m.overdueReviews > 5) {
    out.push({
      ruleKey: "overdue-reviews", severity: "warning",
      title: `${m.overdueReviews} concepts past review cadence`,
      message: `Review backlog exceeded 5 concepts.`,
      entityIds: s.concepts.filter(c => !c.lastReviewedAt).map(c => c.id).slice(0, 20),
      metricKey: "reviews.overdue", observedValue: m.overdueReviews, threshold: 5,
      explanation: "Concepts with missing or stale lastReviewedAt beyond reviewCadenceMonths.",
    });
  }
  const runs = s.automationRuns ?? [];
  const finishedRecent = runs.filter(r => r.status === "succeeded" || r.status === "failed");
  if (finishedRecent.length >= 3 && m.automationSuccessRate < 80) {
    out.push({
      ruleKey: "automation-failure-spike", severity: "warning",
      title: "Automation success rate below 80%",
      message: `Success rate ${m.automationSuccessRate}%.`,
      entityIds: runs.filter(r => r.status === "failed").map(r => r.recipeId),
      metricKey: "automation.successRate", observedValue: m.automationSuccessRate, threshold: 80,
      explanation: "Ratio of succeeded to finished runs under 80% across at least 3 runs.",
    });
  }
  if (m.brokenReferences > 0) {
    out.push({
      ruleKey: "broken-reference-increase", severity: m.brokenReferences > 3 ? "warning" : "info",
      title: `${m.brokenReferences} broken references detected`,
      message: "One or more manifests reference missing entities.",
      entityIds: [], metricKey: "references.broken",
      observedValue: m.brokenReferences, threshold: 0,
      explanation: "detectBrokenReferences() returned non-empty.",
    });
  }
  return out;
}

// ---------- Reports ----------
export interface ReportInput {
  kind: ReportKind;
  actor: string;
  params: {
    dateFrom: string | null;
    dateTo: string | null;
    entityKinds?: string[];
    owners?: string[];
    releaseId?: string | null;
    scope?: string | null;
  };
  format?: "json" | "html";
}

export function generateReport(s: DataSnapshot, input: ReportInput): ReportRun {
  const id = nextReportRunId(s);
  const generatedAt = new Date().toISOString();
  const source = (s.analyticsSnapshots ?? []).filter(sn => {
    const t = new Date(sn.at).getTime();
    const fromT = input.params.dateFrom ? new Date(input.params.dateFrom).getTime() : -Infinity;
    const toT = input.params.dateTo ? new Date(input.params.dateTo).getTime() : Infinity;
    return t >= fromT && t <= toT;
  });
  const metrics = computeExecutiveMetrics(s);
  const manuf = manufacturingAnalytics(s);
  const rel = releaseAnalytics(s);
  const auto = automationAnalytics(s);
  const ev = aiEvalAnalytics(s);
  const health = knowledgeHealth(s);
  let payload: unknown;
  let title = "";
  let summary = "";
  switch (input.kind) {
    case "weekly-manufacturing":
      title = "Weekly Manufacturing Report";
      summary = `WIP aging ${manuf.workInProgressAgingDays}d · ${manuf.releasedThisPeriod} releases · bottleneck ${manuf.bottlenecks[0]?.stage ?? "n/a"}`;
      payload = { metrics, manufacturing: manuf, workload: teamWorkload(s) };
      break;
    case "monthly-executive":
      title = "Monthly Executive Summary";
      summary = `Overall health ${metrics.overallHealth}% · Release confidence ${metrics.releaseConfidence}%`;
      payload = { metrics, health, release: rel, automation: auto };
      break;
    case "quarterly-governance":
      title = "Quarterly Governance Review";
      summary = `${metrics.overdueReviews} overdue · ${metrics.brokenReferences} broken refs · ${metrics.blockedReleases} blocked releases`;
      payload = { metrics, alerts: evaluateAlertRules(s), health, manufacturing: manuf };
      break;
    case "release-readiness":
      title = `Release Readiness Report${input.params.releaseId ? ` — ${input.params.releaseId}` : ""}`;
      summary = `Avg confidence ${rel.avgConfidence}% · ${rel.blocked} blocked`;
      payload = input.params.releaseId
        ? { release: s.releases.find(r => r.id === input.params.releaseId) ?? null,
            intelligence: (() => { const r = s.releases.find(x => x.id === input.params.releaseId); return r ? releaseIntelligence(r, s) : null; })() }
        : { release: rel, perRelease: s.releases.map(r => ({ id: r.id, intel: releaseIntelligence(r, s) })) };
      break;
    case "knowledge-health":
      title = "Knowledge Health Report";
      summary = `Overall ${health.overall}% · ${health.recommendations.length} recommendations`;
      payload = { health, metrics };
      break;
    case "automation-operations":
      title = "Automation Operations Report";
      summary = `${auto.succeeded}/${auto.totalRuns} succeeded · ${auto.successRate}% success rate`;
      payload = { automation: auto };
      break;
    case "ai-governance":
      title = "AI Governance Report";
      summary = `Agent eval ${ev.agentEvalPassRate}% · AI Pack eval ${ev.aiPackEvalPassRate}%`;
      payload = { evaluation: ev, humanReview: { completed: ev.agentHumanReviewCompleted, pending: ev.agentHumanReviewPending } };
      break;
  }
  const now = generatedAt;
  return {
    id, kind: input.kind, title, params: input.params,
    generatedAt, actor: input.actor,
    sourceSnapshotIds: source.map(x => x.id),
    summary, payload, format: input.format ?? "json",
    createdAt: now, updatedAt: now,
  };
}

export function renderReportHtml(run: ReportRun): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]!));
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(run.title)}</title>
<style>body{font-family:Georgia,serif;max-width:800px;margin:2rem auto;color:#1e2a3a;padding:0 1rem}
h1{border-bottom:2px solid #b8862c;padding-bottom:.4rem}pre{background:#f7f2e6;padding:1rem;overflow:auto;font-family:ui-monospace,monospace;font-size:12px}
.meta{color:#556;font-size:12px;margin-bottom:1rem}</style></head><body>
<h1>${esc(run.title)}</h1>
<div class="meta">${esc(run.id)} · Generated ${esc(run.generatedAt)} · Actor ${esc(run.actor)} · Sources ${run.sourceSnapshotIds.length}</div>
<p><strong>Summary:</strong> ${esc(run.summary)}</p>
<h2>Payload</h2><pre>${esc(JSON.stringify(run.payload, null, 2))}</pre>
</body></html>`;
}

export { clamp, iso };
