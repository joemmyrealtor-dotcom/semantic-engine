// Workstream 9 — Multi-workspace registry.
//
// Workspaces enable per-tenant isolation, branding, and settings. Blocker
// #5b (real per-entity isolation) is closed: every workspace-owned entity
// carries `workspaceId`, backfilled on load and enforced at the repository
// mutation boundary. `detectWorkspaceLeakage` now uses the classification
// registry to hard-fail on unscoped rows in owned kinds.

import type { DataSnapshot, Workspace } from "./schema";
import {
  WORKSPACE_OWNED_KINDS, auditWorkspaceCoverage,
} from "./workspace-scoping";

export function nextWorkspaceId(existing: Workspace[]): string {
  const nums = existing.map(w => Number(w.id.replace(/^WS-/, ""))).filter(n => !isNaN(n));
  return `WS-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
}

export function activeWorkspace(snap: DataSnapshot): Workspace | null {
  return snap.workspaces.find(w => w.id === snap.activeWorkspaceId) ?? snap.workspaces[0] ?? null;
}

export function workspaceMetrics(snap: DataSnapshot, workspaceId: string): { assets: number; releases: number; runs: number; auditEvents: number } {
  const inWs = <T extends { workspaceId?: string }>(rows: T[] | undefined) =>
    (rows ?? []).filter(r => r.workspaceId === undefined || r.workspaceId === workspaceId);
  return {
    assets: inWs(snap.concepts).length + inWs(snap.knowledgeObjects).length
      + inWs(snap.publications).length + inWs(snap.clientToolkits).length
      + inWs(snap.aiPacks).length + inWs(snap.agents).length,
    releases: inWs(snap.releases).length,
    runs: inWs(snap.automationRuns).length,
    auditEvents: (snap.auditEvents ?? []).filter(e => e.workspaceId === workspaceId).length,
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
 * W9 #5b — Real per-entity leakage detector. Reports:
 *   - orphaned audit/backup rows (workspaceId → unknown workspace)
 *   - foreign-workspace rows visible under the active workspace
 *   - unscoped rows in workspace-owned kinds (a schema migration gap)
 * Backed by the classification registry in `workspace-scoping.ts` so new
 * entity kinds are covered as soon as they're added to `WORKSPACE_OWNED_KINDS`.
 */
export interface WorkspaceLeakageReport {
  ok: boolean;
  orphanedAuditIds: string[];
  orphanedBackupIds: string[];
  crossWorkspaceEntities: { kind: string; id: string; workspaceId: string }[];
  unscopedEntities: { kind: string; id: string }[];
  perKindCoverage: Array<{ kind: string; total: number; unscoped: number; foreign: number }>;
  activeWorkspaceId: string;
}

export function detectWorkspaceLeakage(snap: DataSnapshot): WorkspaceLeakageReport {
  const workspaces = snap.workspaces ?? [];
  const auditEvents = snap.auditEvents ?? [];
  const backups = snap.backups ?? [];
  const known = new Set(workspaces.map(w => w.id));
  const active = snap.activeWorkspaceId ?? "";
  const orphanedAuditIds = auditEvents.filter(e => !known.has(e.workspaceId)).map(e => e.id);
  const orphanedBackupIds = backups.filter(b => !known.has(b.workspaceId)).map(b => b.id);

  const crossWorkspaceEntities: { kind: string; id: string; workspaceId: string }[] = [];
  const unscopedEntities: { kind: string; id: string }[] = [];
  for (const kind of WORKSPACE_OWNED_KINDS) {
    const rows = ((snap as unknown as Record<string, { id?: string; workspaceId?: string }[]>)[kind] ?? []);
    for (const r of rows) {
      if (!r || typeof r !== "object") continue;
      const id = r.id ?? "";
      if (r.workspaceId === undefined) unscopedEntities.push({ kind, id });
      else if (active && r.workspaceId !== active) {
        crossWorkspaceEntities.push({ kind, id, workspaceId: r.workspaceId });
      }
    }
  }

  const coverage = auditWorkspaceCoverage(snap);
  return {
    ok: orphanedAuditIds.length === 0 && orphanedBackupIds.length === 0 && unscopedEntities.length === 0,
    orphanedAuditIds, orphanedBackupIds,
    crossWorkspaceEntities, unscopedEntities,
    perKindCoverage: coverage.perKind,
    activeWorkspaceId: active,
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

/**
 * Filter any entity array to the active workspace. Rows without a
 * `workspaceId` are treated as legacy/global and included (this preserves
 * behaviour for entity kinds that have not yet been migrated to per-row
 * scoping — the report above tracks that gap explicitly).
 */
export function scopeEntities<T extends { workspaceId?: string }>(rows: T[], activeWorkspaceId: string): T[] {
  return rows.filter(r => r.workspaceId === undefined || r.workspaceId === activeWorkspaceId);
}
