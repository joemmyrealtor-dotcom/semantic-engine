// Local SEO Expansion — measurement registry.
//
// Rankings alone do not tell us whether a local page earned its existence.
// This registry declares, per page, what we measure and what "working" means,
// so the operator surface and any later analytics wiring read from one
// definition rather than inventing thresholds per dashboard.
//
// No numbers are asserted here as observed. Targets are planning values; every
// observed value must come from an instrumented event or an external console.

import { LOCAL_PAGES, type LocalPageSpec } from "./local-pages";

export type MetricSource = "search-console" | "analytics-event" | "lead-capture" | "crm";

export interface MetricDefinition {
  id: string;
  label: string;
  source: MetricSource;
  /** Why this metric is a better signal than raw ranking. */
  rationale: string;
}

export const LOCAL_METRICS: MetricDefinition[] = [
  {
    id: "impressions",
    label: "Impressions",
    source: "search-console",
    rationale: "Confirms the page is eligible for the intended queries at all.",
  },
  {
    id: "clicks",
    label: "Organic clicks",
    source: "search-console",
    rationale: "Measures whether the title and answer earn the click, not just the position.",
  },
  {
    id: "answer_queries",
    label: "Question-shaped queries",
    source: "search-console",
    rationale: "AEO signal: the page should surface for questions, not only for head terms.",
  },
  {
    id: "assessment_start",
    label: "Assessment starts",
    source: "analytics-event",
    rationale: "First real engagement signal; a page with traffic and no starts is not persuading.",
  },
  {
    id: "guide_download",
    label: "Guide requests",
    source: "lead-capture",
    rationale: "Captured intent with attribution attached to this exact page.",
  },
  {
    id: "consult_request",
    label: "Strategy call requests",
    source: "lead-capture",
    rationale: "The conversion the page exists to produce.",
  },
  {
    id: "qualified_lead",
    label: "Qualified leads",
    source: "crm",
    rationale: "Separates volume from value; the only metric that survives contact with the business.",
  },
];

export interface PageMeasurementPlan {
  path: string;
  cluster: string;
  geography: string;
  level: LocalPageSpec["level"];
  /** Primary question the page must be found for. */
  targetQuestion: string;
  metrics: string[];
  /** Review checkpoints, in days after publication. */
  reviewDays: number[];
  /** What must be true at the 90-day review for the page to be kept as-is. */
  keepCriteria: string[];
  /** What triggers a rewrite rather than a deletion. */
  reviseTriggers: string[];
}

export function measurementPlan(spec: LocalPageSpec): PageMeasurementPlan {
  return {
    path: spec.path,
    cluster: spec.cluster,
    geography: spec.geography,
    level: spec.level,
    targetQuestion: spec.question,
    metrics: LOCAL_METRICS.map(m => m.id),
    reviewDays: [30, 60, 90],
    keepCriteria: [
      "The page receives impressions for question-shaped queries in its cluster.",
      "At least one engagement action (assessment start, guide request, or call request) is attributed to it.",
      "Its content remains accurate against current process and law; nothing has gone stale.",
    ],
    reviseTriggers: [
      "Impressions without clicks — the answer or title is not matching intent.",
      "Clicks without engagement — the next step is unclear or the content stops short of a decision.",
      "Overlap with a sibling page's queries — consolidate rather than compete with ourselves.",
    ],
  };
}

export function localMeasurementRegistry(): PageMeasurementPlan[] {
  return LOCAL_PAGES.map(measurementPlan);
}
