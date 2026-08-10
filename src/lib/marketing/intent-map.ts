// Search Authority Gate — canonical search intent map.
//
// One record per public URL. This is the SEO source of truth: every other
// module in the authority pack (cannibalization, internal PageRank, quality
// gate, lifecycle review) reads from here rather than re-deriving page facts.
//
// Nothing here is an observed search metric. Keywords are declared targets,
// not measured demand; measured demand lives in search-evidence.ts.

import { ANSWERS, answerFacet, metaTitleFor } from "./answers";
import { ASSESSMENTS } from "./assessments";
import { CITY_GUIDES } from "./cities";
import { indexablePaths, NON_INDEXABLE_PUBLIC_PATHS } from "./indexation";
import { GUIDES } from "./lead-magnets";
import { LOCAL_PAGES } from "./local-pages";
import { ENTRY_PATHS } from "./positioning";
import { absoluteUrl } from "./site";
import { PROFESSIONAL_PAGES } from "@/lib/partners/pages";

/** The date this map was last reviewed by a human editor. */
export const SEO_REVIEW_DATE = "2026-08-09";

export type PageType =
  | "home"
  | "situation-pillar"
  | "library-hub"
  | "local-hub"
  | "local-topic-hub"
  | "local-city"
  | "local-market-index"
  | "city-guide"
  | "guide"
  | "answer"
  | "assessment"
  | "professional"
  | "trust"
  | "utility";

export type SearchIntent = "informational" | "commercial" | "transactional" | "navigational";
export type FunnelStage = "awareness" | "consideration" | "decision" | "conversion";
export type GeographicIntent = "none" | "county" | "city";

export interface SearchIntentRecord {
  path: string;
  url: string;
  pageType: PageType;
  title: string;
  h1: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  intent: SearchIntent;
  geographicIntent: GeographicIntent;
  place: string | null;
  funnelStage: FunnelStage;
  /** Path of the parent hub. Null only for the site root of the tree. */
  parentHub: string | null;
  supportingPages: string[];
  guideSlug: string | null;
  assessmentSlug: string | null;
  cta: string;
  schemaTypes: string[];
  indexable: boolean;
  lastReviewed: string;
}

const BASE_SCHEMA = ["Organization", "WebSite", "RealEstateAgent", "BreadcrumbList"];

function record(partial: Partial<SearchIntentRecord> & Pick<SearchIntentRecord, "path" | "pageType" | "title" | "primaryKeyword">): SearchIntentRecord {
  return {
    url: absoluteUrl(partial.path),
    h1: partial.h1 ?? partial.title,
    secondaryKeywords: partial.secondaryKeywords ?? [],
    intent: partial.intent ?? "informational",
    geographicIntent: partial.geographicIntent ?? "none",
    place: partial.place ?? null,
    funnelStage: partial.funnelStage ?? "awareness",
    parentHub: partial.parentHub ?? "/home",
    supportingPages: partial.supportingPages ?? [],
    guideSlug: partial.guideSlug ?? null,
    assessmentSlug: partial.assessmentSlug ?? null,
    cta: partial.cta ?? "Book a strategy call",
    schemaTypes: partial.schemaTypes ?? BASE_SCHEMA,
    indexable: partial.indexable ?? true,
    lastReviewed: partial.lastReviewed ?? SEO_REVIEW_DATE,
    ...partial,
  } as SearchIntentRecord;
}

/** Hand-authored records for the static surfaces. */
function staticRecords(): SearchIntentRecord[] {
  return [
    record({
      path: "/home",
      pageType: "home",
      title: "Legacy Forge — Orange County real estate decision guidance",
      h1: "Real estate decisions, made with the whole picture in front of you",
      primaryKeyword: "orange county real estate advisor",
      secondaryKeywords: ["real estate guidance orange county", "probate and inherited property advisor"],
      intent: "commercial",
      geographicIntent: "county",
      place: "Orange County",
      funnelStage: "awareness",
      parentHub: null,
      supportingPages: ENTRY_PATHS.map(e => e.to),
      schemaTypes: [...BASE_SCHEMA, "ItemList"],
    }),
    record({
      path: "/resources",
      pageType: "library-hub",
      title: "Resource library",
      primaryKeyword: "real estate guides orange county",
      funnelStage: "consideration",
      supportingPages: ["/guides", "/answers", "/assessments"],
      schemaTypes: [...BASE_SCHEMA, "ItemList"],
    }),
    record({
      path: "/guides",
      pageType: "library-hub",
      title: "Downloadable guides",
      primaryKeyword: "real estate guide download",
      funnelStage: "consideration",
      parentHub: "/resources",
      supportingPages: GUIDES.map(g => `/guides/${g.slug}`),
      schemaTypes: [...BASE_SCHEMA, "ItemList"],
    }),
    record({
      path: "/answers",
      pageType: "library-hub",
      title: "Seller and buyer questions, answered",
      primaryKeyword: "home selling questions answered",
      funnelStage: "awareness",
      parentHub: "/resources",
      supportingPages: ANSWERS.slice(0, 12).map(a => `/answers/${a.slug}`),
      schemaTypes: [...BASE_SCHEMA, "ItemList"],
    }),
    record({
      path: "/assessments",
      pageType: "library-hub",
      title: "Readiness assessments",
      primaryKeyword: "home selling readiness assessment",
      intent: "commercial",
      funnelStage: "decision",
      parentHub: "/resources",
      supportingPages: ASSESSMENTS.map(a => `/assessments/${a.slug}`),
      schemaTypes: [...BASE_SCHEMA, "ItemList"],
    }),
    // Parent of the two local surfaces. /local owns the DECISION query — a
    // person with a situation looking for help in a place. It is commercial,
    // county-level, and hands off to city situation pages.
    record({
      path: "/local",
      pageType: "local-hub",
      title: "Orange County situation guides by city",
      h1: "Local situation pages",
      primaryKeyword: "orange county real estate help by city",
      secondaryKeywords: ["probate help orange county", "inherited property help orange county"],
      intent: "commercial",
      geographicIntent: "county",
      place: "Orange County",
      funnelStage: "consideration",
      supportingPages: [
        ...LOCAL_PAGES.filter(p => p.level === "hub").map(p => p.path),
        "/local-guides",
      ],
      schemaTypes: [...BASE_SCHEMA, "ItemList"],
    }),
    // Child of /local, and deliberately NOT a second "help in Orange County"
    // page. It owns the RESEARCH query — what a single city's housing market
    // is doing — so it is informational, city-scoped, and carries no county
    // place token that would collide with the parent hub.
    record({
      path: "/local-guides",
      pageType: "local-market-index",
      title: "City housing market briefings",
      h1: "City housing market briefings",
      primaryKeyword: "city housing market briefing",
      secondaryKeywords: ["la habra housing market", "brea housing market", "fullerton housing market"],
      intent: "informational",
      geographicIntent: "city",
      place: null,
      funnelStage: "awareness",
      parentHub: "/local",
      supportingPages: CITY_GUIDES.map(c => `/local-guides/${c.slug}`),
      cta: "Read the briefing for your city",
      schemaTypes: [...BASE_SCHEMA, "ItemList"],
    }),

    record({
      path: "/about",
      pageType: "trust",
      title: "About JM Advisory Press",
      primaryKeyword: "jm advisory press",
      intent: "navigational",
      funnelStage: "consideration",
    }),
    record({
      path: "/contact",
      pageType: "utility",
      title: "Book a strategy call",
      primaryKeyword: "orange county real estate consultation",
      intent: "transactional",
      geographicIntent: "county",
      place: "Orange County",
      funnelStage: "conversion",
      cta: "Submit the consultation request",
    }),
    record({
      path: "/editorial-policy",
      pageType: "trust",
      title: "Editorial policy",
      primaryKeyword: "editorial policy",
      intent: "navigational",
      funnelStage: "consideration",
      cta: "Read the guide library",
    }),
    record({
      path: "/attorney-partners",
      pageType: "professional",
      title: "Attorney partners",
      primaryKeyword: "probate attorney real estate partner orange county",
      intent: "commercial",
      geographicIntent: "county",
      place: "Orange County",
      funnelStage: "decision",
      parentHub: "/for/attorneys",
      cta: "Request the resource kit",
    }),
    ...["/privacy", "/terms", "/accessibility", "/disclaimer"].map(path =>
      record({
        path,
        pageType: "utility",
        title: path.replace("/", "").replace(/^./, c => c.toUpperCase()),
        primaryKeyword: path.replace("/", ""),
        intent: "navigational",
        funnelStage: "awareness",
        cta: "Return to the guide library",
        schemaTypes: ["BreadcrumbList"],
      }),
    ),
  ];
}

function pillarRecords(): SearchIntentRecord[] {
  return ENTRY_PATHS.map(entry => {
    const guide = GUIDES.find(g => g.situation === entry.id) ?? null;
    const assessment = ASSESSMENTS.find(a => a.situation === entry.id) ?? null;
    const localChildren = LOCAL_PAGES.filter(p => p.pillarPath === entry.to).map(p => p.path);
    const localHub = LOCAL_PAGES.find(p => p.pillarPath === entry.to && p.level === "hub")?.path ?? null;
    const topic = entry.id.replace(/-/g, " ");
    // Where a local topic hub exists it owns the Orange County commercial query.
    // The pillar then holds the statewide, explanatory query so the two never
    // compete for the same result.
    const statewide = localHub !== null;
    return record({
      path: entry.to,
      pageType: "situation-pillar",
      title: entry.question,
      h1: entry.label.replace(/^I'm |^I /, "").replace(/^./, c => c.toUpperCase()),
      primaryKeyword: statewide ? `${topic} california explained` : `${topic} orange county`,
      secondaryKeywords: statewide
        ? [`how ${topic} works california`, `${topic} process steps`, `${topic} checklist`]
        : [topic, `${topic} help california`],
      intent: statewide ? "informational" : "commercial",
      geographicIntent: statewide ? "none" : "county",
      place: statewide ? null : "Orange County",
      funnelStage: statewide ? "awareness" : "consideration",
      parentHub: "/home",
      supportingPages: [
        ...(guide ? [`/guides/${guide.slug}`] : []),
        ...(assessment ? [`/assessments/${assessment.slug}`] : []),
        ...(localHub ? [localHub] : []),
        ...localChildren.filter(p => p !== localHub).slice(0, 3),
      ],
      guideSlug: guide?.slug ?? null,
      assessmentSlug: assessment?.slug ?? null,
      cta: statewide ? "Download the situation guide" : "Book a strategy call",
      schemaTypes: [...BASE_SCHEMA, "FAQPage", "ItemList"],
    });
  });
}


function localRecords(): SearchIntentRecord[] {
  return LOCAL_PAGES.map(page => {
    const isHub = page.level === "hub";
    return record({
      path: page.path,
      pageType: isHub ? "local-topic-hub" : "local-city",
      title: page.metaTitle,
      h1: page.question,
      primaryKeyword: `${page.clusterLabel.toLowerCase()} ${page.place.toLowerCase()}`,
      secondaryKeywords: page.paa.slice(0, 3).map(p => p.q),
      intent: "commercial",
      geographicIntent: isHub ? "county" : "city",
      place: page.place,
      funnelStage: isHub ? "consideration" : "decision",
      parentHub: isHub ? "/local" : `/local/${page.cluster}`,
      supportingPages: isHub
        ? LOCAL_PAGES.filter(p => p.cluster === page.cluster && p.level === "city").map(p => p.path)
        : [page.pillarPath, `/guides/${page.guideSlug}`, `/assessments/${page.assessmentSlug}`],
      guideSlug: page.guideSlug,
      assessmentSlug: page.assessmentSlug,
      cta: page.nextStep,
      schemaTypes: [...BASE_SCHEMA, "Article", "FAQPage"],
    });
  });
}

function guideRecords(): SearchIntentRecord[] {
  return GUIDES.map(guide =>
    record({
      path: `/guides/${guide.slug}`,
      pageType: "guide",
      title: guide.metaTitle,
      h1: guide.title,
      primaryKeyword: guide.slug.replace(/-/g, " "),
      secondaryKeywords: [guide.audience.toLowerCase()],
      intent: "commercial",
      funnelStage: "decision",
      parentHub: `/${guide.situation}`,
      supportingPages: [`/assessments/${guide.assessmentSlug}`, `/${guide.situation}`],
      guideSlug: guide.slug,
      assessmentSlug: guide.assessmentSlug,
      cta: guide.primaryCta,
      schemaTypes: [...BASE_SCHEMA, "Article"],
    }),
  );
}

function answerRecords(): SearchIntentRecord[] {
  return ANSWERS.map(answer => {
    // Facet, not cluster. Inheriting the cluster label gave every sibling the
    // same secondary keywords, intent, stage, and CTA, which is what put two
    // representation questions into a critical overlap.
    const facet = answerFacet(answer);
    const stem = answer.question.toLowerCase().replace(/[?"']/g, "").replace(/^(what|how|should|do|can|is|when|why)\s+/i, "").trim();
    return record({
      path: `/answers/${answer.slug}`,
      pageType: "answer",
      title: metaTitleFor(answer),
      h1: answer.question,
      primaryKeyword: answer.question.toLowerCase().replace(/[?"']/g, "").trim(),
      secondaryKeywords: facet.modifiers.map(m => `${stem} ${m}`.slice(0, 70)),
      intent: facet.intent,
      funnelStage: facet.funnelStage,
      parentHub: "/answers",
      supportingPages: [`/${answer.situation}`, `/guides/${answer.guideSlug}`],
      guideSlug: answer.guideSlug,
      assessmentSlug: answer.assessmentSlug,
      cta: facet.cta,
      schemaTypes: [...BASE_SCHEMA, "Article", "FAQPage"],
    });
  });
}


function assessmentRecords(): SearchIntentRecord[] {
  return ASSESSMENTS.map(a =>
    record({
      path: `/assessments/${a.slug}`,
      pageType: "assessment",
      title: a.metaTitle,
      h1: a.title,
      primaryKeyword: a.slug.replace(/-/g, " "),
      intent: "transactional",
      funnelStage: "conversion",
      parentHub: `/${a.situation}`,
      supportingPages: [`/guides/${a.guideSlug}`, `/${a.situation}`],
      guideSlug: a.guideSlug,
      assessmentSlug: a.slug,
      cta: "See your readiness result",
      schemaTypes: [...BASE_SCHEMA, "Article"],
    }),
  );
}

function cityGuideRecords(): SearchIntentRecord[] {
  return CITY_GUIDES.map(city =>
    record({
      path: `/local-guides/${city.slug}`,
      pageType: "city-guide",
      title: city.metaTitle,
      h1: `${city.city} real estate guide`,
      primaryKeyword: `${city.city.toLowerCase()} real estate market`,
      secondaryKeywords: city.situations.slice(0, 2).map(s => `${s.title.toLowerCase()} ${city.city.toLowerCase()}`),
      geographicIntent: "city",
      place: city.city,
      funnelStage: "awareness",
      parentHub: "/local-guides",
      supportingPages: city.situations.map(s => s.to),
      schemaTypes: [...BASE_SCHEMA, "FAQPage", "ItemList"],
    }),
  );
}

function professionalRecords(): SearchIntentRecord[] {
  return Object.values(PROFESSIONAL_PAGES).map(page =>
    record({
      path: `/for/${page.slug}`,
      pageType: "professional",
      title: page.metaTitle,
      h1: page.title,
      primaryKeyword: `real estate partner for ${page.slug.replace(/-/g, " ")} orange county`,
      intent: "commercial",
      geographicIntent: "county",
      place: "Orange County",
      funnelStage: "decision",
      parentHub: "/home",
      cta: "Request the resource kit",
    }),
  );
}

function privateRecords(): SearchIntentRecord[] {
  return NON_INDEXABLE_PUBLIC_PATHS.map(path =>
    record({
      path,
      pageType: "utility",
      title: path === "/" ? "Legacy Forge governed console" : path.replace("/", ""),
      primaryKeyword: "",
      intent: "navigational",
      funnelStage: "awareness",
      parentHub: null,
      indexable: false,
      cta: "None — internal surface",
      schemaTypes: [],
    }),
  );
}

let cache: SearchIntentRecord[] | null = null;

/** Every public URL, indexable and not. The SEO source of truth. */
export function intentMap(): SearchIntentRecord[] {
  if (cache) return cache;
  cache = [
    ...staticRecords(),
    ...pillarRecords(),
    ...localRecords(),
    ...guideRecords(),
    ...answerRecords(),
    ...assessmentRecords(),
    ...cityGuideRecords(),
    ...professionalRecords(),
    ...privateRecords(),
  ];
  return cache;
}

export function indexableRecords(): SearchIntentRecord[] {
  return intentMap().filter(r => r.indexable);
}

export function getIntentRecord(path: string): SearchIntentRecord | undefined {
  const clean = path.replace(/\/+$/, "") || "/";
  return intentMap().find(r => r.path === clean);
}

/** Indexable sitemap paths that have no canonical intent record — must be empty. */
export function missingIntentRecords(): string[] {
  const known = new Set(intentMap().map(r => r.path));
  return indexablePaths().filter(p => !known.has(p));
}

/** Intent records that claim indexability but are absent from the sitemap. */
export function orphanIntentRecords(): string[] {
  const sitemap = new Set(indexablePaths());
  return indexableRecords()
    .map(r => r.path)
    .filter(p => !sitemap.has(p));
}
