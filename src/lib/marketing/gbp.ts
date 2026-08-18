// Google Business Profile authority system — prepared, not published.
//
// GBP is the strongest local entity signal we have, and it is also the
// easiest place to publish a claim we cannot support. Everything here is a
// template or a plan: no reviews, ratings, results, or client statements are
// generated, and nothing is posted to Google from this module.

import { canonicalOriginStatus, absoluteUrl } from "./site";
import { BRAND } from "./positioning";
import { LOCAL_PAGES } from "./local-pages";
import { GUIDES } from "./lead-magnets";
import { ASSESSMENTS } from "./assessments";
import type { ChecklistItem, ReadinessState } from "./discovery-readiness";

export const GBP_PRIMARY_CATEGORY = "Real estate consultant";

export const GBP_ADDITIONAL_CATEGORIES = [
  "Real estate agency",
  "Real estate agent",
  "Estate appraiser",
  "Property consultant",
] as const;

export const GBP_SERVICES = [
  { name: "Probate property consultation", description: "Court-timeline-aware guidance for personal representatives selling real property." },
  { name: "Inherited property planning", description: "Options review for heirs: keep, rent, buy out a sibling, or sell." },
  { name: "Downsizing and right-sizing consultation", description: "Sequencing, move logistics, and equity planning for later-life moves." },
  { name: "Distressed property options review", description: "Foreclosure timeline, short-sale, reinstatement, and sale comparison." },
  { name: "Seller advisory and pricing strategy", description: "Preparation, pricing, and net-proceeds planning." },
  { name: "Buyer advisory", description: "Search strategy, title-holding options, and offer structure." },
  { name: "Investor and 1031 consultation", description: "Exchange timelines, identification rules, and hold-versus-sell analysis." },
  { name: "Trust and LLC transaction support", description: "Coordination with attorneys, CPAs, and fiduciaries on entity-held property." },
] as const;

/** Service areas mirror the wave-one local footprint — no invented coverage. */
export function gbpServiceAreas(): string[] {
  return [...new Set(LOCAL_PAGES.map(p => p.place).filter(p => p !== "Orange County"))].sort();
}

export const GBP_DESCRIPTION = [
  `${BRAND.advisor} publishes ${BRAND.name} through ${BRAND.publisher}: decision guides, situation assessments, and local resources for Orange County property owners.`,
  "Work covers probate and inherited property, downsizing, distressed-property options, seller and buyer advisory, and coordination with attorneys, CPAs, and fiduciaries.",
  "Everything published is educational, sourced, and dated. Not legal, tax, or financial advice. Equal Housing Opportunity.",
].join(" ");

export interface GbpLink {
  label: string;
  url: string;
  placement: "website" | "appointment" | "services" | "posts";
}

export function gbpLinks(): GbpLink[] {
  return [
    { label: "Website", url: absoluteUrl("/home"), placement: "website" },
    { label: "Book a consultation", url: absoluteUrl("/contact"), placement: "appointment" },
    { label: "Guides", url: absoluteUrl("/guides"), placement: "services" },
    { label: "Assessments", url: absoluteUrl("/assessments"), placement: "services" },
    ...GUIDES.slice(0, 6).map(g => ({ label: g.title, url: absoluteUrl(`/guides/${g.slug}`), placement: "posts" as const })),
    ...ASSESSMENTS.slice(0, 6).map(a => ({ label: a.title, url: absoluteUrl(`/assessments/${a.slug}`), placement: "posts" as const })),
  ];
}

export interface PhotoPlanItem {
  category: string;
  count: number;
  guidance: string;
}

/** A plan, not an asset library. Nothing is generated or staged. */
export const GBP_PHOTO_PLAN: PhotoPlanItem[] = [
  { category: "Logo", count: 1, guidance: "Square, 720x720 minimum, transparent-safe brand mark." },
  { category: "Cover", count: 1, guidance: "1200x630 branded cover consistent with the site share card." },
  { category: "Team", count: 3, guidance: "Real photographs of the advisor. No stock imagery presented as the team." },
  { category: "At work", count: 6, guidance: "Consultations, document review, walkthroughs — with written permission from anyone identifiable." },
  { category: "Service area", count: 8, guidance: "Public streetscapes of served cities. No client property without written consent." },
  { category: "Collateral", count: 4, guidance: "Guide covers and assessment screens; no client data visible." },
];

export interface PostTemplate {
  week: number;
  type: "Update" | "Offer" | "Event";
  title: string;
  body: string;
  cta: string;
  url: string;
}

/** Deterministic 12-week rotation, each post anchored to a canonical page. */
export function weeklyPostTemplates(): PostTemplate[] {
  const anchors = LOCAL_PAGES.slice(0, 12);
  return anchors.map((spec, i) => ({
    week: i + 1,
    type: "Update" as const,
    title: spec.question.slice(0, 58),
    body: `${spec.directAnswer.split(". ").slice(0, 2).join(". ").trim()}. Written for ${spec.place}, with the decision path and what it costs. Educational only — not legal, tax, or financial advice.`,
    cta: "Read the decision guide",
    url: absoluteUrl(spec.path),
  }));
}

export interface ReviewRequestStep {
  id: string;
  label: string;
  detail: string;
}

/**
 * Review requests are solicited, never authored. No incentive, no gating on
 * sentiment, no drafting language on the client's behalf.
 */
export const GBP_REVIEW_WORKFLOW: ReviewRequestStep[] = [
  { id: "trigger", label: "Trigger", detail: "Request only after a completed engagement, logged manually by the advisor. No automated blast." },
  { id: "consent", label: "Consent", detail: "Ask permission before sending the request; record the answer." },
  { id: "channel", label: "Channel", detail: "One email or text containing the direct Google review link. One reminder maximum, seven days later." },
  { id: "neutrality", label: "Neutrality", detail: "Every client is asked, regardless of expected sentiment. No pre-screening, no incentives, no suggested wording." },
  { id: "response", label: "Response", detail: "Reply to every review within 72 hours. Negative reviews get a factual, non-defensive reply and an offline path." },
  { id: "record", label: "Record", detail: "Log request date and outcome only. Review text is never copied to the site without written permission from the author." },
];

export interface GbpPack {
  generatedAt: string;
  websiteUrl: string;
  appointmentUrl: string;
  primaryCategory: string;
  additionalCategories: readonly string[];
  services: readonly { name: string; description: string }[];
  serviceAreas: string[];
  description: string;
  links: GbpLink[];
  photoPlan: PhotoPlanItem[];
  posts: PostTemplate[];
  reviewWorkflow: ReviewRequestStep[];
  checklist: ChecklistItem[];
  status: ReadinessState;
  summary: string;
  blockers: string[];
  published: false;
}

export function buildGbpPack(now: Date = new Date()): GbpPack {
  const origin = canonicalOriginStatus();
  const blockers = origin.status === "PASS" ? [] : ["Final production domain is not active; the profile would publish the provisional website URL."];
  const areas = gbpServiceAreas();

  const checklist: ChecklistItem[] = [
    { id: "gbp-url", label: "Final website URL", detail: absoluteUrl("/home") },
    { id: "gbp-appointment", label: "Appointment URL", detail: absoluteUrl("/contact") },
    { id: "gbp-category", label: "Categories", detail: `Primary: ${GBP_PRIMARY_CATEGORY}. Additional: ${GBP_ADDITIONAL_CATEGORIES.join(", ")}.` },
    { id: "gbp-services", label: "Services", detail: `${GBP_SERVICES.length} services, each matching a published guide or local page.` },
    { id: "gbp-areas", label: "Service areas", detail: `${areas.length} cities mirroring the wave-one local footprint: ${areas.join(", ")}.` },
    { id: "gbp-description", label: "Business description", detail: `${GBP_DESCRIPTION.length} characters; no superlatives, guarantees, or results claims.` },
    { id: "gbp-links", label: "Guide and assessment links", detail: `${gbpLinks().length} canonical links, all pointing at the site.` },
    { id: "gbp-photos", label: "Photo plan", detail: `${GBP_PHOTO_PLAN.reduce((n, p) => n + p.count, 0)} assets planned across ${GBP_PHOTO_PLAN.length} categories. Consent required for anyone identifiable.` },
    { id: "gbp-posts", label: "Weekly post templates", detail: `${weeklyPostTemplates().length}-week rotation, each anchored to a canonical page.` },
    { id: "gbp-reviews", label: "Review-request workflow", detail: "Solicited, never authored. No incentives, no sentiment gating." },
  ];

  return {
    generatedAt: now.toISOString(),
    websiteUrl: absoluteUrl("/home"),
    appointmentUrl: absoluteUrl("/contact"),
    primaryCategory: GBP_PRIMARY_CATEGORY,
    additionalCategories: GBP_ADDITIONAL_CATEGORIES,
    services: GBP_SERVICES,
    serviceAreas: areas,
    description: GBP_DESCRIPTION,
    links: gbpLinks(),
    photoPlan: GBP_PHOTO_PLAN,
    posts: weeklyPostTemplates(),
    reviewWorkflow: GBP_REVIEW_WORKFLOW,
    checklist: origin.status === "PASS" ? checklist : checklist.map(c => ({ ...c, blockedBy: blockers[0] })),
    status: blockers.length === 0 ? "REVIEW" : "BLOCKED",
    summary: `${GBP_SERVICES.length} services · ${areas.length} service areas · ${weeklyPostTemplates().length} post templates. Profile is prepared, not published.`,
    blockers,
    published: false,
  };
}
