// Local SEO Expansion — Phase 1: AEO-first page specifications.
//
// Each wave-one page is generated from two sources that both already exist in
// this repository: a cluster framework (the situation-specific decision logic)
// and a city record (real submarket facts). Nothing about a market, a court,
// a price, or a result is invented here — where a fact is not held, the page
// says what to verify instead of asserting it.
//
// Page order follows the AEO structure the owner specified: question first,
// direct answer, key factors, scenarios, decision path, costs/timing, local
// considerations, people-also-ask, guides, assessment, professional
// resources, next step.

import { CITY_GUIDES } from "./cities";
import { CLUSTERS, GEOGRAPHIES, selectWaveOne, type ClusterId, type GeographyId } from "./demand";
import type { ProfessionalAudience } from "@/lib/partners/schema";

export interface Scenario {
  title: string;
  body: string;
}

export interface ClusterFramework {
  id: ClusterId;
  /** Question the page answers, in the visitor's words. `{place}` is filled. */
  question: (place: string) => string;
  /** The direct answer, first. Two to four sentences, no preamble. */
  directAnswer: (place: string) => string;
  keyFactors: string[];
  scenarios: Scenario[];
  decisionPath: string[];
  costTiming: string[];
  paa: { q: string; a: string }[];
  referralAudience: ProfessionalAudience;
  nextStep: string;
}

const CLUSTER_CONTENT: Partial<Record<ClusterId, ClusterFramework>> = {
  probate: {
    id: "probate",
    question: place => `Do I need probate to sell an inherited home in ${place}?`,
    directAnswer: place =>
      `It depends on how the property was titled, not on where it sits. A ${place} home held in a living trust, in joint tenancy with a surviving owner, or covered by a recorded transfer-on-death deed generally transfers without a probate case. A home held in the deceased owner's name alone usually requires court authority before it can be sold, and California offers smaller-estate procedures for some estates rather than a full administration. Pull the vesting off the recorded deed first — that single document decides which path you are on.`,
    keyFactors: [
      "How title is vested on the last recorded deed: sole ownership, joint tenancy, community property with right of survivorship, or trust.",
      "Whether the personal representative has full or limited authority under the Independent Administration of Estates Act, because limited authority adds court confirmation to the sale.",
      "Whether all heirs and beneficiaries agree on selling, and whether any of them occupy the property.",
      "Liens, reverse mortgages, unpaid property taxes, and deferred maintenance that must be resolved out of proceeds.",
      "Which county the deed records in — a detail that matters on the Orange County–Los Angeles County line.",
    ],
    scenarios: [
      {
        title: "Property was held in a trust",
        body: "The successor trustee can typically sell without a probate case once acceptance of trusteeship and the certification of trust are in place. The work shifts from court authority to beneficiary communication and clean accounting.",
      },
      {
        title: "Property was in the decedent's name alone",
        body: "Expect a probate petition, letters of administration or testamentary, and a sale conducted under whichever authority the court grants. Nothing should be listed before that authority is confirmed in writing.",
      },
      {
        title: "An heir is living in the home",
        body: "Occupancy changes both the timeline and the tone. Resolve possession, insurance, and utilities before marketing, and price the condition as it actually is rather than as it will be after a promised cleanout.",
      },
      {
        title: "The estate has more debt than equity",
        body: "Creditor claims, a reverse mortgage payoff, or accrued taxes can consume the proceeds. Model the payoff before committing to a sale so the family is not surprised at settlement.",
      },
    ],
    decisionPath: [
      "Obtain the last recorded deed and read the vesting language.",
      "Confirm whether a trust, survivorship interest, or transfer-on-death deed applies.",
      "If a court case is required, confirm which authority the representative holds before any listing activity.",
      "Order a payoff and lien picture: mortgage, reverse mortgage, taxes, HOA, and any recorded judgments.",
      "Value the property in its current condition, then compare as-is disposition against a scoped cleanup.",
      "Agree in writing on who decides, who signs, and how proceeds are distributed.",
      "Sequence the listing against the legal calendar, not the marketing calendar.",
    ],
    costTiming: [
      "Timelines are driven by the court's calendar and the authority granted, so build the plan around confirmed dates rather than assumed ones.",
      "Carrying costs continue during administration: insurance on a vacant home, utilities, landscaping, property taxes, and any loan payment.",
      "Vacant-home insurance and securing the property are usually the first two expenses worth funding, because a loss during administration is the expensive failure.",
    ],
    paa: [
      {
        q: "Can the house be listed before probate is granted?",
        a: "Marketing before authority is confirmed creates exposure for the representative and can void a contract. Preparation work — cleanout, valuation, contractor bids — can proceed; a binding listing should wait for confirmed authority.",
      },
      {
        q: "Who pays the mortgage and utilities during probate?",
        a: "The estate does, from estate funds, and those carrying costs reduce what the heirs ultimately receive. Track them from day one; they are a real part of the keep-versus-sell math.",
      },
      {
        q: "Do all the heirs have to agree to the sale?",
        a: "Not always, but disagreement is the most common cause of delay and cost. Getting the decision structure in writing early is cheaper than resolving it later.",
      },
    ],
    referralAudience: "attorneys",
    nextStep: "Bring the recorded deed and any court paperwork to a strategy call, and leave with a written sequence.",
  },

  "inherited-property": {
    id: "inherited-property",
    question: place => `Should we keep, rent, or sell an inherited house in ${place}?`,
    directAnswer: place =>
      `Decide it on three numbers, not on sentiment: the property's current value, the true annual cost of holding it, and what each heir needs from the outcome. A ${place} home that carries itself as a rental and has willing family management can be worth holding; one that needs capital, has split ownership, or funds a distribution usually sells better sooner than later. Run all three options on one page before anyone commits.`,
    keyFactors: [
      "Cost basis after any step-up at death, and how a sale would be taxed — a CPA question, not an agent question.",
      "Property-tax treatment after transfer, including whether any exclusion applies to your facts.",
      "Real carrying cost: taxes, insurance, maintenance reserve, and management, not just the mortgage payment.",
      "Condition and deferred maintenance, which determine whether the home reaches the retail buyer pool or the as-is pool.",
      "Whether every co-owner wants the same thing, and whether anyone needs liquidity now.",
    ],
    scenarios: [
      {
        title: "One heir wants to keep it, the others want cash",
        body: "This is a buyout, not a debate. Value the property, agree on the number and the funding source, and document it. Undocumented family buyouts are the ones that end badly.",
      },
      {
        title: "The home needs significant work",
        body: "Compare a scoped, targeted repair plan against a clean as-is sale. The right answer depends on the spread between as-is and updated comparables in that specific submarket, not on a general rule.",
      },
      {
        title: "The property already has a tenant",
        body: "Existing tenancy affects showings, buyer pool, and timing. It can be an asset for an investor sale and a friction point for a retail sale.",
      },
      {
        title: "Nobody has decided anything for a year",
        body: "Inaction is a decision with a price: carrying costs, deterioration, and market movement. Set a decision date and work backward.",
      },
    ],
    decisionPath: [
      "Establish current value in current condition.",
      "Build the annual holding cost line by line, including a maintenance reserve.",
      "Get the tax picture from a CPA before you model outcomes.",
      "Model three outcomes side by side: sell now, rent for a defined period, or buy out a co-owner.",
      "Confirm what each owner actually needs — timing, cash, or continuity.",
      "Pick the option, write it down with dates, and assign responsibilities.",
    ],
    costTiming: [
      "Holding costs accumulate quietly; the annual number is usually larger than families expect once insurance, taxes, and reserves are included.",
      "A rental decision is a multi-year commitment with management obligations, not a pause button.",
      "Tax outcomes turn on facts that must be confirmed with your CPA before closing, not after.",
    ],
    paa: [
      {
        q: "Is it better to sell an inherited house right away?",
        a: "Often, but not always. Selling sooner limits carrying cost and family friction; holding can make sense when the property genuinely cash-flows and every owner agrees on the plan.",
      },
      {
        q: "What if the heirs cannot agree?",
        a: "Document the disagreement, get an independent valuation, and price out the buyout. Most stalemates are really disputes about the number, and a defensible number resolves them.",
      },
      {
        q: "Do we have to fix the house before selling it?",
        a: "No. The question is whether targeted work returns more than it costs in that submarket. Some homes sell better as-is to a buyer who plans the renovation anyway.",
      },
    ],
    referralAudience: "cpas",
    nextStep: "Get the keep, rent, and sell math on one page before the next family conversation.",
  },

  divorce: {
    id: "divorce",
    question: place => `What happens to the house in a ${place} divorce?`,
    directAnswer: place =>
      `The house usually resolves one of three ways: one spouse buys the other out, the property is sold and the proceeds divided, or the sale is deferred by agreement for a defined period. Which one works in ${place} depends on whether either spouse can qualify for financing alone, how much equity there is after costs, and what the court order or settlement requires. Get a neutral valuation and a written net-proceeds estimate before negotiating — it is far easier to divide a number both sides trust.`,
    keyFactors: [
      "Whether either spouse can refinance the existing loan in their own name, which decides whether a buyout is even possible.",
      "Equity after payoff, selling costs, and any liens — the number that actually gets divided.",
      "What the settlement agreement or court order requires and permits, which governs everything else.",
      "Occupancy during the process, including who pays the mortgage and maintenance in the meantime.",
      "Whether children's schooling or timing constraints argue for a deferred sale.",
    ],
    scenarios: [
      {
        title: "One spouse wants to keep the home",
        body: "Test financing capacity first. A buyout that depends on a refinance nobody can qualify for is not a plan; it is a delay with legal costs attached.",
      },
      {
        title: "Both spouses want out",
        body: "A clean, neutral sale process with one shared set of numbers, one communication channel, and one timeline is usually the least expensive path for both.",
      },
      {
        title: "Communication has broken down",
        body: "Work through counsel with an agreed, documented process. Neutrality is the service being provided here — both sides see the same information at the same time.",
      },
      {
        title: "The sale is deferred by agreement",
        body: "Document who pays what, how maintenance decisions are made, and what triggers the eventual sale. Ambiguity here becomes litigation later.",
      },
    ],
    decisionPath: [
      "Obtain a neutral valuation both parties accept.",
      "Produce a written net-proceeds estimate at several price points.",
      "Test buyout feasibility with a lender before negotiating terms.",
      "Confirm what the order or agreement requires.",
      "Choose sale, buyout, or deferral and document the timeline.",
      "If selling, agree in advance on price strategy, offer review, and repair-credit authority.",
    ],
    costTiming: [
      "Selling costs and payoff reduce the divisible equity; negotiating on gross price rather than net proceeds is the most common avoidable mistake.",
      "Delay has a carrying cost that both parties usually share, whether or not the agreement says so.",
      "Legal timelines govern the property timeline. Property decisions get sequenced against counsel's calendar.",
    ],
    paa: [
      {
        q: "Can one spouse force a sale?",
        a: "That is a legal question decided by the order or the court, not by the property side. What the property side supplies is a defensible value and a clear net-proceeds picture that supports either outcome.",
      },
      {
        q: "How is the house valued in a divorce?",
        a: "Through an independent valuation both parties accept, ideally agreed in advance. Competing valuations produced by each side reliably cost more than one neutral one.",
      },
      {
        q: "Who pays the mortgage while the divorce is pending?",
        a: "Whatever the agreement or order says. Absent direction, missed payments damage both parties' credit and reduce the equity there is to divide.",
      },
    ],
    referralAudience: "attorneys",
    nextStep: "Ask for a neutral valuation and net-proceeds sheet that both counsel can work from.",
  },

  "trust-property": {
    id: "trust-property",
    question: place => `How does a successor trustee sell a ${place} property held in a trust?`,
    directAnswer: place =>
      `A successor trustee generally sells a ${place} trust property without a probate case, but only after the trusteeship is documented and the trust's own terms are followed. The sequence is: accept the trusteeship, obtain a certification of trust, confirm the trust actually holds title on the recorded deed, notify beneficiaries as the trust and law require, then market with clean records of every decision. The trustee's exposure comes from process, not price — document as you go.`,
    keyFactors: [
      "Whether the deed actually shows the trust as the owner; an unfunded trust does not avoid probate for that property.",
      "What the trust instrument says about sale authority, notice, and distribution.",
      "Beneficiary communication obligations, and whether any beneficiary occupies the property.",
      "Whether the trustee needs an appraisal to defend the price as prudent.",
      "Whether costs of sale, repairs, and carrying expenses are payable from trust assets.",
    ],
    scenarios: [
      {
        title: "Title was never transferred into the trust",
        body: "This is the most common surprise. The property may still require a court process even though a trust exists, so verify the vesting before assuming the trust route is available.",
      },
      {
        title: "A beneficiary objects to the sale",
        body: "Documentation carries the day: an independent valuation, a written marketing plan, and a record of offers received and why each was accepted or declined.",
      },
      {
        title: "The trust holds several properties",
        body: "Sequence them. Simultaneous listings compete for the same buyer pool and stretch the trustee's attention across too many decisions at once.",
      },
      {
        title: "The property needs work the trust must fund",
        body: "Scope the work against expected return, get the authority documented, and keep receipts. Discretionary spending is where trustee exposure concentrates.",
      },
    ],
    decisionPath: [
      "Confirm the recorded vesting shows the trust as owner.",
      "Document acceptance of trusteeship and obtain a certification of trust.",
      "Read the trust's sale, notice, and distribution provisions with counsel.",
      "Obtain an independent valuation to support the price decision.",
      "Provide beneficiary notice as required, and keep a written record.",
      "Market, evaluate offers on documented criteria, and record the reasoning.",
      "Close, account for costs, and distribute per the trust terms.",
    ],
    costTiming: [
      "Trustee timelines are governed by the trust instrument and required notices rather than by market conditions.",
      "Valuation, insurance, securing the property, and accounting support are ordinary administration expenses worth funding early.",
      "Cutting the documentation to save time is the single most expensive shortcut available to a trustee.",
    ],
    paa: [
      {
        q: "Does a trust always avoid probate for a house?",
        a: "Only if the deed actually shows the trust as the owner. An unfunded trust is the most common reason a family ends up in court anyway.",
      },
      {
        q: "Does the trustee have to tell beneficiaries about the sale?",
        a: "The trust instrument and California law set the notice requirements. Practically, over-communicating in writing is the cheapest form of protection a trustee has.",
      },
      {
        q: "Can the trustee sell to a family member?",
        a: "It raises fairness questions that must be handled with an independent valuation and clear documentation, and it is a question to run past counsel before agreeing to anything.",
      },
    ],
    referralAudience: "attorneys",
    nextStep: "Bring the deed and the trust instrument, and leave with a documented sale sequence.",
  },

  selling: {
    id: "selling",
    question: place => `What will I actually walk away with selling a house in ${place}?`,
    directAnswer: place =>
      `Start from the price a ${place} buyer will actually pay for your home in its current condition, then subtract mortgage payoff with per-diem interest, agent compensation as negotiated, title and escrow fees, transfer and recording charges, prorated taxes and HOA dues, any credits you agree to, and moving costs. The gap between price and net is commonly larger than sellers expect once payoff-adjacent items are included. Build that line-item sheet before listing and update it with every offer.`,
    keyFactors: [
      "Condition versus the active comparable set — the as-is and updated buyer pools pay very different numbers.",
      "Payoff detail, including per-diem interest to the funding date and any second lien or HELOC.",
      "Pricing into the search bands buyers actually filter on, rather than just above them.",
      "Timing relative to your next housing step, which decides whether a contingency or bridge is needed.",
      "What you must disclose, which is always cheaper handled up front than discovered mid-escrow.",
    ],
    scenarios: [
      {
        title: "You are selling and buying at once",
        body: "Sequence decides risk. Selling first maximizes certainty and negotiating strength; buying first protects housing but usually costs leverage or interest.",
      },
      {
        title: "The home is original condition",
        body: "Model a targeted-work plan against a clean as-is sale. Only the spread between the two comparable sets in your submarket answers this.",
      },
      {
        title: "You need a specific net number",
        body: "Work backward from the net to the required price and test whether the market supports it. If it does not, the plan changes before the listing goes live, not after.",
      },
      {
        title: "The first ten days are quiet",
        body: "Weak traffic is a price signal; strong traffic without offers is a condition or presentation signal. Read them differently.",
      },
    ],
    decisionPath: [
      "Establish value in current condition against the active comparable set.",
      "Build the net-proceeds sheet line by line.",
      "Decide the preparation scope on return, not on taste.",
      "Set the list price into a search band, not just above one.",
      "Define offer-review criteria before offers arrive.",
      "Plan the move and the next purchase against the closing date.",
    ],
    costTiming: [
      "Payoff, closing costs, and credits are the three lines that move net proceeds the most.",
      "A reduction spiral costs more than pricing correctly at launch, because the largest audience arrives in the first days.",
      "Repair credits usually beat performing repairs during escrow: fewer workmanship disputes, less schedule risk.",
    ],
    paa: [
      {
        q: "How long does it take to sell?",
        a: "Marketing time and escrow time are separate. Price and condition drive the first; financing type and contingencies drive the second.",
      },
      {
        q: "Should I make repairs before listing?",
        a: "Fix what an inspector will flag and what a camera will show. Full remodels done for resale rarely return their cost.",
      },
      {
        q: "What if the appraisal comes in low?",
        a: "You can hold, split the difference, reduce, or challenge with better comparables. Which move works depends entirely on how many other buyers remain available to you.",
      },
    ],
    referralAudience: "financial-advisors",
    nextStep: "Request a net-proceeds sheet for your address before you decide anything else.",
  },

  "distressed-property": {
    id: "distressed-property",
    question: place => `Foreclosure, short sale, or a workout — which applies to a ${place} homeowner behind on payments?`,
    directAnswer: place =>
      `Equity decides most of it. If a ${place} home is worth more than what is owed, a conventional sale usually protects the most money and the credit record, even on a compressed timeline. If it is worth less, the realistic paths are a lender-approved short sale, a loan modification or repayment plan, or letting the foreclosure proceed — each with different credit, tax, and timing consequences. The most important variable is how early you act, because options disappear as the timeline advances.`,
    keyFactors: [
      "Current value against total payoff, including arrears, fees, and any junior liens.",
      "Where you are in the default timeline, which determines what is still available.",
      "Whether income has recovered, which decides whether a modification or repayment plan is realistic.",
      "Junior liens and HOA balances, which can block a short sale without separate negotiation.",
      "Credit and tax consequences of each path, which need a CPA's input before you choose.",
    ],
    scenarios: [
      {
        title: "There is real equity",
        body: "Sell conventionally. It usually preserves the most proceeds and the cleanest credit outcome, but it needs to start immediately — the timeline is not negotiable.",
      },
      {
        title: "The loan is underwater",
        body: "A short sale requires lender approval and complete documentation. Assume it takes longer than a standard sale, and start assembling the package before you need it.",
      },
      {
        title: "Income has recovered",
        body: "A modification or repayment plan may keep the home. Get the servicer's requirements in writing and meet every deadline exactly.",
      },
      {
        title: "You have stopped opening the mail",
        body: "The common thread in the worst outcomes is silence. Every remaining option requires documentation and contact, and each week of delay removes one.",
      },
    ],
    decisionPath: [
      "Establish current value and total payoff including arrears and junior liens.",
      "Determine your exact position in the default timeline.",
      "Assess income recovery honestly against the payment.",
      "Compare conventional sale, short sale, modification, and foreclosure side by side.",
      "Confirm tax and credit consequences with a CPA before choosing.",
      "Execute one path with complete documentation and deadlines calendared.",
    ],
    costTiming: [
      "Arrears, fees, and default-related charges grow while the decision is deferred.",
      "Short sales depend on lender review timelines, which are outside your control and rarely fast.",
      "Debt forgiveness can carry tax consequences. Confirm your facts with a CPA before agreeing to any resolution.",
    ],
    paa: [
      {
        q: "Is a short sale better than foreclosure?",
        a: "Frequently, on both credit recovery and control of the process, but it depends on your lender, your junior liens, and your tax situation. It is a documented comparison, not a slogan.",
      },
      {
        q: "Can I sell while I am behind on payments?",
        a: "Yes, if there is time and equity. Arrears are paid through escrow. Acting early is what preserves this option.",
      },
      {
        q: "How long does the foreclosure process take?",
        a: "It runs on statutory notice periods rather than a fixed number, and each stage narrows your options. Confirm your exact position before assuming how much time remains.",
      },
    ],
    referralAudience: "attorneys",
    nextStep: "Get the four options priced against your actual payoff while all four are still open.",
  },
};

export interface LocalPageSpec {
  cluster: ClusterId;
  geography: GeographyId;
  /** "hub" for the county roll-up, "city" for a submarket page. */
  level: "hub" | "city";
  path: string;
  place: string;
  question: string;
  metaTitle: string;
  metaDescription: string;
  directAnswer: string;
  keyFactors: string[];
  scenarios: Scenario[];
  decisionPath: string[];
  costTiming: string[];
  localConsiderations: string[];
  neighborhoods: string[];
  paa: { q: string; a: string }[];
  guideSlug: string;
  assessmentSlug: string;
  pillarPath: string;
  referralAudience: ProfessionalAudience;
  nextStep: string;
  clusterLabel: string;
}

function clampMeta(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

function localConsiderationsFor(geographyId: GeographyId, place: string): { notes: string[]; neighborhoods: string[] } {
  const city = CITY_GUIDES.find(c => c.slug === geographyId);
  if (city) return { notes: [city.intro, ...city.marketNotes], neighborhoods: city.neighborhoods };
  return {
    notes: [
      "Orange County spans very different submarkets, and the right answer in one city is often the wrong answer four miles away.",
      "Buyer pools, housing stock age, and condition spreads vary enough between submarkets that county-level averages mislead more than they help.",
      "Properties near the Los Angeles County line need the recording county verified before anyone assumes venue or tax treatment.",
    ],
    neighborhoods: CITY_GUIDES.map(c => c.city),
  };
}

function buildSpec(cluster: ClusterId, geography: GeographyId): LocalPageSpec | null {
  const framework = CLUSTER_CONTENT[cluster];
  const clusterMeta = CLUSTERS.find(c => c.id === cluster);
  const geo = GEOGRAPHIES.find(g => g.id === geography);
  if (!framework || !clusterMeta || !geo) return null;

  const level: "hub" | "city" = geo.citySlug === null ? "hub" : "city";
  const path = level === "hub" ? `/local/${cluster}` : `/local/${cluster}/${geo.citySlug}`;
  const place = geo.label;
  const question = framework.question(place);
  const { notes, neighborhoods } = localConsiderationsFor(geography, place);
  const cityFaqs = CITY_GUIDES.find(c => c.slug === geography)?.faqs ?? [];

  return {
    cluster,
    geography,
    level,
    path,
    place,
    question,
    metaTitle: clampMeta(`${question} | Legacy Forge`, 60),
    metaDescription: clampMeta(framework.directAnswer(place), 155),
    directAnswer: framework.directAnswer(place),
    keyFactors: framework.keyFactors,
    scenarios: framework.scenarios,
    decisionPath: framework.decisionPath,
    costTiming: framework.costTiming,
    localConsiderations: notes,
    neighborhoods,
    paa: [...framework.paa, ...cityFaqs].slice(0, 5),
    guideSlug: clusterMeta.guideSlug,
    assessmentSlug: clusterMeta.assessmentSlug,
    pillarPath: clusterMeta.pillarPath,
    referralAudience: framework.referralAudience,
    nextStep: framework.nextStep,
    clusterLabel: clusterMeta.label,
  };
}

/**
 * Wave one: the scored cells that earned a page, plus a county-level topic hub
 * for every cluster in the wave so each city page has an authority parent.
 */
function buildWaveOne(): LocalPageSpec[] {
  const cells = selectWaveOne();
  const clustersInWave = [...new Set(cells.map(c => c.cluster))];
  const specs = new Map<string, LocalPageSpec>();

  for (const cluster of clustersInWave) {
    const hub = buildSpec(cluster, "orange-county");
    if (hub) specs.set(hub.path, hub);
  }
  for (const cell of cells) {
    const spec = buildSpec(cell.cluster, cell.geography);
    if (spec) specs.set(spec.path, spec);
  }
  return [...specs.values()];
}

export const LOCAL_PAGES: LocalPageSpec[] = buildWaveOne();

export const LOCAL_HUBS: LocalPageSpec[] = LOCAL_PAGES.filter(p => p.level === "hub");

export function getLocalHub(cluster: string): LocalPageSpec | undefined {
  return LOCAL_HUBS.find(p => p.cluster === cluster);
}

export function getLocalPage(cluster: string, city: string): LocalPageSpec | undefined {
  return LOCAL_PAGES.find(p => p.level === "city" && p.cluster === cluster && p.path.endsWith(`/${city}`));
}

export function citiesForCluster(cluster: string): LocalPageSpec[] {
  return LOCAL_PAGES.filter(p => p.level === "city" && p.cluster === cluster);
}

/** Every wave-one path, for the sitemap and the indexation boundary. */
export function localPagePaths(): string[] {
  return LOCAL_PAGES.map(p => p.path);
}
