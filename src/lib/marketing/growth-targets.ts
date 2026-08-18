// Task 36 — canonical 90-day planning assumptions (TARGETS, not results).
//
// CANONICAL TASK NUMBERING
//   Task 35 = Growth / Client Acquisition Dashboard + metric registry
//             (growth-metrics.ts).
//   Task 36 = these planning targets / assumptions (this file).
//   Task 37 = launch, pre-launch, and reactivation campaign system
//             (acquisition-campaigns.ts).
//
// Every number below is a PLANNING TARGET / ASSUMPTION. None is a forecast,
// projection, promise, benchmark, or performance claim. Targets are labelled
// TARGET everywhere they surface and are never rendered as, or beside, a
// measured value without that label.

export type TargetBasis = "ASSUMPTION" | "OPERATOR_INPUT";

export interface GrowthTarget {
  metricId: string;
  label: string;
  /** Lower bound of the 90-day target. Equals `targetMax` for point targets. */
  target: number;
  /** Upper bound. Present and different from `target` for range targets. */
  targetMax: number;
  /** True when the canonical target is a range (e.g. 3–5). */
  isRange: boolean;
  /** Human-readable target, e.g. "1,500" or "3–5". */
  display: string;
  unit: "count" | "percent";
  basis: TargetBasis;
  rationale: string;
  /** Always TARGET. Never MEASURED, FORECAST, or ACTUAL. */
  status: "TARGET";
  /** True when no instrumented source can measure this yet. */
  measurable: boolean;
}

export const TARGET_LABEL = "TARGET / ASSUMPTION" as const;

/**
 * Mandatory recalibration rule. Targets are planning assumptions only. They
 * do not become operational benchmarks by the passage of time.
 */
export const RECALIBRATION_RULE =
  "TARGET / ASSUMPTION only. After 30 days of real production data, the operator must review and revise these targets before any of them is treated as an operational benchmark. Until that review is recorded, no target may be reported as a forecast, commitment, or performance expectation.";

export const RECALIBRATION_WINDOW_DAYS = 30;

function target(
  metricId: string,
  label: string,
  min: number,
  max: number,
  basis: TargetBasis,
  rationale: string,
  measurable: boolean,
): GrowthTarget {
  const isRange = max !== min;
  return {
    metricId,
    label,
    target: min,
    targetMax: max,
    isRange,
    display: isRange ? `${min.toLocaleString("en-US")}–${max.toLocaleString("en-US")}` : min.toLocaleString("en-US"),
    unit: "count",
    basis,
    rationale,
    status: "TARGET",
    measurable,
  };
}

/**
 * The canonical Task 36 target set, exactly as authorized. Changing any value
 * requires an Owner decision; nothing downstream treats these as evidence.
 */
export const NINETY_DAY_TARGETS: GrowthTarget[] = [
  target(
    "qualified_visitors",
    "Qualified visitors (90 days)",
    1500,
    1500,
    "ASSUMPTION",
    "Qualified visitors, not raw sessions. Measured only by the internal qualified-visitor definition (situation-relevant entry + engagement depth + intent interaction); a raw session count is never substituted.",
    true,
  ),
  target("guide_downloads", "Guide downloads (90 days)", 150, 150, "ASSUMPTION", "Planning assumption for lead-magnet delivery volume.", true),
  target("assessment_completions", "Assessments completed (90 days)", 75, 75, "ASSUMPTION", "Planning assumption for completed readiness assessments.", true),
  target("qualified_leads", "Qualified leads (90 days)", 40, 40, "ASSUMPTION", "Planning assumption for leads reaching Qualified or Hot under the internal scoring model.", true),
  target("consultation_requests", "Consultations (90 days)", 20, 20, "ASSUMPTION", "Planning assumption for held or requested consultations.", true),
  target("signed_clients", "Signed clients (90 days)", 10, 10, "ASSUMPTION", "Planning assumption. CRM-owned; never estimated in this application.", false),
  target("referral_relationships", "Referral relationships (90 days)", 10, 10, "ASSUMPTION", "Planning assumption for documented referral-professional relationships. Operator/CRM-owned.", false),
  target("closed_or_pending", "Closed or pending transactions (90 days)", 3, 5, "ASSUMPTION", "Explicit range, not a single number. CRM-owned; never estimated in this application.", false),
];

export interface TargetComparison {
  metricId: string;
  label: string;
  /** Target lower bound. */
  target: number;
  targetMax: number;
  display: string;
  /** Undefined whenever the metric is not measured. Never coerced to 0. */
  actual?: number;
  status: "TARGET_ONLY" | "TRACKING";
  note: string;
  /** Always present so no surface can render a target without its label. */
  label_kind: typeof TARGET_LABEL;
  recalibration: string;
}

/**
 * Compares targets to measurements. When a metric is not measured — or is not
 * measurable at all, as with qualified visitors — the comparison stays
 * TARGET_ONLY with no actual value. Never a zero, and never a substituted
 * proxy such as raw sessions.
 */
export function compareTargets(
  measured: { id: string; status: string; value?: number }[],
  targets: GrowthTarget[] = NINETY_DAY_TARGETS,
): TargetComparison[] {
  return targets.map(t => {
    const base = {
      metricId: t.metricId,
      label: t.label,
      target: t.target,
      targetMax: t.targetMax,
      display: t.display,
      label_kind: TARGET_LABEL,
      recalibration: RECALIBRATION_RULE,
    };
    const reading = t.measurable ? measured.find(m => m.id === t.metricId) : undefined;
    if (!reading || reading.status !== "MEASURED" || typeof reading.value !== "number") {
      return {
        ...base,
        status: "TARGET_ONLY" as const,
        note: t.measurable
          ? "No measured value available. Target shown alone; absence is not zero."
          : "Not measurable with current instrumentation. Target shown alone; no proxy metric is substituted.",
      };
    }
    return {
      ...base,
      actual: reading.value,
      status: "TRACKING" as const,
      note: `Measured value from the metric registry. ${TARGET_LABEL}: planning assumption, not a benchmark. ${RECALIBRATION_RULE}`,
    };
  });
}
