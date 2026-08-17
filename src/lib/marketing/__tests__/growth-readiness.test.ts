import { describe, expect, it } from "vitest";
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
import { NINETY_DAY_TARGETS, compareTargets } from "../growth-targets";
import { CAMPAIGN_ASSETS, buildCampaignReadiness, campaignViolations } from "../acquisition-campaigns";
import { PAID_BLUEPRINTS, PAID_PREREQUISITES, buildPaidReadiness } from "../paid-readiness";

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

  it("covers pre-launch, launch, reactivation, and partner phases", () => {
    const { byPhase } = buildCampaignReadiness();
    expect(byPhase["pre-launch"]).toBeGreaterThan(0);
    expect(byPhase.launch).toBeGreaterThan(0);
    expect(byPhase.reactivation).toBeGreaterThan(0);
    expect(byPhase["referral-partner"]).toBeGreaterThan(0);
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
