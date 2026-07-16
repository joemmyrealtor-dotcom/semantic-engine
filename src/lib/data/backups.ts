// Workstream 9 — Backup, restore, rollback, disaster recovery.
//
// All backups are content-hashed for integrity verification. Restoration is
// governed and produces an audit event; rollback restores the most recent
// backup taken before a specified timestamp. Migration verification checks
// that a restored snapshot conforms to the current SCHEMA_VERSION.

import type { BackupSnapshot, DataSnapshot } from "./schema";
import { SCHEMA_VERSION } from "./schema";
import { contentHash, redactSecrets } from "./security";

export function nextBackupId(existing: BackupSnapshot[] | undefined): string {
  const list = existing ?? [];
  const nums = list.map(b => Number(b.id.replace(/^BKP-/, ""))).filter(n => !isNaN(n));
  return `BKP-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
}

export function createBackup(snapshot: DataSnapshot, opts: { label: string; reason: string; actor: string }): BackupSnapshot {
  // Never persist secret-shaped fields into a backup payload.
  const safe = redactSecrets(snapshot) as DataSnapshot;
  const payload = JSON.stringify(safe);
  const now = new Date().toISOString();
  const id = nextBackupId(snapshot.backups);
  const entityCount = countEntities(safe);
  return {
    id, label: opts.label, reason: opts.reason, actor: opts.actor,
    schemaVersion: safe.schemaVersion,
    entityCount,
    bytes: payload.length,
    hash: contentHash(safe),
    workspaceId: safe.activeWorkspaceId,
    payload, restoredAt: null,
    createdAt: now, updatedAt: now,
  };
}

function countEntities(s: DataSnapshot): number {
  const keys: (keyof DataSnapshot)[] = [
    "domains","concepts","frameworks","knowledgeObjects","clientTools","publications",
    "prompts","agents","releases","clientToolkits","aiPacks","automations",
  ];
  return keys.reduce((n, k) => n + ((s[k] as unknown[])?.length ?? 0), 0);
}

export function verifyBackupIntegrity(backup: BackupSnapshot): { ok: boolean; reason: string } {
  try {
    const parsed = JSON.parse(backup.payload) as DataSnapshot;
    const expected = contentHash(parsed);
    if (expected !== backup.hash) return { ok: false, reason: "hash-mismatch" };
    if (parsed.schemaVersion > SCHEMA_VERSION) return { ok: false, reason: "future-schema-version" };
    return { ok: true, reason: "ok" };
  } catch {
    return { ok: false, reason: "invalid-payload" };
  }
}

export function restoreFromBackup(backup: BackupSnapshot): DataSnapshot {
  const integrity = verifyBackupIntegrity(backup);
  if (!integrity.ok) throw new Error(`Backup ${backup.id} failed integrity: ${integrity.reason}`);
  return JSON.parse(backup.payload) as DataSnapshot;
}

/**
 * Governed restore (W9 #4). Enforces a written reason, a typed confirmation
 * phrase, and creates a pre-restore backup of the CURRENT snapshot before
 * overwriting it. Returns both the pre-restore backup (for rollback) and the
 * restored snapshot with the pre-restore backup appended to its ledger.
 */
export interface RestoreOptions {
  reason: string;
  actor: string;
  confirmation: string;    // must equal "RESTORE" (case-sensitive)
}
export function performGovernedRestore(
  current: DataSnapshot,
  target: BackupSnapshot,
  opts: RestoreOptions,
): { preRestoreBackup: BackupSnapshot; restored: DataSnapshot } {
  if (opts.confirmation !== "RESTORE") {
    throw new Error("Restore blocked: destructive confirmation phrase 'RESTORE' required.");
  }
  if (!opts.reason || opts.reason.trim().length < 8) {
    throw new Error("Restore blocked: written reason (≥ 8 chars) required for audit.");
  }
  const pre = createBackup(current, {
    label: `pre-restore/${target.id}`,
    reason: `Pre-restore safety backup for ${target.id}: ${opts.reason}`,
    actor: opts.actor,
  });
  const restored = restoreFromBackup(target);
  return {
    preRestoreBackup: pre,
    restored: {
      ...restored,
      backups: [...(restored.backups ?? []), pre, { ...target, restoredAt: new Date().toISOString() }],
    },
  };
}

/** Rollback to the latest backup taken strictly before `beforeIso`. */
export function findRollbackTarget(backups: BackupSnapshot[], beforeIso: string): BackupSnapshot | null {
  const cutoff = Date.parse(beforeIso);
  const candidates = backups.filter(b => Date.parse(b.createdAt) < cutoff).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return candidates[0] ?? null;
}

/** Migration verification — asserts the restored snapshot matches current runtime. */
export function verifyMigration(snapshot: DataSnapshot): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (snapshot.schemaVersion !== SCHEMA_VERSION) {
    issues.push(`schemaVersion ${snapshot.schemaVersion} != current ${SCHEMA_VERSION}`);
  }
  const requiredKeys: (keyof DataSnapshot)[] = ["workspaces","auditEvents","featureFlags","rateLimitBuckets","maintenanceMode"];
  for (const k of requiredKeys) {
    if ((snapshot as unknown as Record<string, unknown>)[k] === undefined) issues.push(`missing ${String(k)}`);
  }
  return { ok: issues.length === 0, issues };
}

export interface DisasterRecoveryPlan {
  latestBackup: BackupSnapshot | null;
  backupCount: number;
  oldestBackupAt: string | null;
  recommendedActions: string[];
}
export function buildDisasterRecoveryPlan(snapshot: DataSnapshot): DisasterRecoveryPlan {
  const sorted = [...snapshot.backups].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const latest = sorted[0] ?? null;
  const oldest = sorted[sorted.length - 1] ?? null;
  const recs: string[] = [];
  if (!latest) recs.push("Create the first backup before enabling production traffic.");
  else if (Date.parse(latest.createdAt) < Date.now() - 7 * 86400_000) recs.push("Latest backup > 7 days old — schedule a fresh backup.");
  if (snapshot.backups.length < 3) recs.push("Maintain at least 3 rolling backups for point-in-time recovery.");
  if (!snapshot.maintenanceMode.allowRoles.length) recs.push("Configure allow-list roles for maintenance mode.");
  return { latestBackup: latest, backupCount: snapshot.backups.length, oldestBackupAt: oldest?.createdAt ?? null, recommendedActions: recs };
}
