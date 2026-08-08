// SEO/AEO hardening — reusable schema.org graph.
//
// Rules enforced here:
//  * Only facts that already exist in this repository are emitted.
//  * No address, geo, hours, telephone, price, review, rating, award, or
//    social profile is invented. If the repository does not hold it, it is
//    simply absent — an incomplete graph beats a fabricated one.
//  * Every node carries a stable @id from site.ts so pages merge cleanly.

import { BRAND, CORE_PROMISE } from "./positioning";
import { ENTITY_ID, PUBLIC_SITE_ORIGIN, SITE_LANGUAGE, SOCIAL_CARD, absoluteUrl } from "./site";

export type JsonLdNode = Record<string, unknown>;

/** Fields that must never appear in emitted schema (unverified in repo). */
export const FORBIDDEN_SCHEMA_KEYS = [
  "address",
  "streetAddress",
  "postalCode",
  "telephone",
  "geo",
  "openingHours",
  "openingHoursSpecification",
  "aggregateRating",
  "review",
  "priceRange",
  "award",
  "sameAs",
  "hasCredential",
] as const;

function websiteNode(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": ENTITY_ID.website,
    url: `${PUBLIC_SITE_ORIGIN}/home`,
    name: BRAND.name,
    description: CORE_PROMISE,
    inLanguage: SITE_LANGUAGE,
    publisher: { "@id": ENTITY_ID.organization },
  };
}

function organizationNode(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": ENTITY_ID.organization,
    name: BRAND.publisher,
    url: `${PUBLIC_SITE_ORIGIN}/home`,
    brand: { "@id": ENTITY_ID.brand },
    description:
      "Publisher of Legacy Forge, a governed library of educational real estate decision guides.",
  };
}

function brandNode(): JsonLdNode {
  return {
    "@type": "Brand",
    "@id": ENTITY_ID.brand,
    name: BRAND.name,
    slogan: CORE_PROMISE,
  };
}

function personNode(): JsonLdNode {
  return {
    "@type": "Person",
    "@id": ENTITY_ID.person,
    name: BRAND.advisor,
    worksFor: { "@id": ENTITY_ID.organization },
    knowsAbout: KNOWS_ABOUT,
  };
}

export const KNOWS_ABOUT = [
  "Residential real estate",
  "Probate and trust sales",
  "Inherited property",
  "Downsizing",
  "Foreclosure alternatives and short sales",
  "1031 exchanges",
  "Holding title and ownership structures",
];

/**
 * Service entity. areaServed describes where work is performed; it is
 * deliberately not a LocalBusiness and carries no address, so it never
 * implies a storefront in any city.
 */
function serviceNode(areaServed: readonly string[]): JsonLdNode {
  return {
    "@type": "RealEstateAgent",
    "@id": ENTITY_ID.service,
    name: `${BRAND.name} — ${BRAND.advisor}`,
    url: `${PUBLIC_SITE_ORIGIN}/home`,
    parentOrganization: { "@id": ENTITY_ID.organization },
    employee: { "@id": ENTITY_ID.person },
    knowsAbout: KNOWS_ABOUT,
    areaServed: areaServed.map(name => ({
      "@type": "AdministrativeArea",
      name,
      containedInPlace: { "@type": "AdministrativeArea", name: "Orange County, California" },
    })),
  };
}

/** The shared entity graph included on every public page. */
export function siteGraph(areaServed: readonly string[] = BRAND.serviceArea): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@graph": [websiteNode(), organizationNode(), brandNode(), personNode(), serviceNode(areaServed)],
  };
}

export interface Crumb {
  name: string;
  path: string;
}

/** BreadcrumbList aligned 1:1 with the visible breadcrumb trail. */
export function breadcrumbGraph(crumbs: Crumb[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(crumbs[crumbs.length - 1]?.path ?? "/home")}#breadcrumbs`,
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

export interface ArticleSchemaInput {
  path: string;
  headline: string;
  description: string;
  about?: string[];
  /** Only pass a real, deterministic source date. Never synthesize one. */
  datePublished?: string;
  dateModified?: string;
  isPartOfPath?: string;
}

/** Article/schema for guides and long-form content pages. */
export function articleGraph(input: ArticleSchemaInput): JsonLdNode {
  const url = absoluteUrl(input.path);
  const node: JsonLdNode = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: input.headline,
    description: input.description,
    inLanguage: SITE_LANGUAGE,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    isAccessibleForFree: true,
    author: { "@id": ENTITY_ID.person },
    publisher: { "@id": ENTITY_ID.organization },
    image: SOCIAL_CARD.url,
  };
  if (input.about?.length) {
    node["about"] = input.about.map(name => ({ "@type": "Thing", name }));
  }
  if (input.datePublished) node["datePublished"] = input.datePublished;
  if (input.dateModified) node["dateModified"] = input.dateModified;
  if (input.isPartOfPath) node["isPartOf"] = { "@id": absoluteUrl(input.isPartOfPath) };
  return node;
}

/** FAQ nodes mirror visible Q&A only — semantic clarity, not a rich-result play. */
export function faqGraph(path: string, faqs: { q: string; a: string }[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${absoluteUrl(path)}#faq`,
    inLanguage: SITE_LANGUAGE,
    mainEntity: faqs.map(f => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function jsonLdScript(node: JsonLdNode) {
  return { type: "application/ld+json", children: JSON.stringify(node) };
}
