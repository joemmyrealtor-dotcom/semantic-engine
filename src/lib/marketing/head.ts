// Shared head() builder for public marketing routes.

import { PUBLIC_PAGES } from "./content";
import { BRAND } from "./positioning";

export function publicHead(key: string) {
  const page = PUBLIC_PAGES[key];
  if (!page) throw new Error(`Unknown public page: ${key}`);
  const url = `${BRAND.origin}${page.slug}`;
  const scripts: { type: string; children: string }[] = [];

  if (page.faqs.length > 0) {
    scripts.push({
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: page.faqs.map(f => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }),
    });
  }

  scripts.push({
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BRAND.origin}/home` },
        { "@type": "ListItem", position: 2, name: page.navLabel, item: url },
      ],
    }),
  });

  return {
    meta: [
      { title: page.metaTitle },
      { name: "description", content: page.metaDescription },
      { property: "og:title", content: page.metaTitle },
      { property: "og:description", content: page.metaDescription },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
      ...(page.legal ? [{ name: "robots", content: "index,follow" }] : []),
    ],
    links: [{ rel: "canonical", href: url }],
    scripts,
  };
}
