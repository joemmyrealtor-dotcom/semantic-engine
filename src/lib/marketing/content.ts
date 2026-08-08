// Task 20 — Public website content model.
//
// One record per public page. Routes read from here so that copy,
// CTAs, trust proof, and FAQ schema stay consistent across the site.

import { PRIMARY_CTA, SECONDARY_CTA } from "./positioning";

export interface PublicSection {
  heading: string;
  body: string;
  bullets?: string[];
}

export interface PublicFaq {
  q: string;
  a: string;
}

export interface PublicPage {
  slug: string;
  navLabel: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  headline: string;
  subhead: string;
  primaryCta: { label: string; to: string };
  secondaryCta: { label: string; to: string };
  valueProps: { title: string; body: string }[];
  sections: PublicSection[];
  faqs: PublicFaq[];
  legal?: boolean;
}

const CTA = { primaryCta: PRIMARY_CTA, secondaryCta: SECONDARY_CTA };

export const PUBLIC_PAGES: Record<string, PublicPage> = {
  sellers: {
    slug: "/sellers",
    navLabel: "Sellers",
    metaTitle: "Selling a Home in Orange County — Protect Your Equity | Legacy Forge",
    metaDescription:
      "A clear plan for selling: what your home is worth, what to fix and skip, how to read offers, and what you actually net at closing. Orange County sellers.",
    eyebrow: "For sellers",
    headline: "Sell on your terms, and keep more of what you built.",
    subhead:
      "Most sellers lose money in three places: the wrong list price, the wrong repairs, and the wrong response to the first offer. Here is how to avoid all three.",
    ...CTA,
    valueProps: [
      {
        title: "Know your net, not just your price",
        body: "List price is a headline. Your net proceeds after commissions, concessions, repairs, payoff, and prorations are the number that matters. We model it before you list.",
      },
      {
        title: "Spend only where it returns",
        body: "Some improvements return more than they cost. Most do not. We separate the work that changes your buyer pool from the work that only drains your budget.",
      },
      {
        title: "Read offers like an operator",
        body: "The highest number is often not the strongest offer. Financing type, appraisal terms, contingency windows, and the buyer's own contingent sale all move your real outcome.",
      },
    ],
    sections: [
      {
        heading: "The first fourteen days decide everything",
        body: "Your listing gets its largest audience the week it launches. Pricing above the market to leave negotiating room reliably backfires: showings thin out, the listing ages, and buyers begin negotiating against your days-on-market rather than your value.",
        bullets: [
          "Price into the range where the next five comparable buyers are already looking.",
          "Have photography, disclosures, and pre-listing inspection ready before day one.",
          "Set a written response schedule for offers so you never negotiate under pressure.",
        ],
      },
      {
        heading: "What to fix, and what to disclose instead",
        body: "Cosmetic condition drives buyer emotion; systems drive buyer confidence. A clean, bright, uncluttered home with a documented roof, HVAC, and electrical history outperforms a partially remodeled home with unknowns.",
        bullets: [
          "Fix: paint, lighting, landscaping, deferred maintenance with visible symptoms.",
          "Usually skip: full kitchen or bath remodels done purely to sell.",
          "Always disclose: known defects, past repairs, insurance claims, and permit history.",
        ],
      },
      {
        heading: "Your closing timeline",
        body: "From accepted offer to recording, the transaction moves through inspection, appraisal, loan approval, title commitment and clearance, funding, and recording. Delays cluster in title clearance and loan conditions — both of which can be worked in advance.",
      },
    ],
    faqs: [
      {
        q: "How is my home's value actually determined?",
        a: "By closed comparable sales adjusted for condition, location, and time — then tested against what is currently active and pending. An appraiser will follow the same logic, which is why an inflated list price collapses at the appraisal.",
      },
      {
        q: "Should I sell before I buy my next home?",
        a: "It depends on your equity position and your risk tolerance. Selling first gives you certainty and buying power; buying first gives you continuity but exposes you to carrying two properties. We map both sequences with your actual numbers.",
      },
      {
        q: "What does it cost to sell?",
        a: "Plan for commissions, escrow and title fees, county transfer charges, prorated taxes, any negotiated repairs or credits, and your loan payoff. These are modeled line by line before you list, not estimated afterward.",
      },
    ],
  },

  buyers: {
    slug: "/buyers",
    navLabel: "Buyers",
    metaTitle: "Buying a Home in Orange County — A Clear Plan | Legacy Forge",
    metaDescription:
      "Financing options, real leverage, inspection strategy, and a walk-away number. A structured buying plan for Orange County purchasers.",
    eyebrow: "For buyers",
    headline: "Buy with a plan, not with adrenaline.",
    subhead:
      "The buyers who do well are not the ones who bid the most. They are the ones who arrived with financing settled, a value ceiling written down, and a clear read on the seller's situation.",
    ...CTA,
    valueProps: [
      {
        title: "Financing is strategy, not paperwork",
        body: "Conventional, FHA, VA, jumbo, renovation, and adjustable structures each change your monthly cost, your closing timeline, and how a seller ranks your offer.",
      },
      {
        title: "Know your walk-away number",
        body: "Write it down before you tour. A number decided in advance is the only reliable defense against a competitive weekend.",
      },
      {
        title: "Inspections are leverage",
        body: "An inspection is not a pass or fail. It is a priced list of future obligations, and it is the most defensible negotiation tool you will hold.",
      },
    ],
    sections: [
      {
        heading: "Get your financing right before you shop",
        body: "A full underwritten pre-approval — not a soft pre-qualification — changes how your offer is received and shortens your close. Compare programs on total cost over your expected holding period, not on rate alone.",
        bullets: [
          "Compare rate, points, mortgage insurance, and lender fees as one number.",
          "Ask what happens to your approval if rates or your income change mid-search.",
          "Confirm your lender can perform on the timeline your offer promises.",
        ],
      },
      {
        heading: "Reading the seller's position",
        body: "Days on market, prior price changes, the listing's disclosure package, and whether the seller has already bought elsewhere tell you more about your leverage than any list price does.",
      },
      {
        heading: "From offer to keys",
        body: "Expect inspection, appraisal, loan conditions, title clearance, final walkthrough, funding, and recording. Every contingency has a date. Missing one can cost you your deposit, so the calendar is managed in writing from day one.",
      },
    ],
    faqs: [
      {
        q: "How much do I need for a down payment?",
        a: "It depends entirely on the loan program. VA and USDA can reach zero down for eligible buyers, FHA starts near 3.5 percent, and conventional programs run from 3 percent upward. Lower down payments cost more monthly, so the comparison must include mortgage insurance.",
      },
      {
        q: "Should I waive the inspection to win?",
        a: "Rarely, and never blindly. There are safer ways to strengthen an offer — shorter contingency windows, a larger deposit, an appraisal gap clause, or flexible possession — that do not leave you buying unknown structural or system risk.",
      },
      {
        q: "Is it better to wait for rates to drop?",
        a: "Rates move price competition as much as they move payments. Waiting can trade a lower rate for a higher purchase price and a more crowded field. The right answer depends on your holding period, which we model with you.",
      },
    ],
  },

  probate: {
    slug: "/probate",
    navLabel: "Probate",
    metaTitle: "Probate Real Estate in Orange County — Executor's Guide | Legacy Forge",
    metaDescription:
      "What an executor or administrator can and cannot do with real property, court confirmation, IAEA authority, notices, and timing. Orange County probate sales.",
    eyebrow: "For executors and administrators",
    headline: "Understand your authority before you list anything.",
    subhead:
      "Probate real estate is not a normal sale. What you may do, when you may do it, and whether the court must confirm it all depend on the authority granted in your letters.",
    ...CTA,
    valueProps: [
      {
        title: "Authority determines the process",
        body: "Full independent authority, limited authority, and no authority produce three very different sale paths, timelines, and disclosure obligations.",
      },
      {
        title: "Timing is a fiduciary duty",
        body: "Carrying costs, insurance status, and property condition are all charged against the estate. Delay is not neutral — it is measurable.",
      },
      {
        title: "Beneficiaries are stakeholders",
        body: "A documented, defensible process protects you personally as much as it protects the estate's value.",
      },
    ],
    sections: [
      {
        heading: "Before the property goes on the market",
        body: "Confirm the letters and the authority they grant. Confirm the property is insured under a vacancy-appropriate policy. Secure the property, document its condition, and establish date-of-death value — that value drives both the estate accounting and the eventual tax basis.",
        bullets: [
          "Locate the letters testamentary or letters of administration.",
          "Confirm whether independent administration authority applies.",
          "Establish and document date-of-death value.",
          "Verify insurance covers a vacant or tenant-occupied structure.",
        ],
      },
      {
        heading: "Court confirmation and overbid",
        body: "Where court confirmation is required, an accepted offer is a starting bid subject to overbid at a hearing. That reality changes how the property should be priced, how buyers should be prepared, and how you should evaluate the first offer.",
      },
      {
        heading: "Notice, disclosure, and defensibility",
        body: "Required notices to interested parties, the exemptions that apply to certain probate transfers, and the disclosures you still owe a buyer are all part of a record that a beneficiary may later review. Build that record deliberately.",
      },
    ],
    faqs: [
      {
        q: "Can I sell the house before probate is complete?",
        a: "Often yes, depending on the authority granted in your letters. With full independent authority the sale may proceed without court confirmation, subject to notice requirements. Without it, the court must confirm the sale.",
      },
      {
        q: "What is an overbid?",
        a: "When a sale requires court confirmation, the accepted offer is announced at a hearing where other buyers may bid higher under a statutory increment formula. The original buyer can be outbid at that hearing.",
      },
      {
        q: "Do I have to make repairs?",
        a: "Usually not. Most probate properties sell in present condition with full disclosure of what is known. Spending estate funds on improvements requires a defensible reason that the improvement will return more than it costs.",
      },
    ],
  },

  "inherited-property": {
    slug: "/inherited-property",
    navLabel: "Inherited Property",
    metaTitle: "I Inherited a House — Keep, Rent, or Sell? | Legacy Forge",
    metaDescription:
      "Stepped-up basis, carrying costs, co-owner disagreements, and the real math behind keeping, renting, or selling an inherited property in California.",
    eyebrow: "For heirs and families",
    headline: "Keep it, rent it, or sell it — see the real math first.",
    subhead:
      "Inherited property decisions are made under grief, time pressure, and family opinion. The way through is to put the numbers and the deadlines on one page.",
    ...CTA,
    valueProps: [
      {
        title: "Basis changes everything",
        body: "Property inherited at death generally receives a basis adjustment to its date-of-death value, which can dramatically reduce or eliminate the capital gain on a near-term sale.",
      },
      {
        title: "Carrying cost is the silent decision",
        body: "Taxes, insurance, utilities, maintenance, and any remaining mortgage accrue every month while the family deliberates. That number belongs in the comparison.",
      },
      {
        title: "Co-owners need a process",
        body: "When siblings hold the property together, the structure of ownership and the exit agreement matter more than anyone's preference in the moment.",
      },
    ],
    sections: [
      {
        heading: "Three paths, priced honestly",
        body: "Sell now: capture the stepped-up basis, end the carrying cost, and divide clean proceeds. Rent it: generate income but accept management, vacancy, and eventual capital gain on appreciation after the step-up. Keep it for family use: real value, real cost, and a real need for a written cost-sharing agreement.",
      },
      {
        heading: "The property tax question",
        body: "California's rules on transferring a parent's assessed value to a child are narrower than most families assume, and they generally require the property to become the heir's principal residence within a fixed window. This one factor can change the entire decision, so confirm it early with your tax counsel.",
      },
      {
        heading: "Getting agreement without a lawsuit",
        body: "When co-owners disagree, the alternatives are a buyout at an agreed value, a sale with proceeds divided, or a partition action. The first two are far cheaper. Establishing an independent value early removes the most common source of the argument.",
      },
    ],
    faqs: [
      {
        q: "Will we owe capital gains tax if we sell?",
        a: "Frequently far less than families expect. Because the basis generally steps up to date-of-death value, a sale soon after inheritance often produces a small gain or a small loss. Confirm your specific situation with a CPA.",
      },
      {
        q: "One sibling wants to keep it. What do we do?",
        a: "Establish an independent value, then structure a buyout of the other owners' interests, typically financed. If that is not feasible, a sale with divided proceeds is usually better for the family than a forced partition.",
      },
      {
        q: "Can we sell it as-is?",
        a: "Yes. Most inherited properties sell in present condition. The right question is whether targeted cleanup and access improvements would return more than they cost, which depends on the property and the buyer pool.",
      },
    ],
  },

  downsizing: {
    slug: "/downsizing",
    navLabel: "Downsizing",
    metaTitle: "Downsizing Your Home in Orange County — A Simple Plan | Legacy Forge",
    metaDescription:
      "Sequence the sale and the purchase, protect your equity, and move once. A practical downsizing plan for Orange County homeowners.",
    eyebrow: "For downsizers",
    headline: "Move to something smaller without losing your equity in the process.",
    subhead:
      "The hardest part of downsizing is not the smaller house. It is the order of operations — and being exposed in the gap between selling and buying.",
    ...CTA,
    valueProps: [
      {
        title: "Sequence beats speed",
        body: "Sell-then-buy, buy-then-sell, and simultaneous close each carry different risks. Choose deliberately rather than by accident.",
      },
      {
        title: "Protect the equity you are moving",
        body: "For most downsizers this is the largest single financial transaction of their life. The proceeds plan should be settled before the listing goes live.",
      },
      {
        title: "One move, not three",
        body: "Rent-backs, delayed possession, and staged packing eliminate the double move that costs both money and morale.",
      },
    ],
    sections: [
      {
        heading: "Choosing your sequence",
        body: "Selling first gives you a known number and a strong buying position, at the cost of interim housing. Buying first gives you continuity, at the cost of carrying two properties or relying on bridge financing. A negotiated rent-back after your sale is frequently the cleanest middle path.",
        bullets: [
          "Sell first with a rent-back: certainty plus continuity, negotiated up front.",
          "Buy first: needs bridge capacity and tolerance for a carrying period.",
          "Simultaneous close: cleanest on paper, hardest to schedule.",
        ],
      },
      {
        heading: "What the smaller home really costs",
        body: "Compare the full monthly picture: payment, taxes at the new assessed value, insurance, any association dues, and utilities. A smaller home in a higher-assessment community can cost more monthly than the home you left.",
      },
      {
        heading: "Emptying decades of a house",
        body: "Sort into keep, gift, sell, donate, and discard, and start with the categories that carry the least emotional weight. Senior move managers and estate sale professionals earn their fee on larger properties.",
      },
    ],
    faqs: [
      {
        q: "Can I transfer my property tax base to my new home?",
        a: "California allows eligible homeowners — generally those 55 or older, severely disabled, or affected by disaster — to transfer their assessed value to a replacement primary residence, subject to conditions and limits. Confirm eligibility before you commit to a purchase.",
      },
      {
        q: "Should I pay cash for the smaller home?",
        a: "It depends on your income needs, tax position, and whether a mortgage would preserve liquidity you would otherwise be short of. This is a cash-flow decision, not a philosophical one.",
      },
      {
        q: "How long does a downsizing move take?",
        a: "Plan for sixty to ninety days from decision to keys, and longer if the property needs clearing. Starting the sorting work before the listing is the single largest schedule saver.",
      },
    ],
  },

  "distressed-property": {
    slug: "/distressed-property",
    navLabel: "Distressed Property",
    metaTitle: "Behind on Payments? Foreclosure, Short Sale, and Workout Options | Legacy Forge",
    metaDescription:
      "Compare foreclosure, short sale, loan modification, forbearance, deed in lieu, and selling with equity. Understand your options while you still have all of them.",
    eyebrow: "For homeowners under pressure",
    headline: "Get the real options on the table while you still have all of them.",
    subhead:
      "Almost every bad outcome in a distressed property situation traces to one thing: waiting too long. Options narrow on a schedule, and that schedule is public record.",
    ...CTA,
    valueProps: [
      {
        title: "Equity changes the answer",
        body: "If there is equity in the property, a standard sale is often available and far better than any distressed path. That question gets answered first.",
      },
      {
        title: "The timeline is not negotiable",
        body: "Notice of default, notice of trustee's sale, and the sale date follow statutory intervals. Each one closes doors behind it.",
      },
      {
        title: "Compare consequences, not labels",
        body: "Credit impact, deficiency exposure, tax treatment, and future buying eligibility differ sharply between a short sale, a deed in lieu, and a completed foreclosure.",
      },
    ],
    sections: [
      {
        heading: "Start with one question: is there equity?",
        body: "Take the current market value, subtract every lien and the estimated cost of sale. A positive number usually means you can sell conventionally, pay everyone, and walk away with proceeds — no lender approval required, no short sale, no foreclosure on your record.",
      },
      {
        heading: "When there is no equity",
        body: "The realistic paths are a loan modification or repayment plan, forbearance if the hardship is temporary, a short sale with lender approval, a deed in lieu of foreclosure, or allowing the foreclosure to complete. Each carries different credit, tax, and deficiency consequences that must be evaluated with an attorney and a CPA.",
        bullets: [
          "Modification or repayment plan: keeps the home if income has recovered.",
          "Forbearance: pauses payments for a defined temporary hardship.",
          "Short sale: lender accepts less than owed; requires approval and documentation.",
          "Deed in lieu: voluntary transfer; usually requires no junior liens.",
        ],
      },
      {
        heading: "Beware of anyone promising to save your home for a fee",
        body: "Advance-fee rescue offers, title transfers to a third party for a promise of leaseback, and pressure to sign documents you have not read are the recurring patterns in foreclosure fraud. Nothing in a legitimate process requires you to sign away title to keep your home.",
      },
    ],
    faqs: [
      {
        q: "What is the difference between a short sale and a foreclosure?",
        a: "A short sale is a voluntary sale for less than the loan balance, with lender approval, that you control and participate in. A foreclosure is an involuntary process the lender runs to recover the property. The short sale generally causes less credit damage and shortens the wait before you can finance a home again, but it requires lender cooperation and documentation.",
      },
      {
        q: "Will I owe taxes on forgiven debt?",
        a: "Sometimes. Forgiven mortgage debt can be treated as income, with important exclusions for insolvency and certain qualified principal residence debt. This must be reviewed with a CPA for your specific facts.",
      },
      {
        q: "How late is too late?",
        a: "Options exist right up to the trustee's sale date, but they shrink fast. The strongest position is before the notice of default is recorded, and the meaningful work becomes far harder after the notice of trustee's sale.",
      },
    ],
  },

  investing: {
    slug: "/investing",
    navLabel: "Investing",
    metaTitle: "Real Estate Investing in Orange County — Underwrite First | Legacy Forge",
    metaDescription:
      "Cash flow, cap rate, 1031 exchanges, DSCR financing, and entity structure. An underwriting-first approach to Orange County investment property.",
    eyebrow: "For investors",
    headline: "Underwrite before you fall in love with a property.",
    subhead:
      "Returns are decided at acquisition. Financing structure, holding entity, and exit plan should all be settled before you write the offer.",
    ...CTA,
    valueProps: [
      {
        title: "The numbers come first",
        body: "Rent, vacancy, management, maintenance reserve, taxes at the new assessed value, insurance, and debt service. If it does not work on paper it will not work in reality.",
      },
      {
        title: "Structure before signature",
        body: "How you take title — individually, in an LLC, in a partnership, or in trust — affects liability, financing, and your eventual exit.",
      },
      {
        title: "Plan the exit at entry",
        body: "Hold, refinance, 1031 exchange, or sell. Each has a deadline structure, and the 1031 timeline in particular is unforgiving.",
      },
    ],
    sections: [
      {
        heading: "A defensible underwriting model",
        body: "Start with realistic market rent, not optimistic rent. Apply vacancy, management, and a maintenance reserve even if you plan to self-manage — your time has a cost and deferred maintenance is not optional. Then reprice the property taxes at your purchase price, which is where most first-time investor models fail.",
      },
      {
        heading: "Financing an investment property",
        body: "Conventional investment loans, portfolio lending, DSCR loans underwritten on the property's income rather than your personal income, and seller financing each change your leverage and your qualification path. DSCR products in particular open capacity for investors whose tax returns understate their real income.",
      },
      {
        heading: "1031 exchanges",
        body: "A properly structured exchange defers capital gain when you reinvest into like-kind property, but the identification and closing deadlines are strict and begin at your sale closing. The qualified intermediary must be engaged before that closing — not after.",
      },
    ],
    faqs: [
      {
        q: "Does Orange County cash flow?",
        a: "Rarely on day one at conventional leverage. Most Orange County investment cases are built on appreciation, principal paydown, tax treatment, and eventual refinance rather than immediate positive cash flow. That should be an explicit choice, not a surprise.",
      },
      {
        q: "Should I hold property in an LLC?",
        a: "An LLC can provide liability separation and clean partner accounting, but it can also complicate residential financing and add annual cost. The right answer depends on the number of properties, your partners, and your lender.",
      },
      {
        q: "How fast does a 1031 exchange move?",
        a: "You generally have 45 days from your sale closing to identify replacement property and 180 days to complete the purchase. Missing either deadline collapses the deferral, so replacement candidates should be identified before you close the sale.",
      },
    ],
  },

  resources: {
    slug: "/resources",
    navLabel: "Resources",
    metaTitle: "Real Estate Guides and Decision Tools | Legacy Forge",
    metaDescription:
      "The Legacy Forge guide library: selling, buying, probate, inherited property, 1031 exchanges, title, ownership structures, loan programs, and distressed property.",
    eyebrow: "Guide library",
    headline: "Seventeen guides. One consistent standard.",
    subhead:
      "Every guide is written to be useful on its own, whether or not you ever work with us. Each one moves through drafting, editorial, QA, and canonical review before publication.",
    ...CTA,
    valueProps: [
      {
        title: "Written to be read",
        body: "Plain language, real numbers, and explicit trade-offs. No filler chapters and no disguised sales pitch.",
      },
      {
        title: "Decision tools included",
        body: "Interactive decision trees and structured checklists turn a long read into an answer you can act on today.",
      },
      {
        title: "Cross-referenced",
        body: "Title, closing, ownership structure, and financing guides link to one another so you can follow a question all the way through.",
      },
    ],
    sections: [
      {
        heading: "Selling and buying",
        body: "The Home Seller Guide, the Buyer's Guide, The Seller's 30 Questions, The Buyer's 30 Questions, and Best Home Upgrades to Do and Not Do.",
      },
      {
        heading: "Life events and transitions",
        body: "The Inherited Property Guide, the Divorce Guide, The California Surviving Spouse Property Guide, and When You Move: The Complete Relocation Guide.",
      },
      {
        heading: "Structure, title, and financing",
        body: "The Title Guide, How to Hold Title When You Buy, Trusts LLCs and Partnerships for Real Estate, The Loan Program Guide, and the 1031 Exchange Guide.",
      },
      {
        heading: "Distress and investment",
        body: "Foreclosure vs. Short Sale — including the interactive distressed-property decision tree — and Buying or Selling a Second Home.",
      },
    ],
    faqs: [
      {
        q: "Are the guides free?",
        a: "Yes. They are published as educational resources. Some are also offered as downloadable versions in exchange for an email address so we can send related updates.",
      },
      {
        q: "How current are they?",
        a: "Each guide carries a publication stage and is revised when market conditions or the underlying rules change. Nothing is published without editorial and QA review.",
      },
      {
        q: "Do the guides replace legal or tax advice?",
        a: "No. They explain how things work so you can ask your attorney and CPA better questions. Structure, tax, and probate decisions should always be confirmed with your own professionals.",
      },
    ],
  },

  "local-guides": {
    slug: "/local-guides",
    navLabel: "Local Guides",
    metaTitle: "Orange County Local Market Guides — La Habra, Brea, Fullerton | Legacy Forge",
    metaDescription:
      "Local market intelligence for La Habra, Brea, Fullerton, Whittier, La Mirada, Yorba Linda, Orange, and greater Orange County.",
    eyebrow: "Local market intelligence",
    headline: "Real estate is national news and local reality.",
    subhead:
      "Rates and headlines are the same everywhere. Inventory, buyer pools, school boundaries, assessment patterns, and days on market are not.",
    ...CTA,
    valueProps: [
      {
        title: "City-level, not county-level",
        body: "A Brea seller and a Whittier seller face different buyer pools, different price sensitivity, and different competition.",
      },
      {
        title: "Situation-specific",
        body: "Local pages carry the seller, probate, downsizing, and inherited-property angles that actually apply in each community.",
      },
      {
        title: "Updated with the market",
        body: "Market posts follow the data, not a publishing calendar.",
      },
    ],
    sections: [
      {
        heading: "Communities we cover",
        body: "La Habra, Brea, Fullerton, Whittier, La Mirada, Yorba Linda, Orange, and the surrounding north Orange County submarkets. City hub pages, seller pages, probate pages, downsizing pages, and inherited-property pages are being published community by community.",
      },
      {
        heading: "What a local page tells you",
        body: "How homes in that community are currently being priced and absorbed, what buyers there are responding to, which improvements return locally, and how the probate, downsizing, and inherited-property paths tend to play out in that market.",
      },
    ],
    faqs: [
      {
        q: "Do you work outside these cities?",
        a: "Yes. These are the communities where the local content is deepest, but the work extends across Orange County and adjacent Los Angeles County submarkets.",
      },
      {
        q: "Can I get a market update for my street?",
        a: "Yes. A property-specific review covers recent nearby closings, current competition, and what your home would likely do in today's market. Request one from the contact page.",
      },
    ],
  },

  about: {
    slug: "/about",
    navLabel: "About",
    metaTitle: "About Legacy Forge and Joe Melendez | JM Advisory Press",
    metaDescription:
      "Legacy Forge is the research and advisory system behind Joe Melendez's real estate practice: governed guides, decision tools, and a clear plan for every situation.",
    eyebrow: "About",
    headline: "A research system behind a real estate practice.",
    subhead:
      "Legacy Forge exists because most real estate advice arrives as opinion. We built a system that produces reviewed, consistent, situation-specific guidance instead.",
    ...CTA,
    valueProps: [
      {
        title: "Governed, not improvised",
        body: "Every published guide passes through drafting, editorial review, quality assurance, and canonical approval. Revisions are tracked.",
      },
      {
        title: "Situation-first",
        body: "A probate administrator, a downsizer, and an investor need different things. The system is organized around those situations rather than around listings.",
      },
      {
        title: "Useful before you hire anyone",
        body: "The guides and tools are designed to be genuinely valuable on their own. That is the point.",
      },
    ],
    sections: [
      {
        heading: "What we do",
        body: "Represent sellers, buyers, executors and administrators, heirs, downsizers, homeowners under financial pressure, and investors across Orange County — supported by a documented research library and structured decision tools rather than by improvisation.",
      },
      {
        heading: "How we work",
        body: "Every engagement starts with the numbers and the timeline. We model the outcome before recommending an action, we put the plan in writing, and we tell you when the right answer is to do nothing yet.",
      },
      {
        heading: "Who we work with",
        body: "We coordinate regularly with probate and estate-planning attorneys, CPAs, fiduciaries, financial advisors, and senior move managers, because the real estate decision is usually one part of a larger picture.",
      },
    ],
    faqs: [
      {
        q: "What is JM Advisory Press?",
        a: "JM Advisory Press is the publishing entity behind the Legacy Forge guide library and its governance process.",
      },
      {
        q: "Do you charge for a consultation?",
        a: "No. An initial strategy call is a working conversation about your situation, your numbers, and your options.",
      },
    ],
  },

  contact: {
    slug: "/contact",
    navLabel: "Contact",
    metaTitle: "Book a Real Estate Strategy Call | Legacy Forge",
    metaDescription:
      "Book a no-cost strategy call about selling, buying, probate, inherited property, downsizing, distressed property, or investing in Orange County.",
    eyebrow: "Contact",
    headline: "Tell us the situation. We'll tell you the options.",
    subhead:
      "A strategy call is a working conversation: your numbers, your timeline, and the realistic paths in front of you. No obligation, and no pressure to list.",
    ...CTA,
    valueProps: [
      {
        title: "You'll leave with a plan",
        body: "Even if the plan is to wait, you will know what you are waiting for and what would change the answer.",
      },
      {
        title: "Bring your questions",
        body: "Bring the payoff figure, the tax bill, the letters, the notice, or nothing at all. We will work with what you have.",
      },
      {
        title: "We'll say when it's not us",
        body: "If your situation needs an attorney, a CPA, or a fiduciary first, we will tell you and point you in that direction.",
      },
    ],
    sections: [
      {
        heading: "What to expect",
        body: "A short intake so the conversation is useful, a review of your property and your situation, a walkthrough of the realistic options with their trade-offs, and a written summary of what was discussed.",
      },
      {
        heading: "Urgent situations",
        body: "If you have received a notice of default or a notice of trustee's sale, say so in your message. Those situations are scheduled first because the timeline is statutory.",
      },
    ],
    faqs: [
      {
        q: "How quickly will I hear back?",
        a: "Same business day for most inquiries, and immediately for notices of default or trustee's sale.",
      },
      {
        q: "Am I committing to anything?",
        a: "No. A strategy call is not a listing agreement and does not obligate you to work with us.",
      },
    ],
  },

  privacy: {
    slug: "/privacy",
    navLabel: "Privacy",
    metaTitle: "Privacy Policy | Legacy Forge",
    metaDescription:
      "How Legacy Forge and JM Advisory Press collect, use, store, and share personal information submitted through this website.",
    eyebrow: "Legal",
    headline: "Privacy Policy",
    subhead:
      "This policy explains what information this website collects, why it is collected, and what is done with it.",
    ...CTA,
    legal: true,
    valueProps: [],
    sections: [
      {
        heading: "Information we collect",
        body: "We collect information you submit directly — such as your name, email address, phone number, property address, and the details of your situation — along with standard technical information about your visit, including pages viewed, referring source, and campaign parameters.",
      },
      {
        heading: "How we use it",
        body: "To respond to your inquiry, to deliver requested guides and resources, to send related educational updates you can unsubscribe from at any time, and to understand which content is useful so we can improve it.",
      },
      {
        heading: "Sharing",
        body: "We do not sell personal information. We share it with service providers who operate this site and our customer relationship management system, and with professionals directly involved in your transaction when you ask us to. We disclose information where required by law.",
      },
      {
        heading: "Your choices",
        body: "You may request access to, correction of, or deletion of your personal information, and you may opt out of marketing communications at any time using the unsubscribe link in any email or by contacting us directly.",
      },
      {
        heading: "Cookies and analytics",
        body: "This site uses cookies and similar technologies for basic functionality and to measure traffic and campaign performance. You can control cookies through your browser settings.",
      },
      {
        heading: "Contact",
        body: "Questions about this policy can be sent through the contact page.",
      },
    ],
    faqs: [],
  },

  terms: {
    slug: "/terms",
    navLabel: "Terms",
    metaTitle: "Terms of Use | Legacy Forge",
    metaDescription:
      "The terms governing use of the Legacy Forge website, its guides, and its interactive tools.",
    eyebrow: "Legal",
    headline: "Terms of Use",
    subhead: "By using this website you agree to these terms.",
    ...CTA,
    legal: true,
    valueProps: [],
    sections: [
      {
        heading: "Use of the site",
        body: "This website and its content are provided for informational purposes. You may read, download, and share the published guides for personal use. You may not republish, resell, or present the content as your own.",
      },
      {
        heading: "No professional relationship",
        body: "Using this site, downloading a guide, or completing an assessment does not create an agency, legal, tax, or fiduciary relationship. A representation relationship begins only under a signed written agreement.",
      },
      {
        heading: "Accuracy",
        body: "Content is prepared carefully and reviewed before publication, but law, market conditions, and program rules change. Content is provided without warranty of continued accuracy.",
      },
      {
        heading: "Third-party links",
        body: "Links to third-party resources are provided for convenience. We are not responsible for their content or practices.",
      },
      {
        heading: "Limitation of liability",
        body: "To the fullest extent permitted by law, we are not liable for indirect or consequential damages arising from use of this site or reliance on its content.",
      },
      {
        heading: "Changes",
        body: "These terms may be updated. Continued use of the site after an update constitutes acceptance of the revised terms.",
      },
    ],
    faqs: [],
  },

  accessibility: {
    slug: "/accessibility",
    navLabel: "Accessibility",
    metaTitle: "Accessibility Statement | Legacy Forge",
    metaDescription:
      "Legacy Forge's commitment to WCAG 2.1 AA accessibility, the standards we test against, and how to report a barrier.",
    eyebrow: "Legal",
    headline: "Accessibility Statement",
    subhead:
      "We intend this site to be usable by everyone, including people who use assistive technology.",
    ...CTA,
    legal: true,
    valueProps: [],
    sections: [
      {
        heading: "Our standard",
        body: "We target conformance with the Web Content Accessibility Guidelines 2.1 at Level AA. This includes sufficient color contrast, keyboard operability, meaningful headings and landmarks, descriptive link text, visible focus states, and text alternatives for meaningful images.",
      },
      {
        heading: "How we test",
        body: "Automated accessibility checks run against the site's pages as part of our regular quality assurance process, and issues classified as serious or critical are treated as release blockers.",
      },
      {
        heading: "Known limitations",
        body: "Third-party embedded content and documents provided by outside parties may not meet the same standard. Where we identify a barrier we work to provide the same information in an accessible form.",
      },
      {
        heading: "Reporting a barrier",
        body: "If you encounter something on this site you cannot use, contact us through the contact page and describe the page and the difficulty. We will respond and provide the information you need in an alternative format.",
      },
    ],
    faqs: [],
  },

  disclaimer: {
    slug: "/disclaimer",
    navLabel: "Disclaimer",
    metaTitle: "Disclaimer | Legacy Forge",
    metaDescription:
      "Educational content only. Legacy Forge does not provide legal, tax, or financial advice, and no results are guaranteed.",
    eyebrow: "Legal",
    headline: "Disclaimer",
    subhead: "Read this before relying on anything published here.",
    ...CTA,
    legal: true,
    valueProps: [],
    sections: [
      {
        heading: "Educational content only",
        body: "Everything published on this site — guides, articles, checklists, decision trees, and assessments — is educational. It is not legal advice, tax advice, financial advice, or investment advice, and it is not a substitute for professional counsel on your specific facts.",
      },
      {
        heading: "Consult your own professionals",
        body: "Probate, trust, title, ownership-structure, tax, and distressed-property decisions have consequences that depend on details this site cannot know. Confirm every such decision with a licensed attorney and a qualified tax professional before acting.",
      },
      {
        heading: "No guaranteed results",
        body: "Market outcomes, sale prices, timelines, loan approvals, and tax treatments vary. Nothing here should be read as a promise of a particular result.",
      },
      {
        heading: "Fair housing",
        body: "We conduct all business in accordance with federal, state, and local fair housing law. We do not steer, and we do not describe communities in terms of protected characteristics.",
      },
      {
        heading: "Licensing",
        body: "Real estate services are provided by a licensed California real estate professional. License and brokerage information is available on request and appears on all transactional documents.",
      },
    ],
    faqs: [],
  },
};

export const PUBLIC_NAV: { label: string; to: string }[] = [
  { label: "Home", to: "/home" },
  { label: "Sellers", to: "/sellers" },
  { label: "Buyers", to: "/buyers" },
  { label: "Probate", to: "/probate" },
  { label: "Inherited", to: "/inherited-property" },
  { label: "Downsizing", to: "/downsizing" },
  { label: "Distressed", to: "/distressed-property" },
  { label: "Investing", to: "/investing" },
  { label: "Resources", to: "/resources" },
  { label: "Local", to: "/local-guides" },
  { label: "Guides", to: "/guides" },
  { label: "Assessments", to: "/assessments" },
  { label: "Professionals", to: "/for/attorneys" },

  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
];

export const PUBLIC_LEGAL_NAV: { label: string; to: string }[] = [
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
  { label: "Accessibility", to: "/accessibility" },
  { label: "Disclaimer", to: "/disclaimer" },
];

/** Paths that render the public marketing shell instead of the console. */
export const PUBLIC_PATHS: string[] = [
  ...PUBLIC_NAV.map(n => n.to),
  ...PUBLIC_LEGAL_NAV.map(n => n.to),
  "/refer",
];

/** Public path prefixes for dynamic public routes (e.g. city guides). */
export const PUBLIC_PATH_PREFIXES: string[] = [
  "/local-guides/",
  "/guides/",
  "/assessments/",
  "/for/",
];



export function isPublicPath(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (PUBLIC_PATHS.includes(clean)) return true;
  return PUBLIC_PATH_PREFIXES.some(p => `${clean}/`.startsWith(p));
}

