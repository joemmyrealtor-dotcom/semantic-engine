// Task 26 — Professional entry pages.
//
// Peer-level content for each audience. These pages exist to make the
// professional's job easier, not to sell them anything.

import type { ProfessionalAudience } from "./schema";

export interface ProfessionalPage {
  audience: ProfessionalAudience;
  slug: ProfessionalAudience;
  navLabel: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  understanding: { heading: string; body: string }[];
  process: { step: string; detail: string }[];
  standards: string[];
  kitBlurb: string;
}

export const PROFESSIONAL_PAGES: Record<ProfessionalAudience, ProfessionalPage> = {
  attorneys: {
    audience: "attorneys",
    slug: "attorneys",
    navLabel: "Attorneys",
    title: "For Attorneys",
    metaTitle: "For Attorneys | Property Support for Probate, Trust & Family Law",
    metaDescription:
      "Property sequencing, valuation, and disposition support for Orange County probate, trust, estate, and family-law practices. Free resource kit, no reciprocity.",
    intro:
      "Your matter turns on an asset that cannot be divided, moved, or liquidated quickly. I handle the property side so the legal side is not waiting on it.",
    understanding: [
      {
        heading: "Authority comes before marketing",
        body: "Nothing is listed until the authority to sell is confirmed in writing and the notice requirements are understood. A property marketed ahead of authority creates exposure your client does not need.",
      },
      {
        heading: "Court and settlement calendars govern",
        body: "Listing, offer review, and closing steps are sequenced against the legal calendar rather than against a marketing calendar. I work backward from your dates.",
      },
      {
        heading: "Documentation is the deliverable",
        body: "Valuation basis, marketing evidence, offer log, and communication record are maintained so a disposition decision can be defended years later.",
      },
      {
        heading: "The family stays informed, you stay in control",
        body: "I do not give legal advice, and I route legal questions back to you rather than answering them.",
      },
    ],
    process: [
      { step: "Intake", detail: "Situation, authority, occupancy, condition, and the constraints you are working under." },
      { step: "Assessment", detail: "Written valuation basis, condition findings, and a realistic net-proceeds range." },
      { step: "Sequencing plan", detail: "A dated plan that fits your matter's calendar, with dependencies named." },
      { step: "Execution", detail: "Preparation, marketing, offer review, and closing coordination." },
      { step: "File record", detail: "The complete documentation package delivered to you and the client." },
    ],
    standards: [
      "No legal advice — ever, in any form",
      "No solicitation of your clients for unrelated business",
      "No referral fees paid or accepted",
      "Written scope before any work begins",
    ],
    kitBlurb:
      "Court-timeline worksheets, a property-readiness checklist, a dissolution options grid, and a client handout you can hand out today.",
  },
  "cpas-fiduciaries": {
    audience: "cpas-fiduciaries",
    slug: "cpas-fiduciaries",
    navLabel: "CPAs & Fiduciaries",
    title: "For CPAs and Professional Fiduciaries",
    metaTitle: "For CPAs & Fiduciaries | Documented Property Disposition Support",
    metaDescription:
      "Defensible valuation, marketing, and disposition documentation for CPAs and professional fiduciaries in Orange and Los Angeles County. Free professional resource kit.",
    intro:
      "You need the property facts to be right and the file to be defensible. That is the part I own.",
    understanding: [
      {
        heading: "Numbers before narrative",
        body: "Valuation basis, carrying cost, and realistic net proceeds are established and documented before any recommendation is made.",
      },
      {
        heading: "Tax questions belong to you",
        body: "I surface the property facts that affect basis, exclusions, and exchange feasibility, and leave the tax conclusions to you.",
      },
      {
        heading: "Fiduciary process, in writing",
        body: "Every disposition carries a written record of valuation, marketing exposure, offers received, and the reasoning behind the accepted offer.",
      },
      {
        heading: "Beneficiary communication is documented",
        body: "What was communicated, to whom, and when — kept in the file rather than in memory.",
      },
    ],
    process: [
      { step: "Fact gathering", detail: "Acquisition history, improvements, occupancy, and current condition." },
      { step: "Valuation basis", detail: "Written comparables and methodology, dated." },
      { step: "Options analysis", detail: "Hold, improve-and-sell, sell as-is, or exchange — modeled honestly." },
      { step: "Execution", detail: "Marketing with documented exposure and an offer log." },
      { step: "Closing file", detail: "The complete record delivered for your working papers." },
    ],
    standards: [
      "No tax advice",
      "No referral fees paid or accepted",
      "Written valuation methodology on every engagement",
      "Complete file delivered whether or not a sale occurs",
    ],
    kitBlurb:
      "A basis-and-timing discussion guide, the fiduciary property file standard, and a property-readiness checklist.",
  },
  "financial-advisors": {
    audience: "financial-advisors",
    slug: "financial-advisors",
    navLabel: "Financial Advisors",
    title: "For Financial Advisors",
    metaTitle: "For Financial Advisors | Modeling the Property on the Balance Sheet",
    metaDescription:
      "Property equity analysis, hold-versus-sell frameworks, and disposition support for Orange County financial advisors. Free professional resource kit.",
    intro:
      "The house is usually the largest position your client holds and the only one nobody has modeled. I can give you real numbers for it.",
    understanding: [
      {
        heading: "Net proceeds, not market value",
        body: "The number that belongs in your plan is what the client would actually receive after cost of sale, repairs, and payoff — not a portal estimate.",
      },
      {
        heading: "Carrying cost is a real drag",
        body: "Taxes, insurance, maintenance, and deferred repair are quantified so the hold decision is compared honestly against the alternative.",
      },
      {
        heading: "Concentration risk is named",
        body: "When a single illiquid asset is most of the balance sheet, that is a planning fact, not a lifestyle preference.",
      },
      {
        heading: "The client relationship stays yours",
        body: "I report to you, I do not cross-sell, and I do not take the relationship.",
      },
    ],
    process: [
      { step: "Property brief", detail: "A written summary of value, condition, and constraints." },
      { step: "Equity worksheet", detail: "Realistic net proceeds and annual carrying cost." },
      { step: "Scenario comparison", detail: "Hold, sell now, or sell later — with the numbers behind each." },
      { step: "Client meeting support", detail: "I will join the meeting and answer property questions directly." },
      { step: "Execution if chosen", detail: "Full transaction management, reported back to you." },
    ],
    standards: [
      "No investment advice",
      "No referral fees paid or accepted",
      "No solicitation of your clients",
      "Written analysis you can put in the file",
    ],
    kitBlurb:
      "A property-equity worksheet, a hold-versus-sell framework, and a client-ready handout.",
  },
  "senior-services": {
    audience: "senior-services",
    slug: "senior-services",
    navLabel: "Senior Services",
    title: "For Senior Service Professionals",
    metaTitle: "For Senior Move Managers & Placement Professionals | Property Support",
    metaDescription:
      "Transition sequencing, property preparation, and family communication support for senior move managers and placement professionals in Orange County.",
    intro:
      "You are managing the hardest transition in a family's life. The property does not have to be the part that goes wrong.",
    understanding: [
      {
        heading: "One calendar, not two",
        body: "The move calendar and the property calendar have to be built together. When they are not, the family carries an empty house for months.",
      },
      {
        heading: "Pace is set by the family",
        body: "Nobody is pushed. If the right answer is to wait six months, that is what I will say.",
      },
      {
        heading: "Contents and condition are sequenced",
        body: "Clearing, documentation, and preparation are ordered so no step blocks the next one.",
      },
      {
        heading: "Dignity is a requirement",
        body: "How the home and the family are treated matters more than how fast the property sells.",
      },
    ],
    process: [
      { step: "Joint planning call", detail: "Your calendar, my calendar, one sequence." },
      { step: "Property assessment", detail: "Condition, value, and what genuinely needs to be done." },
      { step: "Preparation", detail: "Coordinated with contents clearing rather than after it." },
      { step: "Sale", detail: "Managed end to end with the family kept informed." },
      { step: "Handoff", detail: "Proceeds, documentation, and a clean close." },
    ],
    standards: [
      "No pressure on the family, at any stage",
      "No referral fees paid or accepted",
      "Clear division of responsibilities in writing",
      "You stay the primary relationship",
    ],
    kitBlurb:
      "A transition sequencing calendar, property-preparation checklist, and a family conversation guide.",
  },
  "property-managers": {
    audience: "property-managers",
    slug: "property-managers",
    navLabel: "Property & Transaction",
    title: "For Property, Title, and Escrow Professionals",
    metaTitle: "For Property Managers, Title & Escrow | Complex Property Referrals",
    metaDescription:
      "Where to route keep-or-sell decisions, vesting problems, and complicated property files in Orange County. Free professional resource kit, no reciprocity required.",
    intro:
      "You see the difficult files first. When one needs more than a standard listing, I am glad to be the person you route it to.",
    understanding: [
      {
        heading: "Keep-or-sell is a real analysis",
        body: "Owners deserve return-on-equity and carrying-cost numbers, not an opinion. I will run them whether or not it results in a sale.",
      },
      {
        heading: "Problems surface early or expensively",
        body: "Vesting, heirship, and lien issues are triaged before a listing goes live rather than discovered in escrow.",
      },
      {
        heading: "Scope discipline on pre-list work",
        body: "Improvement spend is recommended only where it returns in this submarket. Often the right answer is disclose, not repair.",
      },
      {
        heading: "Your relationship is protected",
        body: "If the owner keeps the property, it stays with you. I will say so directly to the owner.",
      },
    ],
    process: [
      { step: "Triage call", detail: "Fifteen minutes on the file and what is actually blocking it." },
      { step: "Assessment", detail: "Condition, value, vesting, and the realistic paths forward." },
      { step: "Owner conversation", detail: "Options presented plainly, including keeping the property." },
      { step: "Execution", detail: "If a sale is chosen, managed end to end." },
      { step: "Report back", detail: "You are told the outcome either way." },
    ],
    standards: [
      "No poaching management accounts",
      "No referral fees paid or accepted",
      "Honest answer even when it costs me the listing",
      "Fast triage — same or next business day",
    ],
    kitBlurb:
      "A pre-list scope-and-return worksheet and a vesting-issue triage sheet.",
  },
};

export const PROFESSIONAL_AUDIENCES = Object.keys(PROFESSIONAL_PAGES) as ProfessionalAudience[];

export function professionalPage(slug: string): ProfessionalPage | undefined {
  return PROFESSIONAL_PAGES[slug as ProfessionalAudience];
}

/** Referral standards shown on every professional surface. */
export const REFERRAL_STANDARDS = [
  "No referral fees are paid or accepted, in either direction.",
  "Your client stays your client. I do not solicit them for anything else.",
  "The resource kit is free with no reciprocity requirement.",
  "I will tell a client not to sell when that is the right answer.",
  "You are told the outcome of every referral, whatever it is.",
];
