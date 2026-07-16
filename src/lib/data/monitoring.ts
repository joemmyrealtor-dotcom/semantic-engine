// Workstream 9 — Aggregated monitoring for API, automation, webhook,
// storage, migration, and background-job health.

import type { DataSnapshot } from "./schema";
import { SCHEMA_VERSION } from "./schema";
import { perfReport } from "./performance";
import { verifyAuditChain } from "./audit";
import { buildDisasterRecoveryPlan } from "./backups";
import { detectWorkspaceLeakage } from "./workspaces";

export type HealthState = "ok" | "warning" | "critical";
export interface Signal { name: string; state: HealthState; value: string; note?: string }

export interface MonitoringReport {
  overall: HealthState;
  signals: Signal[];
  perf: ReturnType<typeof perfReport>;
  generatedAt: string;
}

function worse(a: HealthState, b: HealthState): HealthState {
  const rank: Record<HealthState, number> = { ok: 0, warning: 1, critical: 2 };
  return rank[a] >= rank[b] ? a : b;
}

export function computeMonitoring(snap: DataSnapshot): MonitoringReport {
  const signals: Signal[] = [];

  // API health — rate-limit bucket saturation
  const bucket = snap.rateLimitBuckets[0];
  if (bucket) {
    const pct = Math.round((bucket.currentCount / Math.max(1, bucket.maxRequests)) * 100);
    signals.push({
      name: "API rate-limit",
      state: pct > 90 ? "critical" : pct > 70 ? "warning" : "ok",
      value: `${pct}% (${bucket.currentCount}/${bucket.maxRequests})`,
      note: bucket.key,
    });
  } else {
    signals.push({ name: "API rate-limit", state: "warning", value: "no bucket configured" });
  }

  // Automation health
  const totalRuns = snap.automationRuns.length;
  const failed = snap.automationRuns.filter(r => r.status === "failed").length;
  const failRate = totalRuns ? failed / totalRuns : 0;
  signals.push({
    name: "Automation runs",
    state: failRate > 0.25 ? "critical" : failRate > 0.1 ? "warning" : "ok",
    value: `${failed}/${totalRuns} failed`,
  });

  // Webhook health
  const wd = snap.webhookDeliveries;
  const wdFail = wd.filter(d => d.attempts.some(a => a.status === "failed")).length;
  signals.push({
    name: "Webhook deliveries",
    state: wd.length && wdFail / wd.length > 0.2 ? "warning" : "ok",
    value: `${wdFail}/${wd.length} with failed attempts`,
  });

  // Storage / snapshot
  const bytes = JSON.stringify(snap).length;
  const mb = (bytes / 1048576).toFixed(2);
  signals.push({ name: "Snapshot size", state: bytes > 20_000_000 ? "warning" : "ok", value: `${mb} MB` });

  // Migration
  signals.push({
    name: "Schema migration",
    state: snap.schemaVersion === SCHEMA_VERSION ? "ok" : "critical",
    value: `v${snap.schemaVersion} (current ${SCHEMA_VERSION})`,
  });

  // Background jobs
  const importsFailed = snap.importJobs.filter(j => j.status === "failed").length;
  const exportsFailed = snap.exportJobs.filter(j => j.status === "failed").length;
  signals.push({
    name: "Background jobs",
    state: importsFailed + exportsFailed > 5 ? "warning" : "ok",
    value: `${importsFailed} imports · ${exportsFailed} exports failed`,
  });

  // Audit chain integrity
  const chain = verifyAuditChain(snap.auditEvents);
  signals.push({
    name: "Audit chain",
    state: chain.ok ? "ok" : "critical",
    value: chain.ok ? `${chain.count} events verified` : `broken at ${chain.brokenAt}`,
  });

  // Disaster recovery readiness
  const dr = buildDisasterRecoveryPlan(snap);
  signals.push({
    name: "Backups",
    state: !dr.latestBackup ? "warning" : dr.backupCount < 3 ? "warning" : "ok",
    value: `${dr.backupCount} backups${dr.latestBackup ? ` · latest ${dr.latestBackup.createdAt.slice(0, 10)}` : ""}`,
  });

  const overall = signals.reduce<HealthState>((acc, s) => worse(acc, s.state), "ok");
  return { overall, signals, perf: perfReport(), generatedAt: new Date().toISOString() };
}
