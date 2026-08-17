// Task 35 — Growth / client-acquisition metric registry.
//
// The governing rule: an unavailable source is NEVER rendered as zero. Every
// metric carries an explicit status so an operator can tell the difference
// between "measured zero" and "we cannot see this yet".
//
// Measured values come from the existing local conversion store. Everything
// that depends on Search Console, GA4, HubSpot, Apollo, or manual CRM entry
// is reported as NOT_CONNECTED or UNAVAILABLE until an evidenced connection
// exists. This module connects to nothing.

import { computeConversionMetrics, type ConversionMetrics } from "./conversion-store";
import type { MarketingEvent } from "./analytics";

export type MetricStatus = "MEASURED" | "UNAVAILABLE" | "NOT_CONNECTED" | "TARGET" | "REVIEW";

export type MetricSystem =
  | "app-events"
  | "not-instrumented"
  | "search-console"
  | "ga4"
  | "crm"
  | "apollo"
  | "operator-entry";

export interface GrowthMetricSpec {
  id: string;
  label: string;
  group: "traffic" | "engagement" | "lead" | "sales" | "efficiency" | "operations";
  system: MetricSystem;
  definition: string;
}

export const GROWTH_METRICS: GrowthMetricSpec[] = [
  { id: "sessions", label: "Visitors / sessions", group: "traffic", system: "app-events", definition: "Distinct instrumented sessions in the local conversion store." },
  { id: "page_views", label: "Page views", group: "traffic", system: "app-events", definition: "Instrumented page and content views." },
  { id: "organic_impressions", label: "Organic impressions", group: "traffic", system: "search-console", definition: "Search impressions. Requires a verified Search Console connection." },
  { id: "organic_clicks", label: "Organic clicks", group: "traffic", system: "search-console", definition: "Search clicks. Requires a verified Search Console connection." },
  { id: "guide_downloads", label: "Guide downloads", group: "engagement", system: "app-events", definition: "Delivered lead magnets." },
  { id: "assessment_starts", label: "Assessment starts", group: "engagement", system: "app-events", definition: "First assessment question answered." },
  { id: "assessment_completions", label: "Assessment completions", group: "engagement", system: "app-events", definition: "Assessment produced a readiness result." },
  { id: "consultation_requests", label: "Consultation requests", group: "lead", system: "app-events", definition: "Strategy-call requests initiated." },
  { id: "captured_leads", label: "Captured leads", group: "lead", system: "app-events", definition: "Lead payloads captured on this device." },
  { id: "qualified_leads", label: "Qualified leads", group: "lead", system: "app-events", definition: "Leads scored Qualified or Hot by the internal model." },
  { id: "hot_leads", label: "Hot leads", group: "lead", system: "app-events", definition: "Leads scored Hot by the internal model." },
  { id: "qualified_visitors", label: "Qualified visitors", group: "traffic", system: "not-instrumented", definition: "Visitors matching the qualified-visitor definition (situation-relevant landing page + meaningful engagement depth). Distinct from raw sessions and NOT measurable yet — never compare the qualified-visitor target to a raw session count." },
  { id: "partner_referrals", label: "Partner referrals", group: "lead", system: "crm", definition: "Referrals attributed to a named referral professional. Requires CRM delivery verification." },
  { id: "referral_relationships", label: "Referral relationships", group: "lead", system: "crm", definition: "Named referral professionals with a documented, reciprocal-free working relationship. CRM/operator-owned." },
  { id: "appointments", label: "Appointments", group: "sales", system: "crm", definition: "Booked consultations. CRM-owned." },
  { id: "show_rate", label: "Show rate", group: "sales", system: "crm", definition: "Appointments held ÷ appointments booked. CRM-owned." },
  { id: "signed_clients", label: "Signed clients", group: "sales", system: "crm", definition: "Signed engagements. CRM-owned." },
  { id: "closings", label: "Closings", group: "sales", system: "crm", definition: "Closed transactions. CRM-owned." },
  { id: "closed_or_pending", label: "Closed or pending transactions", group: "sales", system: "crm", definition: "Transactions closed or under contract/pending. CRM-owned. Never estimated here." },
  { id: "revenue", label: "Revenue", group: "sales", system: "crm", definition: "Recorded revenue. CRM-owned. Never estimated or modelled here." },
  { id: "cpl", label: "Cost per lead (CPL)", group: "efficiency", system: "operator-entry", definition: "Spend ÷ captured leads. Requires verified spend, which does not exist while paid acquisition is blocked." },
  { id: "cpa", label: "Cost per acquisition (CPA)", group: "efficiency", system: "operator-entry", definition: "Spend ÷ signed clients. Requires verified spend and CRM outcomes." },
  { id: "cac", label: "Client acquisition cost", group: "efficiency", system: "operator-entry", definition: "Total acquisition cost ÷ signed clients." },
  { id: "content_cadence", label: "Content production cadence", group: "operations", system: "app-events", definition: "Planned cadence items per week from the 90-day plan." },
  { id: "proof_coverage", label: "Review / proof coverage", group: "operations", system: "app-events", definition: "Proof categories with at least one verified, consented record." },
];

export interface MetricReading {
  id: string;
  label: string;
  group: GrowthMetricSpec["group"];
  system: MetricSystem;
  status: MetricStatus;
  /** Only present when status is MEASURED. Never defaulted to 0. */
  value?: number;
  /** Human-readable reason when the value is absent. */
  note?: string;
}

export interface ExternalSourceAvailability {
  searchConsole: boolean;
  ga4: boolean;
  crm: boolean;
  apollo: boolean;
  spend: boolean;
}

/** Nothing is connected until an evidenced connection exists. */
export const DEFAULT_AVAILABILITY: ExternalSourceAvailability = {
  searchConsole: false,
  ga4: false,
  crm: false,
  apollo: false,
  spend: false,
};

const NOT_CONNECTED_NOTE: Record<MetricSystem, string> = {
  "app-events": "No instrumented events recorded on this device yet.",
  "search-console": "Search Console is not connected. No indexing or query data can be read.",
  ga4: "GA4 is not connected. No analytics property data can be read.",
  crm: "CRM delivery is not verified. Sales-stage values cannot be read.",
  apollo: "Apollo is not connected. Outreach data cannot be read.",
  "operator-entry": "Requires verified spend and CRM outcomes; neither is available.",
  "not-instrumented": "No instrumentation exists for this definition yet. The target remains TARGET_ONLY and must never be compared to raw sessions.",
};

export interface GrowthMeasurementInput {
  events?: MarketingEvent[];
  capturedLeads?: number;
  availability?: Partial<ExternalSourceAvailability>;
  /** Planned cadence items per week, from the 90-day plan. */
  cadenceItemsPerWeek?: number;
  /** Proof categories currently covered by a verified record. */
  proofCategoriesCovered?: number;
}

export interface GrowthMeasurementReport {
  generatedAt: string;
  readings: MetricReading[];
  measured: number;
  unavailable: number;
  conversion: ConversionMetrics | null;
  availability: ExternalSourceAvailability;
}

function reading(
  spec: GrowthMetricSpec,
  status: MetricStatus,
  value?: number,
  note?: string,
): MetricReading {
  const base: MetricReading = { id: spec.id, label: spec.label, group: spec.group, system: spec.system, status };
  if (status === "MEASURED" && typeof value === "number") base.value = value;
  if (note) base.note = note;
  return base;
}

export function buildGrowthMeasurement(
  input: GrowthMeasurementInput = {},
  now: Date = new Date(),
): GrowthMeasurementReport {
  const availability: ExternalSourceAvailability = { ...DEFAULT_AVAILABILITY, ...(input.availability ?? {}) };
  const events = input.events;
  const hasEvents = Array.isArray(events) && events.length > 0;
  const conversion = hasEvents ? computeConversionMetrics(events!) : null;

  const appValue: Record<string, number | undefined> = conversion
    ? {
        sessions: conversion.visitors,
        page_views: conversion.pageViews,
        guide_downloads: conversion.guideDownloads,
        assessment_starts: conversion.assessmentStarts,
        assessment_completions: conversion.assessmentCompletions,
        consultation_requests: conversion.consultationRequests,
        qualified_leads: conversion.qualifiedLeads,
        hot_leads: conversion.hotLeads,
      }
    : {};
  if (typeof input.capturedLeads === "number") appValue["captured_leads"] = input.capturedLeads;
  if (typeof input.cadenceItemsPerWeek === "number") appValue["content_cadence"] = input.cadenceItemsPerWeek;
  if (typeof input.proofCategoriesCovered === "number") appValue["proof_coverage"] = input.proofCategoriesCovered;

  const systemConnected: Record<MetricSystem, boolean> = {
    "app-events": true,
    "not-instrumented": false,
    "search-console": availability.searchConsole,
    ga4: availability.ga4,
    crm: availability.crm,
    apollo: availability.apollo,
    "operator-entry": availability.spend && availability.crm,
  };

  const readings = GROWTH_METRICS.map(spec => {
    if (!systemConnected[spec.system]) {
      return reading(spec, "NOT_CONNECTED", undefined, NOT_CONNECTED_NOTE[spec.system]);
    }
    if (spec.system === "app-events") {
      const value = appValue[spec.id];
      return typeof value === "number"
        ? reading(spec, "MEASURED", value)
        : reading(spec, "UNAVAILABLE", undefined, NOT_CONNECTED_NOTE["app-events"]);
    }
    // A connected external system with no reader wired in is UNAVAILABLE,
    // never zero.
    return reading(spec, "UNAVAILABLE", undefined, "Source reported connected but no verified reader is wired in.");
  });

  return {
    generatedAt: now.toISOString(),
    readings,
    measured: readings.filter(r => r.status === "MEASURED").length,
    unavailable: readings.filter(r => r.status !== "MEASURED").length,
    conversion,
    availability,
  };
}
