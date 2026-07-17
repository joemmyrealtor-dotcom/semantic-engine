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
  // Defensive defaults so monitoring never crashes on partial snapshots
  // (import-time snapshots, prerender fallbacks, mid-migration payloads).
  const rateBuckets = snap.rateLimitBuckets ?? [];
  const automationRuns = snap.automationRuns ?? [];
  const webhookDeliveries = snap.webhookDeliveries ?? [];
  const importJobs = snap.importJobs ?? [];
  const exportJobs = snap.exportJobs ?? [];
  const auditEvents = snap.auditEvents ?? [];
  const workspaces = snap.workspaces ?? [];

  const bucket = rateBuckets[0];
  if (bucket) {
    const pct = Math.round((bucket.currentCount / Math.max(1, bucket.maxRequests)) * 100);
    signals.push({ name: "API rate-limit", state: pct > 90 ? "critical" : pct > 70 ? "warning" : "ok", value: `${pct}% (${bucket.currentCount}/${bucket.maxRequests})`, note: bucket.key });
  } else {
    signals.push({ name: "API rate-limit", state: "warning", value: "no bucket configured" });
  }

  const totalRuns = automationRuns.length;
  const failed = automationRuns.filter(r => r.status === "failed").length;
  const failRate = totalRuns ? failed / totalRuns : 0;
  signals.push({ name: "Automation runs", state: failRate > 0.25 ? "critical" : failRate > 0.1 ? "warning" : "ok", value: `${failed}/${totalRuns} failed` });

  const wdFail = webhookDeliveries.filter(d => d.attempts.some(a => a.status === "failed")).length;
  signals.push({ name: "Webhook deliveries", state: webhookDeliveries.length && wdFail / webhookDeliveries.length > 0.2 ? "warning" : "ok", value: `${wdFail}/${webhookDeliveries.length} with failed attempts` });

  const bytes = JSON.stringify(snap).length;
  signals.push({ name: "Snapshot size", state: bytes > 20_000_000 ? "warning" : "ok", value: `${(bytes / 1048576).toFixed(2)} MB` });

  signals.push({ name: "Schema migration", state: snap.schemaVersion === SCHEMA_VERSION ? "ok" : "critical", value: `v${snap.schemaVersion} (current ${SCHEMA_VERSION})` });

  const importsFailed = importJobs.filter(j => j.status === "failed").length;
  const exportsFailed = exportJobs.filter(j => j.status === "failed").length;
  signals.push({ name: "Background jobs", state: importsFailed + exportsFailed > 5 ? "warning" : "ok", value: `${importsFailed} imports · ${exportsFailed} exports failed` });

  const chain = verifyAuditChain(auditEvents);
  signals.push({ name: "Audit chain", state: chain.ok ? "ok" : "critical", value: chain.ok ? `${chain.count} events verified` : `broken at ${chain.brokenAt}` });

  // Disaster recovery readiness
  const dr = buildDisasterRecoveryPlan(snap);
  signals.push({
    name: "Backups",
    state: !dr.latestBackup ? "warning" : dr.backupCount < 3 ? "warning" : "ok",
    value: `${dr.backupCount} backups${dr.latestBackup ? ` · latest ${dr.latestBackup.createdAt.slice(0, 10)}` : ""}`,
  });

  // Workspace isolation (W9 #5)
  const leak = detectWorkspaceLeakage(snap);
  signals.push({
    name: "Workspace isolation",
    state: leak.ok ? "ok" : "warning",
    value: leak.ok ? `${snap.workspaces.length} workspaces · no orphans` : `orphaned: ${leak.orphanedAuditIds.length} audit / ${leak.orphanedBackupIds.length} backups`,
    note: `unscoped rows: ${leak.unscopedEntities.length} · foreign: ${leak.crossWorkspaceEntities.length}`,
  });

  const overall = signals.reduce<HealthState>((acc, s) => worse(acc, s.state), "ok");
  return { overall, signals, perf: perfReport(), generatedAt: new Date().toISOString() };
}
