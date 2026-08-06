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
] as unknown) as PublicationBlueprint[];
