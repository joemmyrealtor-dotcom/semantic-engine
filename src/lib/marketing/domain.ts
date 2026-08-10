// Production Domain Package — Task 17 (T17-1 / T17-10).
//
// One domain owns the entity. Every canonical, sitemap URL, Open Graph URL,
// schema @id, and share URL must resolve to it. This module defines the host
// policy (www vs apex, HTTPS, trailing slash), the provisional-host redirect
// plan, and a deterministic sweep that fails the gate if any emitted URL
// still carries a Lovable hostname.

import {
  PUBLIC_SITE_ORIGIN,
  FALLBACK_SITE_ORIGIN,
  PROVISIONAL_ORIGIN_HOSTS,
  canonicalOriginStatus,
  isProvisionalOrigin,
  absoluteUrl,
  ENTITY_ID,
  SOCIAL_CARD,
} from "./site";
import { indexablePaths } from "./indexation";
import { indexableRecords } from "./intent-map";
import { socialPreviewFor } from "./social-preview";
import { graphForRecord } from "./rich-results";
import { assetsFor } from "./distribution";
import { ANSWERS } from "./answers";

export type DomainStatus = "PASS" | "REVIEW" | "BLOCKED";

/** Host canonicalisation policy. Apex is canonical; www redirects to it. */
export const HOST_POLICY = {
  canonicalHostForm: "apex" as const,
  wwwRule: "www.<domain> issues a 301 to the apex host, preserving path and query.",
  httpsRule: "http://* issues a 301 to https://. HSTS (max-age 31536000, includeSubDomains) is enabled once the apex has served HTTPS cleanly for 7 days.",
  trailingSlashRule: "/path/ 301s to /path. '/' is the only slashed URL.",
  caseRule: "Mixed-case paths 301 to their lowercase form.",
  paramRule: "utm_*, gclid, fbclid are stripped from canonical, sitemap, OG, and schema URLs.",
} as const;

export interface HostRedirect {
  from: string;
  to: string;
  status: 301;
  reason: string;
  /** Prepared only — nothing is applied by this module. */
  applied: false;
}

/**
 * Redirects from the provisional Lovable hosts to the final domain. Generated
 * only once a real production origin is configured: pointing the preview host
 * at itself would be a redirect loop, and pointing it at the fallback would
 * cement the wrong entity.
 */
export function provisionalHostRedirects(origin: string = PUBLIC_SITE_ORIGIN): HostRedirect[] {
  if (isProvisionalOrigin(origin)) return [];
  return [
    {
      from: `${FALLBACK_SITE_ORIGIN}/*`,
      to: `${origin}/:splat`,
      status: 301,
      reason: "Published Lovable host must hand its accumulated signals to the final domain.",
      applied: false,
    },
    {
      from: `${origin.replace("https://", "https://www.")}/*`,
      to: `${origin}/:splat`,
      status: 301,
      reason: "Apex is canonical; www must not serve a duplicate copy.",
      applied: false,
    },
    {
      from: `${origin.replace("https://", "http://")}/*`,
      to: `${origin}/:splat`,
      status: 301,
      reason: "HTTPS enforcement.",
      applied: false,
    },
  ];
}

export interface UrlLeak {
  surface: "canonical" | "sitemap" | "open-graph" | "schema" | "share";
  path: string;
  url: string;
}

function leaksIn(url: string): boolean {
  if (!/^https?:\/\//.test(url)) return false;
  const host = url.replace(/^https?:\/\//, "").split("/")[0]!.toLowerCase();
  return PROVISIONAL_ORIGIN_HOSTS.some(h => host === h || host.endsWith(`.${h}`));
}

/**
 * Sweeps every URL-bearing surface the site actually emits and reports any
 * that still carry a provisional hostname. With a production origin
 * configured this returns [] — with the fallback origin it returns the full
 * set, which is exactly why T17-1 blocks.
 */
export function hostnameLeaks(): UrlLeak[] {
  const leaks: UrlLeak[] = [];
  const push = (surface: UrlLeak["surface"], path: string, url: string) => {
    if (leaksIn(url)) leaks.push({ surface, path, url });
  };

  for (const path of indexablePaths()) {
    push("sitemap", path, absoluteUrl(path));
  }
  for (const record of indexableRecords()) {
    const preview = socialPreviewFor(record);
    push("canonical", record.path, preview.canonical);
    push("open-graph", record.path, preview.ogUrl);
    push("open-graph", record.path, preview.image);
    for (const graph of graphForRecord(record)) {
      for (const value of JSON.stringify(graph).matchAll(/"(https?:\/\/[^"]+)"/g)) {
        push("schema", record.path, value[1]!);
      }
    }
  }
  for (const id of Object.values(ENTITY_ID)) push("schema", "/", id);
  push("open-graph", "/", SOCIAL_CARD.url);
  for (const answer of ANSWERS.slice(0, 5)) {
    for (const asset of assetsFor(answer)) push("share", `/answers/${answer.slug}`, asset.url);
  }
  return leaks;
}

export interface DomainPackage {
  generatedAt: string;
  origin: string;
  originStatus: ReturnType<typeof canonicalOriginStatus>;
  hostPolicy: typeof HOST_POLICY;
  redirects: HostRedirect[];
  leaks: UrlLeak[];
  leakSurfaces: string[];
  urlsChecked: number;
  status: DomainStatus;
  blockers: string[];
}

export function buildDomainPackage(now: Date = new Date()): DomainPackage {
  const originStatus = canonicalOriginStatus();
  const leaks = hostnameLeaks();
  const redirects = provisionalHostRedirects();
  const blockers: string[] = [];
  if (originStatus.status !== "PASS") blockers.push(originStatus.detail);
  if (leaks.length > 0) {
    blockers.push(`${leaks.length} emitted URLs still resolve to a provisional Lovable hostname.`);
  }
  if (originStatus.status === "PASS" && redirects.length === 0) {
    blockers.push("No provisional-host redirect plan generated.");
  }

  return {
    generatedAt: now.toISOString(),
    origin: PUBLIC_SITE_ORIGIN,
    originStatus,
    hostPolicy: HOST_POLICY,
    redirects,
    leaks,
    leakSurfaces: [...new Set(leaks.map(l => l.surface))],
    urlsChecked: indexablePaths().length + indexableRecords().length * 3,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    blockers,
  };
}
