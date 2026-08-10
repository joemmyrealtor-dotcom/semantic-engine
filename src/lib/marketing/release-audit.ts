// Task 17 — SEO/AEO release audit.
//
// Read-only, deterministic checks that must pass before anything is published
// publicly. This module asserts nothing about infrastructure gates (H1–H4);
// it only covers the search/AI/social identity surface. Production release
// stays BLOCKED while any check here is BLOCKED.

import { canonicalOriginStatus, PUBLIC_SITE_ORIGIN } from "./site";
import { buildDomainPackage } from "./domain";
import { buildDiscoveryReadiness } from "./discovery-readiness";
import { buildAuthorityAudit } from "./authority-audit";
import { buildRichResultReport } from "./rich-results";
import { auditSocialPreviews } from "./social-preview";
import { authorityIssues, linkEquityDistribution } from "./authority";
import { buildLaunchPackage } from "./indexing-launch";
import { ga4PiiReview } from "./discovery-readiness";
import { INDEXABLE_STATIC_PATHS, NON_INDEXABLE_PUBLIC_PATHS, indexablePaths } from "./indexation";
import { LOCAL_PAGES } from "./local-pages";
import { ANSWERS } from "./answers";
import { blockingCannibalization, buildCannibalizationReport } from "./cannibalization";
import { missingIntentRecords } from "./intent-map";
import { buildQualityGate } from "./quality-gate";

export type AuditStatus = "PASS" | "BLOCKED" | "REVIEW";

export interface AuditCheck {
  id: string;
  label: string;
  status: AuditStatus;
  detail: string;
  /** True when this check alone blocks public launch. */
  launchCritical: boolean;
}

export interface ReleaseAudit {
  generatedAt: string;
  origin: string;
  checks: AuditCheck[];
  indexableCount: number;
  status: AuditStatus;
}

/** Every wave-one local page must carry distinct local content — no templates. */
export function thinLocalPages(): string[] {
  const seen = new Map<string, string>();
  const thin: string[] = [];
  for (const page of LOCAL_PAGES) {
    const fingerprint = page.localConsiderations.join("|") + page.neighborhoods.join("|");
    const priorPath = seen.get(fingerprint);
    if (priorPath) thin.push(`${page.path} duplicates local context from ${priorPath}`);
    else seen.set(fingerprint, page.path);
    if (page.localConsiderations.length < 3) thin.push(`${page.path} has thin local context`);
    if (page.paa.length < 3) thin.push(`${page.path} has fewer than 3 PAA entries`);
    if (!page.guideSlug || !page.assessmentSlug) thin.push(`${page.path} is missing a guide or assessment path`);
  }
  return thin;
}

export function buildReleaseAudit(now: Date = new Date()): ReleaseAudit {
  const origin = canonicalOriginStatus();
  const paths = indexablePaths();
  const duplicates = paths.filter((p, i) => paths.indexOf(p) !== i);
  const leaked = NON_INDEXABLE_PUBLIC_PATHS.filter(p => paths.includes(p));
  const thin = thinLocalPages();
  const cannibalReport = buildCannibalizationReport(now);
  const cannibalBlockers = blockingCannibalization(cannibalReport);
  const cannibalSeverity = cannibalReport.severityCounts;

  const intentGaps = missingIntentRecords();
  const quality = buildQualityGate(now);
  const domain = buildDomainPackage(now);
  const discovery = buildDiscoveryReadiness(now);
  const authorityAudit = buildAuthorityAudit(now);
  const richResults = buildRichResultReport(now);
  const social = auditSocialPreviews();
  const socialIssues = [
    ...social.duplicateTitles.map(t => `duplicate title: ${t}`),
    ...social.duplicateDescriptions.map(t => `duplicate description: ${t}`),
    ...social.missingCanonical.map(t => `missing canonical: ${t}`),
    ...social.unsafeCopy.map(t => `unsafe copy: ${t}`),
  ];
  const hierarchy = authorityIssues();
  const launch = buildLaunchPackage(now);
  const pii = ga4PiiReview();

  const checks: AuditCheck[] = [
    {
      id: "T17-1",
      label: "Final canonical origin",
      status: domain.status === "PASS" ? "PASS" : "BLOCKED",
      detail:
        domain.status === "PASS"
          ? `${origin.origin} is the canonical entity; ${domain.redirects.length} host redirects prepared (www→apex, http→https, provisional host→final).`
          : domain.blockers.join(" "),
      launchCritical: true,
    },
    {
      id: "T17-2",
      label: "Indexation boundaries",
      status: leaked.length === 0 && duplicates.length === 0 ? "PASS" : "BLOCKED",
      detail:
        leaked.length === 0 && duplicates.length === 0
          ? `${paths.length} unique indexable URLs; excluded: ${NON_INDEXABLE_PUBLIC_PATHS.join(", ")}`
          : [
              leaked.length ? `Leaked into the sitemap: ${leaked.join(", ")}` : "",
              duplicates.length ? `Duplicate URLs: ${duplicates.join(", ")}` : "",
            ]
              .filter(Boolean)
              .join(" · "),
      launchCritical: true,
    },
    {
      id: "T17-3",
      label: "Structured data",
      status: richResults.status === "PASS" ? "PASS" : richResults.status === "REVIEW" ? "REVIEW" : "BLOCKED",
      detail: `${richResults.pagesChecked} pages validated across ${richResults.typesCovered.length} rich-result types; ${richResults.issues.length} issues.`,
      launchCritical: true,
    },
    {
      id: "T17-4",
      label: "Internal authority architecture",
      status: hierarchy.length === 0 ? "PASS" : "REVIEW",
      detail:
        hierarchy.length === 0
          ? `${linkEquityDistribution().length} tiers balanced; every child links upward and every hub features children.`
          : hierarchy.map(i => `${i.path}: ${i.issue}`).join("; "),
      launchCritical: true,
    },
    {
      id: "T17-5",
      label: "Cannibalization audit",
      status:
        authorityAudit.counts.CONSOLIDATE + authorityAudit.counts.REDIRECT + authorityAudit.counts.NOINDEX > 0
          ? "BLOCKED"
          : cannibalBlockers.length === 0 && cannibalSeverity.CRITICAL === 0
            ? cannibalSeverity.MATERIAL === 0
              ? "PASS"
              : "REVIEW"
            : "REVIEW",
      detail: `${authorityAudit.urls.length} URLs stated — KEEP ${authorityAudit.counts.KEEP} · IMPROVE ${authorityAudit.counts.IMPROVE} · REVIEW ${authorityAudit.counts.REVIEW} · CONSOLIDATE ${authorityAudit.counts.CONSOLIDATE} · NOINDEX ${authorityAudit.counts.NOINDEX} · REDIRECT ${authorityAudit.counts.REDIRECT}. Overlap severity — CRITICAL ${cannibalSeverity.CRITICAL} · MATERIAL ${cannibalSeverity.MATERIAL} · ACCEPTABLE ${cannibalSeverity.ACCEPTABLE}. Advisory only; nothing executed.`,
      launchCritical: true,
    },

    {
      id: "T17-6",
      label: "PII-safe analytics",
      status: pii.reviewed ? "PASS" : "BLOCKED",
      detail: pii.detail,
      launchCritical: true,
    },
    {
      id: "T17-7",
      label: "GSC, Bing/IndexNow, GA4, and Business Profile readiness",
      status: discovery.status === "READY" ? "PASS" : discovery.status === "REVIEW" ? "REVIEW" : "BLOCKED",
      detail:
        discovery.status === "READY"
          ? "All four discovery surfaces verified and connected."
          : `${discovery.sections.filter(s => s.state !== "READY").map(s => s.title).join(", ")} outstanding. ${discovery.blockers[0] ?? ""}`,
      launchCritical: true,
    },
    {
      id: "T17-8",
      label: "Social preview coverage",
      status: socialIssues.length === 0 ? "PASS" : "REVIEW",
      detail:
        socialIssues.length === 0
          ? `${social.previews.length} pages emit a unique title, description, self-referencing canonical, and 1200x630 card.`
          : socialIssues.slice(0, 5).join("; "),
      launchCritical: false,
    },
    {
      id: "T17-9",
      label: "Sitemap and robots production validation",
      status:
        intentGaps.length === 0 && launch.sitemapUrlCount === paths.length && thin.length === 0
          ? launch.readiness === "READY"
            ? "PASS"
            : "REVIEW"
          : "BLOCKED",
      detail: [
        `${launch.sitemapUrlCount} URLs at ${launch.sitemapUrl}`,
        intentGaps.length === 0 ? "every URL has a search-intent record" : `intent gaps: ${intentGaps.join(", ")}`,
        thin.length === 0 ? `${LOCAL_PAGES.length} local pages passed the thin-content guard` : thin.join("; "),
        `${ANSWERS.length} canonical answers · ${INDEXABLE_STATIC_PATHS.length} static paths`,
        launch.blockers.join(" "),
      ]
        .filter(Boolean)
        .join(" · "),
      launchCritical: true,
    },
    {
      id: "T17-10",
      label: "Final-domain SSR verification",
      status:
        domain.leaks.length > 0
          ? "BLOCKED"
          : quality.fail > 0
            ? "BLOCKED"
            : quality.review > 0
              ? "REVIEW"
              : "PASS",
      detail:
        domain.leaks.length > 0
          ? `${domain.leaks.length} server-rendered URLs still emit the Lovable hostname across ${domain.leakSurfaces.join(", ")}.`
          : `No provisional hostname in any canonical, sitemap, OG, schema @id, or share URL. ${quality.launchEligible}/${quality.pages.length} pages launch-eligible (${quality.pass} PASS · ${quality.review} REVIEW · ${quality.fail} FAIL). Cannibalization advisories outstanding: ${cannibalBlockers.length}.`,
      launchCritical: true,
    },
  ];

  const blocked = checks.some(c => c.status === "BLOCKED");
  const review = checks.some(c => c.launchCritical && c.status === "REVIEW");

  return {
    generatedAt: now.toISOString(),
    origin: PUBLIC_SITE_ORIGIN,
    checks,
    indexableCount: paths.length,
    status: blocked ? "BLOCKED" : review ? "REVIEW" : "PASS",
  };
}
