// Acquisition funnel map — internal, deterministic, testable.
//
// Maps, per audience/source class:
//   source → canonical page → guide/assessment → lead capture → lead score
//   → CRM situation → consultation → client → review / referral loop
//
// It maps and validates only. It moves no lead, sends no message, writes to
// no external system, and contains no PII. Every path must already exist in
// the governed route inventory: this map never implies a new page.

import { CTA_BY_RUNG, type CtaRung } from "./brand-system";
import { CRM_PIPELINES, pipelineForSituation } from "./crm-schema";
import { indexablePaths, NON_INDEXABLE_PUBLIC_PATHS } from "./indexation";
import type { LeadClassification } from "./lead-scoring";

export type AudienceClass =
  | "future-seller"
  | "future-buyer"
  | "probate-inherited-owner"
  | "downsizer"
  | "distressed-owner"
  | "investor"
  | "past-client"
  | "referral-professional";

export const REQUIRED_AUDIENCE_CLASSES: AudienceClass[] = [
  "future-seller",
  "future-buyer",
  "probate-inherited-owner",
  "downsizer",
  "distressed-owner",
  "investor",
  "past-client",
  "referral-professional",
];

export type FunnelStageKey =
  | "source"
  | "canonicalPage"
  | "guideOrAssessment"
  | "leadCapture"
  | "leadScore"
  | "crmSituation"
  | "consultation"
  | "client"
  | "reviewReferralLoop";

export const FUNNEL_STAGE_KEYS: FunnelStageKey[] = [
  "source",
  "canonicalPage",
  "guideOrAssessment",
  "leadCapture",
  "leadScore",
  "crmSituation",
  "consultation",
  "client",
  "reviewReferralLoop",
];

export interface AudienceFunnelPath {
  audience: AudienceClass;
  label: string;
  /** Where this audience arrives from. Descriptive, not a tracking claim. */
  source: string;
  /** Governed canonical page for the audience. */
  canonicalPage: string;
  /** Governed guide or assessment hub for the audience. */
  guideOrAssessment: string;
  /** Governed lead-capture destination. */
  leadCapture: string;
  /** How the internal model classifies the record. No external enrichment. */
  leadScore: string;
  /** CRM situation key routed through crm-schema. */
  crmSituation: string;
  /** Governed consultation destination. */
  consultation: string;
  /** What "client" means for this audience. CRM-owned. */
  client: string;
  /** Review / referral loop closure. Must exist for every audience. */
  reviewReferralLoop: string;
  /** Governed path the loop terminates at. */
  reviewReferralPath: string;
  ctaRung: CtaRung;
  ctaPath: string;
}

const CONTACT = "/contact";

export const AUDIENCE_FUNNELS: AudienceFunnelPath[] = [
  {
    audience: "future-seller",
    label: "Future seller",
    source: "Organic search on sale-process and cost questions; sphere and referral forwards.",
    canonicalPage: "/sellers",
    guideOrAssessment: "/assessments",
    leadCapture: "/guides",
    leadScore: "Internal scoring model classifies Hot / Qualified / Nurture / Long-term from declared situation and timeline.",
    crmSituation: "sellers",
    consultation: CONTACT,
    client: "Signed listing engagement. CRM-owned; never estimated in this application.",
    reviewReferralLoop: "After close: permission to ask recorded, consented review captured verbatim, referral introduction offered without incentive.",
    reviewReferralPath: "/refer",
    ctaRung: "evaluate",
    ctaPath: CTA_BY_RUNG.evaluate.to,
  },
  {
    audience: "future-buyer",
    label: "Future buyer",
    source: "Organic search on purchase-process questions; local guides.",
    canonicalPage: "/buyers",
    guideOrAssessment: "/assessments",
    leadCapture: "/guides",
    leadScore: "Internal scoring model; buyer timeline and financing readiness drive classification.",
    crmSituation: "buyers",
    consultation: CONTACT,
    client: "Signed buyer representation. CRM-owned.",
    reviewReferralLoop: "After close: consented review request, then referral introduction with no incentive offered.",
    reviewReferralPath: "/refer",
    ctaRung: "evaluate",
    ctaPath: CTA_BY_RUNG.evaluate.to,
  },
  {
    audience: "probate-inherited-owner",
    label: "Probate / inherited-property owner",
    source: "Organic search on probate and inherited-property procedure; attorney and fiduciary forwards.",
    canonicalPage: "/probate",
    guideOrAssessment: "/guides",
    leadCapture: "/guides",
    leadScore: "Internal scoring model; authority to act and estate stage drive classification, not urgency pressure.",
    crmSituation: "probate",
    consultation: CONTACT,
    client: "Engagement for an estate property. CRM-owned.",
    reviewReferralLoop: "After close: consented review, plus a written thank-you to the referring professional with no fee or reciprocity.",
    reviewReferralPath: "/attorney-partners",
    ctaRung: "learn",
    ctaPath: CTA_BY_RUNG.learn.to,
  },
  {
    audience: "downsizer",
    label: "Downsizer",
    source: "Organic search on downsizing sequencing and costs; sphere forwards.",
    canonicalPage: "/downsizing",
    guideOrAssessment: "/assessments",
    leadCapture: "/guides",
    leadScore: "Internal scoring model; sequencing constraints and timeline drive classification. No age or familial-status signals are used.",
    crmSituation: "downsizing",
    consultation: CONTACT,
    client: "Signed engagement covering the sale and the onward move sequence. CRM-owned.",
    reviewReferralLoop: "After close: consented review and an offer to answer questions for family members, without a referral ask attached.",
    reviewReferralPath: "/refer",
    ctaRung: "evaluate",
    ctaPath: CTA_BY_RUNG.evaluate.to,
  },
  {
    audience: "distressed-owner",
    label: "Distressed / pre-foreclosure owner",
    source: "Organic search on options and timelines under financial pressure.",
    canonicalPage: "/distressed-property",
    guideOrAssessment: "/guides",
    leadCapture: "/guides",
    leadScore: "Internal scoring model; available options and deadlines drive triage. No fear or urgency framing at any stage.",
    crmSituation: "distressed",
    consultation: CONTACT,
    client: "Engagement, or a documented handoff when representation is not the right answer. CRM-owned.",
    reviewReferralLoop: "After resolution: consented review only where the outcome was genuinely helpful; no review request during hardship.",
    reviewReferralPath: "/refer",
    ctaRung: "learn",
    ctaPath: CTA_BY_RUNG.learn.to,
  },
  {
    audience: "investor",
    label: "Investor",
    source: "Organic search on sell-vs-rent and equity trade-offs.",
    canonicalPage: "/investing",
    guideOrAssessment: "/assessments",
    leadCapture: "/guides",
    leadScore: "Internal scoring model; holdings and decision horizon drive classification. No return or yield projections anywhere.",
    crmSituation: "investing",
    consultation: CONTACT,
    client: "Signed engagement on a disposition or acquisition. CRM-owned.",
    reviewReferralLoop: "After close: consented review and introductions to other owners, with no incentive attached.",
    reviewReferralPath: "/refer",
    ctaRung: "evaluate",
    ctaPath: CTA_BY_RUNG.evaluate.to,
  },
  {
    audience: "past-client",
    label: "Past client",
    source: "Direct return, reactivation email, or forwarded reference page.",
    canonicalPage: "/resources",
    guideOrAssessment: "/guides",
    leadCapture: CONTACT,
    leadScore: "Existing record. Re-scored only on a new declared situation; never re-prospected as a cold lead.",
    crmSituation: "sellers",
    consultation: CONTACT,
    client: "Repeat engagement. CRM-owned.",
    reviewReferralLoop: "Standing loop: consented review if not already captured, and a low-frequency, opt-out-respecting referral path.",
    reviewReferralPath: "/refer",
    ctaRung: "learn",
    ctaPath: CTA_BY_RUNG.learn.to,
  },
  {
    audience: "referral-professional",
    label: "Referral professional",
    source: "Direct outreach, professional network, and forwarded reference pages.",
    canonicalPage: "/attorney-partners",
    guideOrAssessment: "/resources",
    leadCapture: "/refer",
    leadScore: "Relationship record, not a scored lead. Tracked as a referral relationship, never as a purchased or enriched contact.",
    crmSituation: "referral",
    consultation: CONTACT,
    client: "Documented referral relationship with no fee, incentive, or reciprocity.",
    reviewReferralLoop: "Each referred matter is reported back in writing; the relationship is the loop.",
    reviewReferralPath: "/attorney-partners",
    ctaRung: "refer",
    ctaPath: CTA_BY_RUNG.refer.to,
  },
];

/** Lead classification → the funnel stage the record should sit in. */
export const CLASSIFICATION_FUNNEL_STAGE: Record<LeadClassification, FunnelStageKey> = {
  Hot: "consultation",
  Qualified: "consultation",
  Nurture: "leadScore",
  "Long-term": "leadScore",
};

/** Every path this map is allowed to reference. */
export function governedPaths(): string[] {
  return [...indexablePaths(), ...NON_INDEXABLE_PUBLIC_PATHS];
}

export interface FunnelFinding {
  audience: AudienceClass;
  severity: "BLOCKER" | "REVIEW";
  stage: FunnelStageKey | "coverage";
  reason: string;
}

const PATH_STAGES: FunnelStageKey[] = ["canonicalPage", "guideOrAssessment", "leadCapture", "consultation"];

/**
 * Structural validation only: missing stages, invalid CTA or path, a broken
 * audience path, or a missing review/referral loop. No conversion-rate
 * judgement is made — that would require data that does not exist.
 */
export function validateFunnel(paths: AudienceFunnelPath[] = AUDIENCE_FUNNELS): FunnelFinding[] {
  const findings: FunnelFinding[] = [];
  const governed = new Set(governedPaths());
  const pipelineSituations = new Set(CRM_PIPELINES.flatMap(p => p.situations));

  for (const p of paths) {
    for (const key of FUNNEL_STAGE_KEYS) {
      const value = p[key];
      if (typeof value !== "string" || value.trim().length === 0) {
        findings.push({ audience: p.audience, severity: "BLOCKER", stage: key, reason: `Stage "${key}" is missing.` });
      }
    }
    for (const key of PATH_STAGES) {
      const value = p[key];
      if (typeof value === "string" && value.startsWith("/") && !governed.has(value)) {
        findings.push({
          audience: p.audience,
          severity: "BLOCKER",
          stage: key,
          reason: `Path ${value} is not in the governed route inventory.`,
        });
      }
    }
    if (!p.ctaPath || !governed.has(p.ctaPath)) {
      findings.push({ audience: p.audience, severity: "BLOCKER", stage: "canonicalPage", reason: `CTA path ${p.ctaPath || "(empty)"} is invalid.` });
    }
    if (!p.reviewReferralPath || !governed.has(p.reviewReferralPath) || !p.reviewReferralLoop.trim()) {
      findings.push({ audience: p.audience, severity: "BLOCKER", stage: "reviewReferralLoop", reason: "Review / referral loop is missing or points at an ungoverned path." });
    }
    if (!pipelineSituations.has(p.crmSituation)) {
      findings.push({ audience: p.audience, severity: "REVIEW", stage: "crmSituation", reason: `CRM situation "${p.crmSituation}" has no explicit pipeline; it would fall back to the default.` });
    }
  }

  const covered = new Set(paths.map(p => p.audience));
  for (const required of REQUIRED_AUDIENCE_CLASSES) {
    if (!covered.has(required)) {
      findings.push({ audience: required, severity: "BLOCKER", stage: "coverage", reason: `Audience class "${required}" has no funnel path.` });
    }
  }
  return findings;
}

export interface AcquisitionFunnelReport {
  generatedAt: string;
  audiences: number;
  stages: FunnelStageKey[];
  paths: (AudienceFunnelPath & { pipelineId: string; pipelineLabel: string })[];
  findings: FunnelFinding[];
  blockers: number;
  status: "READY" | "BLOCKED";
  detail: string;
}

export function buildAcquisitionFunnel(now: Date = new Date()): AcquisitionFunnelReport {
  const findings = validateFunnel();
  const blockers = findings.filter(f => f.severity === "BLOCKER").length;
  return {
    generatedAt: now.toISOString(),
    audiences: AUDIENCE_FUNNELS.length,
    stages: FUNNEL_STAGE_KEYS,
    paths: AUDIENCE_FUNNELS.map(p => {
      const pipeline = pipelineForSituation(p.crmSituation);
      return { ...p, pipelineId: pipeline.id, pipelineLabel: pipeline.label };
    }),
    findings,
    blockers,
    status: blockers === 0 ? "READY" : "BLOCKED",
    detail:
      blockers === 0
        ? `${AUDIENCE_FUNNELS.length} audience classes mapped across ${FUNNEL_STAGE_KEYS.length} stages, every path governed, every review/referral loop closed. No PII, no external write, nothing activated.`
        : `${blockers} structural blockers in the acquisition funnel map.`,
  };
}
