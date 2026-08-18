import { describe, expect, it } from "vitest";
import { LICENSE } from "../positioning";
import { buildBrandReadiness, CTA_LADDER, MESSAGE_PILLARS, validateBrandCopy } from "../brand-system";
import {
  MAX_REQUESTS_PER_ENGAGEMENT,
  buildProofOperationsReport,
  caseStudyIntakeComplete,
  requestEligibility,
  requestTemplates,
  CASE_STUDY_INTAKE_CHECKLIST,
} from "../proof-operations";
import { buildAcquisitionCadence, SPHERE_MIN_GAP_DAYS, WEEKLY_QUOTA } from "../acquisition-cadence";
import { buildGrowthMeasurement, GROWTH_METRICS } from "../growth-metrics";
import { NINETY_DAY_TARGETS, RECALIBRATION_RULE, RECALIBRATION_WINDOW_DAYS, TARGET_LABEL, compareTargets } from "../growth-targets";
import {
  CAMPAIGN_ASSETS,
  REQUIRED_SEGMENTS,
  REQUIRED_TRACKS,
  buildCampaignReadiness,
  campaignViolations,
} from "../acquisition-campaigns";
import { PAID_BLUEPRINTS, PAID_PREREQUISITES, SEARCH_CLUSTERS, buildPaidReadiness } from "../paid-readiness";
import {
  AUDIENCE_FUNNELS,
  FUNNEL_STAGE_KEYS,
  REQUIRED_AUDIENCE_CLASSES,
  buildAcquisitionFunnel,
  governedPaths,
  validateFunnel,
} from "../acquisition-funnel";
import { indexablePaths } from "../indexation";
import { CLASSIFICATION_STAGE, FUNNEL_STAGES, buildFunnelMap, funnelLeaks } from "../funnel-map";

describe("brand operating system", () => {
  it("defines pillars and a full CTA ladder", () => {
    expect(MESSAGE_PILLARS.length).toBeGreaterThanOrEqual(4);
    expect(CTA_LADDER.map(c => c.rung)).toEqual(["learn", "evaluate", "talk", "refer"]);
  });

  it("passes readiness on governed copy", () => {
    expect(buildBrandReadiness().findings.filter(f => f.severity === "BLOCKER")).toHaveLength(0);
  });

  it("flags fabricated proof claims", () => {
    const findings = validateBrandCopy({
      id: "test",
      
      text: "The #1 agent with hundreds of 5-star reviews — act now, guaranteed results!",
    });
    expect(findings.length).toBeGreaterThan(0);
  });
});

describe("proof operations", () => {
  const closed = {
    id: "e1",
    category: "seller" as const,
    closedAt: "2026-01-01",
    permissionToAsk: true,
    requestsSent: [],
    reviewCaptured: false,
  };

  it("blocks requests before close and without permission", () => {
    expect(requestEligibility({ ...closed, closedAt: null }).state).toBe("INELIGIBLE");
    expect(requestEligibility({ ...closed, permissionToAsk: false }).state).toBe("INELIGIBLE");
  });

  it("allows one initial request and one reminder only", () => {
    expect(requestEligibility(closed).state).toBe("ELIGIBLE_INITIAL");
    const afterFirst = { ...closed, requestsSent: ["2026-01-02T00:00:00.000Z"] };
    expect(requestEligibility(afterFirst, new Date("2026-01-04T00:00:00.000Z")).state).toBe("WAIT");
    expect(requestEligibility(afterFirst, new Date("2026-01-20T00:00:00.000Z")).state).toBe("ELIGIBLE_REMINDER");
    const capped = { ...closed, requestsSent: ["2026-01-02T00:00:00.000Z", "2026-01-09T00:00:00.000Z"] };
    expect(capped.requestsSent.length).toBe(MAX_REQUESTS_PER_ENGAGEMENT);
    expect(requestEligibility(capped, new Date("2026-03-01T00:00:00.000Z")).state).toBe("COMPLETE");
  });

  it("templates are drafts with no fabricated content", () => {
    const templates = requestTemplates();
    expect(templates.length).toBeGreaterThan(0);
    for (const t of templates) {
      expect(t.status).toBe("DRAFT");
      expect(t.activated).toBe(false);
      expect(t.body).not.toMatch(/\b5[- ]star\b/i);
    }
  });

  it("requires the full intake checklist for case studies", () => {
    expect(caseStudyIntakeComplete([])).toBe(false);
    expect(caseStudyIntakeComplete(CASE_STUDY_INTAKE_CHECKLIST.map(i => i.id))).toBe(true);
  });

  it("renders nothing while the ledger is empty", () => {
    const report = buildProofOperationsReport();
    expect(report.status).toBe("AWAITING_SOURCE_DATA");
    expect(report.publishable).toBe(0);
    expect(report.renderableAssets).toBe(0);
    expect(report.categories.every(c => c.renderable === false)).toBe(true);
  });
});

describe("acquisition cadence", () => {
  const plan = buildAcquisitionCadence("2026-09-07");

  it("is deterministic", () => {
    expect(buildAcquisitionCadence("2026-09-07").items).toEqual(plan.items);
  });

  it("meets the weekly quota and has no violations", () => {
    expect(plan.violations).toEqual([]);
    const week1 = plan.weeklyCounts[1]!;
    for (const [kind, quota] of Object.entries(WEEKLY_QUOTA)) {
      expect(week1[kind as keyof typeof WEEKLY_QUOTA] ?? 0).toBeGreaterThanOrEqual(quota);
    }
  });

  it("caps sphere touches at one per two weeks", () => {
    const dates = plan.sphereTouches.map(t => Date.parse(t.date)).sort((a, b) => a - b);
    for (let i = 1; i < dates.length; i += 1) {
      expect((dates[i]! - dates[i - 1]!) / 86_400_000).toBeGreaterThanOrEqual(SPHERE_MIN_GAP_DAYS);
    }
  });

  it("keeps every item in draft", () => {
    expect(plan.items.every(i => i.status === "Draft")).toBe(true);
  });
});

describe("growth measurement", () => {
  it("never reports unavailable sources as zero", () => {
    const report = buildGrowthMeasurement();
    expect(report.readings).toHaveLength(GROWTH_METRICS.length);
    for (const r of report.readings) {
      if (r.status !== "MEASURED") expect(r.value).toBeUndefined();
    }
    expect(report.readings.find(r => r.id === "revenue")!.status).toBe("NOT_CONNECTED");
  });

  it("reports measured app-event metrics when events exist", () => {
    const report = buildGrowthMeasurement({ capturedLeads: 3, cadenceItemsPerWeek: 10, proofCategoriesCovered: 0 });
    const cadence = report.readings.find(r => r.id === "content_cadence")!;
    expect(cadence.status).toBe("MEASURED");
    expect(cadence.value).toBe(10);
  });

  it("keeps targets separate from actuals", () => {
    const report = buildGrowthMeasurement();
    const comparisons = compareTargets(report.readings, NINETY_DAY_TARGETS);
    expect(comparisons.every(c => c.status === "TARGET_ONLY" || typeof c.actual === "number")).toBe(true);
    expect(NINETY_DAY_TARGETS.every(t => t.status === "TARGET")).toBe(true);
  });
});

describe("campaign drafts", () => {
  it("has no copy or opt-out violations", () => {
    expect(campaignViolations()).toEqual([]);
    expect(buildCampaignReadiness().status).toBe("DRAFT_READY");
  });

  it("keeps every asset unactivated", () => {
    expect(CAMPAIGN_ASSETS.every(a => a.status === "DRAFT" && a.activated === false)).toBe(true);
    expect(buildCampaignReadiness().activated).toBe(0);
  });

  it("covers pre-launch, launch, education, reactivation, partner, and post-launch phases", () => {
    const { byPhase } = buildCampaignReadiness();
    expect(byPhase["pre-launch"]).toBeGreaterThan(0);
    expect(byPhase.launch).toBeGreaterThan(0);
    expect(byPhase.education).toBeGreaterThan(0);
    expect(byPhase.reactivation).toBeGreaterThan(0);
    expect(byPhase["referral-partner"]).toBeGreaterThan(0);
    expect(byPhase["post-launch"]).toBeGreaterThan(0);
  });

  it("covers every required Task 37 track", () => {
    const report = buildCampaignReadiness();
    expect(report.missingTracks).toEqual([]);
    for (const track of REQUIRED_TRACKS) expect(report.byTrack[track]).toBeGreaterThan(0);
  });

  it("covers every required audience segment", () => {
    const report = buildCampaignReadiness();
    expect(report.missingSegments).toEqual([]);
    for (const segment of REQUIRED_SEGMENTS) expect(report.bySegment[segment]).toBeGreaterThan(0);
  });

  it("carries a deterministic testable timeline with a 14-day pre-launch run-up and launch day", () => {
    const report = buildCampaignReadiness(new Date("2026-01-01T00:00:00.000Z"));
    const again = buildCampaignReadiness(new Date("2026-06-01T00:00:00.000Z"));
    expect(report.timeline).toEqual(again.timeline);
    const offsets = report.timeline.map(t => t.dayOffset);
    expect(Math.min(...offsets)).toBe(-14);
    expect(offsets).toContain(0);
    expect(Math.max(...offsets)).toBeGreaterThanOrEqual(30);
    expect(report.timeline.every(t => Number.isInteger(t.dayOffset))).toBe(true);
  });
});

describe("paid readiness", () => {
  it("stays blocked with unmet prerequisites", () => {
    const report = buildPaidReadiness();
    expect(report.activation).toBe("BLOCKED");
    expect(report.unmet).toBe(PAID_PREREQUISITES.length);
    expect(PAID_BLUEPRINTS.every(b => b.status === "BLOCKED" && b.activated === false)).toBe(true);
  });
});

describe("acquisition funnel map", () => {
  it("maps every stage with a forward CTA and no structural blockers", () => {
    const map = buildFunnelMap();
    expect(map.status).toBe("MAPPED");
    expect(map.leaks.filter(l => l.severity === "BLOCKER")).toEqual([]);
    expect(map.stages.every(s => s.ctaPath.length > 0 && s.advanceCriteria.length > 0)).toBe(true);
  });

  it("runs stranger → client → advocacy in order", () => {
    expect(FUNNEL_STAGES.map(s => s.id)).toEqual([
      "awareness",
      "consideration",
      "evaluation",
      "capture",
      "qualification",
      "conversation",
      "client",
      "advocacy",
    ]);
  });

  it("routes every lead classification to a real stage", () => {
    const ids = new Set(FUNNEL_STAGES.map(s => s.id));
    for (const stage of Object.values(CLASSIFICATION_STAGE)) expect(ids.has(stage)).toBe(true);
  });

  it("leaves sales-stage measurement to the CRM rather than estimating it", () => {
    const client = FUNNEL_STAGES.find(s => s.id === "client")!;
    expect(client.owner).toBe("crm");
    expect(client.measurement).toMatch(/never estimated/i);
  });

  it("detects a broken stage", () => {
    const broken = FUNNEL_STAGES.map(s => (s.id === "awareness" ? { ...s, entryPaths: [], ctaPath: "" } : s));
    expect(funnelLeaks(broken).some(l => l.severity === "BLOCKER")).toBe(true);
  });
});


describe("Task 36 canonical targets", () => {
  it("matches the authorized target set exactly", () => {
    const byId = Object.fromEntries(NINETY_DAY_TARGETS.map(t => [t.metricId, t]));
    expect(byId["qualified_visitors"]!.target).toBe(1500);
    expect(byId["guide_downloads"]!.target).toBe(150);
    expect(byId["assessment_completions"]!.target).toBe(75);
    expect(byId["qualified_leads"]!.target).toBe(40);
    expect(byId["consultation_requests"]!.target).toBe(20);
    expect(byId["signed_clients"]!.target).toBe(10);
    expect(byId["referral_relationships"]!.target).toBe(10);
    expect(NINETY_DAY_TARGETS).toHaveLength(8);
  });

  it("keeps closed/pending as an explicit 3–5 range", () => {
    const closed = NINETY_DAY_TARGETS.find(t => t.metricId === "closed_or_pending")!;
    expect(closed.isRange).toBe(true);
    expect(closed.target).toBe(3);
    expect(closed.targetMax).toBe(5);
    expect(closed.display).toBe("3–5");
  });

  it("labels every target TARGET and carries the 30-day recalibration rule", () => {
    expect(NINETY_DAY_TARGETS.every(t => t.status === "TARGET")).toBe(true);
    expect(TARGET_LABEL).toMatch(/TARGET/);
    expect(RECALIBRATION_WINDOW_DAYS).toBe(30);
    expect(RECALIBRATION_RULE).toMatch(/30 days/);
    expect(RECALIBRATION_RULE).toMatch(/operational benchmark/i);
    for (const c of compareTargets([], NINETY_DAY_TARGETS)) {
      expect(c.label_kind).toBe(TARGET_LABEL);
      expect(c.recalibration).toBe(RECALIBRATION_RULE);
    }
  });

  it("never compares the qualified-visitor target to raw sessions", () => {
    const qualified = NINETY_DAY_TARGETS.find(t => t.metricId === "qualified_visitors")!;
    expect(qualified.measurable).toBe(true);
    expect(NINETY_DAY_TARGETS.some(t => t.metricId === "sessions")).toBe(false);
    // A measured session count must never satisfy the qualified-visitor target.
    const comparisons = compareTargets(
      [{ id: "sessions", status: "MEASURED", value: 9999 }],
      NINETY_DAY_TARGETS,
    );
    const qc = comparisons.find(c => c.metricId === "qualified_visitors")!;
    expect(qc.status).toBe("TARGET_ONLY");
    expect(qc.actual).toBeUndefined();
  });

  it("registers qualified_visitors as a distinct, internally instrumented metric", () => {
    const spec = GROWTH_METRICS.find(m => m.id === "qualified_visitors")!;
    expect(spec.system).toBe("app-events");
    expect(spec.definition).toMatch(/never substituted/i);
    // With no events recorded there is no measured value — never a fake zero.
    const reading = buildGrowthMeasurement().readings.find(r => r.id === "qualified_visitors")!;
    expect(reading.status).not.toBe("MEASURED");
    expect(reading.value).toBeUndefined();
    expect(GROWTH_METRICS.some(m => m.id === "referral_relationships")).toBe(true);
    expect(GROWTH_METRICS.some(m => m.id === "closed_or_pending")).toBe(true);
  });
});

describe("Task 33 paid measurement readiness", () => {
  it("covers the five high-intent Google clusters with full blueprint fields", () => {
    expect(SEARCH_CLUSTERS.map(c => c.id).sort()).toEqual(
      ["distressed-preforeclosure", "downsizing", "equity-sell-vs-rent", "probate-inherited", "seller-intent"],
    );
    const governed = new Set(governedPaths());
    for (const c of SEARCH_CLUSTERS) {
      expect(c.objective.length).toBeGreaterThan(0);
      expect(c.destinations.length).toBeGreaterThan(0);
      for (const d of c.destinations) expect(governed.has(d)).toBe(true);
      expect(c.primaryConversionAction.length).toBeGreaterThan(0);
      expect(c.negativeConcepts.length).toBeGreaterThan(0);
      expect(c.budgetGuardrail).toMatch(/No budget is authorized/);
      expect(c.stopConditions.length).toBeGreaterThan(0);
      expect(c.measurementPrerequisites.length).toBeGreaterThan(0);
      expect(c.status).toBe("BLOCKED");
      expect(c.activated).toBe(false);
    }
  });

  it("designs Google enhanced conversions around Data Manager / API-compatible first-party measurement", () => {
    const google = PAID_BLUEPRINTS.find(b => b.platform === "google-search")!;
    expect(google.measurement).toMatch(/Data Manager/);
    expect(google.measurement).toMatch(/first-party/i);
    expect(google.measurement).toMatch(/not a deprecated legacy-only offline click-ID import/i);
    expect(google.measurement).toMatch(/Nothing is connected/i);
  });

  it("keeps Meta on future Conversions API + CRM quality signals, disconnected", () => {
    const meta = PAID_BLUEPRINTS.find(b => b.platform === "meta")!;
    expect(meta.measurement).toMatch(/Conversions API/);
    expect(meta.measurement).toMatch(/CRM lead-quality signals/i);
    expect(meta.measurement).toMatch(/is connected or sent today/i);
    expect(meta.activated).toBe(false);
  });

  it("uses platform-specific housing compliance wording", () => {
    const google = PAID_BLUEPRINTS.find(b => b.platform === "google-search")!;
    const meta = PAID_BLUEPRINTS.find(b => b.platform === "meta")!;
    expect(google.housingCompliance).toMatch(/personalized-advertising restrictions for housing/i);
    expect(google.housingCompliance).toMatch(/does not use Meta's 'Special Ad Category' label/i);
    expect(meta.housingCompliance).toMatch(/Housing Special Ad Category/);
    for (const b of PAID_BLUEPRINTS) {
      if (b.platform.startsWith("google") || b.platform === "local-services") {
        expect(b.housingCompliance).not.toMatch(/Special Ad Category is mandatory/);
      }
    }
  });

  it("keeps the hard activation gate blocked on every required item", () => {
    const report = buildPaidReadiness();
    expect(report.activation).toBe("BLOCKED");
    expect(report.unmet).toBe(PAID_PREREQUISITES.length);
    const ids = PAID_PREREQUISITES.map(p => p.id).sort();
    expect(ids).toEqual(["analytics", "budget", "compliance", "crm", "domain", "measurement", "publication"]);
  });
});

describe("acquisition funnel (source → client → referral loop)", () => {
  const report = buildAcquisitionFunnel();

  it("covers every required audience class across every stage", () => {
    expect(report.status).toBe("READY");
    expect(report.blockers).toBe(0);
    expect(AUDIENCE_FUNNELS.map(p => p.audience).sort()).toEqual([...REQUIRED_AUDIENCE_CLASSES].sort());
    for (const p of AUDIENCE_FUNNELS) {
      for (const key of FUNNEL_STAGE_KEYS) expect(String(p[key]).length).toBeGreaterThan(0);
    }
  });

  it("only maps to governed public paths and adds no indexable URLs", () => {
    const governed = new Set(governedPaths());
    const before = indexablePaths().length;
    for (const p of AUDIENCE_FUNNELS) {
      for (const path of [p.canonicalPage, p.guideOrAssessment, p.leadCapture, p.consultation, p.ctaPath, p.reviewReferralPath]) {
        expect(governed.has(path)).toBe(true);
      }
    }
    expect(indexablePaths().length).toBe(before);
  });

  it("closes a review / referral loop for every audience", () => {
    for (const p of AUDIENCE_FUNNELS) {
      expect(p.reviewReferralLoop.trim().length).toBeGreaterThan(0);
      expect(p.reviewReferralPath.startsWith("/")).toBe(true);
    }
  });

  it("detects a missing stage, an invalid path, and a missing referral loop", () => {
    const brokenStage = AUDIENCE_FUNNELS.map(p => (p.audience === "future-seller" ? { ...p, leadCapture: "" } : p));
    expect(validateFunnel(brokenStage).some(f => f.severity === "BLOCKER" && f.stage === "leadCapture")).toBe(true);

    const brokenPath = AUDIENCE_FUNNELS.map(p => (p.audience === "investor" ? { ...p, canonicalPage: "/not-a-real-page" } : p));
    expect(validateFunnel(brokenPath).some(f => f.severity === "BLOCKER" && /governed route inventory/.test(f.reason))).toBe(true);

    const brokenLoop = AUDIENCE_FUNNELS.map(p => (p.audience === "downsizer" ? { ...p, reviewReferralPath: "/nope" } : p));
    expect(validateFunnel(brokenLoop).some(f => f.stage === "reviewReferralLoop")).toBe(true);

    const missingAudience = AUDIENCE_FUNNELS.filter(p => p.audience !== "past-client");
    expect(validateFunnel(missingAudience).some(f => f.stage === "coverage")).toBe(true);
  });

  it("carries no PII and no fabricated proof or results", () => {
    // The licensee's own business phone/email are required disclosure data
    // (BPC 10140.6), not third-party PII, so they are stripped before the
    // PII scan rather than treated as a violation.
    const text = (JSON.stringify(AUDIENCE_FUNNELS) + JSON.stringify(CAMPAIGN_ASSETS.map(a => a.body)))
      .split(LICENSE.email).join("")
      .split(LICENSE.phone).join("");
    expect(text).not.toMatch(/@[a-z0-9-]+\.(?:com|net|org)/i);
    expect(text).not.toMatch(/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/);
    expect(text).not.toMatch(/\b\d+\s*(?:5-star|star) reviews?\b/i);
    expect(text).not.toMatch(/\bsold \d+ homes\b/i);
  });
});
