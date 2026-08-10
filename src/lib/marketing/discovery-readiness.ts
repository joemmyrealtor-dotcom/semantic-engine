// Discovery & Entity Activation Readiness — Task 17 (T17-7).
//
// Prepared, never submitted. This module holds the operator-facing readiness
// state for Google Search Console, Bing Webmaster Tools / IndexNow, and GA4
// production measurement. Nothing here verifies a property, submits a
// sitemap, pings IndexNow, or writes to an analytics account: it renders the
// exact steps and asserts the preconditions that must hold first.

import { canonicalOriginStatus, absoluteUrl, PUBLIC_SITE_ORIGIN } from "./site";
import { indexablePaths } from "./indexation";
import { GA4_EVENTS, GA4_FORBIDDEN_PARAMS, type Ga4EventSpec } from "./ga4-contract";
import { indexNowConfig, VERIFICATION_PLANS } from "./indexing-launch";
import { buildGbpPack } from "./gbp";

export type ReadinessState = "READY" | "BLOCKED" | "REVIEW";

export interface ChecklistItem {
  id: string;
  label: string;
  detail: string;
  /** Preconditions that must hold before an operator can perform the step. */
  blockedBy?: string;
}

export interface ReadinessSection {
  id: "gsc" | "bing" | "ga4" | "gbp";
  title: string;
  state: ReadinessState;
  summary: string;
  checklist: ChecklistItem[];
  blockers: string[];
}

const DOMAIN_BLOCKER = "Final production domain is not active.";

/* ------------------------------------------------------------------ GSC */

export function searchConsoleChecklist(): ChecklistItem[] {
  return [
    { id: "gsc-verify", label: "Domain verification", detail: "URL-prefix property on the apex, verified with the HTML meta token rendered server-side in the root document head. A DNS TXT domain property is optional and only needed if subdomains must be covered." },
    { id: "gsc-sitemap", label: "Sitemap URL", detail: `Submit ${absoluteUrl("/sitemap.xml")} once canonical validation passes.` },
    { id: "gsc-inspect", label: "URL inspection checklist", detail: "Inspect one URL per page family: /home, a pillar (/probate), a guide, an answer, a local city page, a professional page. Confirm indexed URL equals the canonical, the user-declared and Google-selected canonical match, and the rendered HTML contains the H1 and the direct answer." },
    { id: "gsc-index", label: "Indexing validation", detail: "Watch Pages report: Indexed vs Crawled-not-indexed vs Discovered-not-indexed. Any 'Alternate page with proper canonical' on a page family signals cannibalization — route it back through the authority audit." },
    { id: "gsc-coverage", label: "Coverage monitoring", detail: "Weekly for the first 90 days: sitemap read errors, 404 spikes, soft-404s, redirect chains, robots blocks." },
    { id: "gsc-reporting", label: "Query and landing-page reporting", detail: "Track clicks, impressions, CTR, position by page and by query; segment county hubs vs city pages vs answers to feed the 30/60/90 lifecycle decisions." },
  ];
}

/* ----------------------------------------------------------- Bing/IndexNow */

export function bingChecklist(): ChecklistItem[] {
  return [
    { id: "bing-verify", label: "Site verification", detail: "Import ownership from the verified Google property; fall back to BingSiteAuth.xml hosted at the apex." },
    { id: "bing-sitemap", label: "Sitemap submission", detail: `Submit ${absoluteUrl("/sitemap.xml")} after the Google property reports a clean read.` },
    { id: "indexnow-key", label: "IndexNow endpoint and key", detail: `Host the key file at ${absoluteUrl("/indexnow-key.txt")} and post changed URLs to https://api.indexnow.org/indexnow. Disabled until the final domain is active — a key bound to the preview host is worthless.` },
    { id: "indexnow-flow", label: "URL change notification workflow", detail: "On publish/update of an indexable page: enqueue the canonical URL, batch (max 10,000/request), submit once, log the response. Never resubmit an unchanged URL — repeated pings are a spam signal." },
    { id: "bing-crawl", label: "Crawl-error monitoring", detail: "Weekly review of Bing crawl information: HTTP errors, blocked-by-robots, DNS failures, and slow responses." },
  ];
}

/* ------------------------------------------------------------------ GA4 */

/** Conversions that must exist as GA4 key events before release. */
export const PRIORITY_CONVERSIONS = [
  "guide_download",
  "assessment_started",
  "assessment_completed",
  "consultation_request",
  "contact_submitted",
  "referral_submitted",
  "partner_kit_requested",
  "phone_click",
  "email_click",
] as const;

export type PriorityConversion = (typeof PRIORITY_CONVERSIONS)[number];

export interface Ga4ConversionRow {
  conversion: PriorityConversion;
  mappedFrom: string | null;
  ga4Event: string | null;
  keyConversion: boolean;
  parameters: string[];
  status: "MAPPED" | "MISSING";
}

function findSpec(ga4Name: string): Ga4EventSpec | undefined {
  return GA4_EVENTS.find(e => e.ga4 === ga4Name) ?? GA4_EVENTS.find(e => e.internal === ga4Name);
}

export function ga4ConversionMap(): Ga4ConversionRow[] {
  return PRIORITY_CONVERSIONS.map(conversion => {
    const spec = findSpec(conversion);
    return {
      conversion,
      mappedFrom: spec?.internal ?? null,
      ga4Event: spec?.ga4 ?? null,
      keyConversion: spec?.keyConversion ?? false,
      parameters: spec?.parameters ?? [],
      status: spec ? "MAPPED" : "MISSING",
    };
  });
}

export interface PiiReview {
  reviewed: boolean;
  forbiddenParams: readonly string[];
  violations: string[];
  detail: string;
}

/** Contract-level PII review: no event may declare a forbidden parameter. */
export function ga4PiiReview(): PiiReview {
  const violations: string[] = [];
  for (const spec of GA4_EVENTS) {
    for (const param of spec.parameters) {
      if ((GA4_FORBIDDEN_PARAMS as readonly string[]).includes(param)) {
        violations.push(`${spec.ga4} declares forbidden parameter "${param}"`);
      }
      if (/email|phone|name|address|ssn/i.test(param) && !/page_|campaign|content/.test(param)) {
        violations.push(`${spec.ga4} declares a PII-shaped parameter "${param}"`);
      }
    }
  }
  return {
    reviewed: violations.length === 0,
    forbiddenParams: GA4_FORBIDDEN_PARAMS,
    violations,
    detail:
      violations.length === 0
        ? `${GA4_EVENTS.length} GA4 events reviewed; parameter allowlist contains no identifying fields.`
        : `${violations.length} contract violations must be resolved before release.`,
  };
}

export function ga4Checklist(): ChecklistItem[] {
  return [
    { id: "ga4-property", label: "Production property and stream", detail: "Create the production GA4 property and a single web data stream on the final domain. Preview hosts stay on a separate stream so preview traffic never pollutes production." },
    { id: "ga4-events", label: "Event layer mapping", detail: `${ga4ConversionMap().filter(r => r.status === "MAPPED").length}/${PRIORITY_CONVERSIONS.length} priority conversions map to an instrumented internal event.` },
    { id: "ga4-key", label: "Key events", detail: "Mark the priority conversions as key events; leave page_view and view-only events unmarked so conversion counts stay meaningful." },
    { id: "ga4-params", label: "Custom dimensions", detail: "Register page_type, situation, city, guide_id, assessment_id, lead_tier, channel as event-scoped custom dimensions. Never register an identity field." },
    { id: "ga4-consent", label: "Consent gating", detail: "Analytics fires only after consent; the consent banner already gates the transport layer." },
    { id: "ga4-pii", label: "PII review before release", detail: ga4PiiReview().detail },
  ];
}

/* -------------------------------------------------------------- assembly */

export interface DiscoveryReadiness {
  generatedAt: string;
  origin: string;
  domainActive: boolean;
  sections: ReadinessSection[];
  /** T17-7 rolls up to PASS only when every section is READY. */
  status: ReadinessState;
  blockers: string[];
  submitted: false;
}

export function buildDiscoveryReadiness(now: Date = new Date()): DiscoveryReadiness {
  const origin = canonicalOriginStatus();
  const domainActive = origin.status === "PASS";
  const domainBlockers = domainActive ? [] : [DOMAIN_BLOCKER];
  const pii = ga4PiiReview();
  const conversions = ga4ConversionMap();
  const missing = conversions.filter(c => c.status === "MISSING");
  const gbp = buildGbpPack();

  const sections: ReadinessSection[] = [
    {
      id: "gsc",
      title: "Google Search Console",
      state: domainActive ? "REVIEW" : "BLOCKED",
      summary: domainActive
        ? "Verification, sitemap, inspection, and reporting plans prepared. Operator must run them against the live domain."
        : "Prepared. No verification or submission until the final domain is active.",
      checklist: searchConsoleChecklist().map(i => (domainActive ? i : { ...i, blockedBy: DOMAIN_BLOCKER })),
      blockers: domainBlockers,
    },
    {
      id: "bing",
      title: "Bing Webmaster Tools & IndexNow",
      state: domainActive ? "REVIEW" : "BLOCKED",
      summary: indexNowConfig().detail,
      checklist: bingChecklist().map(i => (domainActive ? i : { ...i, blockedBy: DOMAIN_BLOCKER })),
      blockers: domainBlockers,
    },
    {
      id: "ga4",
      title: "GA4 production measurement",
      state: missing.length > 0 || !pii.reviewed ? "BLOCKED" : domainActive ? "REVIEW" : "BLOCKED",
      summary: `${conversions.length - missing.length}/${conversions.length} priority conversions mapped · PII review ${pii.reviewed ? "PASS" : "FAIL"}.`,
      checklist: ga4Checklist(),
      blockers: [
        ...domainBlockers,
        ...missing.map(m => `No instrumented event maps to ${m.conversion}.`),
        ...pii.violations,
      ],
    },
    {
      id: "gbp",
      title: "Google Business Profile",
      state: gbp.status,
      summary: gbp.summary,
      checklist: gbp.checklist,
      blockers: gbp.blockers,
    },
  ];

  const blockers = sections.flatMap(s => s.blockers.map(b => `${s.title}: ${b}`));
  const status: ReadinessState = sections.every(s => s.state === "READY")
    ? "READY"
    : sections.some(s => s.state === "BLOCKED")
      ? "BLOCKED"
      : "REVIEW";

  return {
    generatedAt: now.toISOString(),
    origin: PUBLIC_SITE_ORIGIN,
    domainActive,
    sections,
    status,
    blockers,
    submitted: false,
  };
}

/** Convenience for the release audit: sitemap URL count reported to engines. */
export function submittableUrlCount(): number {
  return indexablePaths().length;
}

export { VERIFICATION_PLANS };
