// Task 17 — SEO/AEO release audit.
//
// Read-only, deterministic checks that must pass before anything is published
// publicly. This module asserts nothing about infrastructure gates (H1–H4);
// it only covers the search/AI/social identity surface. Production release
// stays BLOCKED while any check here is BLOCKED.

import { canonicalOriginStatus, PUBLIC_SITE_ORIGIN } from "./site";
import { INDEXABLE_STATIC_PATHS, NON_INDEXABLE_PUBLIC_PATHS, indexablePaths } from "./indexation";
import { LOCAL_PAGES } from "./local-pages";
import { ANSWERS } from "./answers";

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

  const checks: AuditCheck[] = [
    {
      id: "T17-1",
      label: "Canonical origin is the final production domain",
      status: origin.status,
      detail: origin.detail,
      launchCritical: true,
    },
    {
      id: "T17-2",
      label: "Governed console and private routes excluded from the index",
      status: leaked.length === 0 ? "PASS" : "BLOCKED",
      detail:
        leaked.length === 0
          ? `Excluded: ${NON_INDEXABLE_PUBLIC_PATHS.join(", ")}`
          : `Leaked into the sitemap: ${leaked.join(", ")}`,
      launchCritical: true,
    },
    {
      id: "T17-3",
      label: "Sitemap contains no duplicate URLs",
      status: duplicates.length === 0 ? "PASS" : "BLOCKED",
      detail: duplicates.length === 0 ? `${paths.length} unique indexable URLs` : duplicates.join(", "),
      launchCritical: true,
    },
    {
      id: "T17-4",
      label: "Local wave-one pages carry unique local content",
      status: thin.length === 0 ? "PASS" : "BLOCKED",
      detail: thin.length === 0 ? `${LOCAL_PAGES.length} local pages passed the thin-content guard` : thin.join("; "),
      launchCritical: true,
    },
    {
      id: "T17-5",
      label: "Answer library present for AEO surfaces",
      status: ANSWERS.length >= 50 ? "PASS" : "REVIEW",
      detail: `${ANSWERS.length} canonical answers available for distribution`,
      launchCritical: false,
    },
    {
      id: "T17-6",
      label: "Static marketing surface registered",
      status: INDEXABLE_STATIC_PATHS.length >= 20 ? "PASS" : "REVIEW",
      detail: `${INDEXABLE_STATIC_PATHS.length} static indexable paths`,
      launchCritical: false,
    },
    {
      id: "T17-7",
      label: "Search Console, Bing, GA4, and Business Profile connected",
      status: "REVIEW",
      detail: "External operator step — verify after the production domain is live.",
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
