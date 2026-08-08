// Shared head() builder for public marketing routes.
//
// SEO/AEO hardening: every public page gets one canonical origin, an
// explicit index directive, complete OG/Twitter metadata with a branded
// share card, the shared entity graph, breadcrumbs that mirror the visible
// trail, and FAQ schema that mirrors visible Q&A only.

import { PUBLIC_PAGES } from "./content";
import { publicMeta, canonicalLink } from "./seo";
import { breadcrumbGraph, faqGraph, jsonLdScript, siteGraph, type Crumb } from "./schema";

/** Visible + structured breadcrumb trail for a registry page. */
export function publicCrumbs(key: string): Crumb[] {
  const page = PUBLIC_PAGES[key];
  if (!page) return [{ name: "Home", path: "/home" }];
  return [
    { name: "Home", path: "/home" },
    { name: page.navLabel, path: page.slug },
  ];
}

export function publicHead(key: string) {
  const page = PUBLIC_PAGES[key];
  if (!page) throw new Error(`Unknown public page: ${key}`);

  const scripts = [jsonLdScript(siteGraph()), jsonLdScript(breadcrumbGraph(publicCrumbs(key)))];
  if (page.faqs.length > 0) scripts.push(jsonLdScript(faqGraph(page.slug, page.faqs)));

  return {
    meta: publicMeta({
      path: page.slug,
      title: page.metaTitle,
      description: page.metaDescription,
    }),
    links: [canonicalLink(page.slug)],
    scripts,
  };
}
