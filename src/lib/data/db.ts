import { openDB, type IDBPDatabase } from "idb";
import { SCHEMA_VERSION, type DataSnapshot, type EntityType, type PublicationStage } from "./schema";
import { buildSeedSnapshot } from "./seed";
import { backfillWorkspaceIds } from "./workspace-scoping";
import {
  upgradeToV10, verifyIntegrity, isStaleSnapshot, USER_MIGRATION_MESSAGES,
  type MigrationAuditEntry, type MigrationOutcome,
} from "./migrations";

const DB_NAME = "legacy-platform-v2";
const STORE = "kv";
const SNAPSHOT_KEY = "snapshot";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (typeof window === "undefined") throw new Error("IndexedDB unavailable during SSR");
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, SCHEMA_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

const LOG_KEY = "migrationLog";
const BACKUP_PREFIX = "snapshot.backup.v";

let lastMigration: MigrationAuditEntry | null = null;
const migrationListeners = new Set<() => void>();

export function getLastMigration(): MigrationAuditEntry | null { return lastMigration; }
export function subscribeMigration(fn: () => void): () => void {
  migrationListeners.add(fn);
  return () => migrationListeners.delete(fn);
}
export function migrationMessage(): string {
  return lastMigration ? USER_MIGRATION_MESSAGES[lastMigration.outcome] : "";
}

async function recordMigration(entry: MigrationAuditEntry) {
  lastMigration = entry;
  try {
    const db = await getDB();
    const log = ((await db.get(STORE, LOG_KEY)) as MigrationAuditEntry[] | undefined) ?? [];
    await db.put(STORE, [...log, entry].slice(-50), LOG_KEY);
  } catch { /* audit log is best-effort; never blocks boot */ }
  migrationListeners.forEach(fn => fn());
}

export async function getMigrationLog(): Promise<MigrationAuditEntry[]> {
  const db = await getDB();
  return ((await db.get(STORE, LOG_KEY)) as MigrationAuditEntry[] | undefined) ?? [];
}

/** Restores the pre-migration backup for a given schema version, if present. */
export async function restoreMigrationBackup(fromVersion: number): Promise<DataSnapshot | null> {
  const db = await getDB();
  const raw = (await db.get(STORE, BACKUP_PREFIX + fromVersion)) as DataSnapshot | undefined;
  if (!raw) return null;
  await db.put(STORE, raw, SNAPSHOT_KEY);
  return raw;
}

async function brokenRefCount(s: DataSnapshot): Promise<number> {
  try {
    const { detectBrokenReferences } = await import("./service");
    return detectBrokenReferences(s).length;
  } catch { return 0; }
}

/** Applies the shared field backfill plus the canonical catalog top-up. */
function normalize(s: DataSnapshot): DataSnapshot {
  return migrateSnapshot(upgradeToV10(migrateSnapshot(s)));
}

export async function loadSnapshot(): Promise<DataSnapshot> {
  const db = await getDB();
  const existing = (await db.get(STORE, SNAPSHOT_KEY)) as DataSnapshot | undefined;

  if (!existing) {
    const seeded = normalize(buildSeedSnapshot());
    await db.put(STORE, seeded, SNAPSHOT_KEY);
    await recordMigration({
      at: new Date().toISOString(), fromVersion: 0, toVersion: SCHEMA_VERSION,
      outcome: "fresh", message: "Fresh install seeded from canonical catalog.",
      integrity: { ok: true, checks: [] }, backupKey: null,
    });
    return seeded;
  }

  const from = existing.schemaVersion ?? 0;

  // Same version: keep the non-destructive catalog reconciliation path.
  if (!isStaleSnapshot(existing)) {
    const normalized = normalize(existing);
    if (normalized.publications.length !== existing.publications.length ||
        JSON.stringify(normalized.publications.map(p => p.id + p.title)) !==
        JSON.stringify(existing.publications.map(p => p.id + p.title))) {
      await db.put(STORE, normalized, SNAPSHOT_KEY);
    }
    return normalized;
  }

  // Stale snapshot → controlled migrate-or-reseed.
  const backupKey = BACKUP_PREFIX + from;
  try { await db.put(STORE, existing, backupKey); } catch { /* non-fatal */ }

  let outcome: MigrationOutcome = "migrated";
  let message = `Upgraded snapshot from v${from} to v${SCHEMA_VERSION}.`;
  let result: DataSnapshot;
  let integrity;

  try {
    const upgraded = normalize(existing);
    integrity = verifyIntegrity(existing, upgraded, await brokenRefCount(upgraded));
    if (integrity.ok) {
      result = upgraded;
    } else {
      outcome = "reseeded";
      message = `Integrity check failed; reseeded from canonical catalog. Failing checks: ${integrity.checks.filter(c => !c.ok).map(c => c.name).join(", ")}`;
      result = normalize(buildSeedSnapshot());
    }
  } catch (e) {
    outcome = "failed";
    message = `Migration threw: ${String(e)}. Recovered by reseeding.`;
    result = normalize(buildSeedSnapshot());
    integrity = { ok: false, checks: [{ name: "Migration executed", ok: false, detail: String(e) }] };
  }

  await db.put(STORE, result, SNAPSHOT_KEY);
  await recordMigration({
    at: new Date().toISOString(), fromVersion: from, toVersion: SCHEMA_VERSION,
    outcome, message, integrity, backupKey,
  });
  return result;
}

// Additive, backward-compatible field backfill. Runs on every load AND
// on the fresh seed so new fields have safe defaults for legacy stores.
export function migrateSnapshot(s: DataSnapshot): DataSnapshot {
  const concepts = s.concepts.map(c => ({
    ...c,
    manufacturingStatus: c.manufacturingStatus ?? (c.status === "Canonical" ? "Canonical" : "Draft"),
    publicationLinks: c.publicationLinks ?? [],
    clientToolkitLinks: c.clientToolkitLinks ?? [],
    aiPackLinks: c.aiPackLinks ?? [],
  }));

  const publications = s.publications.map(p => {
    const rawStage = (p.manufacturingStage as string | undefined) ?? mapStatusToStage(p.status);
    // Fold retired "Review" stage into "SME Review".
    const stage = rawStage === "Review" ? "SME Review" : mapStatusToStage(rawStage);
    const migratedHistory = (p.stageHistory ?? [{ stage: stage, at: p.createdAt, actor: p.steward ?? "system", note: "Initial baseline." }])
      .map(h => ({ ...h, stage: (h.stage as string) === "Review" ? "SME Review" : h.stage }));
    return {
      ...p,
      description: p.description ?? p.purpose ?? "",
      frameworkId: p.frameworkId ?? null,
      tags: p.tags ?? [],
      owner: p.owner ?? p.steward ?? "Editorial Board",
      publicationType: p.publicationType ?? "Guide",
      effectiveDate: p.effectiveDate ?? null,
      reviewDate: p.reviewDate ?? null,
      editorialNotes: p.editorialNotes ?? "",
      reviewNotes: p.reviewNotes ?? "",
      manufacturingStage: stage,
      stageHistory: migratedHistory,
      archived: p.archived ?? false,
      presentations: p.presentations ?? [],
      chapters: (p.chapters ?? []).map(ch => {
        const chRaw = (ch.manufacturingStage as string | undefined) ?? mapStatusToStage(ch.reviewStatus);
        const chStage = chRaw === "Review" ? "SME Review" : mapStatusToStage(chRaw);
        return {
          ...ch,
          description: ch.description ?? "",
          editorialNotes: ch.editorialNotes ?? "",
          estimatedEffortHours: ch.estimatedEffortHours ?? 0,
          chapterVersion: ch.chapterVersion ?? "0.1.0",
          parentChapterId: ch.parentChapterId ?? null,
          presentations: ch.presentations ?? [],
          manufacturingStage: chStage,
        };
      }),
    };
  });

  const migrated = {
    ...s,
    concepts,
    publications,
    automations: (s.automations ?? []).map(r => ({ ...r })),
    automationRuns: (s.automationRuns ?? []).map(r => ({ ...r })),
    analyticsSnapshots: s.analyticsSnapshots ?? [],
    executiveAlerts: s.executiveAlerts ?? [],
    savedExecutiveViews: s.savedExecutiveViews ?? [],
    reportRuns: s.reportRuns ?? [],
    // Workstream 8 — integrations (additive)
    integrationConnections: s.integrationConnections ?? [],
    webhookEndpoints: s.webhookEndpoints ?? [],
    webhookDeliveries: s.webhookDeliveries ?? [],
    apiClients: s.apiClients ?? [],
    importJobs: s.importJobs ?? [],
    exportJobs: s.exportJobs ?? [],
    syncMappings: s.syncMappings ?? [],
    externalReferences: s.externalReferences ?? [],
    deliveryPackages: s.deliveryPackages ?? [],
    deliveryRuns: s.deliveryRuns ?? [],
    eventSubscriptions: s.eventSubscriptions ?? [],
    domainEvents: s.domainEvents ?? [],
    // Workstream 9
    auditEvents: s.auditEvents ?? [],
    backups: s.backups ?? [],
    workspaces: s.workspaces ?? [{ id: "WS-001", name: "JM Advisory Press", slug: "jm-primary", branding: { primary: "#0B1F3A", accent: "#C9A24E", logoInitials: "JM" }, isolated: false, settings: { defaultRole: "Viewer" as const, requireHumanReview: true, retentionDays: 365 }, metrics: { assets: 0, releases: 0, runs: 0 }, archived: false, createdAt: s.exportedAt, updatedAt: s.exportedAt }],
    featureFlags: s.featureFlags ?? [],
    rateLimitBuckets: s.rateLimitBuckets ?? [],
    maintenanceMode: s.maintenanceMode ?? { enabled: false, reason: "", since: null, by: null, allowRoles: ["Administrator","Owner"] },
    activeWorkspaceId: s.activeWorkspaceId ?? "WS-001",
    launchGateEvidence: s.launchGateEvidence ?? [],
    clientToolkits: (s.clientToolkits ?? []).map(tk => ({
      ...tk,
      sections: (tk.sections ?? []).map(sec => ({ ...sec, presentations: sec.presentations ?? [] })),
      presentations: tk.presentations ?? [],
      stageHistory: tk.stageHistory ?? [{ stage: tk.manufacturingStage ?? "Draft", at: tk.createdAt, actor: tk.steward ?? "system" }],
      releaseIds: tk.releaseIds ?? [],
      tags: tk.tags ?? [],
      conceptIds: tk.conceptIds ?? [], frameworkIds: tk.frameworkIds ?? [],
      knowledgeObjectIds: tk.knowledgeObjectIds ?? [], clientToolIds: tk.clientToolIds ?? [],
      publicationIds: tk.publicationIds ?? [],
    })),
    aiPacks: (s.aiPacks ?? []).map(ap => ({
      ...ap,
      modules: ap.modules ?? [],
      evaluationCases: ap.evaluationCases ?? [],
      stageHistory: ap.stageHistory ?? [{ stage: ap.manufacturingStage ?? "Draft", at: ap.createdAt, actor: ap.steward ?? "system" }],
      releaseIds: ap.releaseIds ?? [],
      tags: ap.tags ?? [],
      conceptIds: ap.conceptIds ?? [], frameworkIds: ap.frameworkIds ?? [],
      knowledgeObjectIds: ap.knowledgeObjectIds ?? [], publicationIds: ap.publicationIds ?? [],
      clientToolkitIds: ap.clientToolkitIds ?? [], promptIds: ap.promptIds ?? [], agentIds: ap.agentIds ?? [],
    })),
    agents: (s.agents ?? []).map(a => {
      const stage: PublicationStage = ((a.manufacturingStage as string | undefined) ? mapStatusToStage(a.manufacturingStage as string) : mapStatusToStage(a.status));
      return {
        ...a,
        description: a.description ?? a.role ?? "",
        purpose: a.purpose ?? a.role ?? "",
        useCase: a.useCase ?? "Editorial Assistant",
        targetModel: a.targetModel ?? "",
        owner: a.owner ?? a.steward ?? "Editorial Board",
        tags: a.tags ?? [],
        archived: a.archived ?? false,
        manufacturingStage: stage,
        stageHistory: a.stageHistory ?? [{ stage, at: a.createdAt, actor: a.steward ?? "system", note: "Backfilled." }],
        effectiveDate: a.effectiveDate ?? null,
        reviewDate: a.reviewDate ?? null,
        conceptIds: a.conceptIds ?? [], frameworkIds: a.frameworkIds ?? [],
        knowledgeObjectIds: a.knowledgeObjectIds ?? [], publicationIds: a.publicationIds ?? [],
        clientToolkitIds: a.clientToolkitIds ?? [], aiPackIds: a.aiPackIds ?? [],
        clientToolIds: a.clientToolIds ?? [],
        specifications: a.specifications ?? [],
        evaluationCases: a.evaluationCases ?? [],
        usagePolicy: a.usagePolicy ?? "",
        boundaryConditions: a.boundaryConditions ?? "",
        prohibitedUses: a.prohibitedUses ?? "",
        escalationGuidance: a.escalationGuidance ?? "",
        provenanceNotes: a.provenanceNotes ?? "",
        humanReviewCompleted: a.humanReviewCompleted ?? false,
        releaseIds: a.releaseIds ?? [],
      };
    }),
  };
  return backfillWorkspaceIds(migrated);
}

function mapStatusToStage(status: string | undefined): "Draft"|"Editorial"|"SME Review"|"QA"|"Canonical"|"Released" {
  switch (status) {
    case "Released": return "Released";
    case "Canonical": return "Canonical";
    case "Approved": return "QA";
    case "QA": return "QA";
    case "SME Review": return "SME Review";
    case "Review": return "SME Review"; // schema v1 → v2 migration
    case "In Review": return "SME Review";
    case "Editorial": return "Editorial";
    case "Deprecated":
    case "Archived":
    case "Draft":
    default: return "Draft";
  }
}

export async function saveSnapshot(snapshot: DataSnapshot): Promise<void> {
  const db = await getDB();
  const next: DataSnapshot = { ...snapshot, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString() };
  await db.put(STORE, next, SNAPSHOT_KEY);
}

export async function resetSnapshot(): Promise<DataSnapshot> {
  const db = await getDB();
  const seeded = buildSeedSnapshot();
  await db.put(STORE, seeded, SNAPSHOT_KEY);
  return seeded;
}

export type { EntityType };
