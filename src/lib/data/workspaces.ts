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
