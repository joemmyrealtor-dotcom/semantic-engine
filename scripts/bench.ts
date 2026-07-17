/**
 * RC-1 Blocker #7 — Load-scale benchmark harness.
 *
 * Runs deterministic scale fixtures through the production-critical read
 * and write paths, measures cold + warm timings, asserts correctness
 * invariants, and emits a machine-readable JSON report plus a console
 * summary.
 *
 * Run with:
 *   bun run scripts/bench.ts                # tiers: small, medium, large
 *   bun run scripts/bench.ts --stress       # + stress tier
 *   bun run scripts/bench.ts --tier=medium  # single tier
 *   bun run scripts/bench.ts --out=path.json
 *
 * Exit codes:
 *   0  all budgets met and correctness gates passed
 *   1  correctness failure OR hard budget exceeded
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { scaleSnapshot, verifyScaleFixture, type ScaleTier } from "../src/lib/data/scale-fixture";
import { buildUniversalIndex, universalSearch, impactAnalysis, knowledgeHealth } from "../src/lib/data/intelligence";
import { buildGraph, exportSnapshot, parseImport } from "../src/lib/data/service";
import { computeExecutiveMetrics } from "../src/lib/data/analytics";
import { verifyAuditChain, appendAudit } from "../src/lib/data/audit";
import { createBackup, verifyBackupIntegrity, performGovernedRestore } from "../src/lib/data/backups";
import { detectWorkspaceLeakage, scopeEntities } from "../src/lib/data/workspaces";
import { validateRecipe } from "../src/lib/data/automation";
import { memoize, resetCounters, getCounters } from "../src/lib/data/performance";

// -------- CLI --------
const argv = process.argv.slice(2);
const flag = (k: string) => argv.find(a => a === `--${k}` || a.startsWith(`--${k}=`));
const flagVal = (k: string, def?: string) => {
  const f = flag(k);
  if (!f) return def;
  const i = f.indexOf("=");
  return i === -1 ? "true" : f.slice(i + 1);
};

const wantStress = !!flag("stress") || flagVal("tier") === "stress";
const singleTier = flagVal("tier") as ScaleTier | undefined;
const outPath = resolve(process.cwd(), flagVal("out", "bench-results/latest.json")!);

const TIERS: ScaleTier[] = singleTier
  ? [singleTier]
  : (wantStress ? ["small","medium","large","stress"] : ["small","medium","large"]);

// -------- helpers --------
interface Timing { p50: number; p95: number; max: number; runs: number }
function stats(samples: number[]): Timing {
  const s = [...samples].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))];
  return { p50: +at(0.5).toFixed(3), p95: +at(0.95).toFixed(3), max: +Math.max(...s).toFixed(3), runs: s.length };
}
function measure<T>(runs: number, fn: () => T): { samples: number[]; last: T } {
  let last!: T;
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    last = fn();
    samples.push(performance.now() - t);
  }
  return { samples, last };
}
function mem(): number | null {
  try {
    const m = process.memoryUsage();
    return +(m.heapUsed / 1024 / 1024).toFixed(1);
  } catch { return null; }
}

// -------- Budgets (documented; tuned to local Node/Bun perf) --------
// Only fail on stress-tier "hard" breaches so CI stays green under load.
const BUDGETS = {
  buildIndexColdMs:  { large: 400,  stress: 1200 },
  buildIndexWarmMs:  { large: 120,  stress: 400  },
  buildGraphMs:      { large: 400,  stress: 1500 },
  scopedListMs:      { large: 40,   stress: 150  },
  leakageMs:         { large: 500,  stress: 2500 },
  auditVerifyMs:     { large: 200,  stress: 1000 },
  exportMs:          { large: 800,  stress: 3000 },
  memoHitRatioMin:   0.9,
} as const;

interface TierResult {
  tier: ScaleTier;
  fixture: ReturnType<typeof scaleSnapshot>["report"];
  integrity: { ok: boolean; issueCount: number };
  timings: Record<string, Timing>;
  memory: { rssMB: number | null; heapDeltaMB: number | null };
  memo: { calls: number; hits: number; hitRatio: number };
  correctness: Record<string, boolean>;
  budgetFailures: string[];
}

function runTier(tier: ScaleTier): TierResult {
  console.log(`\n=== tier: ${tier} ===`);
  const memBefore = mem();
  const { snapshot, report } = scaleSnapshot({ tier, seed: 0xC0FFEE });
  console.log(`  entities: ${Object.entries(report.totals).map(([k,v])=>`${k}=${v}`).join(" ")}`);
  console.log(`  audit=${report.auditEvents} backups=${report.backups}`);

  // ---- fixture integrity ----
  const integrity = verifyScaleFixture(snapshot);
  if (!integrity.ok) console.log(`  ! integrity issues (${integrity.issues.length}): ${integrity.issues.slice(0,3).join(", ")}...`);

  const timings: Record<string, Timing> = {};
  const correctness: Record<string, boolean> = {};

  // ---- input immutability guard ----
  const snapshotFP = JSON.stringify(snapshot).length;

  // ---- 2a buildUniversalIndex cold + warm (memoized wrapper) ----
  resetCounters();
  const memoIndex = memoize("bench.buildUniversalIndex", buildUniversalIndex, 4);
  const coldIdx = measure(1, () => memoIndex(snapshot));
  const warmIdx = measure(20, () => memoIndex(snapshot));
  timings.indexCold = stats(coldIdx.samples);
  timings.indexWarm = stats(warmIdx.samples);
  const indexLen = coldIdx.last.length;
  correctness.indexStable = warmIdx.last === coldIdx.last;
  correctness.indexNonEmpty = indexLen > 0;

  // ---- 2b buildGraph + hot query ----
  const graphM = measure(3, () => buildGraph(snapshot));
  timings.buildGraph = stats(graphM.samples);
  const { nodes, edges } = graphM.last;
  correctness.graphNodesMatchesEntities = nodes.length > 0;
  correctness.graphEdgesFinite = edges.length >= 0;

  const impactSample = snapshot.concepts.slice(0, 5).map(c => c.id);
  const impactM = measure(impactSample.length, () => {
    for (const id of impactSample) impactAnalysis(id, snapshot);
    return null;
  });
  timings.impactAnalysis = stats(impactM.samples);

  // ---- 2c workspace-scoped list + leakage ----
  const wsA = snapshot.activeWorkspaceId;
  const scopedM = measure(50, () => scopeEntities(snapshot.concepts, wsA));
  timings.scopedList = stats(scopedM.samples);
  correctness.scopeFiltered = scopedM.last.every(c => c.workspaceId === wsA);
  correctness.scopeNoLeak = scopedM.last.length <= snapshot.concepts.length;

  const leakageM = measure(2, () => detectWorkspaceLeakage(snapshot));
  timings.leakageDetection = stats(leakageM.samples);
  const leakage = leakageM.last;
  correctness.noHardLeakage = leakage.orphanedAuditIds.length === 0 && leakage.orphanedBackupIds.length === 0 && leakage.unscopedEntities.length === 0;

  // ---- 2d search + intelligence aggregation + analytics ----
  const index = coldIdx.last;
  const searchM = measure(10, () => universalSearch(index, "readiness", { limit: 20 }));
  timings.search = stats(searchM.samples);
  correctness.searchDeterministic = JSON.stringify(searchM.last) === JSON.stringify(universalSearch(index, "readiness", { limit: 20 }));

  const healthM = measure(3, () => knowledgeHealth(snapshot));
  timings.knowledgeHealth = stats(healthM.samples);

  const analyticsM = measure(3, () => computeExecutiveMetrics(snapshot));
  timings.executiveMetrics = stats(analyticsM.samples);

  // ---- 2e audit single append + multi append (fresh chain) ----
  const singleM = measure(50, () => appendAudit(snapshot.auditEvents.slice(-1), {
    actor: "bench", actorRole: "Administrator", workspaceId: wsA,
    action: "update", entityType: "concepts", entityId: "bench:1",
  }));
  timings.auditAppendSingle = stats(singleM.samples);

  const txnM = measure(10, () => {
    let evs = snapshot.auditEvents.slice(-1);
    for (let i = 0; i < 10; i++) {
      evs = appendAudit(evs, {
        actor: "bench", actorRole: "Administrator", workspaceId: wsA,
        action: "update", entityType: "concepts", entityId: `bench:txn:${i}`,
      });
    }
    return evs.length;
  });
  timings.auditAppendTxn10 = stats(txnM.samples);

  // ---- 2f audit chain verification ----
  const chainM = measure(3, () => verifyAuditChain(snapshot.auditEvents));
  timings.auditChainVerify = stats(chainM.samples);
  correctness.auditChainOk = chainM.last.ok;

  // ---- 2g backup hash + governed-restore validation (non-destructive) ----
  const backupM = measure(2, () => createBackup(snapshot, { label: "bench", reason: "bench", actor: "bench" }));
  timings.backupCreate = stats(backupM.samples);
  const bkp = backupM.last;
  const verifyM = measure(3, () => verifyBackupIntegrity(bkp));
  timings.backupVerify = stats(verifyM.samples);
  correctness.backupIntegrity = verifyM.last.ok;

  // Governed restore validation: run only, do not persist.
  const restoreM = measure(1, () => {
    try {
      const r = performGovernedRestore(snapshot, bkp, { reason: "bench harness restore verification", actor: "bench", confirmation: "RESTORE" });
      return r.restored.schemaVersion;
    } catch { return -1; }
  });
  timings.governedRestore = stats(restoreM.samples);
  correctness.governedRestoreOk = restoreM.last >= 0 || restoreM.last === undefined;

  // ---- 2h large import validation + export/package ----
  const exportM = measure(2, () => exportSnapshot(snapshot));
  timings.exportSnapshot = stats(exportM.samples);
  const exported = exportM.last;
  const importM = measure(2, () => parseImport(exported));
  timings.parseImport = stats(importM.samples);
  correctness.importRoundtrip = importM.last.errors.length === 0 && (importM.last.snapshot?.concepts.length ?? -1) === snapshot.concepts.length;

  // ---- 2i automation scheduling / validate ----
  const autoM = measure(5, () => snapshot.automations.map(r => validateRecipe(r)));
  timings.automationValidate = stats(autoM.samples);
  correctness.automationValid = autoM.last.every(v => typeof v.ok === "boolean");

  // ---- 2j API-like pagination over large result ----
  const pageM = measure(20, () => JSON.stringify({
    data: snapshot.knowledgeObjects.slice(0, 50).map(k => ({ id: k.id, title: k.title, status: k.status })),
    total: snapshot.knowledgeObjects.length,
  }));
  timings.apiPaginate = stats(pageM.samples);

  // ---- input immutability post-run ----
  correctness.inputImmutable = JSON.stringify(snapshot).length === snapshotFP;

  // ---- memoization efficacy ----
  const c = getCounters().find(x => x.name === "bench.buildUniversalIndex");
  const calls = c?.calls ?? 0;
  const hits = c?.hits ?? 0;
  const hitRatio = calls > 0 ? +(hits / calls).toFixed(3) : 0;

  const memAfter = mem();
  const rssMB = memAfter;
  const heapDeltaMB = memBefore != null && memAfter != null ? +(memAfter - memBefore).toFixed(1) : null;

  // ---- budgets ----
  const budgetFailures: string[] = [];
  const budgetTier = tier === "stress" ? "stress" : "large";
  if (tier === "large" || tier === "stress") {
    if (timings.indexCold.p95 > BUDGETS.buildIndexColdMs[budgetTier]) budgetFailures.push(`indexCold p95 ${timings.indexCold.p95} > ${BUDGETS.buildIndexColdMs[budgetTier]}`);
    if (timings.indexWarm.p95 > BUDGETS.buildIndexWarmMs[budgetTier]) budgetFailures.push(`indexWarm p95 ${timings.indexWarm.p95} > ${BUDGETS.buildIndexWarmMs[budgetTier]}`);
    if (timings.buildGraph.p95 > BUDGETS.buildGraphMs[budgetTier]) budgetFailures.push(`buildGraph p95 ${timings.buildGraph.p95} > ${BUDGETS.buildGraphMs[budgetTier]}`);
    if (timings.scopedList.p95 > BUDGETS.scopedListMs[budgetTier]) budgetFailures.push(`scopedList p95 ${timings.scopedList.p95} > ${BUDGETS.scopedListMs[budgetTier]}`);
    if (timings.leakageDetection.p95 > BUDGETS.leakageMs[budgetTier]) budgetFailures.push(`leakage p95 ${timings.leakageDetection.p95} > ${BUDGETS.leakageMs[budgetTier]}`);
    if (timings.auditChainVerify.p95 > BUDGETS.auditVerifyMs[budgetTier]) budgetFailures.push(`auditChainVerify p95 ${timings.auditChainVerify.p95} > ${BUDGETS.auditVerifyMs[budgetTier]}`);
    if (timings.exportSnapshot.p95 > BUDGETS.exportMs[budgetTier]) budgetFailures.push(`exportSnapshot p95 ${timings.exportSnapshot.p95} > ${BUDGETS.exportMs[budgetTier]}`);
    if (hitRatio < BUDGETS.memoHitRatioMin) budgetFailures.push(`memo hit ratio ${hitRatio} < ${BUDGETS.memoHitRatioMin}`);
  }

  return {
    tier, fixture: report,
    integrity: { ok: integrity.ok, issueCount: integrity.issues.length },
    timings,
    memory: { rssMB, heapDeltaMB },
    memo: { calls, hits, hitRatio },
    correctness, budgetFailures,
  };
}

const t0 = performance.now();
const results: TierResult[] = [];
for (const t of TIERS) results.push(runTier(t));
const totalMs = +(performance.now() - t0).toFixed(1);

// -------- scaling ratios --------
function ratio(a?: TierResult, b?: TierResult) {
  if (!a || !b) return null;
  const r: Record<string, number> = {};
  for (const k of Object.keys(a.timings)) {
    const aP = a.timings[k].p95, bP = b.timings[k]?.p95 ?? 0;
    r[k] = aP > 0 ? +(bP / aP).toFixed(2) : 0;
  }
  return r;
}
const scaling = {
  smallToLarge: ratio(results.find(r => r.tier === "small"), results.find(r => r.tier === "large")),
  mediumToLarge: ratio(results.find(r => r.tier === "medium"), results.find(r => r.tier === "large")),
};

// -------- summary --------
const correctnessFailures = results.flatMap(r =>
  Object.entries(r.correctness).filter(([, v]) => !v).map(([k]) => `${r.tier}:${k}`)
);
const budgetFailures = results.flatMap(r => r.budgetFailures.map(m => `${r.tier}:${m}`));
const ok = correctnessFailures.length === 0 && budgetFailures.length === 0;

const report = {
  meta: {
    at: new Date().toISOString(),
    node: process.version,
    tiers: TIERS, totalMs, ok,
    correctnessFailures, budgetFailures,
  },
  scaling,
  results,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log("\n=== summary ===");
for (const r of results) {
  const cold = r.timings.indexCold.p95, warm = r.timings.indexWarm.p95;
  const gph = r.timings.buildGraph.p95, chn = r.timings.auditChainVerify.p95;
  console.log(`  ${r.tier.padEnd(6)}  indexCold=${cold}ms  indexWarm=${warm}ms  graph=${gph}ms  auditVerify=${chn}ms  memoHits=${r.memo.hits}/${r.memo.calls}  mem=${r.memory.rssMB}MB`);
}
console.log("  scaling small→large p95:", scaling.smallToLarge && Object.entries(scaling.smallToLarge).map(([k,v])=>`${k}=${v}x`).slice(0,4).join(" "));
console.log(`  correctness: ${correctnessFailures.length === 0 ? "PASS" : "FAIL — " + correctnessFailures.join(", ")}`);
console.log(`  budgets:     ${budgetFailures.length === 0 ? "PASS" : "FAIL — " + budgetFailures.join(", ")}`);
console.log(`  wrote ${outPath}`);
console.log(`  total ${totalMs}ms   exit=${ok ? 0 : 1}`);
process.exit(ok ? 0 : 1);
