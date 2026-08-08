// SEO/AEO hardening — internal linking / topic clusters.
//
// One data source for two-way links between pillar pages, city guides,
// downloadable guides, and assessments. Components read from here so no
// route hardcodes a duplicate list, and every anchor is descriptive.

import { CITY_GUIDES } from "./cities";
import { GUIDES } from "./lead-magnets";
import { ASSESSMENTS } from "./assessments";
import { ENTRY_PATHS, type EntryPathId } from "./positioning";

export interface RelatedLink {
  /** Descriptive anchor text — never "learn more". */
  label: string;
  to: string;
  description: string;
  kind: "pillar" | "city" | "guide" | "assessment" | "hub";
}

export function pillarLink(situation: EntryPathId): RelatedLink | null {
  const entry = ENTRY_PATHS.find(e => e.id === situation);
  if (!entry) return null;
  return {
    label: `${entry.label.replace(/^I'm /, "").replace(/^I /, "")} — the full plan`.replace(
      /^./,
      c => c.toUpperCase(),
    ),
    to: entry.to,
    description: entry.promiseLine,
    kind: "pillar",
  };
}

export function guideLinksFor(situation: EntryPathId): RelatedLink[] {
  return GUIDES.filter(g => g.situation === situation).map(g => ({
    label: g.title,
    to: `/guides/${g.slug}`,
    description: g.promise,
    kind: "guide" as const,
  }));
}

export function assessmentLinksFor(situation: EntryPathId): RelatedLink[] {
  return ASSESSMENTS.filter(a => a.situation === situation).map(a => ({
    label: a.title,
    to: `/assessments/${a.slug}`,
    description: a.description,
    kind: "assessment" as const,
  }));
}

/** City guides that explicitly cover this situation, capped for scannability. */
export function cityLinksFor(situation: EntryPathId, limit = 6): RelatedLink[] {
  const entry = ENTRY_PATHS.find(e => e.id === situation);
  return CITY_GUIDES.filter(c =>
    entry ? c.situations.some(s => s.to === entry.to) : true,
  )
    .slice(0, limit)
    .map(c => ({
      label: `${c.city} real estate guide`,
      to: `/local-guides/${c.slug}`,
      description: c.metaDescription,
      kind: "city" as const,
    }));
}

/** Pillar-page cluster: guides, assessment, and the local guides it serves. */
export function pillarCluster(situation: EntryPathId): RelatedLink[] {
  return [
    ...guideLinksFor(situation),
    ...assessmentLinksFor(situation),
    ...cityLinksFor(situation, 4),
    {
      label: "All Orange County local guides",
      to: "/local-guides",
      description: "Submarket-by-submarket decision context across the county.",
      kind: "hub" as const,
    },
  ];
}

/** Guide-page cluster: back to the pillar, its assessment, and local hub. */
export function guideCluster(situation: EntryPathId, assessmentSlug?: string): RelatedLink[] {
  const links: RelatedLink[] = [];
  const pillar = pillarLink(situation);
  if (pillar) links.push(pillar);
  const assessment = ASSESSMENTS.find(a => a.slug === assessmentSlug);
  if (assessment) {
    links.push({
      label: assessment.title,
      to: `/assessments/${assessment.slug}`,
      description: assessment.description,
      kind: "assessment",
    });
  }
  links.push(...cityLinksFor(situation, 3));
  return links;
}

/** City-page cluster: the situation pillars plus the county hub. */
export function cityCluster(citySlug: string): RelatedLink[] {
  const city = CITY_GUIDES.find(c => c.slug === citySlug);
  const links: RelatedLink[] = ENTRY_PATHS.filter(e =>
    city ? city.situations.some(s => s.to === e.to) : true,
  ).map(e => ({
    label: `${e.label.replace(/^I'm /, "").replace(/^I /, "")} in ${city?.city ?? "Orange County"}`,
    to: e.to,
    description: e.promiseLine,
    kind: "pillar" as const,
  }));
  links.push({
    label: "Every Orange County submarket we cover",
    to: "/local-guides",
    description: "Compare buyer pools, housing stock, and probate venue across the county.",
    kind: "hub",
  });
  return links;
}
