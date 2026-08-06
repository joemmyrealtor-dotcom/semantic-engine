// Consumer-facing guide library (Publications module).
// Editorial voice: plain-language, decision-oriented, advisor-neutral.
// Fields omitted here (description/editorialNotes/stage/etc.) are backfilled by migrateSnapshot().
import type { PublicationBlueprint } from "./schema";

const now = "2026-08-01T09:00:00.000Z";
const ts = { createdAt: now, updatedAt: now };

type Ch = {
  id: string;
  order: number;
  title: string;
  description: string;
  learningObjectives: string[];
};

function chapters(prefix: string, list: Omit<Ch, "id" | "order">[]) {
  return list.map((c, i) => ({
    id: `${prefix}-${String(i + 1).padStart(2, "0")}`,
    order: i + 1,
    title: c.title,
    description: c.description,
    learningObjectives: c.learningObjectives,
    domainIds: [],
    conceptIds: [],
    frameworkIds: [],
    knowledgeObjectIds: [],
    clientToolIds: [],
    presentationLinks: [],
    presentations: [],
    editorialNotes: "",
    estimatedEffortHours: 6,
    chapterVersion: "1.0.0",
    parentChapterId: null,
    reviewStatus: "Canonical",
    manufacturingStage: "Published",
  }));
}

function guide(p: {
  id: string;
  title: string;
  audience: string;
  purpose: string;
  description: string;
  tags: string[];
  chapters: ReturnType<typeof chapters>;
}) {
  return {
    id: p.id,
    title: p.title,
    audience: p.audience,
    purpose: p.purpose,
    description: p.description,
    tags: p.tags,
    chapters: p.chapters,
    status: "Canonical",
    version: "1.0.0",
    steward: "Editorial Board",
    owner: "Editorial Board",
    frameworkId: null,
    publicationType: "Guide",
    effectiveDate: now,
    reviewDate: "2027-08-01T09:00:00.000Z",
    editorialNotes: "Consumer guide series. Written for clarity first: short sentences, concrete numbers, no jargon without definition.",
    reviewNotes: "Educational content only. Not legal, tax, or investment advice; jurisdiction-specific rules must be confirmed locally.",
    manufacturingStage: "Published",
    stageHistory: [{ stage: "Published", at: now, actor: "Editorial Board", note: "Initial release of consumer guide series." }],
    archived: false,
    presentations: [],
    ...ts,
  };
}

export const seedGuidePublications: PublicationBlueprint[] = ([
  guide({
    id: "PL-201",
    title: "The Home Seller's Guide",
    audience: "Homeowners preparing to sell, and the advisors guiding them",
    purpose: "Give sellers a clear, sequenced plan that maximizes net proceeds while controlling stress, timing, and risk.",
    description:
      "Selling is a project with a deadline, a budget, and a buyer audience. This guide runs the project end to end: what your home is actually worth, what to fix and what to leave, how pricing psychology drives your first ten days, how to read an offer past the headline number, and how to keep a deal together through inspection, appraisal, and closing.",
    tags: ["seller", "pricing", "negotiation", "net proceeds", "listing"],
    chapters: chapters("CH-SG", [
      {
        title: "Start With Net, Not Price",
        description:
          "Sale price is a headline; net proceeds are the story. Before anything else, build a one-page estimate: expected sale price, loan payoff, commissions, transfer taxes and title fees, prorated property taxes, concessions, repairs, and moving costs. Sellers who know their walk-away number negotiate calmly, because they know exactly which concessions still clear their floor.",
        learningObjectives: [
          "Build a net-proceeds estimate with every deduction line itemized",
          "Identify your walk-away floor before the first showing",
          "Separate costs you control (repairs, staging) from costs you don't (payoff, taxes)",
          "Model two scenarios: a fast sale at a lower price versus a slower sale at a higher price",
        ],
      },
      {
        title: "Reading Your Real Market",
        description:
          "Markets are local, seasonal, and price-band specific. Three numbers tell you almost everything: months of inventory, median days on market for your price band, and the sale-to-list ratio for the last 90 days. Under roughly three months of inventory, sellers hold leverage; above six, buyers do. Everything else in this guide is calibrated to those readings.",
        learningObjectives: [
          "Interpret months of inventory, days on market, and sale-to-list ratio",
          "Compare your home to true comparables rather than aspirational listings",
          "Recognize when your price band behaves differently from the overall market",
          "Adjust timing expectations to seasonality instead of anecdote",
        ],
      },
      {
        title: "Pre-Listing Preparation: What Actually Pays",
        description:
          "Buyers pay for condition they can see and financing they can obtain. High-return work is nearly always cosmetic and functional: paint, light, flooring transitions, landscaping at the curb, deep cleaning, decluttering, and repairing anything that reads as deferred maintenance. Low-return work is anything taste-specific or over-improved for the block. When in doubt, fix what an inspector will find and clean what a camera will show.",
        learningObjectives: [
          "Rank preparation tasks by return per dollar and per day",
          "Distinguish repairs that protect financing from upgrades that chase taste",
          "Decide when a pre-listing inspection reduces renegotiation risk",
          "Set a preparation budget with a hard cap and a completion date",
        ],
      },
      {
        title: "Pricing Strategy and the First Ten Days",
        description:
          "Your listing gets its largest audience in the first ten days, and that audience never returns at full size. Price at or slightly below the level where the most qualified buyers are already searching, and let competition set the ceiling. Overpricing does not test the market; it trains the market to wait for your reduction, and stale days-on-market becomes a negotiating weapon against you.",
        learningObjectives: [
          "Price into an active search band rather than above it",
          "Anticipate the traffic curve and plan the first-ten-day response",
          "Set reduction triggers in advance (showings, saves, and feedback thresholds)",
          "Avoid the reduction spiral caused by chasing a falling market",
        ],
      },
      {
        title: "Marketing That Moves Qualified Buyers",
        description:
          "Most buyers decide from a phone screen before they ever open a door. That makes photography, the first three images, the headline, and the first two lines of description the highest-leverage marketing assets you own. Everything after that — floor plans, video walkthroughs, neighborhood context, and open-house cadence — exists to convert interest into a showing and a showing into an offer.",
        learningObjectives: [
          "Evaluate listing photography and image sequencing critically",
          "Write listing copy that leads with benefit, proof, and specificity",
          "Match marketing intensity to your market's inventory conditions",
          "Track the funnel: impressions, saves, showings, second showings, offers",
        ],
      },
      {
        title: "Evaluating Offers Beyond the Number",
        description:
          "The strongest offer is the one most likely to close at terms you can live with. Read financing type and lender quality, down payment and appraisal exposure, earnest money, contingency scope and timelines, requested concessions, possession terms, and the buyer's own contingencies. A slightly lower price with clean terms and a proven lender routinely nets more than a high offer built on fragile financing.",
        learningObjectives: [
          "Score offers on price, certainty, timeline, and flexibility",
          "Assess appraisal-gap and financing risk before accepting",
          "Use counteroffers to buy certainty rather than only price",
          "Manage multiple offers transparently and defensibly",
        ],
      },
      {
        title: "Inspection, Appraisal, and Renegotiation",
        description:
          "The second negotiation begins after acceptance. Expect requests; decide in advance which categories you will address (safety, structure, systems, and anything that threatens financing) and which you will decline (cosmetic and maintenance items). If the appraisal comes in low, your options are price adjustment, buyer cash contribution, a reconsideration of value with better comparables, or walking — choose based on your net floor, not your ego.",
        learningObjectives: [
          "Pre-decide repair-request policy by category",
          "Respond to a low appraisal with a structured, evidence-based process",
          "Use credits versus repairs strategically to protect timeline",
          "Keep the deal together without giving away your net position",
        ],
      },
      {
        title: "Closing, Possession, and the Clean Handoff",
        description:
          "The last two weeks are logistics, and logistics failures cost real money. Confirm payoff figures, clear title issues early, schedule the final walkthrough, coordinate utilities and possession, and document the condition you deliver. A calm, well-documented handoff prevents post-closing disputes and produces the referrals that follow a good experience.",
        learningObjectives: [
          "Build a two-week closing countdown with owners and deadlines",
          "Clear title and payoff issues before they become delays",
          "Prepare for the final walkthrough and possession terms",
          "Document delivered condition to prevent post-closing claims",
        ],
      },
    ]),
  }),

  guide({
    id: "PL-202",
    title: "The Buyer's Guide: Move-Up, Second Home, and Experienced Purchasers",
    audience: "Buyers who have owned before and are purchasing again",
    purpose: "Serve experienced buyers whose central challenge is sequencing, equity, and portfolio decisions — not learning the basics.",
    description:
      "This is not the first-time buyer guide. It is written for people who already own and must now solve harder problems: buying and selling in the same market, deploying existing equity, carrying two payments briefly, keeping a prior home as a rental, and buying a second home or relocation property without overexposing the household balance sheet.",
    tags: ["buyer", "move-up", "second home", "equity", "contingency"],
    chapters: chapters("CH-BG", [
      {
        title: "The Move-Up Math",
        description:
          "A move-up purchase is two transactions and one balance sheet. Model total housing cost after the move — payment, taxes, insurance, HOA, maintenance, and any rate change on the mortgage you are giving up. If you hold a below-market rate, quantify the cost of surrendering it and compare it honestly against the value of the space, location, or life change you are buying.",
        learningObjectives: [
          "Model post-move total housing cost, not just payment",
          "Price the true cost of giving up a below-market interest rate",
          "Set a maximum comfortable payment tied to net income and reserves",
          "Decide what the move must deliver to justify its cost",
        ],
      },
      {
        title: "Sequencing: Buy First, Sell First, or Bridge",
        description:
          "Every experienced buyer faces the same fork. Selling first maximizes certainty and buying power but risks an interim move. Buying first maximizes control of the new home but requires carrying capacity or a bridge product. A sale contingency preserves safety at the cost of competitiveness. Choose deliberately based on inventory conditions, reserves, and tolerance for disruption.",
        learningObjectives: [
          "Compare buy-first, sell-first, bridge, and contingent strategies",
          "Quantify carry cost and worst-case overlap duration",
          "Evaluate rent-back, extended closing, and bridge financing options",
          "Match strategy to current inventory and competition levels",
        ],
      },
      {
        title: "Putting Existing Equity to Work",
        description:
          "Equity is not automatically the right down payment. Compare a large down payment against reserves, renovation capital, debt payoff, and rate-buydown options. In many cases the highest-return use of equity is not maximizing loan-to-value but preserving liquidity and buying a lower rate.",
        learningObjectives: [
          "Compare equity uses: down payment, buydown, reserves, renovation, debt payoff",
          "Understand how down payment size affects rate, PMI, and monthly cost",
          "Maintain reserve targets after closing",
          "Coordinate proceeds timing between transactions",
        ],
      },
      {
        title: "Keep It or Sell It: The Rental Decision",
        description:
          "Converting a prior home into a rental is an investment decision, not a sentimental one. Run realistic numbers: market rent minus vacancy, management, maintenance reserve, taxes, insurance, and financing. Then compare the resulting yield on trapped equity against alternative uses, and weigh the tax consequences of losing a primary-residence exclusion window.",
        learningObjectives: [
          "Underwrite a rental conversion with realistic expense assumptions",
          "Calculate return on trapped equity rather than return on original price",
          "Identify the tax and insurance implications of conversion",
          "Decide based on capacity and temperament, not on market nostalgia",
        ],
      },
      {
        title: "Second Homes, Relocation, and Out-of-Area Purchases",
        description:
          "Buying away from home changes financing terms, insurance exposure, inspection logistics, and due diligence. Second-home and investment financing carries different rates and down payment requirements. Distance increases the value of local expertise, written condition documentation, and thorough disclosure review.",
        learningObjectives: [
          "Distinguish primary, second-home, and investment financing terms",
          "Build an out-of-area due diligence process you can trust remotely",
          "Assess insurance, climate, and carrying-cost exposure",
          "Plan for management, maintenance, and seasonality",
        ],
      },
      {
        title: "Competing Without Overpaying",
        description:
          "Competitiveness comes from certainty as much as price. Strong lender documentation, realistic timelines, appropriately scoped contingencies, sensible escalation, and clean communication frequently beat a higher, shakier offer. Set your walk-away number in writing before you write, and review every offer against it.",
        learningObjectives: [
          "Strengthen offers through certainty rather than price alone",
          "Use escalation clauses and appraisal-gap terms with limits",
          "Decide which contingencies are non-negotiable for your risk profile",
          "Hold a written pre-commitment through emotional negotiations",
        ],
      },
      {
        title: "Due Diligence for Experienced Buyers",
        description:
          "Experience creates blind spots. Read the disclosure package fully, order specialty inspections where the property type warrants them, review HOA financials and reserve studies, verify permits on prior work, and confirm insurability early. The cost of thorough diligence is trivial against the cost of a surprise after closing.",
        learningObjectives: [
          "Build a property-type-specific inspection plan",
          "Review HOA budgets, reserves, and pending assessments",
          "Verify permits and prior renovation quality",
          "Confirm insurability and premium levels before contingency removal",
        ],
      },
      {
        title: "Closing Two Transactions at Once",
        description:
          "Coordinated closings live or die on the calendar. Align funding dates, moving logistics, possession terms, and utility transfers, and build in slack for lender delays. Assign one person to own the combined timeline and confirm every dependency in writing.",
        learningObjectives: [
          "Build one combined timeline across both transactions",
          "Identify single points of failure and add slack",
          "Negotiate rent-back or delayed possession when needed",
          "Confirm funding and wire logistics well ahead of the deadline",
        ],
      },
    ]),
  }),

  guide({
    id: "PL-203",
    title: "The Inherited Property Guide",
    audience: "Heirs, executors, trustees, and the families they represent",
    purpose: "Turn an emotional and procedurally complex inheritance into a sequenced, defensible set of decisions.",
    description:
      "Inheriting property arrives with grief, deadlines, co-owners, and unfamiliar procedures. This guide sequences the work: establish authority, secure and insure the property, understand cost basis and holding costs, align multiple heirs, and choose between keeping, renting, and selling — with the documentation to support whichever path you take.",
    tags: ["inherited", "probate", "estate", "heirs", "cost basis"],
    chapters: chapters("CH-IP", [
      {
        title: "First 30 Days: Secure, Insure, Document",
        description:
          "Before any decision about the future, protect the asset. Secure the property and change locks, notify the insurer that the home is now vacant (standard policies often restrict vacancy), maintain utilities to prevent freeze and moisture damage, forward mail, and photograph every room and outbuilding. Vacant, uninsured property is where inherited value quietly disappears.",
        learningObjectives: [
          "Complete a first-30-day protection checklist",
          "Convert coverage to an appropriate vacant-property policy",
          "Document condition and contents before anything is removed",
          "Preserve utilities, maintenance, and security continuity",
        ],
      },
      {
        title: "Who Has Authority to Act",
        description:
          "Nothing can be sold or signed until authority is established. Determine how title is held: probate estate, revocable trust, joint tenancy with survivorship, transfer-on-death deed, or life estate. Each path has a different document that proves authority — letters testamentary, a certificate of trust, a recorded death certificate — and a different timeline.",
        learningObjectives: [
          "Identify the vesting method and the authority document it requires",
          "Distinguish probate, trust administration, and non-probate transfers",
          "Understand typical timelines and court-approval requirements",
          "Assemble the document package a title company will require",
        ],
      },
      {
        title: "Cost Basis, Step-Up, and Why Valuation Matters",
        description:
          "Inherited property generally receives a stepped-up basis to fair market value at the date of death, which can eliminate decades of embedded gain. That makes a defensible date-of-death valuation — a formal appraisal, not a website estimate — one of the highest-value hours in the entire process. Confirm treatment with a qualified tax professional; rules vary by state and by ownership structure.",
        learningObjectives: [
          "Explain stepped-up basis and its effect on taxable gain",
          "Commission a date-of-death appraisal and retain the documentation",
          "Recognize how holding period and later improvements affect basis",
          "Know which questions to bring to a tax professional",
        ],
      },
      {
        title: "The Real Cost of Holding",
        description:
          "Every month of indecision has a price: mortgage payments, property taxes, vacancy insurance premiums, utilities, landscaping, security, and deferred maintenance that compounds. Build a monthly carry number and a decision deadline. Families that quantify carry cost make faster, better decisions than families that debate indefinitely.",
        learningObjectives: [
          "Calculate a complete monthly carry cost",
          "Set an explicit decision deadline tied to that number",
          "Identify reverse mortgages, liens, and loans that force timing",
          "Plan funding for carry costs during administration",
        ],
      },
      {
        title: "When Heirs Disagree",
        description:
          "Multiple heirs with different finances, geographies, and attachments are the norm. Structure the conversation: agree on facts first (value, carry cost, condition), then on the decision process, then on the decision. Buyout, sale and split, and co-ownership agreements are all workable — undocumented co-ownership is not. Partition litigation is the expensive outcome of avoided conversations.",
        learningObjectives: [
          "Run a facts-first family decision meeting",
          "Structure a buyout with an independent valuation",
          "Document co-ownership terms, expenses, and exit rights",
          "Recognize when mediation is cheaper than partition",
        ],
      },
      {
        title: "Prepare and Clear the Property",
        description:
          "Most inherited homes need contents resolution before they need repairs. Sort in passes: documents and valuables first, family distribution second, estate sale or donation third, disposal last. Then decide the improvement level — as-is, clean-and-clear, or light cosmetic — based on buyer pool, carry cost, and available capital rather than on what the home 'deserves.'",
        learningObjectives: [
          "Run a structured contents and clearing process",
          "Choose an improvement level based on buyer pool and carry cost",
          "Decide when an estate sale or auction adds net value",
          "Protect documents needed for the estate and for closing",
        ],
      },
      {
        title: "Keep, Rent, or Sell",
        description:
          "Compare the three paths with the same math. Keeping means carry cost against personal use value. Renting means realistic net yield on the property's current value, plus management burden and the eventual loss of stepped-up-basis advantage. Selling converts an illiquid, jointly owned asset into divisible proceeds — usually while basis advantages are largest.",
        learningObjectives: [
          "Compare keep, rent, and sell on a single financial framework",
          "Evaluate rental yield against current value, not sentimental value",
          "Weigh liquidity, family dynamics, and management capacity",
          "Time a sale relative to basis and market conditions",
        ],
      },
      {
        title: "Selling an Inherited Home",
        description:
          "Estate sales carry specific friction: limited disclosure knowledge, deferred maintenance, court or trustee approvals, and buyers who expect a discount. Counter with documentation — appraisal, inspection, permits where available — and price to condition. Transparency about what you do and do not know is both legally safer and commercially stronger.",
        learningObjectives: [
          "Handle disclosure limits honestly and defensibly",
          "Price to condition with supporting documentation",
          "Manage court, trustee, or co-heir approval timelines",
          "Distribute proceeds cleanly with proper accounting",
        ],
      },
    ]),
  }),

  guide({
    id: "PL-204",
    title: "The Divorce and Real Estate Guide",
    audience: "Divorcing homeowners and the attorneys and advisors supporting them",
    purpose: "Provide neutral, structured guidance on the housing decisions that dominate divorce outcomes.",
    description:
      "The home is usually the largest asset, the most emotional one, and the one with the most irreversible decisions. This guide covers valuation, the three real options, refinance and assumption mechanics, credit and liability separation, timing, and the post-decree cleanup that prevents years of avoidable problems. It is educational only and never a substitute for counsel.",
    tags: ["divorce", "buyout", "refinance", "equity split", "post-decree"],
    chapters: chapters("CH-DV", [
      {
        title: "Establish the Facts Before the Feelings",
        description:
          "Negotiation without an agreed factual baseline produces bad settlements. Establish four numbers early: current market value from a neutral appraisal, exact payoff balances, net proceeds after costs of sale, and each party's independent qualifying capacity. Every option in this guide is evaluated against those four numbers.",
        learningObjectives: [
          "Commission a neutral valuation both parties accept",
          "Compute net equity after realistic costs of sale",
          "Determine each party's independent borrowing capacity",
          "Separate agreed facts from contested characterization",
        ],
      },
      {
        title: "Three Options, Honestly Compared",
        description:
          "There are only three outcomes: one party keeps the home and buys out the other, the home is sold and proceeds divided, or the parties co-own temporarily under a written agreement. Each has a cost profile and a risk profile. The keep-the-house instinct is the most common source of post-divorce financial distress when affordability is not tested rigorously.",
        learningObjectives: [
          "Compare buyout, sale, and deferred sale on cost and risk",
          "Stress-test single-income affordability including maintenance",
          "Structure a deferred-sale agreement with triggers and cost sharing",
          "Recognize when keeping the home is an unaffordable outcome",
        ],
      },
      {
        title: "Buyout Mechanics",
        description:
          "A buyout requires two things: a value both parties accept and financing that removes the departing spouse from the debt. Understand the difference between a cash-out refinance, an equity buyout loan, and a loan assumption where the program allows one. Removal from title does not remove liability on the loan — only refinance, assumption, or payoff does that.",
        learningObjectives: [
          "Distinguish title transfer from mortgage liability release",
          "Compare cash-out refinance, buyout loan, and assumption paths",
          "Use a deed and settlement language that lenders will accept",
          "Set a firm deadline and fallback if refinancing fails",
        ],
      },
      {
        title: "Credit, Liability, and Protection During the Process",
        description:
          "Until the loan is refinanced, assumed, or paid off, both parties remain liable, and a single missed payment damages both credit profiles. Agree in writing who pays what and when, verify payments monthly, keep insurance current with both parties named where appropriate, and avoid new joint debt.",
        learningObjectives: [
          "Document interim payment responsibility in writing",
          "Monitor credit and mortgage status during the proceeding",
          "Maintain insurance and title protection during separation",
          "Avoid actions that jeopardize future refinance qualification",
        ],
      },
      {
        title: "Selling During or After Divorce",
        description:
          "A jointly sold home requires joint decisions on price, repairs, showings, offers, and timing. Pre-agree the decision rules: who signs, how price reductions are approved, how repair credits are handled, and how proceeds are held and distributed. Written rules prevent the sale from becoming another litigation front.",
        learningObjectives: [
          "Establish written joint-decision rules before listing",
          "Coordinate occupancy, showings, and preparation fairly",
          "Handle offers and reductions through an agreed process",
          "Direct proceeds through escrow per the settlement terms",
        ],
      },
      {
        title: "Tax, Timing, and Support Interactions",
        description:
          "Filing status, the capital gains exclusion, transfer timing relative to the decree, and mortgage interest deductions all interact with housing decisions. Timing can be worth a great deal, and it is easy to lose an exclusion by waiting too long after moving out. Confirm every item with a qualified tax professional and coordinate with counsel.",
        learningObjectives: [
          "Understand how the primary-residence exclusion applies after separation",
          "Recognize timing effects of transfers relative to the decree",
          "Coordinate housing outcomes with support calculations",
          "Prepare the specific questions to bring to tax counsel",
        ],
      },
      {
        title: "Buying Again After Divorce",
        description:
          "Requalifying involves new documentation: the decree, support obligations counted as income or debt, seasoning requirements, and a credit profile that may have shifted. Plan the sequence — settle, refinance or sell, stabilize documentation, then buy. Rushing the purchase before the file is clean is the most common cause of denial.",
        learningObjectives: [
          "Assemble the documentation lenders require post-decree",
          "Understand how support is treated as income or liability",
          "Rebuild reserves and credit before applying",
          "Sequence settlement, disposition, and purchase realistically",
        ],
      },
      {
        title: "Post-Decree Property Cleanup",
        description:
          "The judgment is not the finish line. Record the deed, confirm loan liability release, update insurance and title, change beneficiary designations on retirement and life policies, update estate documents and powers of attorney, and file everything in one place. This checklist prevents the problems that surface five years later.",
        learningObjectives: [
          "Record and verify deed and title changes",
          "Confirm mortgage liability release in writing",
          "Update beneficiaries, insurance, and estate documents",
          "Maintain a complete post-decree evidence file",
        ],
      },
    ]),
  }),

  guide({
    id: "PL-205",
    title: "The 1031 Exchange Guide",
    audience: "Investment property owners, advisors, CPAs, and exchange participants",
    purpose: "Explain like-kind exchanges accurately, including the deadlines and disqualifying mistakes that end them.",
    description:
      "A 1031 exchange defers capital gains and depreciation recapture when investment or business-use real property is exchanged for like-kind replacement property. The rules are unforgiving: strict deadlines, a qualified intermediary who must be engaged before closing, and identification limits. This guide covers structure, timing, math, and the failure modes that cost investors the deferral. Educational only — engage a qualified intermediary and tax counsel.",
    tags: ["1031", "exchange", "investment", "tax deferral", "qualified intermediary"],
    chapters: chapters("CH-EX", [
      {
        title: "What a 1031 Exchange Actually Does",
        description:
          "A 1031 exchange defers — it does not erase — tax on gain from the sale of real property held for investment or productive use in a trade or business. Deferred items include capital gains and depreciation recapture, which is often the larger surprise. Personal residences and property held primarily for resale do not qualify.",
        learningObjectives: [
          "Define deferral versus elimination of tax",
          "Identify qualifying and non-qualifying property",
          "Explain depreciation recapture and why it drives exchange decisions",
          "Understand how deferral compounds across successive exchanges",
        ],
      },
      {
        title: "The Deadlines That End Exchanges",
        description:
          "From the day the relinquished property closes, you have 45 calendar days to identify replacement property in writing and 180 calendar days to close on it — and the 180-day clock may be shortened by your tax filing deadline. These are calendar days, not business days, and they are effectively unextendable. Most failed exchanges fail on the 45-day clock.",
        learningObjectives: [
          "Track the 45-day and 180-day clocks from the correct start date",
          "Meet written identification requirements precisely",
          "Understand the tax-filing interaction with the 180-day period",
          "Begin replacement search before the relinquished property closes",
        ],
      },
      {
        title: "Identification Rules",
        description:
          "Identification must be unambiguous, in writing, signed, and delivered to the qualified intermediary. Three safe harbors govern how many properties you may identify: the three-property rule, the 200 percent rule, and the 95 percent rule. Vague identification is treated as no identification.",
        learningObjectives: [
          "Apply the three-property, 200 percent, and 95 percent rules",
          "Draft unambiguous property identifications",
          "Build backup identifications to protect against fallout",
          "Deliver identification to the correct party on time",
        ],
      },
      {
        title: "The Qualified Intermediary",
        description:
          "You may never take actual or constructive receipt of the proceeds. A qualified intermediary must be engaged before the relinquished property closes and must hold the funds throughout. Touching the money — even briefly, even in an attorney trust account of your own choosing — disqualifies the exchange. Vet the intermediary's bonding, segregation of funds, and insurance.",
        learningObjectives: [
          "Explain the constructive receipt rule and its consequences",
          "Engage a qualified intermediary before closing",
          "Evaluate intermediary security, bonding, and fund segregation",
          "Sequence exchange documents with the closing agent",
        ],
      },
      {
        title: "Value, Debt, and Boot",
        description:
          "For full deferral, the replacement property must be of equal or greater value, all net proceeds must be reinvested, and debt must be replaced with equal or greater debt or offset by additional cash. Any shortfall is boot — cash boot or mortgage boot — and boot is taxable. This is where investors most often create unintended tax bills.",
        learningObjectives: [
          "Apply the equal-or-greater value, equity, and debt tests",
          "Identify cash boot and mortgage boot before closing",
          "Calculate partial-deferral outcomes deliberately",
          "Model exchange versus outright sale on an after-tax basis",
        ],
      },
      {
        title: "Exchange Structures",
        description:
          "The delayed (forward) exchange is standard. Reverse exchanges acquire replacement property first through an exchange accommodation titleholder. Improvement or construction exchanges apply proceeds to improvements within the 180-day window. Each structure raises cost and complexity and demands earlier planning.",
        learningObjectives: [
          "Compare delayed, reverse, and improvement exchange structures",
          "Assess cost, financing, and timing constraints of each",
          "Determine when a reverse exchange is warranted",
          "Plan improvement exchanges within the completion window",
        ],
      },
      {
        title: "Replacement Property Selection",
        description:
          "Deferral is not a reason to buy a weak asset. Underwrite the replacement on its own merits — cash flow, location, condition, management burden, and financing — and only then confirm it satisfies the exchange requirements. Fractional options such as Delaware Statutory Trusts can qualify and can serve as backup identifications, with their own liquidity and control trade-offs.",
        learningObjectives: [
          "Underwrite replacement property independent of tax motivation",
          "Use backup identifications to preserve optionality",
          "Evaluate DSTs and fractional interests for suitability",
          "Align replacement financing with debt-replacement requirements",
        ],
      },
      {
        title: "Failure Modes and Long-Term Strategy",
        description:
          "Exchanges fail for a short list of repeat reasons: late intermediary engagement, weak or late identification, financing collapse, boot created at the closing table, and unqualified property. Over the long term, investors use serial exchanges to consolidate, relocate, or reposition holdings, with basis and estate consequences that deserve professional planning.",
        learningObjectives: [
          "Recognize the common causes of failed exchanges",
          "Build contingency plans for financing or fallout risk",
          "Plan serial exchanges and their basis consequences",
          "Coordinate exchange strategy with estate planning",
        ],
      },
    ]),
  }),

  guide({
    id: "PL-206",
    title: "Best Home Upgrades to Do — and Not Do",
    audience: "Homeowners planning improvements, and sellers deciding what to fix before listing",
    purpose: "Separate improvements that return money from improvements that only spend it.",
    description:
      "Renovation advice is dominated by inspiration and starved of arithmetic. This guide applies a consistent test to every project: does it recover cost at resale, does it protect value, or is it purely lifestyle spending? It ranks the reliable winners, names the reliable losers, and explains how timing, neighborhood ceilings, and permits change every answer.",
    tags: ["renovation", "ROI", "resale value", "curb appeal", "over-improvement"],
    chapters: chapters("CH-UP", [
      {
        title: "The Three Reasons to Spend",
        description:
          "Every project is one of three things: a return project that recovers most of its cost at resale, a protection project that prevents value loss or a failed inspection, and a lifestyle project you fund because you want it. Problems begin when lifestyle spending is justified with return language. Label each project honestly before you budget it.",
        learningObjectives: [
          "Classify every project as return, protection, or lifestyle",
          "Set separate budgets and expectations for each category",
          "Apply cost-recovery ranges rather than assuming full payback",
          "Sequence protection projects ahead of discretionary ones",
        ],
      },
      {
        title: "The Neighborhood Ceiling",
        description:
          "Your home's value is capped by its block, not by your receipts. Establish the top sale price on your street and in your immediate comparable set, and stop improving well before you reach it. Over-improvement is the single most expensive renovation mistake, and it is almost always avoidable with thirty minutes of comparable research.",
        learningObjectives: [
          "Identify the neighborhood price ceiling from recent sales",
          "Calculate remaining improvement headroom before spending",
          "Recognize the signs of over-improvement",
          "Match finish level to buyer expectations in your band",
        ],
      },
      {
        title: "Reliable Winners: Curb, Light, and Condition",
        description:
          "The best-returning projects are consistently the least glamorous. Exterior condition and entry appeal, fresh neutral paint, updated lighting, clean and consistent flooring, garage doors, and thorough decluttering repeatedly outperform large remodels on percentage recovered. They are also fast, low-risk, and rarely require permits.",
        learningObjectives: [
          "Prioritize curb appeal, paint, lighting, and flooring",
          "Choose neutral, durable finishes that widen the buyer pool",
          "Sequence high-return projects within a short pre-listing window",
          "Budget realistically for professional-quality execution",
        ],
      },
      {
        title: "Kitchens and Baths: Minor Beats Major",
        description:
          "Minor kitchen and bath refreshes — cabinet refacing or painting, hardware, counters, faucets, lighting, and appliance consistency — typically recover a far higher share of cost than full gut remodels. Major remodels can be worth doing for lifestyle or when the existing space is functionally obsolete, but they should be budgeted as lifestyle spending with partial recovery.",
        learningObjectives: [
          "Compare minor refresh and major remodel cost recovery",
          "Identify functional obsolescence that justifies a full remodel",
          "Specify finishes that photograph well and wear well",
          "Avoid layout changes that move plumbing without need",
        ],
      },
      {
        title: "Systems and Structure: Protection Spending",
        description:
          "Roof, HVAC, electrical panel, plumbing, water intrusion, and foundation issues rarely return their cost as a premium — but unaddressed, they cost far more in renegotiation, failed financing, insurance denial, or a lost buyer. Treat them as protection of value, address them before listing when possible, and keep receipts and warranties.",
        learningObjectives: [
          "Prioritize systems work that threatens financing or insurability",
          "Weigh repair now versus credit later at the negotiating table",
          "Document work with permits, receipts, and warranties",
          "Use a pre-listing inspection to find issues early",
        ],
      },
      {
        title: "Projects That Usually Don't Pay",
        description:
          "The habitual underperformers: swimming pools in most climates, elaborate or high-maintenance landscaping, sunrooms, garage conversions that remove parking, wall-to-wall carpet over hardwood, bold tile and fixture choices, luxury upgrades above the neighborhood band, home theaters, and heavily personalized built-ins. Some are worth doing for enjoyment — none should be justified as investments.",
        learningObjectives: [
          "Recognize commonly negative-return projects",
          "Distinguish neutral-but-narrowing from actively value-reducing changes",
          "Preserve bedroom count, parking, and flexible use",
          "Say no to taste-specific finishes before listing",
        ],
      },
      {
        title: "Energy, Resilience, and Insurability",
        description:
          "Efficiency and resilience upgrades increasingly affect both operating cost and insurability. Insulation, air sealing, efficient HVAC, windows in the right climates, and hazard mitigation such as roof strengthening or defensible space can lower premiums and widen the buyer pool. Check incentives and rebates before you contract; they change the math materially.",
        learningObjectives: [
          "Prioritize efficiency work by payback period",
          "Identify resilience upgrades that lower insurance cost",
          "Research incentives and rebates before contracting",
          "Document improvements for appraisers and insurers",
        ],
      },
      {
        title: "Timing, Permits, and Contractor Control",
        description:
          "Return depends on when and how you spend. Improvements enjoyed for years justify more than improvements made sixty days before listing. Unpermitted work creates disclosure, appraisal, and financing problems that can exceed the original savings. Control scope with written contracts, defined change-order rules, milestone payments, and lien releases.",
        learningObjectives: [
          "Decide what to do now versus at listing time",
          "Understand the resale consequences of unpermitted work",
          "Structure contracts, change orders, and payment milestones",
          "Collect lien releases, permits, and warranty documentation",
        ],
      },
      {
        title: "Cross-Reference: How Escrow, Title, and Closing Risk Decide When Work Can Start",
        description:
          "Renovation timing is not a contractor question first — it is a title and escrow question. Until the deed records, you do not own the property, and money spent on a home you do not yet own is unsecured. Buyers who demo a bathroom or order tile the week before closing discover the hard version of this rule when a Schedule B-I requirement slips: an unreleased prior mortgage, an heirship gap, a judgment lien, a name discrepancy, or a boundary encroachment can push a closing date by days or by months. Read the title commitment the day it arrives and treat every open B-I requirement as a construction hold. There are four gates, and each one changes what is safe to spend. Gate one, contract signed and commitment received: plan, measure, and get bids — commit nothing. Gate two, all B-I requirements cleared in writing: order long-lead materials such as tile, cabinets, and windows only if the deposit is refundable or the material is resellable. Gate three, loan funded: mobilize crews and set a start date, but do not let anyone swing a hammer. Gate four, deed recorded and keys released: work begins. Sellers face the mirror image. Work performed before closing but unpaid at closing creates mechanic's-lien exposure that the title company will require you to clear before it insures, and an open permit will surface in the search and stall the file. Pay contractors and collect signed final lien waivers and permit sign-offs before the settlement statement is finalized, and disclose any work in progress in writing. Two more traps. First, pre-closing access agreements — the buyer who is allowed in early to start work — are a title and liability problem, not a favor; if they are used at all, they need written consent from the seller, the lender, and the insurer, and they must state who owns the improvements if the sale fails. Second, renovation financing changes the sequence: 203(k), HomeStyle, and construction-to-permanent loans require approved plans, bids, and draw schedules before funding, so title clearance and lender approval must run in parallel or the whole calendar slips. The practical habit: keep one shared timeline with three columns — title milestone, lender milestone, and construction milestone — and never let a construction commitment sit to the left of the title milestone that authorizes it. See PL-211, The Title Guide, for the underlying commitment, curative, escrow, and recording mechanics.",
        learningObjectives: [
          "Apply the four gates — commitment, B-I clearance, funding, recording — to every renovation commitment",
          "Read open Schedule B-I requirements as construction holds and re-plan when curative work slips",
          "Prevent mechanic's-lien and open-permit problems by collecting final waivers and sign-offs before closing",
          "Sequence renovation financing draws and pre-closing access agreements without creating title or liability exposure",
        ],
      },
    ]),
  }),

  guide({
    id: "PL-207",
    title: "The California Surviving Spouse Property Guide",
    audience: "Surviving spouses and registered domestic partners who own California real property, and the advisors supporting them",
    purpose:
      "Help a surviving spouse organize facts, clear title correctly, protect the existing mortgage, meet county and tax deadlines, and avoid irreversible mistakes before professional review.",
    description:
      "A decision-oriented companion to the California Surviving Spouse Property Decision Worksheet. It separates four actions people commonly confuse — clearing title, confirming successor-in-interest status, formally assuming the loan, and refinancing — and walks through vesting, servicing, property tax, income tax basis, and future estate planning. Educational only; not legal, tax, title, or lending advice.",
    tags: ["California", "Surviving Spouse", "Probate", "Title", "Mortgage Servicing", "Property Tax", "Estate Planning"],
    chapters: chapters("PL-207-CH", [
      {
        title: "Start Here: Goals, Risk Screen, and the Four Separate Actions",
        description:
          "Before any document is signed or recorded, name the goal: remain, sell, rent, refinance, preserve the current rate, move title into a trust, or add a future co-owner. Then run the risk screen — foreclosure or default, disputed ownership, children from another relationship, possible separate property, reverse mortgage or PACE/solar/judgment/HOA liens, pending deadlines, or a plan to add a nonspouse to title. Any checked box means professional review comes first. Above all, understand that clearing title, becoming a confirmed successor in interest, formally assuming the mortgage, and refinancing are four separate actions; completing one does not complete the others.",
        learningObjectives: [
          "State the primary property goal in one sentence",
          "Run the initial risk screen and flag items requiring professional review",
          "Distinguish clearing title, successor status, assumption, and refinance",
          "Identify which deadlines are already running",
        ],
      },
      {
        title: "How Title Was Held at Death",
        description:
          "The exact wording on the last recorded deed controls the path forward: joint tenancy, community property with right of survivorship, community property without survivorship, tenants in common, a revocable living trust, the deceased spouse's sole name, or the survivor's sole name. Survivorship vesting typically clears through the appropriate affidavit of death; trust property follows the trust terms and funding; non-survivorship or unclear title may require a spousal property petition or probate order. Marriage alone does not make ownership clear, and a surviving spouse does not always receive one hundred percent of separate property when other heirs exist.",
        learningObjectives: [
          "Read vesting language from the recorded deed and title report",
          "Match each vesting type to its common next step and caution",
          "Recognize when a spousal property petition or probate may be required",
          "Confirm whether trust assets were actually funded into the trust",
        ],
      },
      {
        title: "The Document Set",
        description:
          "Gather once, use everywhere. Certified death certificates, the current recorded deed and a preliminary title report, the complete trust with all amendments, the will and codicils, marriage or domestic partnership records, any marital or transmutation agreement, probate filings, property tax bills and assessor notices, the mortgage statement and promissory note, homeowners insurance declarations, HOA/solar/PACE/judgment/lien records, and a date-of-death appraisal. Missing documents, not disputed law, cause most delays.",
        learningObjectives: [
          "Assemble a complete title, loan, tax, and estate document set",
          "Order certified death certificates in sufficient quantity",
          "Obtain a preliminary title report before assuming vesting",
          "Track which documents are outstanding and who will supply them",
        ],
      },
      {
        title: "Mortgage Servicing and Successor-in-Interest Status",
        description:
          "Identify the servicer, loan number, balance, rate, payment, term, status, loan type, and — critically — who signed the promissory note. Federal rules generally prevent a lender from accelerating a loan solely because ownership changed through a protected death-related transfer, and a confirmed successor in interest can receive servicing protections without assuming the debt. Keep a dated contact log with representative names and reference numbers, and get key answers in writing. Reverse mortgages follow separate death and eligible non-borrowing spouse rules with hard deadlines.",
        learningObjectives: [
          "Confirm note signers and loan type from documents, not memory",
          "Request confirmed successor-in-interest status in writing",
          "Maintain a servicer contact log with reference numbers",
          "Recognize reverse-mortgage deadlines that require immediate action",
        ],
      },
      {
        title: "Keep, Assume, Refinance, or Sell",
        description:
          "Four loan paths, four trade-offs. Continuing payments with confirmed successor status preserves the existing rate and terms but does not put the survivor on the note. Formal assumption or substitution places the survivor on the debt when the servicer and investor allow it, and financial documents may still be requested. Refinancing creates a new loan at current market terms with full underwriting and closing costs, and can forfeit a favorable legacy rate. Selling clears the loan through escrow but requires marketable title and a review of timing, gain, and net proceeds.",
        learningObjectives: [
          "Compare the four loan paths against the stated household goal",
          "Quantify the cost of giving up an existing below-market rate",
          "Ask the servicer the right assumption and substitution questions",
          "Confirm title is marketable before committing to a sale timeline",
        ],
      },
      {
        title: "California Property Tax: Reassessment and the Assessor Filing",
        description:
          "A qualifying transfer between spouses, including one caused by death, is generally excluded from California reassessment — but the exclusion does not erase reporting duties. File the county's current BOE-502-D, Change in Ownership Statement, Death of Real Property Owner; where there is no probate, the deadline is generally 150 days after the date of death, and in a probated estate the statement is coordinated with the Inventory and Appraisal. Update the tax-bill mailing address, verify the homeowners' exemption, keep the recorded document and assessor response together, and review any supplemental or escape assessment notice promptly.",
        learningObjectives: [
          "File BOE-502-D within the applicable county deadline",
          "Coordinate the assessor filing with any probate proceeding",
          "Verify the homeowners' exemption and mailing address",
          "Respond promptly to supplemental or escape assessment notices",
        ],
      },
      {
        title: "Income Tax, Cost Basis, and the Two-Year Sale Window",
        description:
          "Obtain a defensible date-of-death fair market value and determine whether the property was community, separate, or mixed in character. Community property often receives a basis adjustment for the entire property at the first spouse's death, while joint tenancy, separate property, depreciation, and rental use can produce a different result. Track post-death improvements and selling expenses. A surviving spouse may qualify to exclude up to $500,000 of gain on a qualifying principal-residence sale within two years after death when all statutory conditions are met — confirm with a tax adviser before relying on it.",
        learningObjectives: [
          "Secure a defensible date-of-death valuation",
          "Determine community, separate, or mixed property character",
          "Understand how basis adjustment affects a future sale",
          "Evaluate the two-year surviving-spouse exclusion window",
        ],
      },
      {
        title: "Future Title Choices and Adding Anyone to Title",
        description:
          "Sole ownership is simple now but can expose the estate to probate later. A revocable living trust often avoids probate and supports incapacity planning when the deed and lender notice are handled correctly. A revocable transfer-on-death deed may pass qualifying property outside probate but follows strict statutory form, execution, recording, and notice rules. Adding a future spouse, a child, a partner, or an entity to title can trigger reassessment, gift reporting, creditor exposure, partition rights, loss of control, and due-on-sale review. Every later transfer needs a fresh review.",
        learningObjectives: [
          "Compare sole ownership, trust, and transfer-on-death deed paths",
          "Anticipate reassessment and gift consequences of adding a nonspouse",
          "Coordinate any deed change with the lender and insurer",
          "Schedule a review before any future transfer is recorded",
        ],
      },
      {
        title: "Decision Summary, Action Plan, and Professional Review",
        description:
          "Close the loop with a written summary: vesting confirmed from recorded documents, estate plan and heirs reviewed, ownership percentage confirmed, note signers and loan type confirmed, successor status confirmed in writing, assessor filing and exemption confirmed, date-of-death valuation obtained, and liens and insurance reviewed. Then assign each next step a responsible person and target date, and record the estate attorney, CPA or tax adviser, servicer contact, title or escrow contact, and county assessor contact. A valid choice is to take no title-changing action until professional review is complete. This guide is educational and does not provide legal, tax, probate, title, lending, or accounting advice.",
        learningObjectives: [
          "Confirm the eight core facts before acting",
          "Assign every next step an owner and target date",
          "Build the professional review team and contact record",
          "Recognize when the correct action is to wait",
        ],
      },
    ]),
  }),
  guide({
    id: "PL-208",
    title: "When You Move: The Complete Relocation Guide",
    audience: "Anyone moving out of one home and into another — sellers, buyers, renters, and the households behind them",
    purpose:
      "Turn a move into a sequenced, budgeted, low-surprise project: what to decide, what to book, what to transfer, what to protect, and what to verify on both sides of the door.",
    description:
      "Most moving stress is not caused by boxes. It is caused by unsequenced decisions: overlapping dates, unbooked movers, utilities shut off a day early, insurance gaps between addresses, and a condition dispute nobody documented. This guide runs the move as a timeline — eight weeks out to the first week in — covering budget, mover selection and liability, purge strategy, packing systems, utilities and address changes, kids, pets, schools, valuables and documents, move-day control, condition evidence, and settling into the new property.",
    tags: ["Moving", "Relocation", "Logistics", "Utilities", "Move-In", "Checklist", "Consumer"],
    chapters: chapters("PL-208-CH", [
      {
        title: "The Move Timeline: Eight Weeks to Keys",
        description:
          "Every good move is a backward-planned schedule anchored to two fixed dates: the day you must be out and the day you can be in. Work backward from there. Eight weeks out: confirm dates, set the budget, and gather quotes. Six weeks: book the mover and start purging. Four weeks: order supplies, begin non-essential packing, and file address changes. Two weeks: schedule utilities, confirm building rules and elevator reservations, and arrange care for children and pets. One week: pack essentials, defrost, and finalize payment method. Move week: execute, document, and verify. When the two anchor dates overlap or leave a gap, decide early whether you need a rent-back, short-term housing, or storage — those choices get expensive when made late.",
        learningObjectives: [
          "Build a backward-planned schedule from the two anchor dates",
          "Identify the tasks that must happen at each week marker",
          "Spot a date gap or overlap early enough to solve cheaply",
          "Decide between rent-back, storage, and interim housing",
        ],
      },
      {
        title: "The Real Budget: What Moves Actually Cost",
        description:
          "Quote the whole move, not just the truck. Line items include mover or truck rental, packing labor and materials, specialty items such as pianos and safes and large appliances, storage, insurance or valuation coverage, utility deposits and connection fees, cleaning at both ends, minor repairs and paint, travel and lodging for long moves, pet transport and boarding, tips, and the almost-always-underestimated first-week replacement spending on shower curtains, tools, and pantry staples. Add a ten to fifteen percent contingency. Note which costs may be deductible or employer-reimbursable and keep receipts accordingly; rules are narrow, so confirm with a tax adviser rather than assuming.",
        learningObjectives: [
          "Build a line-item move budget including hidden costs",
          "Price specialty items and storage before they surprise you",
          "Set a realistic contingency reserve",
          "Retain documentation for reimbursement or tax review",
        ],
      },
      {
        title: "Choosing Movers: Estimates, Liability, and Red Flags",
        description:
          "Get at least three written estimates from an in-home or video survey — phone quotes without an inventory are guesses. Understand estimate types: a binding estimate fixes the price for the listed inventory, a non-binding estimate can rise with actual weight, and a binding not-to-exceed caps the price while allowing it to fall. For interstate moves, verify the company's federal registration and complaint history and read the required consumer rights disclosure. Understand liability: basic released-value protection is minimal per pound, while full-value protection costs more and covers replacement. Red flags: large cash deposits, no written inventory, a rented truck with no company markings, a name that changes between calls, and a refusal to put terms in writing.",
        learningObjectives: [
          "Compare binding, non-binding, and not-to-exceed estimates",
          "Verify a mover's registration, insurance, and complaint record",
          "Choose between released-value and full-value protection",
          "Recognize deposit, inventory, and paperwork red flags",
        ],
      },
      {
        title: "Purge First, Pack Second",
        description:
          "You pay to move volume, so the cheapest box is the one you never fill. Run the purge four to six weeks out, room by room, into four piles: keep, sell, donate, dispose. Sell what has real resale value early enough for pickup; donate the rest and keep receipts. Handle non-transportable items separately — most movers will not carry propane, paint, solvents, ammunition, aerosols, or perishables, and many will not take live plants across state lines. Measure large furniture against the new floor plan, doorways, stairwells, and elevator dimensions before you decide to move it; a sectional that cannot enter the new home is a costly discovery on move day.",
        learningObjectives: [
          "Run a room-by-room purge on a defined schedule",
          "Route sell, donate, and dispose items with documentation",
          "Identify non-transportable and restricted items in advance",
          "Measure furniture against the new home's access points",
        ],
      },
      {
        title: "Packing Systems That Survive Unpacking",
        description:
          "Pack for the unpack. Label every box on the top and two sides with destination room, a short contents summary, and a number; keep a simple inventory list or photo log keyed to those numbers, which also supports any damage claim. Use small boxes for heavy items and large boxes for light bulk. Protect fragile items with real materials, not linens alone. Photograph the back of every electronics setup before unplugging, and bag hardware to the furniture it belongs to. Build an open-first box for each person — bedding, towels, toiletries, chargers, medication, basic tools, paper goods, coffee — and keep it in your own vehicle along with valuables, documents, and anything irreplaceable.",
        learningObjectives: [
          "Apply a consistent labeling and inventory system",
          "Pack fragile, heavy, and electronic items correctly",
          "Assemble an open-first box for each household member",
          "Separate items that should never ride in the truck",
        ],
      },
      {
        title: "Utilities, Address Changes, and the Service Switch",
        description:
          "Time the switch so there is never a dark day. Schedule electricity, gas, water, sewer, trash, internet, and any security or propane service to stop at the old address the day after you leave and start at the new address the day before you arrive — internet installation often has the longest lead time, so book it first. File the postal forwarding order, then update the records forwarding will not fix: employer and payroll, banks and cards, insurance, driver's license and vehicle registration, voter registration, subscriptions and deliveries, medical and dental, schools, and pharmacies. Take final meter readings and photograph them, and keep confirmation numbers for every stop and start order.",
        learningObjectives: [
          "Sequence utility stop and start dates to avoid gaps",
          "Prioritize long-lead services such as internet installation",
          "Work a complete address-change list beyond mail forwarding",
          "Document final meter readings and confirmation numbers",
        ],
      },
      {
        title: "People, Pets, and Paperwork",
        description:
          "The logistics people forget are the human ones. Request school records and confirm enrollment requirements and immunization documentation early; transfer dates rarely align neatly with move dates. Move medical, dental, and veterinary records, and refill prescriptions before the pharmacy changes. Pets need current vaccination records, updated microchip and tag information, and a quiet, closed room or off-site care on move day — more pets are lost on move day than any other. Children do better with a role, a known plan, and their own open-first box. Keep a single secure folder with passports, birth and marriage certificates, titles, deeds, leases, insurance policies, tax records, and the moving contract, and carry it personally.",
        learningObjectives: [
          "Transfer school, medical, and veterinary records on time",
          "Protect pets and update identification before move day",
          "Give children a defined role and a familiar first box",
          "Hand-carry a secure folder of essential documents",
        ],
      },
      {
        title: "Move Day: Control, Condition, and Evidence",
        description:
          "Move day is an execution and documentation exercise. Before loading, photograph or video every room and the condition of walls, floors, and high-value items — this is your evidence at both ends. Protect floors, doorframes, and banisters. Have one decision-maker on site, phone charged, with cash for tips, water for the crew, and parking or elevator access already reserved. Review and keep the inventory sheet, and note any exception before signing. Walk the empty home for closets, attics, crawlspaces, the garage, the mailbox, and the shed. Leave keys, remotes, codes, and manuals as agreed, do the final clean, and take the last meter photographs.",
        learningObjectives: [
          "Capture condition evidence before loading and after unloading",
          "Manage crew access, parking, and elevator logistics",
          "Review the inventory sheet and note exceptions before signing",
          "Complete a full empty-home sweep and handoff",
        ],
      },
      {
        title: "The First Week In: Safety, Systems, and Claims",
        description:
          "Arrive with a first-week protocol. Change or rekey every exterior lock and reset garage, alarm, and smart-home codes. Locate the electrical panel, water shutoff, gas shutoff, and water heater, and label them. Test smoke and carbon monoxide detectors and replace batteries. Confirm the insurance policy is active at the new address with correct coverage and no gap from the move. Unpack in order — beds, bathrooms, kitchen, then everything else — and resist the urge to finish in a weekend. Inspect for transit damage and file any claim within the carrier's window, using your photo log and inventory numbers. Then handle the small things that make it home: register the address locally, meet the neighbors, and learn the trash and recycling schedule.",
        learningObjectives: [
          "Complete a security and shutoff-location safety pass",
          "Verify insurance coverage is active with no gap",
          "Unpack in a priority order that restores daily function",
          "File transit damage claims within the carrier's deadline",
        ],
      },
    ]),
  }),
  guide({
    id: "PL-209",
    title: "Buying or Selling a Second Home: The Do's and Don'ts Guide",
    audience:
      "Owners and buyers of vacation homes, weekend properties, short-term rentals, and other non-primary residences",
    purpose:
      "Give second-home buyers and sellers a decision-grade playbook: how the financing, tax, insurance, rental, and exit rules differ from a primary residence — stated as clear do's and don'ts at every step.",
    description:
      "A second home is not a bigger version of your first one. Different loan rules, different down payments, different insurance, different tax treatment, different carrying costs, and a resale market that is thinner and far more seasonal. Most second-home regret traces back to three mistakes: underwriting the purchase on the best week of the year, assuming rental income will cover the gap, and ignoring how the property is classified for taxes and insurance. This guide runs both sides of the transaction — buy and sell — as a sequence of do's and don'ts, with the numbers, documents, and questions that separate a good second property from an expensive one.",
    tags: ["Second Home", "Vacation Property", "Investment", "Financing", "Short-Term Rental", "Do's and Don'ts", "Consumer"],
    chapters: chapters("PL-209-CH", [
      {
        title: "Define the Purpose Before You Define the Budget",
        description:
          "A second home serves one of four purposes: personal use, income, future primary residence, or long-hold appreciation. Each one points to a different property, a different location, and a different loan. DO write the purpose down in one sentence and rank the others below it, because the property that maximizes rental yield is rarely the one that maximizes family use. DO decide how many weeks per year you will realistically be there — then halve it, since the honest number for most owners is two to four weeks. DON'T buy on vacation emotion during the best week of the season; visit in the off-season, on a weekday, in bad weather. DON'T let a mixed purpose stay unresolved, because 'we'll rent it when we're not there' is the assumption that most often turns into a shortfall.",
        learningObjectives: [
          "State a single primary purpose and rank secondary uses",
          "Estimate realistic annual personal-use weeks, not aspirational ones",
          "Test the location outside peak season before committing",
          "Recognize when mixed use will compromise both goals",
        ],
      },
      {
        title: "How Lenders See a Second Home",
        description:
          "Occupancy classification drives everything. Lenders sort properties into primary residence, second home, and investment property, and the terms worsen in that order. DO expect a larger down payment, a higher rate, stronger reserve requirements, and tighter credit standards than your primary loan; second-home and investment pricing carries added risk cost. DO ask the lender in writing which classification your file will use and what documentation supports it, because the answer changes your payment. DO get fully underwritten pre-approval before you tour, since second-home markets can move quickly on desirable inventory. DON'T sign an occupancy certification that says 'second home' if you intend to rent it out full-time — misrepresenting occupancy on a loan application is mortgage fraud, not a technicality. DON'T assume the rental income you project will count toward qualifying; second-home programs typically will not use it, and investment programs that do will discount it and require documentation.",
        learningObjectives: [
          "Distinguish primary, second-home, and investment loan classifications",
          "Anticipate higher down payment, rate, and reserve requirements",
          "Confirm in writing how the lender will classify and document the file",
          "Avoid occupancy misrepresentation and rental-income assumptions",
        ],
      },
      {
        title: "Underwrite the Real Carrying Cost",
        description:
          "The mortgage payment is the smallest surprise in second-home ownership. DO build a full annual carrying-cost model: principal and interest, property taxes, insurance, HOA or resort dues and special assessments, utilities year-round (not just occupied months), internet, landscaping, snow or storm service, pest control, pool or dock maintenance, security monitoring, local licensing fees, property management, cleaning and turnover if rented, and a reserve line for repairs on a property nobody is watching daily. DO add a vacancy and seasonality assumption if income is part of the plan. DO stress-test the model: what happens if it rents zero nights, if insurance rises materially, or if the HOA levies an assessment. DON'T compare the second home's monthly cost to your primary home's — remote and coastal properties often carry higher insurance, higher maintenance, and higher service premiums. DON'T budget the purchase to the edge; the properties that become burdens are the ones with no margin for a bad year.",
        learningObjectives: [
          "Build a complete twelve-month carrying-cost model",
          "Include management, turnover, licensing, and reserve lines",
          "Stress-test for zero rental income and cost increases",
          "Preserve margin rather than budgeting to the maximum approval",
        ],
      },
      {
        title: "Insurance, Climate, and Location Risk",
        description:
          "Second homes cluster where risk concentrates: coastlines, mountains, lakes, wildland edges. DO obtain insurance quotes before your inspection contingency expires, not after — availability and price, not just condition, can end a deal. DO ask specifically about wind, hail, flood, wildfire, earthquake, and freeze coverage, and whether any of those requires a separate policy, a higher deductible, or a state or federal program. DO understand that standard homeowners policies contemplate an occupied home; a property vacant for long stretches may need a specific endorsement, and rental use almost always requires a different policy form. DO check flood maps, wildfire ratings, and any local disclosure history. DON'T assume your current carrier will write the second property, and DON'T let coverage lapse into a vacancy exclusion that voids a claim precisely when you are not there to notice a burst pipe.",
        learningObjectives: [
          "Quote insurance before contingency deadlines expire",
          "Identify perils requiring separate policies or endorsements",
          "Match the policy form to vacancy and rental use",
          "Assess flood, wildfire, and climate exposure with real data",
        ],
      },
      {
        title: "Rental Income: Rules Before Revenue",
        description:
          "Rental projections sell properties; local rules govern them. DO research short-term rental legality before you write an offer: city and county ordinances, permit caps, licensing, occupancy limits, minimum stay requirements, parking rules, and enforcement history. DO read the HOA or condominium documents in full — many prohibit or heavily restrict rentals, and a rule can be amended after you buy. DO verify claimed income with actual statements and tax filings rather than a spreadsheet or a listing-site estimate, and DO model net income after management, cleaning, supplies, platform fees, taxes, insurance uplift, and vacancy. DON'T rely on the seller's peak-season nightly rate as an annual average. DON'T assume grandfathering will protect you, and DON'T count on rental income to make the payment work — if the property only pencils when fully booked, it does not pencil.",
        learningObjectives: [
          "Verify short-term rental legality, permits, and caps locally",
          "Read HOA and condo restrictions on rental use",
          "Validate income claims with statements, not projections",
          "Model net, not gross, rental income including vacancy",
        ],
      },
      {
        title: "Taxes: Personal Use, Rental Days, and the Lines That Matter",
        description:
          "Tax treatment of a second home turns on how you use it. DO track personal-use days and rental days precisely, in writing, all year — the ratio determines how the property is classified and which deductions apply. DO understand the general framework: a home rented very few days per year is treated differently from one that is rented substantially, and a property with significant personal use is treated differently from a pure rental. DO know that mortgage interest and property tax deductibility on a second residence is subject to limits that may already be consumed by your primary home. DO keep every receipt, invoice, and improvement record, because basis matters at sale. DON'T assume the capital-gains exclusion available on a primary residence applies to a second home — it generally does not unless the property later becomes your principal residence under specific rules. DON'T plan a 1031 exchange around a property with meaningful personal use without professional guidance. Confirm all of it with a CPA who knows the state involved; this is educational content, not tax advice.",
        learningObjectives: [
          "Track personal-use and rental days with contemporaneous records",
          "Understand how use ratio drives property classification",
          "Maintain basis documentation for every improvement",
          "Engage a CPA before relying on exclusions or exchanges",
        ],
      },
      {
        title: "Buying Well: Diligence for a Property You Won't Watch",
        description:
          "Distance changes diligence. DO inspect more, not less: general inspection plus the specialists the location demands — septic and well, roof and attic in snow country, seawall, dock, foundation and drainage, wood-destroying organisms, radon, and moisture where humidity is high. DO walk the property with the systems running and, when possible, after rain. DO confirm access: private roads, easements, road-maintenance agreements, seasonal closures, and whether emergency and delivery services actually reach the address. DO line up local vendors — caretaker, plumber, electrician, landscaper — before closing, since finding them from three hundred miles away during a freeze is not a plan. DO review title, survey, boundary, and any shared amenity agreements. DON'T waive inspections to win a competitive offer on a property you cannot check weekly. DON'T skip the HOA reserve study and assessment history; underfunded reserves in a resort community become your bill.",
        learningObjectives: [
          "Commission location-specific inspections beyond the general one",
          "Verify access, easements, and seasonal service availability",
          "Build a local vendor bench before closing",
          "Review HOA reserves, assessments, and shared-amenity agreements",
        ],
      },
      {
        title: "Selling Well: Timing, Presentation, and a Thinner Buyer Pool",
        description:
          "Second-home markets are seasonal and discretionary, which means both timing and story matter more than they do for primary residences. DO list into the season buyers are actively imagining themselves there — the market for a lake house is not the market for a suburban colonial. DO assemble a buyer's package in advance: utility and maintenance history, rental income statements and occupancy calendar, permits and licenses, HOA documents and assessment history, insurance history and claims, warranties, and a vendor list — a documented property removes uncertainty and defends price. DO present the property as a lifestyle and a proforma at once, with professional photography in the right season and honest cost transparency. DO understand your net: capital gains treatment, depreciation recapture if it was rented, transfer taxes, and any state withholding for out-of-state sellers. DON'T price to the peak of the last cycle or to your emotional attachment. DON'T hide seasonal negatives — the buyer will discover them, usually during the inspection, at the worst possible moment for the deal.",
        learningObjectives: [
          "Time the listing to the property's true buying season",
          "Assemble a documentation package that defends price",
          "Calculate net proceeds including recapture and withholding",
          "Disclose seasonal realities early rather than during inspection",
        ],
      },
      {
        title: "The Exit Plan, the Ownership Structure, and the Decision Summary",
        description:
          "Buy the exit at the same time you buy the property. DO decide up front how long you intend to hold, what would trigger a sale, and who inherits or takes over the property — second homes are the most common source of family conflict among inherited assets. DO discuss ownership structure with your attorney and CPA before closing: sole, joint, trust, LLC, or co-ownership with family or friends, each with different liability, financing, tax, and succession consequences. DO put any co-ownership arrangement in a written agreement covering cost sharing, scheduling, decision-making, buyout rights, and dispute resolution — before the first disagreement, not after. DO revisit the carrying-cost model annually against actual use. DON'T restructure title after closing without checking the effect on your mortgage, insurance, and property tax assessment. DON'T hold a property out of sunk-cost loyalty: if the honest use is two weekends a year and the carry is meaningful, the numbers, not the memories, should decide. Close with a one-page summary: purpose, annual carry, use expectation, income assumptions, exit trigger, and the professionals reviewing it.",
        learningObjectives: [
          "Define the hold period and the triggers that would prompt a sale",
          "Choose an ownership structure with legal and tax guidance",
          "Document co-ownership terms and buyout mechanics in writing",
          "Produce a one-page decision summary and review it annually",
        ],
      },
    ]),
  }),

  guide({
    id: "PL-210",
    title: "Foreclosure vs. Short Sale: What It Actually Means for You",
    audience: "Homeowners facing missed payments, hardship, negative equity, or a pre-foreclosure notice",
    purpose:
      "Explain, in plain language, the real difference between a foreclosure and a short sale — what each one does to your credit, your taxes, your future borrowing, and your control — and lay out every option in between so you can choose deliberately instead of by default.",
    description:
      "If you are behind on your mortgage, underwater, or holding a notice you do not fully understand, this guide is written for you. It defines every term you will hear, walks the actual timeline of a default, compares foreclosure and short sale side by side on the four things that matter — credit, taxes, deficiency liability, and control — and gives you a decision framework, a document checklist, a scam-avoidance section, and a first-72-hours action plan. Educational content only: your outcome depends on your state, your loan type, and your numbers, so the guide tells you exactly which professionals to bring in and what to ask them.",
    tags: ["foreclosure", "short sale", "distressed", "credit", "tax", "hardship", "pre-foreclosure"],
    chapters: chapters("CH-FSS", [
      {
        title: "Start Here: The Words People Are Using, Defined Once and Clearly",
        description:
          "Distress has its own vocabulary, and lenders rarely stop to translate. Delinquency is a missed payment. Default is a formal breach of the loan terms, usually after a set number of missed payments. Pre-foreclosure is the window after a default notice and before a sale — the window where you still have the most options. Foreclosure is the legal process by which the lender forces a sale to recover the debt; depending on your state it is judicial (through a court) or non-judicial (through a trustee, typically faster). A short sale is when you sell the home for less than you owe and the lender agrees to release the lien and accept the shortfall. A deed in lieu is handing the property back by agreement instead of being sold out of it. A deficiency is the unpaid balance left after the sale, and whether the lender can pursue you for it is a state-law question with enormous financial consequences. Loss mitigation is the umbrella term for every workout option — forbearance, repayment plan, loan modification, partial claim, short sale, deed in lieu. Write these down. When your servicer uses one, you will know which door they just opened.",
        learningObjectives: [
          "Distinguish delinquency, default, pre-foreclosure, and foreclosure precisely",
          "Understand judicial versus non-judicial foreclosure and why the difference affects your timeline",
          "Define short sale, deed in lieu, deficiency, and loss mitigation in your own words",
          "Recognize which term your servicer is using and what option it implies",
        ],
      },
      {
        title: "The Timeline: What Happens, In What Order, and Where Your Leverage Is",
        description:
          "Foreclosure is a sequence, not an event, and every stage has a different set of options. Day one of a missed payment starts late fees and servicer contact. Around thirty days, the delinquency is typically reported to the credit bureaus. Somewhere near the ninety-to-one-hundred-twenty-day mark, most federally backed loans allow the servicer to begin the formal process — which is why the earliest weeks are the most valuable and the least used. Then comes a formal notice: a Notice of Default, a demand letter, or in judicial states a lawsuit and summons. A notice period runs, a sale date is set and advertised, and the auction occurs. After the sale come possession and eviction steps, and, in some states, a redemption period during which the property may be reclaimed. The single most important fact in this chapter: your options narrow at every stage and your leverage is highest today. A homeowner who calls the servicer at day thirty has forbearance, modification, repayment plans, and an unhurried short sale on the table. A homeowner who calls the week before the auction usually has one option left, and it is not the good one.",
        learningObjectives: [
          "Map the stages from first missed payment through sale, possession, and redemption",
          "Identify which options are available at each stage and which expire",
          "Understand why acting in the first 30-90 days materially changes outcomes",
          "Locate your own position on the timeline using the notices you have received",
        ],
      },
      {
        title: "Foreclosure vs. Short Sale, Side by Side: The Four Things That Actually Differ",
        description:
          "Strip away the emotion and the two paths differ on four axes. Control: in a short sale you choose the agent, cooperate on price, and influence the closing date; in a foreclosure the lender and the court or trustee control the calendar and you are a passenger. Timeline: a short sale is negotiated and typically closes on a scheduled date you helped set; a foreclosure runs on statutory deadlines. Credit: both are serious derogatory events, but they are reported differently, and the post-event waiting periods lenders impose before you can finance again are commonly shorter after a short sale than after a foreclosure — sometimes dramatically so, and the gap widens further if your short sale is completed without severe delinquency. Deficiency exposure: a short sale gives you a written opportunity to negotiate a release of the remaining balance before you sign; a foreclosure leaves that determination to state law and lender discretion. There is also a fifth axis nobody puts on a chart: dignity and information. A short sale is a transaction you participate in, with documents you read and a closing you attend. A foreclosure is something that happens to you, on a schedule set elsewhere. That difference is worth more than most people expect.",
        learningObjectives: [
          "Compare foreclosure and short sale on control, timeline, credit, and deficiency exposure",
          "Understand why post-event financing waiting periods generally favor a short sale",
          "Recognize the value of negotiating deficiency language before signing anything",
          "Use the comparison to frame your own decision rather than react to pressure",
        ],
      },
      {
        title: "What It Does to Your Credit — Realistically, Not Dramatically",
        description:
          "Here is the honest picture. The damage begins before either event: the string of thirty-, sixty-, and ninety-day late payments leading up to it usually drives the largest single score drop. The event itself — foreclosure, short sale, or deed in lieu — is then reported as a serious derogatory mark and generally remains on your credit report for about seven years from the date of first delinquency. Score impact varies widely and depends heavily on where you started; a borrower with excellent credit and no other blemishes typically falls further in points than someone already impaired. Short sales are often reported as a settled account for less than the full balance, which is damaging but frequently viewed differently by future underwriters than a completed foreclosure. What matters most for your future is not the drop but the rebuild: keep every other account current, keep utilization low, do not close old accounts, avoid new derogatory marks, and let time do its work. Pull all three reports after the dust settles and dispute any inaccuracy in the reported status, balance, or dates — errors on distressed accounts are common and correcting them is free. Ask, in writing, exactly how your servicer will report the outcome before you agree to it. That one question has changed more borrowers' next five years than any other in this guide.",
        learningObjectives: [
          "Separate the credit impact of late payments from the impact of the event itself",
          "Understand the roughly seven-year reporting window and how recovery accelerates over time",
          "Ask your servicer in writing how the account will be reported before agreeing",
          "Build a deliberate rebuild plan and verify reporting accuracy across all three bureaus",
        ],
      },
      {
        title: "What It Does to Your Taxes: Forgiven Debt, 1099-C, and the Exceptions",
        description:
          "This is the chapter people skip and later regret. When a lender forgives debt — the shortfall in a short sale, or a deficiency written off after a foreclosure — that cancelled amount can be treated as taxable income and reported to you and to the IRS on a Form 1099-C. A foreclosure or deed in lieu can also generate a Form 1099-A and may be treated as a sale of the property, which means there can be a gain or loss calculation based on your basis and the loan balance, separate from any cancellation-of-debt issue. There are important exceptions and exclusions that may reduce or eliminate the tax — including insolvency at the time of cancellation, bankruptcy, certain qualified principal residence indebtedness relief where and when it applies, and rules that differ for recourse versus non-recourse loans. States may treat it differently from the federal government. None of this is guesswork territory. Do three things: keep every 1099 you receive and never ignore one, assemble your basis records and closing statements, and engage a CPA or tax attorney before you sign a short sale approval letter, not after you file. The cost of that consultation is trivial against a surprise tax bill on tens of thousands of forgiven dollars. This is educational content, not tax advice.",
        learningObjectives: [
          "Understand cancellation-of-debt income and how Forms 1099-C and 1099-A arise",
          "Identify the major exceptions: insolvency, bankruptcy, and principal-residence relief where applicable",
          "Recognize why recourse versus non-recourse status changes the analysis",
          "Engage a CPA before signing approval documents and retain all basis and 1099 records",
        ],
      },
      {
        title: "Exploring a Short Sale: How It Actually Works, Start to Finish",
        description:
          "A short sale is a normal sale with one extra party at the table: your lender. The sequence is knowable. First, confirm you are genuinely short — get a realistic value opinion and compare it to your payoff, including arrears, fees, and closing costs. Second, contact your servicer's loss mitigation department and request the short sale package; many servicers have a defined program with published timelines. Third, assemble the hardship file: a written hardship letter that states the cause plainly and honestly, income documentation, bank statements, tax returns, a monthly budget, and the authorization form letting your agent speak with the servicer. Fourth, list the property with an agent who has actually closed short sales, priced to the market rather than to your payoff. Fifth, submit the offer with the HUD-1 or closing disclosure estimate and wait for the lender's valuation and decision, which may involve a second lienholder or mortgage insurer whose separate approval is required. Sixth — and this is the step that protects you — read the approval letter for two things: whether the deficiency is released or reserved, and how the account will be reported. Negotiate those before closing, because after closing you have nothing left to trade. Expect the process to take longer than a standard sale, expect requests for updated documents, and keep a dated log of every call.",
        learningObjectives: [
          "Verify you are genuinely short before starting the process",
          "Assemble a complete hardship package that survives servicer review",
          "Understand junior lien and mortgage insurer approval as separate gates",
          "Negotiate deficiency release and credit reporting language into the approval letter",
        ],
      },
      {
        title: "You Received a Notice: The First 72 Hours",
        description:
          "A default or pre-foreclosure notice is frightening, and fear produces the two worst responses: ignoring it, and signing something fast. Do this instead. Hour one: read the notice completely and write down the sender, the date, the amount claimed, any deadline, and any sale date. Hour two: put every document in one folder — note, mortgage or deed of trust, all notices, statements, and correspondence. Day one: call your servicer's loss mitigation line, state clearly that you want to be reviewed for all loss mitigation options, and request the application package; log the date, time, representative name, and reference number. Day one, second call: contact a HUD-approved housing counseling agency. Their counseling is free, they know your state's process and your loan program's options, and they can often speak to servicers in a language servicers respond to. Day two: consult a real estate attorney licensed in your state, especially if the notice involves a lawsuit or a scheduled sale date. Day three: get an honest value opinion on the property and build a one-page picture of payoff, arrears, value, income, and expenses. Never miss a court deadline in a judicial state — a default judgment removes options that were otherwise available. And do not move out because you assume it is over; leaving early can forfeit occupancy, relocation assistance, and negotiating position.",
        learningObjectives: [
          "Triage a notice by identifying sender, amount, deadlines, and any sale date",
          "Request full loss mitigation review and document every servicer contact",
          "Engage a HUD-approved counselor and a state-licensed attorney early",
          "Avoid the two default errors: silence, and vacating the property prematurely",
        ],
      },
      {
        title: "Every Option on the Table — Including the Ones Nobody Offered You",
        description:
          "Foreclosure and short sale are the two endpoints most people hear about; the middle is where many homeowners actually land. Reinstatement means paying the arrears in a lump sum and returning the loan to current. A repayment plan spreads the arrears across future payments. Forbearance pauses or reduces payments temporarily for a defined hardship, with a required exit plan — always ask how the paused amount comes due, because a lump-sum reinstatement at the end is a very different product than a deferral to the end of the loan. A loan modification permanently changes rate, term, or balance to create an affordable payment. Some government-backed loans offer partial claims or payment supplements that move arrears into a subordinate, often no-interest, obligation. If you have equity, the best answer is often the simplest and most overlooked: sell conventionally, pay the loan in full, and walk away with cash and intact credit — an enormous number of distressed homeowners never realize they are not underwater at all. Refinancing may work if credit and equity still allow. A deed in lieu ends it by agreement, sometimes with relocation assistance. Bankruptcy is a legal tool with real consequences and real protections, including an automatic stay, and it deserves an attorney's evaluation rather than internet opinion. Renting the property, or taking in a tenant, can bridge a temporary gap. Choose by matching the tool to the diagnosis: temporary hardship with recovery ahead points to forbearance or repayment; permanent income reduction points to modification; no realistic path to affordability points to a sale, short or otherwise.",
        learningObjectives: [
          "Distinguish reinstatement, repayment plan, forbearance, modification, and partial claim",
          "Check equity first — a conventional sale is often the overlooked best outcome",
          "Ask how forbearance ends before accepting it",
          "Match the remedy to whether the hardship is temporary or permanent",
        ],
      },
      {
        title: "Scams, Deficiency Traps, Life After, and Your One-Page Decision Summary",
        description:
          "Distressed homeowners are targeted, so learn the red flags: anyone who asks for an upfront fee to negotiate with your lender, tells you to stop communicating with your servicer, asks you to make payments to them instead of the lender, pressures you to sign documents you have not read, offers to take title while you 'rent back,' or guarantees a specific result. Legitimate help is free or transparent: HUD-approved counseling agencies, your servicer's own loss mitigation department, and a licensed attorney or agent whose fees are disclosed in writing. On deficiency, get one thing in writing before you sign anything: whether the lender releases you from the remaining balance or reserves the right to pursue it — and if a junior lienholder exists, get the same answer from them separately, because an unreleased second lien can follow you long after the house is gone. Then plan the recovery. Expect a waiting period before you can finance a home again, typically shorter after a short sale than a foreclosure and sometimes shortened further by documented extenuating circumstances. Rebuild credit deliberately, keep housing payments current wherever you live next, save for a down payment, and keep the complete file — approval letters, closing statements, 1099s, and correspondence — because your next lender will ask for it. Close with a one-page summary: your position on the timeline, current value versus payoff, the options you have confirmed are available, deficiency status, expected tax treatment, how the account will be reported, and the counselor, attorney, and CPA advising you. One page, honestly filled in, converts a crisis into a decision.",
        learningObjectives: [
          "Identify rescue-scam red flags and route to legitimate free or disclosed help",
          "Obtain written deficiency release terms from every lienholder before closing",
          "Plan realistic post-event financing waiting periods and credit rebuilding",
          "Produce a one-page decision summary covering position, numbers, tax, credit, and advisors",
        ],
      },
    ]),
  }),

  guide({
    id: "PL-211",
    title: "The Title Guide: What Title Is, Why It Decides Your Closing, and How a Title Company Protects You",
    audience: "Buyers, sellers, refinancing owners, heirs, and investors who want to understand title, escrow, and closing before they sign",
    purpose:
      "Explain in plain language what title is, what a title company actually does from contract to keys, how title search, examination, curative work, escrow, and title insurance protect your money and your ownership, and exactly what you should ask, read, and verify at every step of closing.",
    description:
      "Title is the single most misunderstood part of a real estate transaction — and the one that quietly decides whether your closing happens on time, whether you truly own what you paid for, and whether a problem from 40 years ago becomes your problem today. This guide walks the entire title process: what a title company is and who pays for it, how a title search and examination work, the defects that show up most often and how they get cleared, what your title commitment's Schedule A, B-I, and B-II really say, the difference between owner's and lender's policies, how escrow and settlement move the money, what happens on closing day, wire-fraud protection, and the special cases — inheritance, divorce, trusts, new construction, foreclosure and short sales, and 1031 exchanges. Educational content only; title law, fee structures, and who customarily pays vary by state and county, so confirm specifics with your title company, attorney, and lender.",
    tags: ["title", "title insurance", "escrow", "closing", "settlement", "liens", "buyer", "seller", "wire fraud"],
    chapters: chapters("CH-TTL", [
      {
        title: "What Title Actually Is — And Why It Is Not the Same as the House",
        description:
          "You do not buy a building; you buy the bundle of legal rights attached to it. Title is that bundle: the right to possess, use, exclude others, encumber, and transfer. The deed is the document that moves title from one owner to the next — it is the receipt, not the ownership itself. Those two ideas explain most closing confusion. A property can have a beautiful roof and a broken title, and a broken title costs far more than a roof. Title can be clouded by an unpaid contractor's lien, a divorce decree that never got recorded, a deceased co-owner whose estate never closed, an old mortgage that was paid but never released, a misspelled name on a 1974 deed, a boundary that was fenced in the wrong place for thirty years, or an easement giving a utility permanent access across your yard. It can also be limited on purpose: recorded covenants, HOA restrictions, and mineral or water rights that were severed generations ago. 'Marketable title' means title a reasonable buyer would accept and a lender would finance — not perfect title, but title free of defects that would create real risk of loss or litigation. The whole title process exists to answer one question with evidence: does the seller own what they are selling, and can they hand it over free of anything you did not agree to accept?",
        learningObjectives: [
          "Distinguish title (the rights) from the deed (the document that transfers them)",
          "Name the common categories of title defect: liens, heirs, unreleased mortgages, name and legal-description errors, easements, and encroachments",
          "Explain what 'marketable title' means and why lenders require it",
          "Recognize that recorded restrictions can limit use without clouding ownership",
        ],
      },
      {
        title: "Who a Title Company Is, What They Do, and Who Pays Them",
        description:
          "A title company is the neutral third party that verifies ownership, clears problems, insures the result, holds the money, and records the documents. In some states an attorney performs part or all of this role, and in others an independent escrow company handles funds while the title underwriter issues the policy — the functions are the same even when the job titles differ. Practically, the company wears four hats. As researcher, it searches public records and examines the chain of title. As problem-solver, it performs curative work: chasing lien releases, obtaining payoff statements, correcting legal descriptions, and gathering affidavits. As insurer, it issues title insurance backed by an underwriter that pays defense costs and covered losses if a past defect surfaces later. As settlement agent, it holds earnest money and loan proceeds in escrow, prepares the settlement statement, disburses funds, and records the deed and mortgage in the correct order at the county. On cost, two things matter more than the sticker: who customarily pays in your market — it varies by state and even by county, and it is negotiable in the contract — and whether a reissue rate, simultaneous-issue rate, or seller's prior policy can lower the premium. Title insurance is generally a one-time premium paid at closing, not a recurring bill. Ask early: what is customary here, what is negotiable, and which discounts do I qualify for?",
        learningObjectives: [
          "Describe the four core roles: search, curative, insurance, and settlement",
          "Understand how title-agent, escrow-company, and attorney-state models differ in practice",
          "Ask who customarily pays for owner's and lender's policies in your market and negotiate it in the contract",
          "Identify reissue and simultaneous-issue discounts that reduce premium",
        ],
      },
      {
        title: "The Title Search and Examination: How They Look Backward So You Can Move Forward",
        description:
          "Once you are under contract, the file opens and the search begins. Examiners assemble the chain of title — the unbroken sequence of recorded transfers connecting today's seller to prior owners — and pull everything recorded against the property and against the names of the people in that chain. That means deeds, mortgages and deeds of trust, assignments and releases, judgments, state and federal tax liens, mechanic's liens, HOA assessments, probate and divorce records, bankruptcy filings, easements, covenants, plats, and sometimes surveys. They check the legal description against the plat, confirm each signature and notarization was proper, and confirm every mortgage that was paid off actually shows a recorded release. Then an examiner reads the results and forms an opinion on insurability: clean, clean with exceptions, or cloudy and requiring curative work. Timing matters to you. A routine residential search often comes back in days; complicated chains — estates, tax sales, long-vacant land, unpermitted splits — take longer. A last-minute update called a bring-down or gap search is run immediately before recording, because a judgment or lien filed the week of closing still attaches. If your contract has short deadlines, ask on day one when the commitment will be delivered so you can review it inside your objection window.",
        learningObjectives: [
          "Explain what a chain of title is and what records get searched",
          "Understand why searches run against people's names as well as the property",
          "Anticipate longer timelines for estates, tax-sale, and unusual-history properties",
          "Know why a bring-down or gap search happens right before recording",
        ],
      },
      {
        title: "Reading Your Title Commitment Like a Professional",
        description:
          "The title commitment is the company's promise to insure, on stated conditions, and it is the most valuable document you will receive before closing. Read it the day it arrives. Schedule A is the facts: the proposed insured, the policy amounts, the current record owner, the estate being insured (usually fee simple), and the legal description. Verify your name spelling, the price, the loan amount, and — critically — that the legal description matches the property you walked, including any extra lot or parcel you believed you were buying. Schedule B-I is the requirements: everything that must happen before the policy issues. Payoff and release of the existing mortgage, satisfaction of judgments, HOA estoppel, a death certificate and affidavit for a deceased co-owner, an entity resolution and good-standing certificate for an LLC seller, a signed survey affidavit. Schedule B-II is the exceptions: what the policy will not cover. Standard exceptions include matters a survey would reveal, rights of parties in possession, unrecorded mechanic's liens, and taxes not yet due. Specific exceptions are the real reading: easements, covenants and restrictions, mineral reservations, party-wall agreements, HOA declarations. Request copies of every exception document and actually read them — that is where you learn a utility easement crosses the spot you planned to build a pool, or that the HOA prohibits your intended rental. Many standard exceptions can be removed with a current survey or an endorsement; ask which ones and what they cost.",
        learningObjectives: [
          "Verify Schedule A facts, especially names, amounts, and the legal description",
          "Work through Schedule B-I requirements and know who is responsible for each",
          "Read Schedule B-II exceptions and request the underlying recorded documents",
          "Ask which standard exceptions can be removed by survey or endorsement, and at what cost",
        ],
      },
      {
        title: "When Something Is Wrong: Curative Work, and What It Means for Your Closing Date",
        description:
          "Most title problems are solvable; the variable is time. Unreleased paid-off mortgages are cleared with a payoff letter and a recorded release, sometimes requiring the servicer to be chased for weeks. Judgment and tax liens are paid from seller proceeds at closing, or negotiated down and released. Mechanic's liens are resolved with lien waivers and contractor releases. Heirship gaps require probate documents, an affidavit of heirship, or a small-estate affidavit; a missing signature from a former spouse requires a quitclaim deed or the recorded divorce decree. Name discrepancies — 'Robert J. Smith' on one deed and 'Bob Smith' on another — are cured with a one-and-the-same affidavit. Boundary encroachments may need a survey, an encroachment agreement, or a boundary-line agreement with the neighbor. Truly stubborn defects go to a quiet-title action, a court proceeding measured in months, not days. Occasionally the practical answer is an endorsement or affirmative coverage: the underwriter agrees to insure over a low-risk problem rather than cure it. Your job as a party to the transaction is to shorten the clock. Respond to document requests the same day, put the title officer, lender, and agent on the same email thread, ask weekly for a written status of open B-I requirements, and if a cure will slip past your closing date, negotiate an extension in writing early instead of scrambling the night before.",
        learningObjectives: [
          "Match common defects to their standard cures and realistic timelines",
          "Understand when an underwriter will insure over a defect instead of curing it",
          "Track open Schedule B-I requirements weekly in writing",
          "Negotiate contract extensions early when curative work will not finish in time",
        ],
      },
      {
        title: "Title Insurance: Owner's Policy vs. Lender's Policy, and Why You Want Both",
        description:
          "Title insurance is backward-looking. Every other policy you own protects against future events; title insurance protects against past events that nobody found. It covers defense costs — often the larger real-world benefit — plus covered losses up to the policy amount. Here is the part buyers miss: the lender's policy protects the lender's loan balance only, and it declines as you pay the loan down. It does nothing for your equity. The owner's policy protects you, generally for the purchase price, for as long as you or your heirs hold an interest, with no renewals and no monthly premium. Standard coverage typically addresses forged or improperly executed documents, undisclosed heirs, prior unreleased liens, defective recordings, and lack of legal right to transfer. Extended or enhanced owner's policies, where available, can add coverage for items like post-policy forgery, building-permit violations, mechanic's liens, subdivision-map issues, and automatic inflation adjustments — for a higher premium. Exclusions are real and worth reading: zoning and governmental police power, matters you knew about and did not disclose, defects created after the policy date, and anything listed in Schedule B-II. Two practical moves. First, if you are refinancing, your original owner's policy still stands even though the lender requires a new lender's policy — and ask about a reissue rate. Second, if a claim ever arises, notify the underwriter promptly and in writing; late notice is the most common self-inflicted claim problem.",
        learningObjectives: [
          "Explain why a lender's policy does not protect the owner's equity",
          "Compare standard and enhanced owner's coverage against their exclusions",
          "Understand that owner's coverage is one premium, lasting as long as you hold an interest",
          "Know how and when to file a claim, and to ask about reissue rates on refinance",
        ],
      },
      {
        title: "Escrow and the Money: How Funds Move Safely From Contract to Keys",
        description:
          "Escrow is a neutral holding pattern with rules. Your earnest money goes into a trust account, not the seller's pocket, and it is released only per the contract — which is exactly why a written amendment matters more than a friendly phone call when terms change. As closing approaches, the settlement agent builds the numbers: purchase price, loan proceeds, seller payoffs, prorated property taxes and HOA dues, transfer taxes and recording fees, commissions, home warranty, insurance and escrow reserves, credits and concessions, and the title premium. Buyers using financing receive a Closing Disclosure from the lender, typically at least three business days before consummation — that waiting period exists so you can compare it to your Loan Estimate line by line. Sellers and cash buyers usually see a settlement statement instead. Review it early and out loud: is the sale price right, are the tax prorations calculated to the correct date, are the agreed credits present, do the payoffs match the payoff letters, are there junk fees nobody explained? Bring corrections back within hours, not minutes before signing. Funds must be good funds — a wire or, in some cases, a cashier's check — and personal checks generally do not clear a closing table. Finally, understand the sequence: signing is not closing, funding is not recording, and in most states you are the owner when the deed records at the county, which is when keys are properly released.",
        learningObjectives: [
          "Explain how earnest money is held and under what conditions it is released",
          "Review a Closing Disclosure or settlement statement line by line before signing",
          "Deliver good funds correctly and on time",
          "Distinguish signing, funding, recording, and possession",
        ],
      },
      {
        title: "Closing Day, Wire Fraud, and the Documents You Are Actually Signing",
        description:
          "Closings are increasingly flexible — in person, split signings, mobile notary, or fully remote online notarization where the state permits it — but the content is the same. Buyers sign the note, the mortgage or deed of trust, the Closing Disclosure, an affidavit package, and the loan disclosures. Sellers sign the deed, a seller's affidavit regarding liens and possession, tax withholding certifications where applicable, and the settlement statement. Bring government-issued photo identification matching the name on the documents, and if you are signing under a power of attorney, get it approved by the title company and lender days ahead, not at the table. Do a final walkthrough before you sign, not after. Now the most important paragraph in this guide: wire fraud is the single largest financial risk in a modern closing. Criminals monitor email, spoof the title company's domain by one character, and send convincing 'updated wiring instructions' hours before closing. The rule is absolute — never accept wire instructions by email, never act on a change to instructions, and always call the title company at a number you independently looked up, not one in the email, to verbally verify the account before sending a dollar. Verify after sending too, within the hour. If a wire goes wrong, contact your bank and the title company immediately and file with law enforcement the same day; recovery odds drop by the hour. After recording, store your deed, owner's policy, and settlement statement permanently — you will need them for resale, refinance, tax basis, and estate planning.",
        learningObjectives: [
          "Know which documents buyers and sellers sign and what each one does",
          "Prepare identification, powers of attorney, and remote-notarization logistics in advance",
          "Apply an absolute verbal-verification rule to all wire instructions",
          "Store the deed, owner's policy, and settlement statement permanently",
        ],
      },
      {
        title: "Special Situations, Smart Questions, and Your One-Page Title Checklist",
        description:
          "Some transactions need extra title attention. Inherited property requires probate documents, letters of administration, heirship affidavits, and often an estate tax clearance — start title work before you list, not after you have a buyer. Divorce sales require the recorded decree and a deed from the departing spouse; a decree alone does not move title. Trust and entity sales require the trust certification or operating agreement, plus proof of authority to sign. New construction adds mechanic's-lien risk, so ask for final lien waivers from the general contractor and subs, and confirm the subdivision plat and any dedication requirements. Foreclosure and short sale purchases carry junior-lien and redemption-period questions; get written lien-release terms from every lienholder before closing. A 1031 exchange requires the qualified intermediary to be in place before you close the sale — one day late and the exchange is dead. Vacant land invites access, easement, and boundary questions; a survey is not optional. Finally, how you take title matters: sole ownership, tenants in common, joint tenancy with right of survivorship, community property with right of survivorship where recognized, or a trust — each changes what happens on death, divorce, and creditor claims, so decide with an attorney before the deed is drafted, not after. Close with a one-page checklist: commitment received and read, legal description verified, exception documents requested, B-I requirements assigned with owners and dates, survey ordered or waived deliberately, endorsements priced, owner's policy elected, closing statement reviewed, wire instructions verbally verified, vesting decided, and documents archived.",
        learningObjectives: [
          "Prepare the added documentation required for estates, divorce, trusts, entities, and new construction",
          "Handle distressed, exchange, and vacant-land closings with the right specialists engaged early",
          "Choose a vesting method with legal guidance before the deed is drafted",
          "Run a one-page title checklist from commitment through post-closing archiving",
        ],
      },
    ]),
  }),
] as unknown) as PublicationBlueprint[];
