// Gate 5 / Phase 5A1 — machine-readable origin manifest.
//
// Captures every origin-bearing public surface (canonical, sitemap entry,
// robots Sitemap reference, Open Graph URL + image, the seven stable entity
// @id values, and per-page JSON-LD) so the pre- and post-migration states can
// be hashed and diffed deterministically. Read-only: emits JSON to stdout or
// to --out=<path>.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { PUBLIC_SITE_ORIGIN, ENTITY_ID, SOCIAL_CARD, absoluteUrl, canonicalOriginStatus } from "../src/lib/marketing/site";
import { indexablePaths } from "../src/lib/marketing/indexation";
import { indexableRecords } from "../src/lib/marketing/intent-map";
import { socialPreviewFor } from "../src/lib/marketing/social-preview";
import { graphForRecord } from "../src/lib/marketing/rich-results";
import { hostnameLeaks } from "../src/lib/marketing/domain";

interface RouteEntry {
  path: string;
  canonical: string;
  sitemapUrl: string;
  ogUrl: string;
  ogImage: string;
  jsonLd: unknown[];
}

function robotsSitemapReference(): string[] {
  const txt = readFileSync(new URL("../public/robots.txt", import.meta.url), "utf8");
  return txt
    .split("\n")
    .filter(l => /^sitemap:/i.test(l.trim()))
    .map(l => l.trim());
}

export function buildManifest() {
  const sitemap = indexablePaths().map(p => ({ path: p, url: absoluteUrl(p) }));
  const routes: RouteEntry[] = indexableRecords()
    .map(record => {
      const preview = socialPreviewFor(record);
      return {
        path: record.path,
        canonical: preview.canonical,
        sitemapUrl: absoluteUrl(record.path),
        ogUrl: preview.ogUrl,
        ogImage: preview.image,
        jsonLd: graphForRecord(record),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  const uniquePaths = [...new Set(routes.map(r => r.path))].sort();

  return {
    manifestVersion: "gate5-5A1/1.0",
    origin: PUBLIC_SITE_ORIGIN,
    originStatus: canonicalOriginStatus(),
    routeCount: routes.length,
    uniqueRouteCount: uniquePaths.length,
    sitemapCount: sitemap.length,
    robotsSitemapReference: robotsSitemapReference(),
    entityIds: ENTITY_ID,
    socialCardUrl: SOCIAL_CARD.url,
    sitemap,
    routes,
    provisionalLeakCount: hostnameLeaks().length,
    provisionalLeakSurfaces: [...new Set(hostnameLeaks().map(l => l.surface))].sort(),
  };
}

const manifest = buildManifest();
const json = JSON.stringify(manifest, null, 2);
const sha = createHash("sha256").update(json, "utf8").digest("hex");

const outArg = process.argv.find(a => a.startsWith("--out="));
if (outArg) {
  writeFileSync(outArg.slice("--out=".length), `${json}\n`);
}
console.log(
  JSON.stringify(
    {
      origin: manifest.origin,
      originStatus: manifest.originStatus.status,
      routeCount: manifest.routeCount,
      uniqueRouteCount: manifest.uniqueRouteCount,
      sitemapCount: manifest.sitemapCount,
      robotsSitemapReference: manifest.robotsSitemapReference,
      provisionalLeakCount: manifest.provisionalLeakCount,
      sha256: sha,
      out: outArg ? outArg.slice("--out=".length) : null,
    },
    null,
    2,
  ),
);
