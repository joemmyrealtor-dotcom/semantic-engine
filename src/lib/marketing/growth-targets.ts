// Task 35 — 90-day planning assumptions.
//
// These are PLANNING TARGETS, not results, forecasts, or claims. They are
// labelled TARGET everywhere they surface and must never be rendered next to
// measured values without that label. No target is derived from, or implies,
// an actual outcome.

export type TargetBasis = "ASSUMPTION" | "OPERATOR_INPUT";

export interface GrowthTarget {
  metricId: string;
  label: string;
  /** Target for the full 90-day window. */
  target: number;
  unit: "count" | "percent";
  basis: TargetBasis;
  rationale: string;
  status: "TARGET";
}

/**
 * Conservative, self-consistent planning assumptions. Every number is an
 * input to a plan, not a prediction. Change them freely — nothing downstream
 * treats them as evidence.
 */
export const NINETY_DAY_TARGETS: GrowthTarget[] = [
  {
    metricId: "sessions",
    label: "Visitors (90 days)",
    target: 1500,
    unit: "count",
    basis: "ASSUMPTION",
    rationale: "Planning assumption for an unlaunched site with no historical traffic. Not a forecast.",
    status: "TARGET",
  },
  {
    metricId: "guide_downloads",
    label: "Guide downloads (90 days)",
    target: 90,
    unit: "count",
    basis: "ASSUMPTION",
    rationale: "Assumes a 6% download rate on visitors. Assumption only.",
    status: "TARGET",
  },
  {
    metricId: "assessment_completions",
    label: "Assessment completions (90 days)",
    target: 45,
    unit: "count",
    basis: "ASSUMPTION",
    rationale: "Assumes half of assessment starts finish. Assumption only.",
    status: "TARGET",
  },
  {
    metricId: "captured_leads",
    label: "Captured leads (90 days)",
    target: 120,
    unit: "count",
    basis: "ASSUMPTION",
    rationale: "Sum of guide, assessment, and consultation entry paths, de-duplicated by assumption.",
    status: "TARGET",
  },
  {
    metricId: "qualified_leads",
    label: "Qualified+ leads (90 days)",
    target: 40,
    unit: "count",
    basis: "ASSUMPTION",
    rationale: "Assumes one third of captured leads reach Qualified or Hot under the internal scoring model.",
    status: "TARGET",
  },
  {
    metricId: "consultation_requests",
    label: "Consultation requests (90 days)",
    target: 24,
    unit: "count",
    basis: "ASSUMPTION",
    rationale: "Assumption tied to qualified-lead volume, not to any observed conversion rate.",
    status: "TARGET",
  },
  {
    metricId: "partner_referrals",
    label: "Referral-professional conversations (90 days)",
    target: 13,
    unit: "count",
    basis: "ASSUMPTION",
    rationale: "One documented partner conversation per planning week.",
    status: "TARGET",
  },
  {
    metricId: "proof_coverage",
    label: "Proof categories covered (90 days)",
    target: 3,
    unit: "count",
    basis: "OPERATOR_INPUT",
    rationale: "Depends entirely on real closed engagements and consented reviews. Cannot be manufactured.",
    status: "TARGET",
  },
];

export interface TargetComparison {
  metricId: string;
  label: string;
  target: number;
  /** Undefined whenever the metric is not measured. Never coerced to 0. */
  actual?: number;
  status: "TARGET_ONLY" | "TRACKING";
  note: string;
}

/**
 * Compares targets to measurements. When a metric is not measured, the
 * comparison stays TARGET_ONLY with no actual value — never a zero.
 */
export function compareTargets(
  measured: { id: string; status: string; value?: number }[],
  targets: GrowthTarget[] = NINETY_DAY_TARGETS,
): TargetComparison[] {
  return targets.map(t => {
    const reading = measured.find(m => m.id === t.metricId);
    if (!reading || reading.status !== "MEASURED" || typeof reading.value !== "number") {
      return {
        metricId: t.metricId,
        label: t.label,
        target: t.target,
        status: "TARGET_ONLY" as const,
        note: "No measured value available. Target shown alone; absence is not zero.",
      };
    }
    return {
      metricId: t.metricId,
      label: t.label,
      target: t.target,
      actual: reading.value,
      status: "TRACKING" as const,
      note: "Measured value from instrumented app events. Target is a planning assumption, not a benchmark.",
    };
  });
}
