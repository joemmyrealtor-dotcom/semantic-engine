// Task 13 — unit tests: backup creation, integrity, governed restore, rollback.
import { describe, it, expect } from "vitest";
import { buildSeedSnapshot } from "@/lib/data/seed";
import { SCHEMA_VERSION } from "@/lib/data/schema";
import {
  createBackup, verifyBackupIntegrity, restoreFromBackup, performGovernedRestore,
  findRollbackTarget, verifyMigration, buildDisasterRecoveryPlan,
} from "@/lib/data/backups";

const opts = { label: "test", reason: "unit test backup", actor: "vitest" };

describe("backup creation", () => {
  it("captures counts, bytes and a content hash", () => {
    const s = buildSeedSnapshot();
    const b = createBackup(s, opts);
    expect(b.id).toMatch(/^BKP-\d{3}$/);
    expect(b.schemaVersion).toBe(SCHEMA_VERSION);
    expect(b.entityCount).toBeGreaterThan(0);
    expect(b.bytes).toBeGreaterThan(0);
    expect(b.hash).toBeTruthy();
    expect(b.restoredAt).toBeNull();
  });

  it("assigns sequential ids", () => {
    const s = buildSeedSnapshot();
    const b1 = createBackup(s, opts);
    const b2 = createBackup({ ...s, backups: [b1] }, opts);
    expect(b2.id).not.toBe(b1.id);
  });
});

describe("backup integrity and restoration", () => {
  it("verifies a freshly created backup", () => {
    const b = createBackup(buildSeedSnapshot(), opts);
    expect(verifyBackupIntegrity(b)).toEqual({ ok: true, reason: "ok" });
  });

  it("detects a tampered payload", () => {
    const b = createBackup(buildSeedSnapshot(), opts);
    const tampered = { ...b, payload: b.payload.replace("Legacy", "Tampered") };
    expect(verifyBackupIntegrity(tampered).ok).toBe(false);
  });

  it("detects an unparseable payload", () => {
    const b = createBackup(buildSeedSnapshot(), opts);
    expect(verifyBackupIntegrity({ ...b, payload: "{" }).reason).toBe("invalid-payload");
  });

  it("restores the original content", () => {
    const s = buildSeedSnapshot();
    const restored = restoreFromBackup(createBackup(s, opts));
    expect(restored.publications.length).toBe(s.publications.length);
    expect(restored.concepts.length).toBe(s.concepts.length);
  });

  it("refuses to restore a corrupt backup", () => {
    const b = createBackup(buildSeedSnapshot(), opts);
    expect(() => restoreFromBackup({ ...b, hash: "deadbeef" })).toThrow(/integrity/i);
  });
});

describe("governed restore", () => {
  const s = buildSeedSnapshot();
  const target = createBackup(s, opts);

  it("requires the RESTORE confirmation phrase", () => {
    expect(() => performGovernedRestore(s, target, { reason: "valid reason text", actor: "vitest", confirmation: "yes" }))
      .toThrow(/RESTORE/);
  });

  it("requires a written reason", () => {
    expect(() => performGovernedRestore(s, target, { reason: "short", actor: "vitest", confirmation: "RESTORE" }))
      .toThrow(/reason/i);
  });

  it("creates a pre-restore safety backup and stamps restoredAt", () => {
    const out = performGovernedRestore(s, target, { reason: "drill restoration", actor: "vitest", confirmation: "RESTORE" });
    expect(out.preRestoreBackup.label).toContain("pre-restore/");
    expect(out.restored.backups.some(b => b.id === target.id && b.restoredAt)).toBe(true);
  });
});

describe("rollback target selection", () => {
  it("picks the newest backup before the cutoff", () => {
    const s = buildSeedSnapshot();
    const mk = (id: string, at: string) => ({ ...createBackup(s, opts), id, createdAt: at });
    const list = [mk("BKP-001", "2026-01-01T00:00:00Z"), mk("BKP-002", "2026-02-01T00:00:00Z"), mk("BKP-003", "2026-04-01T00:00:00Z")];
    expect(findRollbackTarget(list, "2026-03-01T00:00:00Z")!.id).toBe("BKP-002");
  });
  it("returns null when nothing precedes the cutoff", () => {
    expect(findRollbackTarget([], "2026-03-01T00:00:00Z")).toBeNull();
  });
});

describe("migration verification and DR plan", () => {
  it("passes for a current snapshot", () => {
    expect(verifyMigration(buildSeedSnapshot()).ok).toBe(true);
  });
  it("reports a schema-version mismatch", () => {
    const res = verifyMigration({ ...buildSeedSnapshot(), schemaVersion: 9 });
    expect(res.ok).toBe(false);
    expect(res.issues[0]).toContain("schemaVersion 9");
  });
  it("recommends a first backup when the ledger is empty", () => {
    const plan = buildDisasterRecoveryPlan({ ...buildSeedSnapshot(), backups: [] });
    expect(plan.backupCount).toBe(0);
    expect(plan.recommendedActions.join(" ")).toMatch(/first backup/i);
  });
});
