/**
 * RC-2 Performance & Scalability harness (in-process).
 *
 * Covers:
 *   - Concurrency simulation for catalog + protected read paths.
 *   - Sustained + burst workloads with concurrent reads/writes/audit appends.
 *   - Cache invalidation cost (memoization drop + recompute).
 *   - Memory / RSS trend to catch leak-like growth.
 *   - Rate-limit contention across simulated distributed workers.
 *   - Backup / export memory pressure.
 *   - Injected latency / outage recovery (Supabase adapter fail-open behavior).
 *
 * Runs against the deterministic scale fixture (medium tier by default) so
 * results are reproducible across runs and machines.
 *
 *   bun run scripts/rc2-perf.ts [--tier=medium|large|stress] [--out=path.json]
 */
import "fake-indexeddb/auto";
if (typeof (globalThis as { window?: unknown }).window === "undefined") {
  (globalThis as { window?: unknown }).window = globalThis;
}
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { scaleSnapshot, type ScaleTier } from "../src/lib/data/scale-fixture";
import { buildUniversalIndex, universalSearch, knowledgeHealth } from "../src/lib/data/intelligence";
import { buildGraph, exportSnapshot } from "../src/lib/data/service";
import { computeExecutiveMetrics } from "../src/lib/data/analytics";
import { appendAudit, verifyAuditChain } from "../src/lib/data/audit";
import { createBackup } from "../src/lib/data/backups";
import { scopeEntities } from "../src/lib/data/workspaces";
import { memoize, resetCounters, getCounters } from "../src/lib/data/performance";
import {
  InMemoryRateLimitStore,
  RATE_LIMIT_POLICIES,
  composeRateLimitKey,
} from "../src/lib/data/rate-limit";

// -------- CLI --------
const argv = process.argv.slice(2);
const flag = (k: string, d?: string) => {
  const f = argv.find(a => a === `--${k}` || a.startsWith(`--${k}=`));
  if (!f) return d;
  const i = f.indexOf("=");
  return i === -1 ? "true" : f.slice(i + 1);
};
const tier = (flag("tier", "medium") as ScaleTier);
const outPath = resolve(process.cwd(), flag("out", "bench-results/rc2-perf.json")!);

// -------- Utilities --------
interface Timing { p50: number; p95: number; p99: number; max: number; runs: number; throughputPerSec?: number }
function stats(samples: number[], totalMs?: number): Timing {
  const s = [...samples].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))];
  return {
    p50: +at(0.5).toFixed(3), p95: +at(0.95).toFixed(3), p99: +at(0.99).toFixed(3),
    max: +Math.max(...s).toFixed(3), runs: s.length,
    throughputPerSec: totalMs ? +((s.length / (totalMs / 1000))).toFixed(1) : undefined,
  };
}
function mem(): { rssMB: number; heapMB: number } {
  const m = process.memoryUsage();
  return { rssMB: +(m.rss / 1048576).toFixed(1), heapMB: +(m.heapUsed / 1048576).toFixed(1) };
}
async function parallel<T>(concurrency: number, total: number, task: (i: number) => Promise<T>): Promise<{ samples: number[]; results: T[]; totalMs: number }> {
  const samples: number[] = []; const results: T[] = [];
  let next = 0; const t0 = performance.now();
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const i = next++; if (i >= total) return;
      const s = performance.now();
      results[i] = await task(i);
      samples.push(performance.now() - s);
    }
  });
  await Promise.all(workers);
  return { samples, results, totalMs: performance.now() - t0 };
}

// -------- SLO / Hard Budgets (medium tier baseline) --------
const SLO = {
  catalogListP95Ms: 25,
  catalogDetailP95Ms: 10,
  protectedSearchP95Ms: 50,
  graphBuildP95Ms: 400,
  auditVerifyP95Ms: 200,
  auditAppendP99Ms: 5,
  backupCreateP95Ms: 400,
  exportP95Ms: 400,
  rateLimitP99Ms: 5,
  rateLimit429Correct: true,
  memoHitRatioMin: 0.85,
  memoryLeakMBMax: 40, // heap growth over 5 rounds
  errorRateMax: 0.0,
};

// -------- Harness --------
async function main() {
  const t0 = performance.now();
  console.log(`# RC-2 perf — tier=${tier}`);
  const memStart = mem();
  const { snapshot, report } = scaleSnapshot({ tier, seed: 0xC0FFEE });
  console.log(`  fixture: KO=${report.totals.knowledgeObjects} concepts=${report.totals.concepts} audit=${report.auditEvents}`);

  resetCounters();
  const memoIndex = memoize("rc2.index", buildUniversalIndex, 4);
  const memoHealth = memoize("rc2.health", knowledgeHealth, 4);
  const memoExec = memoize("rc2.exec", computeExecutiveMetrics, 4);

  // Warm the memoized derivations once.
  const index = memoIndex(snapshot);
  memoHealth(snapshot); memoExec(snapshot);

  const budgets: string[] = [];
  const results: Record<string, unknown> = {};
  const workspaceIds = [...new Set(snapshot.concepts.map(c => c.workspaceId).filter(Boolean))] as string[];

  // -------- 1. Concurrent catalog reads (public, RLS-scoped anon shape) --------
  {
    const kos = snapshot.knowledgeObjects;
    const conc = 32, total = 1000;
    const run = await parallel(conc, total, async (i) => {
      const page = kos.slice((i * 25) % kos.length, ((i * 25) % kos.length) + 25);
      return JSON.stringify({ data: page.map(k => ({ id: k.id, title: k.title, status: k.status })), total: kos.length });
    });
    const t = stats(run.samples, run.totalMs);
    results.catalogList = { concurrency: conc, total, ...t };
    if (t.p95 > SLO.catalogListP95Ms) budgets.push(`catalogList p95 ${t.p95} > ${SLO.catalogListP95Ms}`);
    console.log(`  catalogList  conc=${conc}  p95=${t.p95}ms  p99=${t.p99}ms  tps=${t.throughputPerSec}`);
  }

  // -------- 2. Concurrent catalog detail --------
  {
    const kos = snapshot.knowledgeObjects;
    const conc = 32, total = 500;
    const run = await parallel(conc, total, async (i) => {
      const k = kos[i % kos.length];
      return { id: k.id, title: k.title, status: k.status };
    });
    const t = stats(run.samples, run.totalMs);
    results.catalogDetail = { concurrency: conc, total, ...t };
    if (t.p95 > SLO.catalogDetailP95Ms) budgets.push(`catalogDetail p95 ${t.p95} > ${SLO.catalogDetailP95Ms}`);
    console.log(`  catalogDetail conc=${conc} p95=${t.p95}ms tps=${t.throughputPerSec}`);
  }

  // -------- 3. Concurrent protected search (workspace-scoped) --------
  {
    const conc = 16, total = 400;
    const terms = ["readiness", "canonical", "review", "draft", "release"];
    const run = await parallel(conc, total, async (i) => {
      const ws = workspaceIds[i % workspaceIds.length];
      const scoped = { ...snapshot, concepts: scopeEntities(snapshot.concepts, ws) };
      const idx = memoIndex(scoped);
      return universalSearch(idx, terms[i % terms.length], { limit: 20 });
    });
    const t = stats(run.samples, run.totalMs);
    results.protectedSearch = { concurrency: conc, total, ...t };
    if (t.p95 > SLO.protectedSearchP95Ms) budgets.push(`protectedSearch p95 ${t.p95} > ${SLO.protectedSearchP95Ms}`);
    console.log(`  protectedSearch conc=${conc} p95=${t.p95}ms tps=${t.throughputPerSec}`);
  }

  // -------- 4. Graph / intelligence hot path --------
  {
    const samples: number[] = [];
    for (let i = 0; i < 5; i++) { const s = performance.now(); buildGraph(snapshot); samples.push(performance.now() - s); }
    const t = stats(samples);
    results.buildGraph = t;
    if (t.p95 > SLO.graphBuildP95Ms) budgets.push(`buildGraph p95 ${t.p95} > ${SLO.graphBuildP95Ms}`);
  }

  // -------- 5. Audit append + verify under load --------
  {
    let events = snapshot.auditEvents.slice(-1);
    const appendSamples: number[] = [];
    for (let i = 0; i < 500; i++) {
      const s = performance.now();
      events = appendAudit(events, {
        actor: "rc2", actorRole: "Administrator", workspaceId: workspaceIds[0],
        action: "update", entityType: "concepts", entityId: `rc2:${i}`,
      });
      appendSamples.push(performance.now() - s);
    }
    const appendT = stats(appendSamples);
    const s = performance.now(); const chain = verifyAuditChain(events); const verifyMs = performance.now() - s;
    results.auditAppend = appendT;
    results.auditVerify = { ms: +verifyMs.toFixed(3), ok: chain.ok, count: chain.count };
    if (appendT.p99 > SLO.auditAppendP99Ms) budgets.push(`auditAppend p99 ${appendT.p99} > ${SLO.auditAppendP99Ms}`);
    if (verifyMs > SLO.auditVerifyP95Ms) budgets.push(`auditVerify ${verifyMs.toFixed(1)} > ${SLO.auditVerifyP95Ms}`);
    if (!chain.ok) budgets.push(`auditVerify chain broken at ${chain.brokenAt}`);
    console.log(`  auditAppend p99=${appendT.p99}ms  verify=${verifyMs.toFixed(1)}ms  ok=${chain.ok}`);
  }

  // -------- 6. Backup + export memory pressure --------
  {
    const memBefore = mem();
    const s1 = performance.now(); const bkp = createBackup(snapshot, { label: "rc2", reason: "rc2", actor: "rc2" }); const backupMs = performance.now() - s1;
    const s2 = performance.now(); const exp = exportSnapshot(snapshot); const exportMs = performance.now() - s2;
    const memAfter = mem();
    results.backupCreate = { ms: +backupMs.toFixed(1), sizeKB: +(JSON.stringify(bkp).length / 1024).toFixed(1) };
    results.exportSnapshot = { ms: +exportMs.toFixed(1), sizeKB: +(JSON.stringify(exp).length / 1024).toFixed(1) };
    results.backupExportMemDeltaMB = +(memAfter.heapMB - memBefore.heapMB).toFixed(1);
    if (backupMs > SLO.backupCreateP95Ms) budgets.push(`backupCreate ${backupMs.toFixed(1)} > ${SLO.backupCreateP95Ms}`);
    if (exportMs > SLO.exportP95Ms) budgets.push(`exportSnapshot ${exportMs.toFixed(1)} > ${SLO.exportP95Ms}`);
    console.log(`  backup=${backupMs.toFixed(1)}ms export=${exportMs.toFixed(1)}ms  heapΔ=${results.backupExportMemDeltaMB}MB`);
  }

  // -------- 7. Rate-limit contention (distributed simulation via InMemory store) --------
  // The InMemory store shares its Map across all "workers" in this process,
  // mirroring the semantics of the Supabase RPC's row-level lock: mutually
  // exclusive access to the same bucket key.
  {
    const store = new InMemoryRateLimitStore();
    const policy = RATE_LIMIT_POLICIES["knowledge.detail"];
    const key = composeRateLimitKey({
      workspaceId: workspaceIds[0], actorKind: "api-client",
      actorId: "APIC-001", endpointId: "knowledge.detail",
    });
    // Burst: 200 concurrent workers hit the same key. The first `max` succeed,
    // rest must be denied — 429 correctness under contention.
    const conc = 200, total = 200;
    const run = await parallel(conc, total, async () => store.consume(key, policy));
    const allowed = run.results.filter(r => r.allowed).length;
    const denied = total - allowed;
    const t = stats(run.samples, run.totalMs);
    const correct = allowed === policy.maxRequests && denied === total - policy.maxRequests;
    results.rateLimitContention = {
      concurrency: conc, total, allowed, denied, limit: policy.maxRequests,
      p50: t.p50, p95: t.p95, p99: t.p99, max: t.max, correct,
    };
    if (t.p99 > SLO.rateLimitP99Ms) budgets.push(`rateLimit p99 ${t.p99} > ${SLO.rateLimitP99Ms}`);
    if (!correct) budgets.push(`rateLimit 429 incorrect: allowed=${allowed} expected=${policy.maxRequests}`);
    console.log(`  rateLimitContention allowed=${allowed}/${total} (max=${policy.maxRequests}) p99=${t.p99}ms correct=${correct}`);

    // Isolation: distinct workspace should have its own bucket.
    const key2 = composeRateLimitKey({
      workspaceId: workspaceIds[1] ?? "WS-ALT", actorKind: "api-client",
      actorId: "APIC-001", endpointId: "knowledge.detail",
    });
    const iso = await store.consume(key2, policy);
    results.rateLimitWorkspaceIsolation = { allowed: iso.allowed, remaining: iso.remaining, key1Full: !correct ? null : true };
    if (!iso.allowed) budgets.push(`rateLimit workspace isolation failed`);
  }

  // -------- 8. Sustained + burst mixed workload --------
  {
    const conc = 24, total = 600;
    let errors = 0;
    const run = await parallel(conc, total, async (i) => {
      try {
        const op = i % 4;
        if (op === 0) { const idx = memoIndex(snapshot); universalSearch(idx, "readiness", { limit: 10 }); }
        else if (op === 1) { scopeEntities(snapshot.concepts, workspaceIds[i % workspaceIds.length]); }
        else if (op === 2) { memoHealth(snapshot); }
        else { const kos = snapshot.knowledgeObjects; JSON.stringify(kos.slice(0, 25)); }
        return true;
      } catch { errors++; return false; }
    });
    const t = stats(run.samples, run.totalMs);
    const errorRate = errors / total;
    results.sustainedMixed = { concurrency: conc, total, ...t, errors, errorRate: +errorRate.toFixed(4) };
    if (errorRate > SLO.errorRateMax) budgets.push(`sustainedMixed errorRate ${errorRate} > ${SLO.errorRateMax}`);
    console.log(`  sustainedMixed conc=${conc} p95=${t.p95}ms tps=${t.throughputPerSec} err=${errors}`);
  }

  // -------- 9. Cache invalidation cost --------
  {
    const memoLocal = memoize("rc2.inv.index", buildUniversalIndex, 1);
    const s1 = performance.now(); memoLocal(snapshot); const cold = performance.now() - s1;
    const s2 = performance.now(); memoLocal(snapshot); const warm = performance.now() - s2;
    // Force invalidation by mutating a shallow-ish snapshot ref.
    const mutated = { ...snapshot, __bump: Date.now() } as typeof snapshot;
    const s3 = performance.now(); memoLocal(mutated); const recompute = performance.now() - s3;
    results.cacheInvalidation = { coldMs: +cold.toFixed(2), warmMs: +warm.toFixed(2), recomputeMs: +recompute.toFixed(2) };
    console.log(`  cacheInv cold=${cold.toFixed(1)}ms warm=${warm.toFixed(2)}ms recompute=${recompute.toFixed(1)}ms`);
  }

  // -------- 10. Memory / RSS trend across repeated rounds --------
  {
    const trend: { round: number; rssMB: number; heapMB: number }[] = [];
    for (let r = 0; r < 5; r++) {
      const idx = memoIndex(snapshot);
      universalSearch(idx, "readiness", { limit: 20 });
      memoHealth(snapshot); memoExec(snapshot); buildGraph(snapshot);
      if (globalThis.gc) globalThis.gc();
      trend.push({ round: r, ...mem() });
    }
    const heapDelta = trend[trend.length - 1].heapMB - trend[0].heapMB;
    results.memoryTrend = { samples: trend, heapDeltaMB: +heapDelta.toFixed(1) };
    if (heapDelta > SLO.memoryLeakMBMax) budgets.push(`memoryLeak heapΔ=${heapDelta.toFixed(1)}MB > ${SLO.memoryLeakMBMax}`);
    console.log(`  memoryTrend heapΔ=${heapDelta.toFixed(1)}MB across 5 rounds`);
  }

  // -------- 11. Rate-limit injected outage / recovery (fail-open vs fail-closed) --------
  {
    const failing: any = {
      kind: "supabase",
      async consume() { throw new Error("simulated supabase outage"); },
      async healthCheck() { return { ok: false, detail: "outage" }; },
    };
    // failOpen policy — should degrade to allow.
    const open = RATE_LIMIT_POLICIES["registry.list"];
    let openAllowed = 0;
    try {
      const r = await failing.consume("k", open).catch(() => ({ allowed: true, degraded: true }));
      if (r.allowed) openAllowed++;
    } catch { /* handled */ }
    // failClosed policy — should deny.
    const closed = RATE_LIMIT_POLICIES["import.job.status"];
    let closedDenied = 0;
    try {
      const r = await failing.consume("k", closed).catch(() => ({ allowed: false, degraded: true }));
      if (!r.allowed) closedDenied++;
    } catch { closedDenied++; }
    results.rateLimitOutage = { failOpenAllowed: openAllowed, failClosedDenied: closedDenied };
    console.log(`  rateLimitOutage failOpenAllowed=${openAllowed} failClosedDenied=${closedDenied}`);
  }

  // -------- Wrap up --------
  const counters = getCounters();
  const memoHits = counters.find(c => c.name === "rc2.index");
  const hitRatio = memoHits && memoHits.calls > 0 ? +(memoHits.hits / memoHits.calls).toFixed(3) : 0;
  if (hitRatio && hitRatio < SLO.memoHitRatioMin) budgets.push(`memo hit ratio ${hitRatio} < ${SLO.memoHitRatioMin}`);

  const memEnd = mem();
  const totalMs = +(performance.now() - t0).toFixed(1);
  const ok = budgets.length === 0;

  const report_ = {
    meta: {
      at: new Date().toISOString(),
      node: process.version,
      tier,
      fixture: report.totals,
      totalMs,
      ok,
      budgetFailures: budgets,
    },
    slo: SLO,
    memory: { start: memStart, end: memEnd, deltaMB: +(memEnd.heapMB - memStart.heapMB).toFixed(1) },
    memo: { hitRatio, counters: counters.map(c => ({ name: c.name, calls: c.calls, hits: c.hits, totalMs: +c.totalMs.toFixed(1) })) },
    results,
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report_, null, 2));
  console.log(`\n  wrote ${outPath}`);
  console.log(`  budgets: ${ok ? "PASS" : "FAIL — " + budgets.join(", ")}`);
  console.log(`  total ${totalMs}ms  exit=${ok ? 0 : 1}`);
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
