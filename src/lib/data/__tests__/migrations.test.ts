// Task 13 — unit tests: v9 → v10 migration engine.
import { describe, it, expect } from "vitest";
import { buildSeedSnapshot } from "@/lib/data/seed";
import { SCHEMA_VERSION } from "@/lib/data/schema";
import { seedGuidePublications } from "@/lib/data/seed.guides";
import { upgradeToV10, verifyIntegrity, isStaleSnapshot, USER_MIGRATION_MESSAGES } from "@/lib/data/migrations";

function v9(): ReturnType<typeof buildSeedSnapshot> {
  const s = buildSeedSnapshot();
  return { ...s, schemaVersion: 9 };
}

describe("stale-snapshot detection", () => {
  it("flags a v9 snapshot as stale", () => {
    expect(isStaleSnapshot({ schemaVersion: 9 })).toBe(true);
  });
  it("does not flag a current snapshot", () => {
    expect(isStaleSnapshot({ schemaVersion: SCHEMA_VERSION })).toBe(false);
  });
});

describe("upgradeToV10", () => {
  it("stamps the current schema version", () => {
    expect(upgradeToV10(v9()).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("adds every canonical guide missing from the snapshot", () => {
    const s = v9();
    s.publications = s.publications.filter(p => !seedGuidePublications.some(g => g.id === p.id));
    const out = upgradeToV10(s);
    for (const g of seedGuidePublications) {
      expect(out.publications.some(p => p.id === g.id)).toBe(true);
    }
  });

  it("retains custom, non-seed publications (custom-record retention)", () => {
    const s = v9();
    const custom = { ...s.publications[0], id: "PL-CUSTOM-001", title: "Operator Custom Guide" };
    s.publications = [...s.publications, custom];
    const out = upgradeToV10(s);
    const kept = out.publications.find(p => p.id === "PL-CUSTOM-001");
    expect(kept?.title).toBe("Operator Custom Guide");
  });

  it("replaces stub seed rows with the canonical seed content", () => {
    const s = v9();
    const target = seedGuidePublications[0];
    s.publications = s.publications.map(p =>
      p.id === target.id ? { ...p, title: "Untitled Publication", chapters: [] } : p);
    const out = upgradeToV10(s);
    const fixed = out.publications.find(p => p.id === target.id)!;
    expect(fixed.title).toBe(target.title);
    expect(fixed.chapters.length).toBe(target.chapters.length);
  });

  it("does not overwrite an edited seed publication", () => {
    const s = v9();
    const target = seedGuidePublications[0];
    s.publications = s.publications.map(p =>
      p.id === target.id ? { ...p, title: "Owner Edited Title" } : p);
    const out = upgradeToV10(s);
    expect(out.publications.find(p => p.id === target.id)!.title).toBe("Owner Edited Title");
  });

  it("is idempotent", () => {
    const once = upgradeToV10(v9());
    const twice = upgradeToV10(once);
    expect(twice.publications.length).toBe(once.publications.length);
  });
});

describe("verifyIntegrity", () => {
  it("passes for a clean v9 → v10 upgrade", () => {
    const before = v9();
    const after = upgradeToV10(before);
    const res = verifyIntegrity(before, after, 0);
    expect(res.ok).toBe(true);
    expect(res.checks.every(c => c.ok)).toBe(true);
  });

  it("fails when a publication is dropped", () => {
    const before = v9();
    const after = { ...upgradeToV10(before), publications: [] as typeof before.publications };
    const res = verifyIntegrity(before, after, 0);
    expect(res.ok).toBe(false);
    expect(res.checks.find(c => c.name === "No publication dropped")!.ok).toBe(false);
  });

  it("fails when broken references remain", () => {
    const before = v9();
    const after = upgradeToV10(before);
    const res = verifyIntegrity(before, after, 3);
    expect(res.ok).toBe(false);
    expect(res.checks.find(c => c.name === "Broken references at zero")!.detail).toBe("3 found");
  });

  it("fails when the schema version is not stamped", () => {
    const before = v9();
    const after = { ...upgradeToV10(before), schemaVersion: 9 };
    const res = verifyIntegrity(before, after, 0);
    expect(res.checks.find(c => c.name === "Schema version stamped")!.ok).toBe(false);
  });
});

describe("user-facing migration messages", () => {
  it("is silent for current and fresh outcomes", () => {
    expect(USER_MIGRATION_MESSAGES.current).toBe("");
    expect(USER_MIGRATION_MESSAGES.fresh).toBe("");
  });
  it("explains migrated, reseeded and failed outcomes", () => {
    for (const k of ["migrated", "reseeded", "failed"] as const) {
      expect(USER_MIGRATION_MESSAGES[k].length).toBeGreaterThan(40);
    }
  });
});
