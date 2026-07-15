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
  const seeded = buildSeedSnapshot();
  await db.put(STORE, seeded, SNAPSHOT_KEY);
  return seeded;
}

// Additive, backward-compatible field backfill for Canonical Knowledge Core.
function migrateSnapshot(s: DataSnapshot): DataSnapshot {
  const concepts = s.concepts.map(c => ({
    manufacturingStatus: c.status === "Canonical" ? "Canonical" as const : "Draft" as const,
    publicationLinks: [],
    clientToolkitLinks: [],
    aiPackLinks: [],
    ...c,
  }));
  return { ...s, concepts };
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
