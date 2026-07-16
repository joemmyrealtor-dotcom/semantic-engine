// Workstream 9 — Deployment readiness.
//
// Aggregates environment validation, feature flags, maintenance mode, and
// a Release Candidate 1 readiness report.

import type { DataSnapshot, FeatureFlag, Role } from "./schema";
import { SCHEMA_VERSION } from "./schema";
import { validateEnvironment, type EnvValidationResult } from "./security";
import { computeMonitoring, type HealthState } from "./monitoring";
import { verifyAuditChain } from "./audit";
import { buildDisasterRecoveryPlan } from "./backups";

export interface StartupDiagnostic { name: string; ok: boolean; detail: string }

export function startupDiagnostics(env: Record<string, string | undefined>, snap: DataSnapshot): StartupDiagnostic[] {
  const envRes: EnvValidationResult = validateEnvironment(env);
  const out: StartupDiagnostic[] = [];
  out.push({ name: "Environment variables", ok: envRes.ok, detail: envRes.ok ? `${envRes.present.length} present` : `missing: ${envRes.missing.join(", ")}` });
  out.push({ name: "Schema version", ok: snap.schemaVersion === SCHEMA_VERSION, detail: `snapshot v${snap.schemaVersion} / runtime v${SCHEMA_VERSION}` });
  out.push({ name: "Active workspace", ok: !!snap.workspaces.find(w => w.id === snap.activeWorkspaceId), detail: snap.activeWorkspaceId });
  const chain = verifyAuditChain(snap.auditEvents);
  out.push({ name: "Audit chain", ok: chain.ok, detail: chain.ok ? `${chain.count} verified` : `broken at ${chain.brokenAt}` });
  out.push({ name: "Rate-limit bucket", ok: snap.rateLimitBuckets.length > 0, detail: `${snap.rateLimitBuckets.length} bucket(s)` });
  out.push({ name: "Maintenance mode", ok: !snap.maintenanceMode.enabled, detail: snap.maintenanceMode.enabled ? snap.maintenanceMode.reason : "off" });
  return out;
}

export function isFeatureEnabled(flags: FeatureFlag[], key: string, role: Role): boolean {
  const f = flags.find(x => x.key === key);
  if (!f || !f.enabled) return false;
  if (f.audience === "all") return true;
  if (f.audience === "administrators") return role === "Administrator" || role === "Owner";
  if (f.audience === "operations") return role === "Operations" || role === "Administrator" || role === "Owner";
  return f.audience === "beta";
}

export interface MaintenanceGate { allowed: boolean; reason: string }
export function maintenanceGate(snap: DataSnapshot, role: Role): MaintenanceGate {
  if (!snap.maintenanceMode.enabled) return { allowed: true, reason: "" };
  const allowed = snap.maintenanceMode.allowRoles.includes(role);
  return { allowed, reason: allowed ? "" : snap.maintenanceMode.reason || "Platform in maintenance mode" };
}

export type RCState = "ready" | "conditional" | "blocked";
export interface ReleaseReadiness {
  state: RCState;
  score: number;
  blockers: string[];
  warnings: string[];
  monitoring: HealthState;
}

export function releaseCandidateReadiness(env: Record<string, string | undefined>, snap: DataSnapshot): ReleaseReadiness {
  const diags = startupDiagnostics(env, snap);
  const monitoring = computeMonitoring(snap);
  const dr = buildDisasterRecoveryPlan(snap);

  const blockers: string[] = [];
  const warnings: string[] = [];

  for (const d of diags) if (!d.ok) blockers.push(`${d.name}: ${d.detail}`);
  if (monitoring.overall === "critical") blockers.push(`Monitoring critical: ${monitoring.signals.filter(s => s.state === "critical").map(s => s.name).join(", ")}`);
  if (monitoring.overall === "warning") warnings.push(`Monitoring warnings: ${monitoring.signals.filter(s => s.state === "warning").map(s => s.name).join(", ")}`);
  for (const r of dr.recommendedActions) warnings.push(r);

  const passed = diags.filter(d => d.ok).length;
  const score = Math.round(((passed / Math.max(1, diags.length)) * 0.7 + (monitoring.overall === "ok" ? 0.3 : monitoring.overall === "warning" ? 0.15 : 0)) * 100);

  const state: RCState = blockers.length > 0 ? "blocked" : warnings.length > 0 ? "conditional" : "ready";
  return { state, score, blockers, warnings, monitoring: monitoring.overall };
}
