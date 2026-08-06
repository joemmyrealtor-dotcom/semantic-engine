// Dashboard "Next Actions" derivation (Task 13).
//
// Extracted from the dashboard route so the derivation is pure, testable,
// and shared. Purely presentation-feeding: no persistence, no side effects.

import type { DataSnapshot } from "./schema";
import { detectBrokenReferences } from "./service";

export interface NextActions {
  overdueConcepts: number;
  brokenReferences: number;
  draftKnowledgeObjects: number;
  draftChapters: { pubId: string; chapterId: string }[];
  releaseCandidates: string[];
  emptyFrameworks: string[];
  hasActions: boolean;
}

const MONTH_MS = 30 * 24 * 3600 * 1000;

export function overdueConceptCount(s: DataSnapshot, now: number = Date.now()): number {
  return s.concepts.filter(c => {
    if (!c.lastReviewedAt) return true;
    return now - new Date(c.lastReviewedAt).getTime() > c.reviewCadenceMonths * MONTH_MS;
  }).length;
}

export function deriveNextActions(s: DataSnapshot, now: number = Date.now()): NextActions {
  const overdueConcepts = overdueConceptCount(s, now);
  const brokenReferences = detectBrokenReferences(s).length;
  const draftKnowledgeObjects = s.knowledgeObjects.filter(k => k.status === "Draft").length;
  const draftChapters = s.publications.flatMap(p =>
    p.chapters.filter(c => c.reviewStatus === "Draft").map(c => ({ pubId: p.id, chapterId: c.id })),
  );
  const releaseCandidates = s.releases.filter(r => r.stage === "Release Candidate").map(r => r.id);
  const emptyFrameworks = s.frameworks.filter(f => f.governingConceptIds.length === 0).map(f => f.id);
  const hasActions =
    overdueConcepts > 0 || brokenReferences > 0 || draftKnowledgeObjects > 0 ||
    draftChapters.length > 0 || releaseCandidates.length > 0 || emptyFrameworks.length > 0;
  return {
    overdueConcepts, brokenReferences, draftKnowledgeObjects,
    draftChapters, releaseCandidates, emptyFrameworks, hasActions,
  };
}
