// Task 37 — the acquisition funnel map.
//
// One explicit path from stranger to client, wired to what already exists:
// governed public pages, the CTA ladder in brand-system.ts, the internal
// scoring model in lead-scoring.ts, and the CRM pipelines in crm-schema.ts.
//
// This module maps and validates. It moves no lead, sends no message, and
// writes to no external system. Every measurement reference points at an
// existing instrumented event or is explicitly marked unavailable.

import { CTA_BY_RUNG, type CtaRung } from "./brand-system";
import { CRM_PIPELINES } from "./crm-schema";
import type { LeadClassification } from "./lead-scoring";

export type FunnelStageId =
  | "awareness"
  | "consideration"
  | "evaluation"
  | "capture"
  | "qualification"
  | "conversation"
  | "client"
  | "advocacy";

export interface FunnelStage {
  id: FunnelStageId;
  label: string;
  /** What the visitor is actually trying to do at this stage. */
  visitorIntent: string;
  /** Governed public entry points. No new pages are implied by this map. */
  entryPaths: string[];
  ctaRung: CtaRung;
  ctaLabel: string;
  ctaPath: string;
  /** Instrumented metric id from growth-metrics.ts, or null when unmeasured. */
  metricId: string | null;
  /** How the stage is measured, or why it cannot be. */
  measurement: string;
  /** What must be true to advance. */
  advanceCriteria: string;
  /** Where the record lives once it exists. */
  owner: "public-site" | "app-events" | "crm" | "advisor";
}

export const FUNNEL_STAGES: FunnelStage[] = [
  {
    id: "awareness",
    label: "Awareness",
    visitorIntent: "Find a plain answer to one specific question.",
    entryPaths: ["/answers", "/local-guides", "/local"],
    ctaRung: "learn",
    ctaLabel: CTA_BY_RUNG.learn.label,
    ctaPath: CTA_BY_RUNG.learn.to,
    metricId: "sessions",
    measurement: "Instrumented sessions and page views. Search impressions require a Search Console connection that does not exist.",
    advanceCriteria: "Reads the answer and follows an internal link to a deeper explanation.",
    owner: "public-site",
  },
  {
    id: "consideration",
    label: "Consideration",
    visitorIntent: "Understand the whole decision, not just one answer.",
    entryPaths: ["/sellers", "/buyers", "/probate", "/inherited-property", "/downsizing", "/investing", "/distressed-property"],
    ctaRung: "learn",
    ctaLabel: CTA_BY_RUNG.learn.label,
    ctaPath: CTA_BY_RUNG.learn.to,
    metricId: "page_views",
    measurement: "Depth of instrumented content views across a situation cluster.",
    advanceCriteria: "Opens a guide or an assessment for their own situation.",
    owner: "public-site",
  },
  {
    id: "evaluation",
    label: "Evaluation",
    visitorIntent: "Work out what applies to my situation specifically.",
    entryPaths: ["/assessments", "/guides"],
    ctaRung: "evaluate",
    ctaLabel: CTA_BY_RUNG.evaluate.label,
    ctaPath: CTA_BY_RUNG.evaluate.to,
    metricId: "assessment_starts",
    measurement: "Assessment starts and completions from instrumented events. Answers stay in the browser unless submitted.",
    advanceCriteria: "Completes an assessment or requests a guide.",
    owner: "app-events",
  },
  {
    id: "capture",
    label: "Capture",
    visitorIntent: "Get the document or result, on my own terms.",
    entryPaths: ["/guides", "/assessments", "/contact"],
    ctaRung: "evaluate",
    ctaLabel: CTA_BY_RUNG.evaluate.label,
    ctaPath: CTA_BY_RUNG.evaluate.to,
    metricId: "captured_leads",
    measurement: "Lead payloads captured locally. CRM delivery is not verified, so CRM-side counts are unavailable.",
    advanceCriteria: "Submits contact details voluntarily with consent recorded.",
    owner: "app-events",
  },
  {
    id: "qualification",
    label: "Qualification",
    visitorIntent: "Not a visitor action — internal triage.",
    entryPaths: [],
    ctaRung: "talk",
    ctaLabel: CTA_BY_RUNG.talk.label,
    ctaPath: CTA_BY_RUNG.talk.to,
    metricId: "qualified_leads",
    measurement: "Internal scoring model classifies Hot / Qualified / Nurture / Long-term. No external enrichment.",
    advanceCriteria: "Scores Qualified or Hot, or explicitly asks to talk regardless of score.",
    owner: "app-events",
  },
  {
    id: "conversation",
    label: "Conversation",
    visitorIntent: "Talk it through with someone who already showed their reasoning.",
    entryPaths: ["/contact"],
    ctaRung: "talk",
    ctaLabel: CTA_BY_RUNG.talk.label,
    ctaPath: CTA_BY_RUNG.talk.to,
    metricId: "consultation_requests",
    measurement: "Consultation requests are instrumented. Appointments held and show rate are CRM-owned and unavailable.",
    advanceCriteria: "Consultation held and next step agreed.",
    owner: "crm",
  },
  {
    id: "client",
    label: "Client",
    visitorIntent: "Execute the decision with representation.",
    entryPaths: [],
    ctaRung: "talk",
    ctaLabel: CTA_BY_RUNG.talk.label,
    ctaPath: CTA_BY_RUNG.talk.to,
    metricId: "signed_clients",
    measurement: "CRM-owned. Signed engagements, closings, and revenue are never estimated in this application.",
    advanceCriteria: "Engagement signed and recorded in the CRM pipeline for the situation.",
    owner: "crm",
  },
  {
    id: "advocacy",
    label: "Advocacy",
    visitorIntent: "Refer someone, or say publicly what the experience was.",
    entryPaths: ["/refer", "/attorney-partners", "/resources"],
    ctaRung: "refer",
    ctaLabel: CTA_BY_RUNG.refer.label,
    ctaPath: CTA_BY_RUNG.refer.to,
    metricId: "proof_coverage",
    measurement: "Verified, consented proof records only. Nothing is displayed until a real record exists.",
    advanceCriteria: "Engagement closed, permission to ask recorded, review captured verbatim with consent.",
    owner: "advisor",
  },
];

/** Lead classification → the stage the record should sit in. */
export const CLASSIFICATION_STAGE: Record<LeadClassification, FunnelStageId> = {
  Hot: "conversation",
  Qualified: "conversation",
  Nurture: "qualification",
  "Long-term": "qualification",
};

export interface FunnelLeak {
  stageId: FunnelStageId;
  severity: "BLOCKER" | "REVIEW";
  reason: string;
}

/**
 * Structural checks only. A "leak" here means the map itself is broken —
 * a stage with no way forward, no CTA, or an unmeasurable claim — not a
 * conversion-rate judgement, which would require data that does not exist.
 */
export function funnelLeaks(stages: FunnelStage[] = FUNNEL_STAGES): FunnelLeak[] {
  const leaks: FunnelLeak[] = [];
  for (const [i, stage] of stages.entries()) {
    const isLast = i === stages.length - 1;
    if (!stage.ctaPath) {
      leaks.push({ stageId: stage.id, severity: "BLOCKER", reason: "Stage has no forward CTA." });
    }
    if (!stage.advanceCriteria.trim() && !isLast) {
      leaks.push({ stageId: stage.id, severity: "BLOCKER", reason: "Stage has no defined advance criteria." });
    }
    if (stage.owner === "public-site" && stage.entryPaths.length === 0) {
      leaks.push({ stageId: stage.id, severity: "BLOCKER", reason: "Public stage has no governed entry path." });
    }
    if (!stage.metricId) {
      leaks.push({ stageId: stage.id, severity: "REVIEW", reason: "Stage has no metric mapped; progress cannot be observed." });
    }
  }
  return leaks;
}

export interface FunnelMapReport {
  generatedAt: string;
  stages: FunnelStage[];
  stageCount: number;
  measuredStages: number;
  crmOwnedStages: number;
  pipelines: { id: string; label: string; stages: string[] }[];
  leaks: FunnelLeak[];
  status: "MAPPED" | "BLOCKED";
  detail: string;
}

export function buildFunnelMap(now: Date = new Date()): FunnelMapReport {
  const leaks = funnelLeaks();
  const blockers = leaks.filter(l => l.severity === "BLOCKER").length;
  return {
    generatedAt: now.toISOString(),
    stages: FUNNEL_STAGES,
    stageCount: FUNNEL_STAGES.length,
    measuredStages: FUNNEL_STAGES.filter(s => s.owner === "app-events" || s.owner === "public-site").length,
    crmOwnedStages: FUNNEL_STAGES.filter(s => s.owner === "crm").length,
    pipelines: CRM_PIPELINES.map(p => ({ id: p.id, label: p.label, stages: p.stages })),
    leaks,
    status: blockers > 0 ? "BLOCKED" : "MAPPED",
    detail:
      blockers > 0
        ? `${blockers} funnel stages have no forward path.`
        : "Every stage has a governed entry point, a single forward CTA, and an explicit measurement source or a stated reason it is unavailable. No lead is moved by this map.",
  };
}
