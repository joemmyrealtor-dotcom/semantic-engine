import { openDB, type IDBPDatabase } from "idb";
import { SCHEMA_VERSION, type DataSnapshot, type EntityType } from "./schema";
import { buildSeedSnapshot } from "./seed";

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

export async function loadSnapshot(): Promise<DataSnapshot> {
  const db = await getDB();
  const existing = (await db.get(STORE, SNAPSHOT_KEY)) as DataSnapshot | undefined;
  if (existing && existing.schemaVersion === SCHEMA_VERSION) return migrateSnapshot(existing);
  const seeded = migrateSnapshot(buildSeedSnapshot());
  await db.put(STORE, seeded, SNAPSHOT_KEY);
  return seeded;
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
    const stage = p.manufacturingStage ?? mapStatusToStage(p.status);
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
      stageHistory: p.stageHistory ?? [{ stage, at: p.createdAt, actor: p.steward ?? "system", note: "Initial baseline." }],
      archived: p.archived ?? false,
      presentations: p.presentations ?? [],
      chapters: (p.chapters ?? []).map(ch => ({
        ...ch,
        description: ch.description ?? "",
        editorialNotes: ch.editorialNotes ?? "",
        estimatedEffortHours: ch.estimatedEffortHours ?? 0,
        chapterVersion: ch.chapterVersion ?? "0.1.0",
        parentChapterId: ch.parentChapterId ?? null,
        presentations: ch.presentations ?? [],
        manufacturingStage: ch.manufacturingStage ?? mapStatusToStage(ch.reviewStatus),
      })),
    };
  });

  return { ...s, concepts, publications };
}

function mapStatusToStage(status: string | undefined): "Draft"|"Editorial"|"Review"|"SME Review"|"QA"|"Canonical"|"Released" {
  switch (status) {
    case "Canonical": return "Canonical";
    case "Approved": return "QA";
    case "In Review": return "Review";
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
