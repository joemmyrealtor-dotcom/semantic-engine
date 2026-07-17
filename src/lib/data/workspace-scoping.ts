// Workstream 9 — Blocker #5b: per-entity workspace isolation registry.
//
// Classifies every entity kind in `DataSnapshot` as either
//   - workspace-owned (must carry a `workspaceId` matching the active
//     workspace), or
//   - global/registry (single-tenant metadata shared across workspaces).
//
// Consumed by:
//   - `db.ts` migrateSnapshot → `backfillWorkspaceIds` (idempotent).
//   - `repository.ts` → strict `scopedList`, and cross-workspace guards on
//     `create`/`update`/`remove`.
//   - `workspaces.ts` → `detectWorkspaceLeakage` upgraded to enforce the
//     registry (unscoped rows in owned kinds become hard issues, not
//     advisories).

import type { DataSnapshot, EntityType } from "./schema";

/** Kinds whose rows are owned by exactly one workspace. */
export const WORKSPACE_OWNED_KINDS = [
  "domains","concepts","frameworks","knowledgeObjects","clientTools",
  "publications","prompts","agents","releases",
  "clientToolkits","aiPacks",
  "automations","automationRuns",
  "analyticsSnapshots","executiveAlerts","savedExecutiveViews","reportRuns",
  "integrationConnections","webhookEndpoints","webhookDeliveries","apiClients",
  "importJobs","exportJobs","syncMappings","externalReferences",
  "deliveryPackages","deliveryRuns","eventSubscriptions","domainEvents",
  "auditEvents","backups","launchGateEvidence",
] as const satisfies readonly EntityType[];

/** Kinds intentionally global (multi-tenant metadata). */
export const GLOBAL_KINDS = [
  "workspaces","featureFlags","rateLimitBuckets",
] as const satisfies readonly EntityType[];

const OWNED = new Set<string>(WORKSPACE_OWNED_KINDS);
export function isWorkspaceOwned(kind: EntityType | string): boolean {
  return OWNED.has(kind as string);
}

/**
 * Idempotent backfill: any workspace-owned row missing `workspaceId` is
 * stamped with `snap.activeWorkspaceId` (or the first workspace's id).
 * Preserves existing values — never re-homes a row.
 */
export function backfillWorkspaceIds(snap: DataSnapshot): DataSnapshot {
  const wid = snap.activeWorkspaceId
    ?? snap.workspaces?.[0]?.id
    ?? "WS-001";
  const out = { ...snap } as unknown as Record<string, unknown>;
  for (const kind of WORKSPACE_OWNED_KINDS) {
    const rows = (snap as unknown as Record<string, unknown[]>)[kind];
    if (!Array.isArray(rows)) continue;
    let mutated = false;
    const next = rows.map(r => {
      if (r && typeof r === "object" && !("workspaceId" in r)) {
        mutated = true;
        return { ...(r as object), workspaceId: wid };
      }
      // Backup/audit rows already require workspaceId — leave untouched.
      return r;
    });
    if (mutated) out[kind] = next;
  }
  return out as unknown as DataSnapshot;
}

export interface WorkspaceCoverageReport {
  ok: boolean;
  perKind: Array<{ kind: string; total: number; unscoped: number; foreign: number }>;
  totalUnscoped: number;
  totalForeign: number;
}

/** Per-kind census of workspaceId coverage against the active workspace. */
export function auditWorkspaceCoverage(snap: DataSnapshot): WorkspaceCoverageReport {
  const active = snap.activeWorkspaceId ?? "";
  const perKind: WorkspaceCoverageReport["perKind"] = [];
  let totalUnscoped = 0;
  let totalForeign = 0;
  for (const kind of WORKSPACE_OWNED_KINDS) {
    const rows = ((snap as unknown as Record<string, unknown[]>)[kind] ?? []) as Array<{ workspaceId?: string; id?: string }>;
    let unscoped = 0, foreign = 0;
    for (const r of rows) {
      if (!r || typeof r !== "object") continue;
      if (r.workspaceId === undefined) unscoped += 1;
      else if (active && r.workspaceId !== active) foreign += 1;
    }
    totalUnscoped += unscoped;
    totalForeign += foreign;
    perKind.push({ kind, total: rows.length, unscoped, foreign });
  }
  return { ok: totalUnscoped === 0, perKind, totalUnscoped, totalForeign };
}
