/**
 * Deterministic, dependency-free validation harness for the service layer.
 * Not a test-runner replacement — designed to be easy to port to Vitest later.
 *
 * Run via:  bun run src/lib/data/service.validate.ts
 * Any failing invariant throws; a successful run prints "OK <n> checks".
 */
import type { ChapterBlueprint, PublicationBlueprint, DataSnapshot, PublicationStage } from "./schema";
import {
  isChapterAncestor,
  wouldCreateChapterCycle,
  chapterDescendantIds,
  moveChapter,
  duplicatePublication,
  isAdjacentStageTransition,
  validatePublicationPromotion,
} from "./service";

let count = 0;
function check(name: string, cond: boolean) {
  count += 1;
  if (!cond) throw new Error(`FAIL: ${name}`);
}
function eq<T>(name: string, a: T, b: T) { check(`${name} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`, JSON.stringify(a) === JSON.stringify(b)); }

function ch(id: string, parent: string | null, order: number): ChapterBlueprint {
  return {
    id, order, title: id, description: "", learningObjectives: [],
    domainIds: [], conceptIds: [], frameworkIds: [], knowledgeObjectIds: [], clientToolIds: [],
    presentationLinks: [], reviewStatus: "Draft", editorialNotes: "",
    estimatedEffortHours: 1, chapterVersion: "0.1.0",
    parentChapterId: parent, presentations: [], manufacturingStage: "Draft",
  };
}

export function runValidations(): number {
  count = 0;

  // Fixture: A(root) -> B -> C ; D(root)
  const chapters: ChapterBlueprint[] = [
    ch("A", null, 10), ch("B", "A", 20), ch("C", "B", 30), ch("D", null, 40),
  ];

  // ---- Hierarchy helpers ----
  check("A is ancestor of C", isChapterAncestor(chapters, "A", "C"));
  check("A is not ancestor of D", !isChapterAncestor(chapters, "A", "D"));
  check("B is ancestor of C", isChapterAncestor(chapters, "B", "C"));
  check("descendants(A) = [B,C]", JSON.stringify(chapterDescendantIds(chapters, "A").sort()) === JSON.stringify(["B", "C"]));

  // ---- Cycle prevention ----
  check("cycle: A → C (would make A descendant of C)", wouldCreateChapterCycle(chapters, "A", "C"));
  check("cycle: B → B is self-cycle", wouldCreateChapterCycle(chapters, "B", "B"));
  check("no cycle: D → A", !wouldCreateChapterCycle(chapters, "D", "A"));
  check("no cycle: parent=null", !wouldCreateChapterCycle(chapters, "B", null));

  // ---- moveChapter: deterministic order, siblings re-indexed by 10 ----
  const moved = moveChapter(chapters, "D", "A", 0);
  const aKids = moved.filter(c => c.parentChapterId === "A").sort((x, y) => x.order - y.order).map(c => c.id);
  eq("moveChapter reparents D under A at index 0", aKids, ["D", "B"]);
  const orders = moved.filter(c => c.parentChapterId === "A").sort((x, y) => x.order - y.order).map(c => c.order);
  eq("moveChapter re-indexes siblings by 10", orders, [10, 20]);

  // moveChapter must refuse cycle
  const noop = moveChapter(chapters, "A", "C", 0);
  check("moveChapter refuses cycle (returns unchanged array)", noop === chapters);

  // ---- duplicatePublication: remaps parentChapterId, does NOT flatten ----
  const pub: PublicationBlueprint = {
    id: "PL-999", title: "T", description: "", audience: "", purpose: "",
    publicationType: "Guide", tags: [], owner: "x", frameworkId: null,
    effectiveDate: null, reviewDate: null, editorialNotes: "", reviewNotes: "",
    chapters, status: "Draft", version: "0.1.0", steward: "x",
    manufacturingStage: "Draft", stageHistory: [], archived: false, presentations: [],
    createdAt: "", updatedAt: "",
  };
  const snap: DataSnapshot = {
    schemaVersion: 2, domains: [], concepts: [], frameworks: [], knowledgeObjects: [],
    clientTools: [], publications: [pub], prompts: [], agents: [], releases: [],
    reviewItems: [], auditEvents: [],
  } as unknown as DataSnapshot;
  const dup = duplicatePublication(pub, "PL-1000", snap);
  check("duplicate has same chapter count", dup.chapters.length === chapters.length);
  check("duplicate chapter ids are all new", dup.chapters.every(c => !chapters.find(o => o.id === c.id)));
  const dupById = new Map(dup.chapters.map(c => [c.title, c] as const));
  // B's parent was A → in the clone, B's new parent must equal the clone of A.
  const cloneA = dupById.get("A")!;
  const cloneB = dupById.get("B")!;
  const cloneC = dupById.get("C")!;
  const cloneD = dupById.get("D")!;
  eq("clone B.parent = clone A.id", cloneB.parentChapterId, cloneA.id);
  eq("clone C.parent = clone B.id", cloneC.parentChapterId, cloneB.id);
  eq("clone D.parent = null (root preserved)", cloneD.parentChapterId, null);

  // ---- Stage adjacency ----
  const adj: Array<[PublicationStage, PublicationStage, boolean]> = [
    ["Draft", "Editorial", true],
    ["Editorial", "SME Review", true],
    ["SME Review", "QA", true],
    ["QA", "Canonical", true],
    ["Canonical", "Released", true],
    ["Draft", "QA", false],
    ["QA", "Draft", false],
    ["Released", "Canonical", false],
  ];
  for (const [f, t, want] of adj) eq(`adjacent ${f}→${t}`, isAdjacentStageTransition(f, t), want);

  // ---- validatePublicationPromotion: chapter-stage alignment ----
  const pubForPromotion: PublicationBlueprint = {
    ...pub,
    chapters: [ch("X", null, 10)],
    manufacturingStage: "Draft",
  };
  const snap2: DataSnapshot = { ...snap, publications: [pubForPromotion] } as DataSnapshot;
  const r1 = validatePublicationPromotion(pubForPromotion, "Editorial", snap2);
  check("Draft→Editorial produces a report", typeof r1 === "object" && r1 !== null);

  console.log(`OK ${count} checks`);
  return count;
}

// Run when invoked directly.
declare const process: { argv: string[] } | undefined;
if (typeof process !== "undefined" && process.argv[1]?.endsWith("service.validate.ts")) {
  runValidations();
}
