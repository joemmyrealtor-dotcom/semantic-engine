// Discovery Measurement Pack — 30/60/90-day page decision framework.
//
// After launch, every SEO page is judged on real performance. Before data
// exists, the verdict is "insufficient data" — never "underperforming".

import type { PagePerformance } from "./search-console";

export type ReviewWindow = 30 | 60 | 90;

export type PageDecision =
  | "INSUFFICIENT_DATA"
  | "HOLD"
  | "IMPROVE_DIFFERENTIATION"
  | "IMPROVE_INTERNAL_AUTHORITY"
  | "IMPROVE_CONVERSION"
  | "EXPAND_SUPPORTING_CONTENT"
  | "CONSOLIDATE_CANDIDATE";

export interface WindowCriteria {
  window: ReviewWindow;
  question: string;
  measures: string[];
  thresholds: string[];
}

export const REVIEW_FRAMEWORK: WindowCriteria[] = [
  {
    window: 30,
    question: "Is the page indexed, seen, and matched to the intended queries?",
    measures: ["Indexed in Search Console", "Impressions > 0", "Query alignment with the declared primary keyword"],
    thresholds: ["Indexed within 30 days", "At least 50 impressions", "At least one query matching the declared intent"],
  },
  {
    window: 60,
    question: "Is the page earning clicks and holding attention?",
    measures: ["CTR", "Average position trend", "Engagement", "Assessment or guide conversion"],
    thresholds: ["CTR at or above 1.5%", "Position improving vs the 30-day read", "At least one guide or assessment start"],
  },
  {
    window: 90,
    question: "Is the page producing qualified pipeline?",
    measures: ["Qualified leads", "Consultations booked", "CRM opportunities", "Client contribution"],
    thresholds: ["At least one qualified lead", "Consultation or CRM opportunity attributed to the page"],
  },
];

export interface PageEngagement {
  guideDownloads: number;
  assessmentStarts: number;
  assessmentCompletions: number;
  consultations: number;
  qualifiedLeads: number;
  crmOpportunities: number;
}

export interface PageReviewInput {
  path: string;
  window: ReviewWindow;
  /** Null when Search Console is not connected or has no rows for this page. */
  performance: PagePerformance | null;
  engagement: PageEngagement | null;
  indexed: boolean | null;
}

export interface PageReviewResult {
  path: string;
  window: ReviewWindow;
  decision: PageDecision;
  rationale: string;
  actions: string[];
}

export function reviewPage(input: PageReviewInput): PageReviewResult {
  const { performance, engagement, window, path } = input;

  if (!performance || input.indexed === null) {
    return {
      path,
      window,
      decision: "INSUFFICIENT_DATA",
      rationale: "No Search Console data is available for this page. Absence of data is not evidence of absence of demand.",
      actions: ["Connect Search Console", "Re-run this review once the property returns rows"],
    };
  }

  if (window === 30) {
    if (input.indexed === false) {
      return {
        path,
        window,
        decision: "IMPROVE_INTERNAL_AUTHORITY",
        rationale: "The page is not indexed after 30 days.",
        actions: ["Add contextual links from the parent hub", "Confirm the URL is in the sitemap and self-canonical"],
      };
    }
    if (performance.impressions < 50) {
      return {
        path,
        window,
        decision: "IMPROVE_DIFFERENTIATION",
        rationale: `Only ${performance.impressions} impressions in the first window.`,
        actions: ["Sharpen the primary query angle", "Check the cannibalization report for a stronger sibling", "Strengthen internal links from the topic hub"],
      };
    }
    return { path, window, decision: "HOLD", rationale: "Indexed and earning impressions. Let it mature.", actions: ["Re-review at 60 days"] };
  }

  if (window === 60) {
    if (performance.ctr < 0.015) {
      return {
        path,
        window,
        decision: "IMPROVE_DIFFERENTIATION",
        rationale: `CTR of ${(performance.ctr * 100).toFixed(2)}% is below the 1.5% threshold.`,
        actions: ["Rewrite the title and meta description around the observed query", "Move the direct answer higher"],
      };
    }
    const starts = engagement?.assessmentStarts ?? 0;
    const downloads = engagement?.guideDownloads ?? 0;
    if (starts + downloads === 0) {
      return {
        path,
        window,
        decision: "IMPROVE_CONVERSION",
        rationale: "Traffic is arriving but no guide or assessment path is being taken.",
        actions: ["Place the assessment CTA inside the answer block", "Match the offer to the query intent"],
      };
    }
    return { path, window, decision: "HOLD", rationale: "Clicks and engagement both present.", actions: ["Re-review at 90 days"] };
  }

  const qualified = engagement?.qualifiedLeads ?? 0;
  const opportunities = engagement?.crmOpportunities ?? 0;
  if (qualified > 0 || opportunities > 0) {
    return {
      path,
      window,
      decision: "EXPAND_SUPPORTING_CONTENT",
      rationale: `${qualified} qualified lead(s) and ${opportunities} CRM opportunity(ies) attributed.`,
      actions: ["Add supporting answer pages beneath this page", "Increase internal links pointing to it", "Build the matching city variant"],
    };
  }
  if (performance.impressions > 0 && performance.clicks === 0) {
    return {
      path,
      window,
      decision: "CONSOLIDATE_CANDIDATE",
      rationale: "Impressions without clicks across 90 days.",
      actions: ["Review for consolidation into the parent hub", "Do not delete without an authorized redirect decision"],
    };
  }
  return {
    path,
    window,
    decision: "IMPROVE_CONVERSION",
    rationale: "Traffic exists but produced no qualified pipeline in 90 days.",
    actions: ["Change the conversion offer", "Add a situation-specific next step"],
  };
}

export function reviewAll(inputs: PageReviewInput[]): PageReviewResult[] {
  return inputs.map(reviewPage);
}
