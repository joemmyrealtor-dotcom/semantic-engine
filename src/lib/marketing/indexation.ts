// SEO/AEO hardening — indexation boundary.
//
// The governed console ("/") and every internal/admin/operator route are
// working software, not search landing pages. The root route emits
// noindex,nofollow by default; public marketing routes override it with an
// explicit index directive (TanStack merges meta by name, last match wins).
//
// This module holds the declarative list so tests and the sitemap agree.

import { CITY_GUIDES } from "./cities";
import { GUIDES } from "./lead-magnets";
import { ASSESSMENTS } from "./assessments";
import { PROFESSIONAL_AUDIENCES } from "@/lib/partners/pages";

/** Static public pages that should rank. Ordered roughly by priority. */
export const INDEXABLE_STATIC_PATHS: string[] = [
  "/home",
  "/sellers",
  "/buyers",
  "/probate",
  "/inherited-property",
  "/downsizing",
  "/distressed-property",
  "/investing",
  "/resources",
  "/guides",
  "/assessments",
  "/local-guides",
  "/about",
  "/contact",
  "/editorial-policy",
  "/attorney-partners",
  "/privacy",
  "/terms",
  "/accessibility",
  "/disclaimer",
];

/**
 * Public routes deliberately kept out of the sitemap and out of the index:
 * the governed console, the operator surfaces, and the referral intake form
 * (a private professional workflow, not an organic landing page).
 */
export const NON_INDEXABLE_PUBLIC_PATHS: string[] = ["/", "/refer", "/auth", "/reset-password"];

export function indexablePaths(): string[] {
  return [
    ...INDEXABLE_STATIC_PATHS,
    ...PROFESSIONAL_AUDIENCES.map(a => `/for/${a}`),
    ...GUIDES.map(g => `/guides/${g.slug}`),
    ...ASSESSMENTS.map(a => `/assessments/${a.slug}`),
    ...CITY_GUIDES.map(c => `/local-guides/${c.slug}`),
  ];
}

export function isIndexablePath(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return indexablePaths().includes(clean);
}
