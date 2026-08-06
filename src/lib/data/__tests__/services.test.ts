// Task 13 — unit tests: pure data services.
import { describe, it, expect } from "vitest";
import { buildSeedSnapshot } from "@/lib/data/seed";
import { detectBrokenReferences, evaluateReleaseGate, exportSnapshot, parseImport } from "@/lib/data/service";
import { deriveNextActions, overdueConceptCount } from "@/lib/data/next-actions";
import { buildExportManifest } from "@/lib/data/integrations";
import type { DataSnapshot } from "@/lib/data/schema";

const seed = () => buildSeedSnapshot();

describe("service: broken-reference detection", () => {
  it("reports zero broken references on the canonical catalog", () => {
    expect(detectBrokenReferences(seed())).toEqual([]);
  });

  it("detects a dangling concept reference on a framework", () => {
    const s = seed();
    s.frameworks[0].governingConceptIds = [...s.frameworks[0].governingConceptIds, "C-DOES-NOT-EXIST"];
    const broken = detectBrokenReferences(s);
    expect(broken.length).toBeGreaterThan(0);
    expect(broken.some(b => b.targetId === "C-DOES-NOT-EXIST")).toBe(true);
  });

  it("is stable — repeated calls return the same result", () => {
    const s = seed();
    expect(detectBrokenReferences(s)).toEqual(detectBrokenReferences(s));
  });
});

describe("service: release gate", () => {
  it("counts passed gate checks", () => {
    const s = seed();
    const r = s.releases[0];
    if (!r) return;
    const gate = evaluateReleaseGate(r);
    expect(gate.total).toBe(r.gateChecklist.length);
    expect(gate.passed).toBe(r.gateChecklist.filter(g => g.passed).length);
  });
});

describe("service: export / import round trip", () => {
  it("re-imports its own export without loss", () => {
    const s = seed();
    const json = exportSnapshot(s);
    const parsed = parseImport(json);
    expect(parsed.errors).toEqual([]);
    expect(parsed.snapshot?.publications.length).toBe(s.publications.length);
  });

  it("rejects malformed payloads", () => {
    const bad = parseImport("{not json");
    expect(bad.snapshot).toBeNull();
    expect(bad.errors.length).toBeGreaterThan(0);
  });
});

describe("integrations: manifest derivation", () => {
  it("derives a manifest containing the requested entity", () => {
    const s = seed();
    const pub = s.publications[0];
    const built = buildExportManifest(s, {
      kind: "publication", entityId: pub.id, requestedBy: "vitest",
    });
    expect(built.manifest[0].ids).toContain(pub.id);
    expect(built.manifest[0].entityType).toBe("publications");
    expect(built.title).toBe(pub.title);
    expect(typeof built.readinessScore).toBe("number");
  });
});

describe("next actions derivation", () => {
  it("flags concepts past review cadence", () => {
    const s = seed();
    s.concepts.forEach(c => { c.lastReviewedAt = new Date("2000-01-01").toISOString(); c.reviewCadenceMonths = 6; });
    expect(overdueConceptCount(s)).toBe(s.concepts.length);
  });

  it("treats a never-reviewed concept as overdue", () => {
    const s = seed();
    s.concepts.forEach(c => { c.lastReviewedAt = null; });
    expect(overdueConceptCount(s)).toBe(s.concepts.length);
  });

  it("returns hasActions=false for a fully clear snapshot", () => {
    const s: DataSnapshot = {
      ...seed(),
      concepts: [], knowledgeObjects: [], publications: [], releases: [], frameworks: [],
      clientTools: [], clientToolkits: [], aiPacks: [], agents: [], prompts: [],
    };
    const na = deriveNextActions(s);
    expect(na.hasActions).toBe(false);
    expect(na.draftChapters).toEqual([]);
  });

  it("surfaces draft chapters, RC releases and empty frameworks", () => {
    const s = seed();
    const pub = s.publications.find(p => p.chapters.length > 0)!;
    pub.chapters[0].reviewStatus = "Draft";
    const na = deriveNextActions(s);
    expect(na.draftChapters.some(d => d.pubId === pub.id && d.chapterId === pub.chapters[0].id)).toBe(true);
    expect(na.hasActions).toBe(true);
    expect(na.releaseCandidates).toEqual(s.releases.filter(r => r.stage === "Release Candidate").map(r => r.id));
    expect(na.emptyFrameworks).toEqual(s.frameworks.filter(f => f.governingConceptIds.length === 0).map(f => f.id));
  });
});
