// SEO/AEO hardening — one meta builder for every public, indexable page.
//
// Guarantees: single origin, explicit index directive, complete OG/Twitter
// share metadata, and a branded share card on every public page.

import { BRAND } from "./positioning";
import { PUBLIC_SITE_ORIGIN, SITE_LOCALE, SOCIAL_CARD, absoluteUrl } from "./site";

export const INDEXABLE_ROBOTS = "index,follow,max-image-preview:large,max-snippet:-1";
export const INTERNAL_ROBOTS = "noindex,nofollow";

export interface PublicMetaInput {
  path: string;
  title: string;
  description: string;
  type?: "website" | "article";
}

export interface HeadTag {
  [key: string]: string;
}

/** Meta tags shared by every public indexable page. */
export function publicMeta(input: PublicMetaInput): HeadTag[] {
  const url = absoluteUrl(input.path);
  return [
    { title: input.title },
    { name: "description", content: input.description },
    { name: "robots", content: INDEXABLE_ROBOTS },
    { name: "author", content: BRAND.advisor },
    { property: "og:site_name", content: BRAND.name },
    { property: "og:locale", content: SITE_LOCALE },
    { property: "og:title", content: input.title },
    { property: "og:description", content: input.description },
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:url", content: url },
    { property: "og:image", content: SOCIAL_CARD.url },
    { property: "og:image:width", content: SOCIAL_CARD.width },
    { property: "og:image:height", content: SOCIAL_CARD.height },
    { property: "og:image:alt", content: SOCIAL_CARD.alt },
    { property: "og:image:type", content: SOCIAL_CARD.type },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: input.title },
    { name: "twitter:description", content: input.description },
    { name: "twitter:image", content: SOCIAL_CARD.url },
    { name: "twitter:image:alt", content: SOCIAL_CARD.alt },
  ];
}

export function canonicalLink(path: string) {
  return { rel: "canonical", href: absoluteUrl(path) };
}

/** True when the given absolute URL uses the one configured public origin. */
export function isSameOrigin(url: string): boolean {
  return url.startsWith(`${PUBLIC_SITE_ORIGIN}/`) || url === PUBLIC_SITE_ORIGIN;
}
