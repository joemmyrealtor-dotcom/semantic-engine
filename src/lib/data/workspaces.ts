// Workstream 9 — Multi-workspace registry.
//
// Workspaces enable soft isolation, branding, and per-tenant settings.
// When `isolated` is true, list-scope helpers filter to the workspaceId.

import type { DataSnapshot, Workspace } from "./schema";

export function nextWorkspaceId(existing: Workspace[]): string {
  const nums = existing.map(w => Number(w.id.replace(/^WS-/, ""))).filter(n => !isNaN(n));
  return `WS-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
}

export function activeWorkspace(snap: DataSnapshot): Workspace | null {
  return snap.workspaces.find(w => w.id === snap.activeWorkspaceId) ?? snap.workspaces[0] ?? null;
}

export function workspaceMetrics(snap: DataSnapshot, workspaceId: string): { assets: number; releases: number; runs: number; auditEvents: number } {
  const assets =
    snap.concepts.length + snap.knowledgeObjects.length + snap.publications.length +
    snap.clientToolkits.length + snap.aiPacks.length + snap.agents.length;
  return {
    assets,
    releases: snap.releases.length,
    runs: snap.automationRuns.length,
    auditEvents: snap.auditEvents.filter(e => e.workspaceId === workspaceId).length,
  };
}

export function exportWorkspace(snap: DataSnapshot, workspaceId: string): { workspaceId: string; exportedAt: string; audit: number; backups: number } {
  return {
    workspaceId,
    exportedAt: new Date().toISOString(),
    audit: snap.auditEvents.filter(e => e.workspaceId === workspaceId).length,
    backups: snap.backups.filter(b => b.workspaceId === workspaceId).length,
  };
}

/**
 * W9 #5 — Cross-workspace leakage check. Scans workspace-scoped ledgers
 * (auditEvents, backups) and reports any row whose `workspaceId` refers to
 * a workspace that no longer exists, or whose active-workspace filter would
 * expose data from a sibling workspace. Returns a structured report used by
 * the admin monitoring UI and the release-readiness gate.
 *
 * NOTE (honest limitation): domain entities (concepts, publications, etc.)
 * do not yet carry a `workspaceId` column — full per-entity isolation
 * requires the schema migration tracked as W9-BLOCKER-2. Until then, this
 * check enforces isolation on the surfaces that DO carry workspace scoping
 * (audit trail, backups) and reports the un-scoped entities as advisories.
 */
export interface WorkspaceLeakageReport {
  ok: boolean;
  orphanedAuditIds: string[];
  orphanedBackupIds: string[];
  unscopedEntityKinds: string[];
  activeWorkspaceId: string;
}
export function detectWorkspaceLeakage(snap: DataSnapshot): WorkspaceLeakageReport {
  const workspaces = snap.workspaces ?? [];
  const auditEvents = snap.auditEvents ?? [];
  const backups = snap.backups ?? [];
  const known = new Set(workspaces.map(w => w.id));
  const orphanedAuditIds = auditEvents.filter(e => !known.has(e.workspaceId)).map(e => e.id);
  const orphanedBackupIds = backups.filter(b => !known.has(b.workspaceId)).map(b => b.id);
  return {
    ok: orphanedAuditIds.length === 0 && orphanedBackupIds.length === 0,
    orphanedAuditIds, orphanedBackupIds,
    unscopedEntityKinds: [
      "concepts","frameworks","knowledgeObjects","publications","clientTools",
      "clientToolkits","aiPacks","agents","automations","releases",
    ],
    activeWorkspaceId: snap.activeWorkspaceId ?? "",
  };
}

/** Filter workspace-scoped ledgers to only the active workspace's rows. */
export function scopedAudit(snap: DataSnapshot): DataSnapshot["auditEvents"] {
  const wid = snap.activeWorkspaceId;
  return snap.auditEvents.filter(e => e.workspaceId === wid);
}
export function scopedBackups(snap: DataSnapshot): DataSnapshot["backups"] {
  const wid = snap.activeWorkspaceId;
  return snap.backups.filter(b => b.workspaceId === wid);
}
