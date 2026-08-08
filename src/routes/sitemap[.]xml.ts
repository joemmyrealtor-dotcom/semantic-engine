import { createFileRoute } from "@tanstack/react-router";
import { CITY_GUIDES } from "@/lib/marketing/cities";
import { GUIDES } from "@/lib/marketing/lead-magnets";
import { ASSESSMENTS } from "@/lib/marketing/assessments";
import { PROFESSIONAL_AUDIENCES } from "@/lib/partners/pages";
import { INDEXABLE_STATIC_PATHS } from "@/lib/marketing/indexation";
import { PUBLIC_SITE_ORIGIN } from "@/lib/marketing/site";
import type {} from "@tanstack/react-start";

// SEO/AEO hardening: the sitemap lists indexable public marketing URLs only.
// The governed console ("/"), operator/admin surfaces, the referral intake
// form, and auth routes are intentionally excluded — they are working
// software, not search landing pages. No <lastmod> is emitted because the
// project has no authoritative per-page modification timestamp.

const BASE_URL = PUBLIC_SITE_ORIGIN;

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const STATIC_META: Record<string, { changefreq: SitemapEntry["changefreq"]; priority: string }> = {
  "/home": { changefreq: "weekly", priority: "1.0" },
  "/sellers": { changefreq: "weekly", priority: "0.9" },
  "/buyers": { changefreq: "weekly", priority: "0.9" },
  "/probate": { changefreq: "weekly", priority: "0.9" },
  "/inherited-property": { changefreq: "weekly", priority: "0.9" },
  "/downsizing": { changefreq: "weekly", priority: "0.8" },
  "/distressed-property": { changefreq: "weekly", priority: "0.9" },
  "/investing": { changefreq: "weekly", priority: "0.8" },
  "/resources": { changefreq: "weekly", priority: "0.8" },
  "/guides": { changefreq: "weekly", priority: "0.9" },
  "/assessments": { changefreq: "monthly", priority: "0.9" },
  "/local-guides": { changefreq: "weekly", priority: "0.8" },
  "/about": { changefreq: "monthly", priority: "0.6" },
  "/contact": { changefreq: "monthly", priority: "0.7" },
  "/editorial-policy": { changefreq: "yearly", priority: "0.5" },
  "/attorney-partners": { changefreq: "monthly", priority: "0.8" },
  "/privacy": { changefreq: "yearly", priority: "0.3" },
  "/terms": { changefreq: "yearly", priority: "0.3" },
  "/accessibility": { changefreq: "yearly", priority: "0.3" },
  "/disclaimer": { changefreq: "yearly", priority: "0.3" },
};

export function sitemapEntries(): SitemapEntry[] {
  return [
    ...INDEXABLE_STATIC_PATHS.map(path => ({
      path,
      ...(STATIC_META[path] ?? { changefreq: "monthly" as const, priority: "0.5" }),
    })),
    ...PROFESSIONAL_AUDIENCES.map(a => ({
      path: `/for/${a}`,
      changefreq: "monthly" as const,
      priority: "0.7",
    })),
    ...GUIDES.map(g => ({
      path: `/guides/${g.slug}`,
      changefreq: "monthly" as const,
      priority: "0.8",
    })),
    ...ASSESSMENTS.map(a => ({
      path: `/assessments/${a.slug}`,
      changefreq: "monthly" as const,
      priority: "0.8",
    })),
    ...CITY_GUIDES.map(c => ({
      path: `/local-guides/${c.slug}`,
      changefreq: "weekly" as const,
      priority: "0.7",
    })),
  ];
}

export function sitemapXml(): string {
  const urls = sitemapEntries().map(e =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () =>
        new Response(sitemapXml(), {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
