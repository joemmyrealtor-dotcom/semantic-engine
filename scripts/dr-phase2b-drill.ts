import "fake-indexeddb/auto";
if (typeof (globalThis as { window?: unknown }).window === "undefined") {
  (globalThis as { window?: unknown }).window = globalThis;
}
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { performGovernedRestore, verifyBackupIntegrity, verifyMigration } from "../src/lib/data/backups";
import { loadSnapshot, saveSnapshot } from "../src/lib/data/db";
import { contentHash } from "../src/lib/data/security";
import type { BackupSnapshot, DataSnapshot } from "../src/lib/data/schema";
import { openDB } from "idb";

const BASELINE = "/mnt/documents/baselines/BL-APPDRILL-20260727T153835212Z.json";
const EXPECTED_SHA = "a384b89721d9b9b5c7baa2eaad440c072b347803021cd52ce1db0f655ff1cc7a";

const evidence: Record<string, unknown> = {};
const raw = readFileSync(BASELINE);
const storedSha = createHash("sha256").update(raw).digest("hex");
evidence.baselineFile = BASELINE;
evidence.baselineBytes = raw.length;
evidence.baselineStoredSha256 = storedSha;
evidence.baselineHashMatch = storedSha === EXPECTED_SHA;
if (storedSha !== EXPECTED_SHA) throw new Error(`baseline hash mismatch: ${storedSha}`);

const target = JSON.parse(raw.toString("utf8")) as BackupSnapshot;
const integrity = verifyBackupIntegrity(target);
evidence.baselineIntegrity = integrity;
if (!integrity.ok) throw new Error(`integrity failed: ${integrity.reason}`);

const targetPayloadParsed = JSON.parse(target.payload) as DataSnapshot;
const targetMigration = verifyMigration(targetPayloadParsed);
evidence.baselinePayloadMigration = targetMigration;
if (!targetMigration.ok) throw new Error(`migration failed`);

const current = await loadSnapshot();
evidence.currentSchemaVersion = current.schemaVersion;
evidence.currentWorkspaceId = current.activeWorkspaceId;
evidence.currentEntityCount = (current.concepts?.length ?? 0) + (current.publications?.length ?? 0);

const rtoStartMs = Date.now();
const rtoStartIso = new Date(rtoStartMs).toISOString();

const { preRestoreBackup, restored } = performGovernedRestore(current, target, {
  reason: "Phase 2B application restore drill under accepted Option B v1.0.2 baseline (non-production)",
  actor: "dr-drill-harness",
  confirmation: "RESTORE",
});

const preIntegrity = verifyBackupIntegrity(preRestoreBackup);
evidence.preRestoreBackup = {
  id: preRestoreBackup.id,
  hash: preRestoreBackup.hash,
  bytes: preRestoreBackup.bytes,
  entityCount: preRestoreBackup.entityCount,
  createdAt: preRestoreBackup.createdAt,
  integrity: preIntegrity,
};
if (!preIntegrity.ok) throw new Error("pre-restore backup integrity failed");

const restoredMigration = verifyMigration(restored);
evidence.restoredMigration = restoredMigration;
if (!restoredMigration.ok) throw new Error("restored migration failed");

const restoredFullHash = contentHash(restored);
evidence.restoredSchemaVersion = restored.schemaVersion;
evidence.restoredWorkspaceId = restored.activeWorkspaceId;
evidence.restoredContentHash = restoredFullHash;
evidence.restoredCounts = {
  concepts: restored.concepts.length,
  publications: restored.publications.length,
  frameworks: restored.frameworks.length,
  knowledgeObjects: restored.knowledgeObjects.length,
  agents: restored.agents.length,
  releases: restored.releases.length,
  auditEvents: restored.auditEvents.length,
  backups: restored.backups.length,
  launchGateEvidence: restored.launchGateEvidence.length,
};

await saveSnapshot(restored);
evidence.persistence = { database: "legacy-platform-v2", store: "kv", key: "snapshot", ok: true };

const conn = await openDB("legacy-platform-v2", 9);
conn.close();
evidence.dbClosed = true;

const conn2 = await openDB("legacy-platform-v2", 9);
const persisted = (await conn2.get("kv", "snapshot")) as DataSnapshot;
conn2.close();
evidence.dbReopened = true;
evidence.persistedHashMatchesRestored = contentHash(persisted) === restoredFullHash;

// Reload via normal data-path
const fresh = await import("../src/lib/data/db?fresh=" + Date.now());
const reloaded = await fresh.loadSnapshot();
const reloadedHash = contentHash(reloaded);
evidence.reloadedHashMatchesRestored = reloadedHash === restoredFullHash;
evidence.reloadedSchemaVersion = reloaded.schemaVersion;
evidence.reloadedWorkspaceId = reloaded.activeWorkspaceId;

const rtoEndMs = Date.now();
const rtoSeconds = (rtoEndMs - rtoStartMs) / 1000;
evidence.rto = {
  startedAt: rtoStartIso,
  endedAt: new Date(rtoEndMs).toISOString(),
  seconds: rtoSeconds,
  withinBudget: rtoSeconds <= 1800,
  budgetSeconds: 1800,
};

writeFileSync("/tmp/dr-phase2b/drill-result.json", JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));

// Normalized comparison — saveSnapshot bumps exportedAt; migrateSnapshot backfills defaults.
// Compare structural equivalence excluding exportedAt.
function normHash(s: DataSnapshot): string {
  const { exportedAt: _e, ...rest } = s as DataSnapshot & Record<string, unknown>;
  return contentHash(rest);
}
const restoredNorm = normHash(restored);
const persistedNorm = normHash(persisted);
const reloadedNorm = normHash(reloaded);
const finalEvidence = {
  ...evidence,
  normalized: {
    restored: restoredNorm,
    persisted: persistedNorm,
    reloaded: reloadedNorm,
    persistedMatches: persistedNorm === restoredNorm,
    reloadedMatches: reloadedNorm === restoredNorm,
  },
};
writeFileSync("/tmp/dr-phase2b/drill-result.json", JSON.stringify(finalEvidence, null, 2));
console.log("NORMALIZED:", JSON.stringify(finalEvidence.normalized, null, 2));

import { migrateSnapshot } from "../src/lib/data/db";
const migratedRestored = migrateSnapshot(restored);
const migratedNorm = normHash(migratedRestored);
const equivalence = {
  reloadedEqualsMigratedRestored: reloadedNorm === migratedNorm,
  reloadedContentHash: reloadedNorm,
  migratedRestoredContentHash: migratedNorm,
  entityParity: {
    concepts: reloaded.concepts.length === restored.concepts.length,
    publications: reloaded.publications.length === restored.publications.length,
    frameworks: reloaded.frameworks.length === restored.frameworks.length,
    knowledgeObjects: reloaded.knowledgeObjects.length === restored.knowledgeObjects.length,
    agents: reloaded.agents.length === restored.agents.length,
    releases: reloaded.releases.length === restored.releases.length,
    backups: reloaded.backups.length === restored.backups.length,
    workspaceId: reloaded.activeWorkspaceId === restored.activeWorkspaceId,
    schemaVersion: reloaded.schemaVersion === restored.schemaVersion,
  },
};
console.log("EQUIV:", JSON.stringify(equivalence, null, 2));
const final2 = { ...finalEvidence, equivalence };
writeFileSync("/tmp/dr-phase2b/drill-result.json", JSON.stringify(final2, null, 2));
