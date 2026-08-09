// SEO/AEO hardening tests — indexation boundary, canonical origin, entity
// graph shape, and sitemap agreement.

import { describe, expect, it } from "vitest";
import {
  INDEXABLE_STATIC_PATHS,
  NON_INDEXABLE_PUBLIC_PATHS,
  indexablePaths,
  isIndexablePath,
} from "../indexation";
import { publicMeta, canonicalLink, INDEXABLE_ROBOTS } from "../seo";
import { siteGraph, breadcrumbGraph, articleGraph, faqGraph } from "../schema";
import { PUBLIC_SITE_ORIGIN, absoluteUrl, ENTITY_ID } from "../site";
import { GUIDES } from "../lead-magnets";
import { ASSESSMENTS } from "../assessments";
import { ANSWERS } from "@/lib/marketing/answers";
import { CITY_GUIDES } from "../cities";
import { PROFESSIONAL_AUDIENCES } from "@/lib/partners/pages";

describe("canonical origin", () => {
  it("has no trailing slash and is absolute https", () => {
    expect(PUBLIC_SITE_ORIGIN).toMatch(/^https:\/\/[^/]+$/);
  });

  it("builds absolute URLs from any path shape", () => {
    expect(absoluteUrl("/home")).toBe(`${PUBLIC_SITE_ORIGIN}/home`);
    expect(absoluteUrl("home")).toBe(`${PUBLIC_SITE_ORIGIN}/home`);
    expect(absoluteUrl("/")).toBe(`${PUBLIC_SITE_ORIGIN}/`);
  });

  it("derives every entity @id from the same origin", () => {
    for (const id of Object.values(ENTITY_ID)) {
      expect(id.startsWith(PUBLIC_SITE_ORIGIN)).toBe(true);
    }
  });
});

describe("indexation boundary", () => {
  it("never exposes the governed console route", () => {
    expect(indexablePaths()).not.toContain("/");
    expect(isIndexablePath("/")).toBe(false);
  });

  it("keeps operator and private routes out of the index", () => {
    for (const path of NON_INDEXABLE_PUBLIC_PATHS) {
      expect(isIndexablePath(path)).toBe(false);
    }
    for (const path of ["/admin/partners", "/admin/lead-delivery", "/marketing-analytics", "/governance"]) {
      expect(isIndexablePath(path)).toBe(false);
    }
  });

  it("covers every public marketing surface exactly once", () => {
    const paths = indexablePaths();
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.length).toBe(
      INDEXABLE_STATIC_PATHS.length +
        PROFESSIONAL_AUDIENCES.length +
        GUIDES.length +
        ANSWERS.length +
        ASSESSMENTS.length +
        CITY_GUIDES.length +
        LOCAL_PAGES.length,
    );
  });

  it("treats trailing slashes as the same path", () => {
    expect(isIndexablePath("/home/")).toBe(true);
  });
});

describe("public meta", () => {
  const meta = publicMeta({
    path: "/sellers",
    title: "Sell With a Plan | Legacy Forge",
    description: "A seller plan built around net proceeds, not list price.",
  });
  const get = (key: string) =>
    meta.find(m => ("name" in m && m.name === key) || ("property" in m && m.property === key));

  it("explicitly opts the page into indexing", () => {
    expect(get("robots")).toMatchObject({ content: INDEXABLE_ROBOTS });
    expect(INDEXABLE_ROBOTS).toContain("index");
    expect(INDEXABLE_ROBOTS).not.toContain("noindex");
  });

  it("self-references its own canonical and og:url", () => {
    expect(get("og:url")).toMatchObject({ content: absoluteUrl("/sellers") });
    expect(canonicalLink("/sellers")).toEqual({
      rel: "canonical",
      href: absoluteUrl("/sellers"),
    });
  });

  it("ships absolute social imagery and a card type", () => {
    const image = get("og:image") as { content: string } | undefined;
    expect(image?.content.startsWith("https://")).toBe(true);
    expect(get("twitter:card")).toMatchObject({ content: "summary_large_image" });
    expect(get("twitter:image")).toMatchObject({ content: image?.content });
  });

  it("carries a title and description on every public page", () => {
    expect(meta.find(m => "title" in m)).toBeTruthy();
    expect(get("description")).toBeTruthy();
  });
});

describe("entity graph", () => {
  it("emits a stable, cross-linked site graph", () => {
    const graph = siteGraph() as { "@graph": Array<{ "@type": string; "@id": string }> };
    const types = graph["@graph"].map(n => n["@type"]).flat();
    expect(types).toEqual(expect.arrayContaining(["Organization", "WebSite", "RealEstateAgent"]));
    const ids = graph["@graph"].map(n => n["@id"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("numbers breadcrumb positions from one", () => {
    const bc = breadcrumbGraph([
      { name: "Home", path: "/home" },
      { name: "Guides", path: "/guides" },
    ]) as { itemListElement: Array<{ position: number; item: string }> };
    expect(bc.itemListElement.map(i => i.position)).toEqual([1, 2]);
    expect(bc.itemListElement[1]?.item).toBe(absoluteUrl("/guides"));
  });

  it("attributes articles to the site publisher and author", () => {
    const article = articleGraph({
      path: "/guides/seller-net-proceeds",
      headline: "The Seller Net Proceeds Worksheet",
      description: "Model your real number before you list.",
    }) as Record<string, unknown>;
    expect(article["@type"]).toBe("Article");
    expect(article["mainEntityOfPage"]).toMatchObject({
      "@id": absoluteUrl("/guides/seller-net-proceeds"),
    });
    expect(article["author"]).toBeTruthy();
    expect(article["publisher"]).toBeTruthy();
  });

  it("builds FAQ nodes with accepted answers", () => {
    const faq = faqGraph("/sellers", [{ q: "How long does it take?", a: "Usually 30-45 days." }]) as {
      mainEntity: Array<{ "@type": string; acceptedAnswer: { text: string } }>;
    };
    expect(faq.mainEntity[0]?.["@type"]).toBe("Question");
    expect(faq.mainEntity[0]?.acceptedAnswer.text).toBe("Usually 30-45 days.");
  });
});
