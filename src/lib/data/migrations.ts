// Snapshot migration engine (Task 12).
//
// Controlled migrate-or-reseed behaviour for local IndexedDB snapshots.
// v9 → v10 upgrades an existing snapshot in place, verifies data integrity,
// and falls back to a clean reseed when the upgrade cannot be trusted.
//
// Every outcome is recorded in an append-only migration audit log so support
// and monitoring can distinguish "migrated", "reseeded" and "failed" stores.

import { SCHEMA_VERSION, type DataSnapshot } from "./schema";
import { seedGuidePublications } from "./seed.guides";
import { detectBrokenReferences } from "./service";

export type MigrationOutcome = "current" | "migrated" | "reseeded" | "failed" | "fresh";

export interface MigrationAuditEntry {
  at: string;
  fromVersion: number;
  toVersion: number;
  outcome: MigrationOutcome;
  message: string;
  integrity: IntegrityResult;
  backupKey: string | null;
}

export interface IntegrityResult {
  ok: boolean;
  checks: { name: string; ok: boolean; detail: string }[];
}

const COUNTED = [
  "concepts", "frameworks", "knowledgeObjects", "publications", "prompts",
  "agents", "clientTools", "clientToolkits", "aiPacks", "releases",
] as const;

function count(s: DataSnapshot, key: string): number {
  const v = (s as unknown as Record<string, unknown>)[key];
  return Array.isArray(v) ? v.length : 0;
}

/** Verifies that a migrated snapshot lost no content and no relationships. */
export function verifyIntegrity(before: DataSnapshot, after: DataSnapshot): IntegrityResult {
  const checks: { name: string; ok: boolean; detail: string }[] = [];

  for (const key of COUNTED) {
    const b = count(before, key);
    const a = count(after, key);
    checks.push({
      name: `${key} retained`,
      ok: a >= b,
      detail: `${b} → ${a}`,
    });
  }

  const beforeIds = new Set(before.publications.map(p => p.id));
  const missing = [...beforeIds].filter(id => !after.publications.some(p => p.id === id));
  checks.push({
    name: "No publication dropped",
    ok: missing.length === 0,
    detail: missing.length === 0 ? "all ids present" : `missing ${missing.join(", ")}`,
  });

  const seedPresent = seedGuidePublications.every(g => after.publications.some(p => p.id === g.id));
  checks.push({
    name: "Seed guide catalog present",
    ok: seedPresent,
    detail: `${seedGuidePublications.length} canonical guides expected`,
  });

  let broken: { source: string; targetId: string; kind: string }[] = [];
  try {
    broken = detectBrokenReferences(after);
  } catch (e) {
    checks.push({ name: "Broken-reference scan", ok: false, detail: String(e) });
  }
  checks.push({
    name: "Broken references at zero",
    ok: broken.length === 0,
    detail: `${broken.length} found`,
  });

  checks.push({
    name: "Schema version stamped",
    ok: after.schemaVersion === SCHEMA_VERSION,
    detail: `v${after.schemaVersion}`,
  });

  return { ok: checks.every(c => c.ok), checks };
}

/**
 * v9 → v10 upgrade. Purely additive at the field level: the shared
 * `migrateSnapshot` backfill (applied by the caller) handles field defaults;
 * this step reconciles the canonical guide catalog and re-stamps the version.
 */
export function upgradeToV10(s: DataSnapshot): DataSnapshot {
  const seedById = new Map(seedGuidePublications.map(p => [p.id, p]));
  const reconciled = s.publications.map(p => {
    const seed = seedById.get(p.id);
    if (!seed) return p;
    const isStub = !p.title || p.title === "Untitled Publication" || (p.chapters?.length ?? 0) === 0;
    return isStub ? { ...seed } : p;
  });
  const have = new Set(reconciled.map(p => p.id));
  const missing = seedGuidePublications.filter(p => !have.has(p.id));
  return {
    ...s,
    publications: [...reconciled, ...missing],
    schemaVersion: SCHEMA_VERSION,
  };
}

export const USER_MIGRATION_MESSAGES: Record<MigrationOutcome, string> = {
  current: "",
  fresh: "",
  migrated:
    "Your local Legacy Forge data was upgraded to the latest content version. Nothing was lost — a backup of the previous copy is retained in this browser.",
  reseeded:
    "Your local Legacy Forge data could not be upgraded safely, so it was refreshed from the canonical catalog. A backup of the previous copy is retained in this browser.",
  failed:
    "Legacy Forge could not upgrade your local data. You are viewing the canonical catalog. Use Import / Export to restore a backup if you had unsaved local work.",
};

/** Snapshot is considered stale when it does not match the runtime schema. */
export function isStaleSnapshot(s: Pick<DataSnapshot, "schemaVersion">): boolean {
  return s.schemaVersion !== SCHEMA_VERSION;
}
