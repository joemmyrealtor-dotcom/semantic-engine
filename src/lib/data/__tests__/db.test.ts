// Task 13 — integration tests: IndexedDB boot, v9 → v10 migration outcomes,
// pre-migration backup retention, and integrity-failure reseed.
//
// Runs against fake-indexeddb; each test gets a clean factory and a fresh
// module registry so the db module's cached connection is not shared.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { buildSeedSnapshot } from "@/lib/data/seed";
import { SCHEMA_VERSION } from "@/lib/data/schema";
import type { DataSnapshot } from "@/lib/data/schema";

type DbModule = typeof import("@/lib/data/db");

async function freshDb(): Promise<DbModule> {
  vi.resetModules();
  globalThis.indexedDB = new IDBFactory();
  return await import("@/lib/data/db");
}

/** Writes a snapshot directly into the same store the app boots from. */
async function seedStore(snapshot: DataSnapshot) {
  const { openDB } = await import("idb");
  const db = await openDB("legacy-platform-v2", SCHEMA_VERSION, {
    upgrade(d) { if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv"); },
  });
  await db.put("kv", snapshot, "snapshot");
  db.close();
}

const v9Snapshot = (): DataSnapshot => ({ ...buildSeedSnapshot(), schemaVersion: 9 });

let db: DbModule;
beforeEach(async () => { db = await freshDb(); });

describe("first boot", () => {
  it("seeds a fresh store and records a 'fresh' migration entry", async () => {
    const snap = await db.loadSnapshot();
    expect(snap.schemaVersion).toBe(SCHEMA_VERSION);
    expect(snap.publications.length).toBeGreaterThan(0);
    expect(db.getLastMigration()?.outcome).toBe("fresh");
  });

  it("emits no user-facing notice for a fresh install", async () => {
    await db.loadSnapshot();
    expect(db.migrationMessage()).toBe("");
  });

  it("is idempotent across reloads", async () => {
    const first = await db.loadSnapshot();
    const second = await db.loadSnapshot();
    expect(second.publications.length).toBe(first.publications.length);
  });
});

describe("v9 → v10 migration", () => {
  it("upgrades in place and reports outcome 'migrated'", async () => {
    await seedStore(v9Snapshot());
    const snap = await db.loadSnapshot();
    expect(snap.schemaVersion).toBe(SCHEMA_VERSION);
    const entry = db.getLastMigration()!;
    expect(entry.outcome).toBe("migrated");
    expect(entry.fromVersion).toBe(9);
    expect(entry.toVersion).toBe(SCHEMA_VERSION);
    expect(entry.integrity.ok).toBe(true);
  });

  it("retains operator-authored records through the upgrade", async () => {
    const s = v9Snapshot();
    const custom = { ...s.publications[0], id: "PL-RETAIN-1", title: "Operator Retained Guide" };
    await seedStore({ ...s, publications: [...s.publications, custom] });
    const snap = await db.loadSnapshot();
    expect(snap.publications.find(p => p.id === "PL-RETAIN-1")?.title).toBe("Operator Retained Guide");
  });

  it("writes a pre-migration backup that can be restored", async () => {
    const s = v9Snapshot();
    const marked = { ...s, publications: [...s.publications, { ...s.publications[0], id: "PL-PRE-1", title: "Pre-migration only" }] };
    await seedStore(marked);
    await db.loadSnapshot();
    expect(db.getLastMigration()?.backupKey).toBe("snapshot.backup.v9");
    const restored = await db.restoreMigrationBackup(9);
    expect(restored?.schemaVersion).toBe(9);
    expect(restored?.publications.some(p => p.id === "PL-PRE-1")).toBe(true);
  });

  it("returns null when no backup exists for the requested version", async () => {
    await db.loadSnapshot();
    expect(await db.restoreMigrationBackup(7)).toBeNull();
  });

  it("appends the outcome to the persistent migration log", async () => {
    await seedStore(v9Snapshot());
    await db.loadSnapshot();
    const log = await db.getMigrationLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[log.length - 1].outcome).toBe("migrated");
  });

  it("shows a user-facing notice after a real migration", async () => {
    await seedStore(v9Snapshot());
    await db.loadSnapshot();
    expect(db.migrationMessage()).toMatch(/upgraded/i);
  });

  it("does not migrate an already-current snapshot", async () => {
    await seedStore(buildSeedSnapshot());
    await db.loadSnapshot();
    expect(db.getLastMigration()).toBeNull();
  });
});

describe("integrity failure handling", () => {
  it("reseeds from the canonical catalog when integrity cannot be trusted", async () => {
    vi.resetModules();
    globalThis.indexedDB = new IDBFactory();
    vi.doMock("@/lib/data/migrations", async () => {
      const actual = await vi.importActual<typeof import("@/lib/data/migrations")>("@/lib/data/migrations");
      return {
        ...actual,
        verifyIntegrity: () => ({ ok: false, checks: [{ name: "Forced failure", ok: false, detail: "test" }] }),
      };
    });
    const mocked = await import("@/lib/data/db");
    await seedStore({ ...v9Snapshot(), publications: [] });
    const snap = await mocked.loadSnapshot();
    const entry = mocked.getLastMigration()!;
    expect(entry.outcome).toBe("reseeded");
    expect(entry.integrity.ok).toBe(false);
    expect(snap.publications.length).toBeGreaterThan(0);
    expect(mocked.migrationMessage()).toMatch(/refreshed from the canonical catalog/i);
    vi.doUnmock("@/lib/data/migrations");
  });
});
