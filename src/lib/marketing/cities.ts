// Task 21 — Local SEO architecture.
//
// One record per Orange County submarket. City pages are conversion
// surfaces; the educational pillar pages carry the search volume and
// link down into these. Content only — no network calls, no analytics.

import { BRAND } from "./positioning";

export interface CityGuide {
  slug: string;
  city: string;
  county: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  marketNotes: string[];
  neighborhoods: string[];
  situations: { title: string; body: string; to: string }[];
  faqs: { q: string; a: string }[];
}

function commonSituations(city: string) {
  return [
    {
      title: `Selling a home in ${city}`,
      body: `Pricing into the active ${city} buyer pool, deciding which pre-list work returns its cost, and modeling net proceeds before the sign goes up.`,
      to: "/sellers",
    },
    {
      title: `Buying in ${city}`,
      body: `Financing posture, inspection strategy, and a written walk-away number so you compete without overpaying.`,
      to: "/buyers",
    },
    {
      title: `Probate and inherited property in ${city}`,
      body: `Confirming the authority you hold, sequencing court requirements, and comparing keep, rent, and sell against real carrying costs.`,
      to: "/probate",
    },
    {
      title: `Behind on payments in ${city}`,
      body: `Foreclosure timeline, short sale viability, and workout options while every option is still on the table.`,
      to: "/distressed-property",
    },
  ];
}

export const CITY_GUIDES: CityGuide[] = [
  {
    slug: "la-habra",
    city: "La Habra",
    county: "Orange County",
    metaTitle: "La Habra Real Estate Guide — Sell, Buy, Probate | Legacy Forge",
    metaDescription:
      "La Habra real estate: pricing, net proceeds, probate and inherited property, and distressed-property options. Local decision guides from Legacy Forge.",
    intro:
      "La Habra sits on the Orange County–Los Angeles County line, which means two different buyer pools, two different commute stories, and frequent confusion about which county's records and courts apply to a property.",
    marketNotes: [
      "Housing stock skews mid-century single family, with a large share of long-held, low-basis ownership.",
      "County-line properties require care: verify the recording county before assuming probate venue or tax treatment.",
      "Original-condition homes trade at a wide spread against updated comparables — condition strategy matters more here than list price bravado.",
    ],
    neighborhoods: ["Westridge", "Country Hills", "The Highlands", "Downtown La Habra", "La Habra Heights border"],
    situations: commonSituations("La Habra"),
    faqs: [
      {
        q: "Is my La Habra property in Orange County or Los Angeles County?",
        a: "La Habra is in Orange County; adjacent La Habra Heights is in Los Angeles County. The recording county drives probate venue, transfer documentation, and which assessor handles reassessment, so it is worth confirming on the deed before you plan anything.",
      },
      {
        q: "Do original-condition homes still sell here?",
        a: "Yes, and often quickly — but they sell to a different buyer than an updated home. The decision is whether to sell into the as-is buyer pool at a known discount or invest targeted work to reach the retail pool. We model both before you commit.",
      },
    ],
  },
  {
    slug: "brea",
    city: "Brea",
    county: "Orange County",
    metaTitle: "Brea Real Estate Guide — Sell, Buy, Probate | Legacy Forge",
    metaDescription:
      "Brea real estate decision guides: pricing and net proceeds, buying strategy, probate and inherited property, and distressed-property options.",
    intro:
      "Brea's buyer pool is heavily school- and commute-driven, which compresses the spring window and rewards sellers who are ready before it opens.",
    marketNotes: [
      "Seasonality is pronounced: listings that launch prepared in late winter meet the deepest demand.",
      "Mixed HOA and non-HOA inventory means carrying-cost math varies widely between comparable-looking homes.",
      "Newer hillside tracts and older flatland stock behave as effectively separate submarkets.",
    ],
    neighborhoods: ["Olinda Village", "Blackstone", "Brea Ranch", "Country Hills", "Downtown Brea"],
    situations: commonSituations("Brea"),
    faqs: [
      {
        q: "When should I list in Brea?",
        a: "Preparation date matters more than calendar date. That said, demand concentrates ahead of the school year, so a prepared late-winter launch typically meets more qualified buyers than a rushed summer one.",
      },
      {
        q: "How much does an HOA change my net?",
        a: "Dues, transfer fees, and document costs all land in your closing math, and buyer affordability is calculated against dues as well as payment. Two homes at the same list price can produce meaningfully different outcomes.",
      },
    ],
  },
  {
    slug: "fullerton",
    city: "Fullerton",
    county: "Orange County",
    metaTitle: "Fullerton Real Estate Guide — Sell, Buy, Probate | Legacy Forge",
    metaDescription:
      "Fullerton real estate: historic housing stock, permits and disclosures, probate and inherited property, and seller net-proceeds planning.",
    intro:
      "Fullerton has some of the oldest and most architecturally varied housing in north Orange County, which makes permit history and disclosure discipline unusually important.",
    marketNotes: [
      "Older housing stock raises the odds of unpermitted additions — resolve or disclose before listing, never after an inspection.",
      "Student and rental demand supports a distinct investor buyer pool near the university corridor.",
      "Historic-character homes reward specialist marketing rather than generic comparable pricing.",
    ],
    neighborhoods: ["Raymond Hills", "Sunny Hills", "Golden Hill", "Amerige Heights", "Downtown Fullerton"],
    situations: commonSituations("Fullerton"),
    faqs: [
      {
        q: "What if an addition was never permitted?",
        a: "You have three paths: permit it retroactively, price and market the home as-is with full disclosure, or remove it. The worst path is silence — an unpermitted space discovered during escrow costs more in renegotiation than it ever would have cost to disclose upfront.",
      },
      {
        q: "Does an older home need a pre-listing inspection?",
        a: "In Fullerton's older tracts, usually yes. Knowing what a buyer's inspector will find lets you decide what to fix, what to credit, and what to disclose — instead of negotiating from surprise.",
      },
    ],
  },
  {
    slug: "whittier",
    city: "Whittier",
    county: "Los Angeles County",
    metaTitle: "Whittier Real Estate Guide — Sell, Buy, Probate | Legacy Forge",
    metaDescription:
      "Whittier real estate decision guides: pricing strategy, probate and inherited property, distressed-property options, and net-proceeds planning.",
    intro:
      "Whittier is in Los Angeles County, so probate venue, transfer taxes, and recording practice differ from neighboring Orange County cities even when the homes look identical.",
    marketNotes: [
      "Los Angeles County documentary transfer tax and city-level charges change seller net math versus Orange County.",
      "Uptown and historic districts carry design and preservation considerations that affect renovation planning.",
      "Long-tenured ownership means many sales are estate- or retirement-driven rather than move-up driven.",
    ],
    neighborhoods: ["Uptown Whittier", "Friendly Hills", "Michigan Park", "College Hills", "East Whittier"],
    situations: commonSituations("Whittier"),
    faqs: [
      {
        q: "How is selling in Whittier different from Orange County?",
        a: "The buyer behavior is similar; the paperwork is not. County transfer taxes, recording practice, and probate venue all follow Los Angeles County rules, which changes both your net proceeds and your court timeline.",
      },
      {
        q: "Can you handle a Los Angeles County probate sale?",
        a: "Yes. The core sequence — authority, appraisal, notice, and confirmation where required — is the same; the venue and local rules differ. We map the sequence before anything is listed.",
      },
    ],
  },
  {
    slug: "la-mirada",
    city: "La Mirada",
    county: "Los Angeles County",
    metaTitle: "La Mirada Real Estate Guide — Sell, Buy, Probate | Legacy Forge",
    metaDescription:
      "La Mirada real estate: tract-home pricing, probate and inherited property, downsizing sequencing, and seller net-proceeds planning.",
    intro:
      "La Mirada's tract-built consistency makes comparable pricing unusually reliable — and unusually unforgiving of an inflated list price.",
    marketNotes: [
      "Homogeneous tracts mean buyers can compare your home directly against three others in the same floor plan.",
      "Condition and updates, not square footage, drive most of the price spread.",
      "Strong first-time and move-up buyer demand keeps well-prepared listings moving quickly.",
    ],
    neighborhoods: ["Windemere", "La Mirada Estates", "Creek Park", "Hillsborough", "Rancho La Mirada"],
    situations: commonSituations("La Mirada"),
    faqs: [
      {
        q: "Why did my neighbor's identical home sell for more?",
        a: "In tract markets the spread is almost always condition, presentation, and timing rather than the home itself. That is good news: those are the three variables you can still control before you list.",
      },
      {
        q: "Should I remodel before selling?",
        a: "Rarely a full remodel. Paint, flooring, lighting, and landscaping usually return more per dollar than a kitchen you will never cook in.",
      },
    ],
  },
  {
    slug: "yorba-linda",
    city: "Yorba Linda",
    county: "Orange County",
    metaTitle: "Yorba Linda Real Estate Guide — Sell, Buy, Estate Planning | Legacy Forge",
    metaDescription:
      "Yorba Linda real estate: higher-value pricing strategy, trust and estate sales, 1031 exchanges, and seller net-proceeds planning.",
    intro:
      "Yorba Linda's higher price points mean more trust-held property, more jumbo financing, and more transactions where the tax consequence outweighs the price negotiation.",
    marketNotes: [
      "Trust and estate ownership is common — confirm trustee authority and successor status early.",
      "Jumbo financing changes appraisal risk and buyer qualification review.",
      "Lot size, view, and equestrian access create wide value spreads within the same tract.",
    ],
    neighborhoods: ["Vista Del Verde", "East Lake Village", "Kerrigan Ranch", "Bryant Ranch", "Yorba Linda Estates"],
    situations: commonSituations("Yorba Linda"),
    faqs: [
      {
        q: "The property is in a trust. What changes?",
        a: "The trustee sells, not the heirs, and the trust document controls the authority. We confirm successor trustee status and title vesting before marketing — that single step prevents most escrow delays in trust sales.",
      },
      {
        q: "Is a 1031 exchange worth it here?",
        a: "When the property is investment-held and the gain is large, deferral often outweighs the friction. The deadlines are strict, so replacement candidates should be identified before the sale closes.",
      },
    ],
  },
  {
    slug: "orange",
    city: "Orange",
    county: "Orange County",
    metaTitle: "City of Orange Real Estate Guide — Sell, Buy, Probate | Legacy Forge",
    metaDescription:
      "City of Orange real estate: Old Towne historic property, probate and inherited homes, buying strategy, and seller net-proceeds planning.",
    intro:
      "The City of Orange combines a nationally recognized historic district with conventional postwar tracts, and the two require completely different marketing and renovation approaches.",
    marketNotes: [
      "Old Towne properties carry historic review considerations that affect renovation scope and timeline.",
      "Period-correct restoration can add value; generic modernization frequently does not.",
      "Proximity to hospitals and universities supports steady rental and investor demand.",
    ],
    neighborhoods: ["Old Towne Orange", "Orange Park Acres", "Santiago Hills", "El Modena", "West Orange"],
    situations: commonSituations("Orange"),
    faqs: [
      {
        q: "Does historic status limit what I can do?",
        a: "It can shape exterior changes and review timelines. It also creates a premium buyer pool that pays for authenticity, so the constraint is often worth more than it costs.",
      },
      {
        q: "How do I market a historic home?",
        a: "To the buyer who wants that home specifically. Documentation of period features, permits, and restoration work does more than a wider ad spend.",
      },
    ],
  },
  {
    slug: "placentia",
    city: "Placentia",
    county: "Orange County",
    metaTitle: "Placentia Real Estate Guide — Sell, Buy, Probate | Legacy Forge",
    metaDescription:
      "Placentia real estate: pricing and net proceeds, probate and inherited property, downsizing sequencing, and distressed-property options.",
    intro:
      "Placentia's mix of established family tracts and newer infill keeps demand steady, and its central north-county position pulls buyers from several surrounding markets at once.",
    marketNotes: [
      "Central location means your competition is not just Placentia — buyers cross-shop Brea, Yorba Linda, and Fullerton.",
      "Established tracts hold significant long-term equity, making estate and downsizing sales common.",
      "Newer infill product competes on condition, which pressures unprepared resale listings.",
    ],
    neighborhoods: ["Alta Vista", "Bradford Place", "Tuscany", "Golden Elm", "Placentia Estates"],
    situations: commonSituations("Placentia"),
    faqs: [
      {
        q: "How do I compete with newer construction?",
        a: "Not on features — on condition, clarity, and price position. A move-in-ready resale with clean disclosures beats a new build with a long delivery timeline for most buyers.",
      },
      {
        q: "We are downsizing. Sell first or buy first?",
        a: "It depends on your equity, your financing, and your tolerance for a double move. We sequence it so you are never carrying two payments without a plan.",
      },
    ],
  },
];

export function getCityGuide(slug: string): CityGuide | undefined {
  return CITY_GUIDES.find(c => c.slug === slug);
}

export function cityJsonLd(guide: CityGuide) {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: `${BRAND.name} — ${BRAND.advisor}`,
    parentOrganization: { "@type": "Organization", name: BRAND.publisher },
    url: `${BRAND.origin}/local-guides/${guide.slug}`,
    areaServed: {
      "@type": "City",
      name: guide.city,
      containedInPlace: { "@type": "AdministrativeArea", name: guide.county },
    },
    knowsAbout: [
      "Residential sales",
      "Probate and trust sales",
      "Inherited property",
      "Distressed property",
      "1031 exchanges",
    ],
  };
}
