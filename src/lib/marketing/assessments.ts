// Task 23B/23C — Assessment intelligence and lead qualification.
//
// Questions map to named decision factors. Results are generated from
// rules over the answers, not from canned result pages. Lead
// qualification is computed alongside but is never shown to the visitor.

import type { EntryPathId } from "./positioning";

export type ReadinessLevel = "Ready" | "Nearly Ready" | "Needs Planning" | "Action Required";
export type LeadTier = "High priority" | "Qualified" | "Nurture";

export interface AssessmentOption {
  value: string;
  label: string;
  /** 0 (blocking) to 3 (fully ready) against this factor. */
  score: 0 | 1 | 2 | 3;
  /** Surfaced as a risk when chosen. */
  risk?: string;
  /** Surfaced as a priority action when chosen. */
  priority?: string;
  /** Forces the Action Required level. */
  urgent?: boolean;
  /** Internal qualification points. Never shown to the visitor. */
  leadPoints?: number;
}

export interface AssessmentQuestion {
  id: string;
  factor: string;
  prompt: string;
  help?: string;
  options: AssessmentOption[];
}

export interface AssessmentDefinition {
  id: string;
  slug: string;
  version: string;
  title: string;
  audience: string;
  situation: EntryPathId;
  description: string;
  guideSlug: string;
  publicationIds: string[];
  metaTitle: string;
  metaDescription: string;
  crmCampaign: string;
  questions: AssessmentQuestion[];
}

export interface LeadQualification {
  tier: LeadTier;
  points: number;
  signals: string[];
}

export interface AssessmentResult {
  level: ReadinessLevel;
  summary: string;
  priorities: string[];
  risks: string[];
  nextAction: string;
  guideSlug: string;
  publicationIds: string[];
  qualification: LeadQualification;
  factorScores: { factor: string; score: number; max: number }[];
}

// ---------------------------------------------------------------------------
// Shared question builders
// ---------------------------------------------------------------------------

function timelineQuestion(subject: string): AssessmentQuestion {
  return {
    id: "timeline",
    factor: "Timing",
    prompt: `When do you need to ${subject}?`,
    options: [
      {
        value: "0-90",
        label: "Within 90 days",
        score: 3,
        leadPoints: 30,
        priority: "Work backwards from your target date and lock the preparation sequence this week.",
      },
      { value: "3-6", label: "In three to six months", score: 3, leadPoints: 18 },
      {
        value: "6-12",
        label: "In six to twelve months",
        score: 2,
        leadPoints: 8,
        priority: "Use the runway: resolve documents and numbers now, while nothing is urgent.",
      },
      {
        value: "researching",
        label: "Still researching",
        score: 1,
        leadPoints: 2,
        priority: "Define the outcome you want before you evaluate options.",
      },
    ],
  };
}

function alignmentQuestion(): AssessmentQuestion {
  return {
    id: "alignment",
    factor: "Decision-maker alignment",
    prompt: "Is everyone who must agree actually in agreement?",
    options: [
      { value: "solo", label: "It is only my decision", score: 3, leadPoints: 10 },
      { value: "aligned", label: "Yes, we agree", score: 3, leadPoints: 10 },
      {
        value: "mostly",
        label: "Mostly, with open questions",
        score: 2,
        leadPoints: 5,
        priority: "Close the open questions in writing before you commit to a date.",
      },
      {
        value: "split",
        label: "No, we disagree",
        score: 0,
        leadPoints: 3,
        risk: "Disagreement among decision-makers is the most common cause of failed sales. Settle the decision structure before the property decision.",
        priority: "Agree who decides, by what standard, by what date.",
      },
    ],
  };
}

function contactQuestion(): AssessmentQuestion {
  return {
    id: "support",
    factor: "Advisory support",
    prompt: "What kind of help do you want next?",
    options: [
      {
        value: "consult",
        label: "A consultation on my specific situation",
        score: 3,
        leadPoints: 25,
      },
      { value: "plan", label: "A written plan I can follow myself", score: 3, leadPoints: 12 },
      { value: "answers", label: "Answers to a few specific questions", score: 2, leadPoints: 8 },
      { value: "reading", label: "Just reading for now", score: 2, leadPoints: 0 },
    ],
  };
}

function propertyQuestion(label: string): AssessmentQuestion {
  return {
    id: "property",
    factor: "Property identified",
    prompt: label,
    options: [
      { value: "yes", label: "Yes, a specific property", score: 3, leadPoints: 15 },
      { value: "shortlist", label: "A short list, not decided", score: 2, leadPoints: 8 },
      { value: "no", label: "Not yet", score: 1, leadPoints: 2 },
    ],
  };
}

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

export const ASSESSMENTS: AssessmentDefinition[] = [
  {
    id: "AS-001",
    slug: "seller-readiness",
    version: "1.0.0",
    title: "Seller Readiness Assessment",
    audience: "Homeowners considering a sale",
    situation: "sellers",
    description:
      "Ten decision factors — motivation, timing, equity, condition, next housing, financial readiness, alignment, title, preparation, and market expectations.",
    guideSlug: "seller-decision-guide",
    publicationIds: ["PL-201", "PL-212"],
    metaTitle: "Seller Readiness Assessment — Are You Ready to Sell? | Legacy Forge",
    metaDescription:
      "Answer ten questions on motivation, equity, condition, and timing to get a readiness level, your top three priorities, your top three risks, and a next action.",
    crmCampaign: "lf-assessment-seller-readiness",
    questions: [
      {
        id: "motivation",
        factor: "Motivation",
        prompt: "What is driving the possible sale?",
        options: [
          { value: "must", label: "A change we have to make (job, health, family)", score: 3, leadPoints: 20 },
          { value: "want", label: "A move we want to make", score: 3, leadPoints: 12 },
          { value: "financial", label: "Financial pressure", score: 2, leadPoints: 18, urgent: false },
          {
            value: "curious",
            label: "Curious what the home is worth",
            score: 1,
            leadPoints: 2,
            priority: "Get a written valuation and a net sheet before deciding anything.",
          },
        ],
      },
      timelineQuestion("be moved"),
      {
        id: "equity",
        factor: "Equity",
        prompt: "Do you know your loan payoff and estimated equity?",
        options: [
          { value: "exact", label: "Yes, both in writing", score: 3, leadPoints: 12 },
          { value: "estimate", label: "A reasonable estimate", score: 2, leadPoints: 8, priority: "Order a written payoff demand so the net sheet is real." },
          {
            value: "unknown",
            label: "No",
            score: 0,
            leadPoints: 4,
            risk: "Without a verified payoff you cannot know your net proceeds, and every pricing decision is a guess.",
            priority: "Request a payoff demand from your servicer this week.",
          },
        ],
      },
      {
        id: "condition",
        factor: "Property condition",
        prompt: "What condition is the home in today?",
        options: [
          { value: "ready", label: "Market ready", score: 3 },
          { value: "cosmetic", label: "Needs cosmetic work", score: 2, priority: "Scope only the pre-list work that returns its cost." },
          {
            value: "deferred",
            label: "Meaningful deferred maintenance",
            score: 1,
            risk: "Deferred maintenance discovered by a buyer's inspector costs more than the same work done on your schedule.",
            priority: "Order a pre-listing inspection before you price.",
          },
          { value: "unknown", label: "I have not been through it recently", score: 0, risk: "Pricing a property you have not inspected invites a mid-escrow renegotiation." },
        ],
      },
      {
        id: "next-housing",
        factor: "Next housing plan",
        prompt: "Where do you go after the sale?",
        options: [
          { value: "secured", label: "Secured — owned, rented, or family", score: 3, leadPoints: 10 },
          { value: "buying", label: "Buying next, not yet identified", score: 2, leadPoints: 15, priority: "Decide sell-first versus buy-first and price the exposure of each." },
          { value: "unclear", label: "Not decided", score: 1, risk: "An unplanned next move is the most common source of rushed, expensive decisions after a sale closes." },
        ],
      },
      {
        id: "financial",
        factor: "Financial readiness",
        prompt: "Can you fund preparation and closing costs?",
        options: [
          { value: "yes", label: "Yes, comfortably", score: 3 },
          { value: "limited", label: "A limited budget", score: 2, priority: "Rank prep work by return so a limited budget goes to the highest-yield items." },
          { value: "no", label: "No — it must come out of proceeds", score: 1, priority: "Structure prep costs against proceeds before committing to any vendor." },
        ],
      },
      alignmentQuestion(),
      {
        id: "title",
        factor: "Title considerations",
        prompt: "Is title clean and are all signers available?",
        help: "Trusts, probate, divorce, liens, and out-of-state signers all belong here.",
        options: [
          { value: "clean", label: "Yes, straightforward", score: 3 },
          { value: "trust", label: "Held in a trust or entity", score: 2, priority: "Confirm the signing authority documents before listing." },
          {
            value: "complex",
            label: "Probate, divorce, liens, or co-owner issues",
            score: 1,
            leadPoints: 10,
            risk: "Title complications discovered in escrow delay or kill sales. They are inexpensive to solve before marketing.",
            priority: "Open a preliminary title report now.",
          },
          { value: "unknown", label: "I am not sure", score: 1, priority: "Order a preliminary title report to remove the unknown." },
        ],
      },
      {
        id: "preparation",
        factor: "Sale preparation",
        prompt: "How far along is preparation?",
        options: [
          { value: "done", label: "Essentially done", score: 3 },
          { value: "started", label: "Started", score: 2 },
          { value: "not", label: "Not started", score: 1, priority: "Build the preparation sequence backwards from your target list date." },
        ],
      },
      {
        id: "expectations",
        factor: "Market expectations",
        prompt: "How would you describe your price expectation?",
        options: [
          { value: "evidence", label: "Based on recent comparable sales", score: 3 },
          { value: "flexible", label: "I have a number but I am flexible", score: 2 },
          {
            value: "fixed",
            label: "I need a specific number regardless of comps",
            score: 1,
            risk: "A price the buyer pool will not support costs you the first ten days, which are the most valuable days a listing gets.",
            priority: "Test your number against a written net sheet at three price points.",
          },
        ],
      },
    ],
  },
  {
    id: "AS-002",
    slug: "probate-property",
    version: "1.0.0",
    title: "Probate Property Assessment",
    audience: "Executors, administrators, trustees, and heirs",
    situation: "probate",
    description:
      "Authority, court stage, title, carrying cost, condition, occupancy, family alignment, and disposition intent — assessed together.",
    guideSlug: "probate-property-roadmap",
    publicationIds: ["PL-203", "PL-206"],
    metaTitle: "Probate Property Assessment — What Can You Do Now? | Legacy Forge",
    metaDescription:
      "An assessment for executors and heirs: confirm your authority, your stage, your carrying cost, and the next action that is actually available to you.",
    crmCampaign: "lf-assessment-probate-property",
    questions: [
      {
        id: "authority",
        factor: "Legal authority",
        prompt: "What authority do you currently hold?",
        options: [
          { value: "full", label: "Full authority, documented", score: 3, leadPoints: 20 },
          { value: "limited", label: "Limited authority", score: 2, leadPoints: 15, priority: "Confirm which actions require court confirmation before you market." },
          { value: "trustee", label: "Successor trustee under a trust", score: 3, leadPoints: 20 },
          {
            value: "none",
            label: "None yet — petition pending or not filed",
            score: 0,
            leadPoints: 8,
            urgent: true,
            risk: "No property may be listed, promised, or disposed of before authority exists. Acting early creates personal exposure.",
            priority: "Do not list or promise the property. Confirm appointment first.",
          },
        ],
      },
      {
        id: "stage",
        factor: "Court stage",
        prompt: "Where is the estate in the process?",
        options: [
          { value: "appointed", label: "Appointed, administration underway", score: 3 },
          { value: "filed", label: "Petition filed, hearing pending", score: 2, priority: "Use the waiting period to establish value and secure the property." },
          { value: "notfiled", label: "Nothing filed yet", score: 1, priority: "Speak with a probate attorney before touching the property." },
          { value: "trust", label: "No probate — trust administration", score: 3 },
        ],
      },
      {
        id: "occupancy",
        factor: "Occupancy and security",
        prompt: "Who is in the property?",
        options: [
          { value: "vacant-secure", label: "Vacant and secured", score: 3 },
          { value: "occupied-heir", label: "Occupied by a family member", score: 1, risk: "An occupying heir changes both the timeline and the negotiation. Address occupancy before marketing.", priority: "Agree occupancy terms and an exit date in writing." },
          { value: "tenant", label: "Occupied by a tenant", score: 2, priority: "Confirm tenancy terms and applicable notice requirements." },
          { value: "vacant-open", label: "Vacant and not secured", score: 0, urgent: true, risk: "An unsecured vacant property risks vandalism, squatters, and an insurance denial.", priority: "Secure the property and confirm vacant-property insurance today." },
        ],
      },
      {
        id: "value",
        factor: "Valuation",
        prompt: "Has a date-of-death value been established?",
        options: [
          { value: "appraised", label: "Yes, by appraisal or probate referee", score: 3 },
          { value: "opinion", label: "An agent opinion only", score: 2 },
          { value: "none", label: "No", score: 1, priority: "Establish date-of-death value — it drives basis and every downstream tax question." },
        ],
      },
      {
        id: "carrying",
        factor: "Carrying cost",
        prompt: "Do you know the monthly carrying cost?",
        options: [
          { value: "known", label: "Yes, calculated", score: 3 },
          { value: "rough", label: "Roughly", score: 2 },
          { value: "unknown", label: "No", score: 1, risk: "Unmeasured carrying cost is the quiet expense of every delayed estate decision.", priority: "Total the monthly cost: taxes, insurance, utilities, upkeep, and any loan." },
        ],
      },
      {
        id: "condition",
        factor: "Property condition",
        prompt: "What condition is the property in?",
        options: [
          { value: "ready", label: "Market ready", score: 3 },
          { value: "dated", label: "Dated but sound", score: 2 },
          { value: "contents", label: "Full of contents, needs clearing", score: 1, priority: "Sequence contents clearing before any marketing date is set." },
          { value: "poor", label: "Poor condition", score: 1, priority: "Compare an as-is sale against targeted repairs with real numbers." },
        ],
      },
      alignmentQuestion(),
      {
        id: "intent",
        factor: "Disposition intent",
        prompt: "What is the current intent for the property?",
        options: [
          { value: "sell", label: "Sell", score: 3, leadPoints: 20 },
          { value: "undecided", label: "Undecided between keep, rent, and sell", score: 2, leadPoints: 12, priority: "Put keep, rent, and sell on one page with the same assumptions." },
          { value: "keep", label: "Keep in the family", score: 3, leadPoints: 6, priority: "Document who pays, who maintains, and who decides." },
        ],
      },
      contactQuestion(),
    ],
  },
  {
    id: "AS-003",
    slug: "downsizing-readiness",
    version: "1.0.0",
    title: "Downsizing Readiness Assessment",
    audience: "Homeowners 55+ and families planning a smaller move",
    situation: "downsizing",
    description:
      "Destination, sequencing, equity, contents, mobility needs, tax base, alignment, and timing assessed as one plan.",
    guideSlug: "downsizing-made-simple",
    publicationIds: ["PL-205"],
    metaTitle: "Downsizing Readiness Assessment | Legacy Forge",
    metaDescription:
      "Eight questions on destination, sequencing, equity, and contents produce a readiness level, your priorities, your risks, and the next action.",
    crmCampaign: "lf-assessment-downsizing",
    questions: [
      {
        id: "destination",
        factor: "Destination",
        prompt: "Do you know where you are going?",
        options: [
          { value: "specific", label: "A specific home or community", score: 3, leadPoints: 20 },
          { value: "area", label: "An area, not a home", score: 2, leadPoints: 12 },
          { value: "unknown", label: "Not yet", score: 1, leadPoints: 4, priority: "Define the destination first — it determines the entire sequence." },
        ],
      },
      {
        id: "sequence",
        factor: "Sequencing",
        prompt: "Have you decided sell-first or buy-first?",
        options: [
          { value: "sell", label: "Sell first, then buy", score: 3 },
          { value: "buy", label: "Buy first, then sell", score: 2, risk: "Buying first means carrying two properties. Confirm with your lender that you can genuinely qualify and sustain both." },
          { value: "undecided", label: "Not decided", score: 1, priority: "Price both sequences before choosing — the difference is usually thousands, not tens of thousands." },
        ],
      },
      {
        id: "equity",
        factor: "Equity and budget",
        prompt: "Do the sale proceeds cover the next home?",
        options: [
          { value: "yes", label: "Yes, with room", score: 3 },
          { value: "tight", label: "Close — it depends on price", score: 2, priority: "Model net proceeds at three sale prices against the target purchase." },
          { value: "no", label: "No, we would need financing", score: 1, priority: "Confirm financing eligibility on the next home before listing this one." },
          { value: "unknown", label: "Not sure", score: 1, risk: "Without a net-proceeds figure, the downsizing budget is guesswork." },
        ],
      },
      {
        id: "contents",
        factor: "Contents",
        prompt: "How far along is sorting the contents?",
        options: [
          { value: "done", label: "Largely done", score: 3 },
          { value: "started", label: "Started", score: 2 },
          { value: "not", label: "Not started", score: 1, priority: "Start the contents sort eight weeks before your target list date, one category at a time." },
          { value: "decades", label: "Decades of belongings, feels overwhelming", score: 0, risk: "Contents, not price, is what most often delays a downsizing move.", priority: "Break the sort into weekly categories and schedule help." },
        ],
      },
      {
        id: "mobility",
        factor: "Accessibility needs",
        prompt: "Does the next home need accessibility features?",
        options: [
          { value: "no", label: "No", score: 3 },
          { value: "future", label: "Not now, but plan for later", score: 3, priority: "Filter for single-level or adaptable layouts even if you do not need them yet." },
          { value: "yes", label: "Yes, now", score: 2, priority: "Screen for step-free entry, bathroom access, and single-level living from the first search." },
        ],
      },
      {
        id: "taxbase",
        factor: "Property tax base",
        prompt: "Have you checked whether you can transfer your property tax base?",
        options: [
          { value: "yes", label: "Yes, verified", score: 3 },
          { value: "heard", label: "I have heard of it but have not checked", score: 2, priority: "Verify eligibility with the county assessor — it can change what you can afford." },
          { value: "no", label: "No", score: 1, priority: "Ask the county assessor about base-year value transfer eligibility." },
        ],
      },
      alignmentQuestion(),
      timelineQuestion("be in the next home"),
    ],
  },
  {
    id: "AS-004",
    slug: "distressed-options",
    version: "1.0.0",
    title: "Distressed Property Options Assessment",
    audience: "Homeowners behind on payments or facing default",
    situation: "distressed-property",
    description:
      "Loan status, recorded notices, equity, income, communication with the servicer, and intent — mapped to the options still available.",
    guideSlug: "pre-foreclosure-options",
    publicationIds: ["PL-207"],
    metaTitle: "Distressed Property Options Assessment — California | Legacy Forge",
    metaDescription:
      "Find out which options are still open: reinstatement, workout, equity sale, or short sale. Six questions, a clear readiness level, and an immediate next action.",
    crmCampaign: "lf-assessment-distressed",
    questions: [
      {
        id: "status",
        factor: "Loan status",
        prompt: "Where do the payments stand?",
        options: [
          { value: "current", label: "Current, but it is getting hard", score: 3, leadPoints: 12, priority: "Acting while current preserves every option, including a conventional sale." },
          { value: "1-2", label: "One or two payments behind", score: 2, leadPoints: 20, priority: "Request a reinstatement quote from the servicer now." },
          { value: "3plus", label: "Three or more behind", score: 1, leadPoints: 25, urgent: true, risk: "At three or more missed payments, a notice of default is typically imminent." },
          { value: "unknown", label: "I have stopped opening the mail", score: 0, leadPoints: 25, urgent: true, risk: "Unopened notices do not pause deadlines. The timeline runs whether or not you read it.", priority: "Open every notice today and record the dates." },
        ],
      },
      {
        id: "notice",
        factor: "Recorded notices",
        prompt: "Has anything been recorded against the property?",
        options: [
          { value: "none", label: "Nothing recorded", score: 3 },
          { value: "nod", label: "A notice of default", score: 1, leadPoints: 25, urgent: true, risk: "A recorded notice of default starts a statutory clock. The reinstatement window is finite.", priority: "Confirm the exact recording date and the reinstatement deadline." },
          { value: "nos", label: "A notice of sale, with a date", score: 0, leadPoints: 30, urgent: true, risk: "A scheduled trustee sale is the last stage. Options remaining are measured in days.", priority: "Seek immediate advice from a HUD-approved counselor or attorney." },
          { value: "unsure", label: "I am not sure", score: 1, urgent: true, priority: "Check the county recorder for recorded documents today." },
        ],
      },
      {
        id: "equity",
        factor: "Equity position",
        prompt: "Is the home likely worth more than what is owed?",
        options: [
          { value: "yes", label: "Yes, meaningfully more", score: 3, leadPoints: 20, priority: "With equity, a conventional sale usually beats every distressed alternative." },
          { value: "close", label: "About even", score: 2, leadPoints: 15 },
          { value: "no", label: "No, less than owed", score: 1, leadPoints: 15, priority: "Compare a short sale against a workout with your servicer." },
          { value: "unknown", label: "Not sure", score: 1, priority: "Establish value and total payoff before choosing a path." },
        ],
      },
      {
        id: "income",
        factor: "Income stability",
        prompt: "Has income recovered or is it likely to?",
        options: [
          { value: "recovered", label: "Yes, already recovered", score: 3, priority: "Recovered income makes reinstatement or modification realistic — ask the servicer." },
          { value: "soon", label: "Expected to recover soon", score: 2 },
          { value: "no", label: "No", score: 1, risk: "Keeping the home without restored income usually delays rather than resolves the problem." },
        ],
      },
      {
        id: "servicer",
        factor: "Servicer communication",
        prompt: "Are you in contact with your lender or servicer?",
        options: [
          { value: "active", label: "Yes, actively", score: 3 },
          { value: "some", label: "Some contact", score: 2, priority: "Ask specifically for the loss mitigation department and document every call." },
          { value: "none", label: "No contact", score: 0, risk: "Servicers cannot offer options they are never asked for. Silence removes solutions.", priority: "Call the loss mitigation department and request all available options in writing." },
        ],
      },
      {
        id: "intent",
        factor: "Objective",
        prompt: "What outcome do you want?",
        options: [
          { value: "keep", label: "Keep the home if possible", score: 3, leadPoints: 12 },
          { value: "sell", label: "Sell and protect what equity remains", score: 3, leadPoints: 25 },
          { value: "unknown", label: "I do not know what is realistic", score: 2, leadPoints: 18, priority: "Map your position on the timeline before choosing an outcome." },
        ],
      },
    ],
  },
  {
    id: "AS-005",
    slug: "buyer-readiness",
    version: "1.0.0",
    title: "Buyer Readiness Assessment",
    audience: "Buyers and first-time buyers",
    situation: "buyers",
    description:
      "Financing posture, funds, payment comfort, property focus, timeline, reserves, and decision alignment.",
    guideSlug: "buyer-decision-guide",
    publicationIds: ["PL-202", "PL-213"],
    metaTitle: "Buyer Readiness Assessment — Are You Ready to Buy? | Legacy Forge",
    metaDescription:
      "Seven questions on financing, funds, reserves, and timing produce a readiness level, your top priorities and risks, and a clear next action.",
    crmCampaign: "lf-assessment-buyer",
    questions: [
      {
        id: "financing",
        factor: "Financing posture",
        prompt: "Where are you with financing?",
        options: [
          { value: "underwritten", label: "Fully underwritten pre-approval", score: 3, leadPoints: 25 },
          { value: "prequal", label: "Pre-qualified only", score: 2, leadPoints: 15, priority: "Upgrade to full underwriting — it is the cheapest offer-strength improvement available." },
          { value: "cash", label: "Paying cash", score: 3, leadPoints: 25 },
          { value: "none", label: "Not started", score: 1, leadPoints: 5, priority: "Talk to a lender before touring — it defines your ceiling and your leverage." },
        ],
      },
      {
        id: "funds",
        factor: "Funds available",
        prompt: "Are your down payment and closing funds available?",
        options: [
          { value: "liquid", label: "Yes, liquid and seasoned", score: 3 },
          { value: "partly", label: "Partly, or tied up", score: 2, priority: "Move funds into a documented account well ahead of an offer." },
          { value: "gift", label: "Relying on a gift or a sale", score: 2, priority: "Document the gift or the dependent sale early — underwriters will ask." },
          { value: "no", label: "Not yet", score: 1, priority: "Set a savings target with a date before shopping." },
        ],
      },
      {
        id: "payment",
        factor: "Payment comfort",
        prompt: "Have you modeled the full monthly cost, not just principal and interest?",
        options: [
          { value: "yes", label: "Yes, including taxes, insurance, HOA, and upkeep", score: 3 },
          { value: "partly", label: "Partly", score: 2, priority: "Add taxes, insurance, HOA or Mello-Roos, and a maintenance reserve to the payment." },
          { value: "no", label: "No", score: 1, risk: "A home you can buy and a home you can own are not always the same home." },
        ],
      },
      propertyQuestion("Have you identified a property or area?"),
      timelineQuestion("be in your new home"),
      {
        id: "reserves",
        factor: "Reserves after closing",
        prompt: "What is left in reserves after closing?",
        options: [
          { value: "6", label: "Six months or more", score: 3 },
          { value: "3", label: "About three months", score: 2 },
          { value: "0", label: "Little or nothing", score: 1, risk: "Closing with no reserves turns the first repair into a crisis. Target three to six months." },
        ],
      },
      alignmentQuestion(),
    ],
  },
  {
    id: "AS-006",
    slug: "investor-readiness",
    version: "1.0.0",
    title: "Investor Readiness Assessment",
    audience: "Investors and owners deciding whether to keep or dispose",
    situation: "investing",
    description:
      "Objective, capital, underwriting discipline, management posture, tax strategy, risk tolerance, and exchange timing.",
    guideSlug: "sell-vs-rent",
    publicationIds: ["PL-204", "PL-208"],
    metaTitle: "Investor Readiness Assessment — Keep, Buy, or Sell | Legacy Forge",
    metaDescription:
      "Seven questions on objective, capital, underwriting, management, and tax strategy produce a readiness level, your priorities and risks, and a next action.",
    crmCampaign: "lf-assessment-investor",
    questions: [
      {
        id: "objective",
        factor: "Investment objective",
        prompt: "What is the objective for this capital?",
        options: [
          { value: "cashflow", label: "Monthly cash flow", score: 3, leadPoints: 15 },
          { value: "appreciation", label: "Long-term appreciation", score: 3, leadPoints: 12 },
          { value: "exit", label: "Exiting a property I already own", score: 3, leadPoints: 20 },
          { value: "unclear", label: "Not clearly defined", score: 1, priority: "Name the objective first — it determines which properties even qualify." },
        ],
      },
      {
        id: "capital",
        factor: "Capital position",
        prompt: "Is capital available and deployable?",
        options: [
          { value: "ready", label: "Ready to deploy", score: 3, leadPoints: 20 },
          { value: "exchange", label: "Coming from a sale or exchange", score: 3, leadPoints: 25, priority: "Exchange timelines are strict. Map the 45-day and 180-day dates before you close the sale." },
          { value: "later", label: "Available later this year", score: 2, leadPoints: 8 },
          { value: "no", label: "Not yet", score: 1, leadPoints: 2 },
        ],
      },
      {
        id: "underwriting",
        factor: "Underwriting discipline",
        prompt: "Do you underwrite before touring?",
        options: [
          { value: "always", label: "Always, with written assumptions", score: 3 },
          { value: "sometimes", label: "Sometimes", score: 2, priority: "Standardize a one-page underwriting sheet so every deal is compared the same way." },
          { value: "no", label: "Not yet", score: 1, risk: "Falling in love with a property before underwriting it is the most reliable way to overpay." },
        ],
      },
      {
        id: "management",
        factor: "Management posture",
        prompt: "Who manages the property?",
        options: [
          { value: "pm", label: "A professional manager", score: 3 },
          { value: "self", label: "I self-manage", score: 3, priority: "Price your own time into the return — it is a real expense." },
          { value: "unknown", label: "Not decided", score: 1, priority: "Decide management before purchase; it changes the net return materially." },
        ],
      },
      {
        id: "tax",
        factor: "Tax strategy",
        prompt: "Have you confirmed the tax treatment with a CPA?",
        options: [
          { value: "yes", label: "Yes", score: 3 },
          { value: "planned", label: "Planned, not yet done", score: 2, priority: "Confirm basis, depreciation, and exchange eligibility before you transact." },
          { value: "no", label: "No", score: 1, risk: "Tax posture frequently changes which option is actually better. Confirm it before deciding." },
        ],
      },
      {
        id: "risk",
        factor: "Risk tolerance",
        prompt: "How much operational risk do you want?",
        options: [
          { value: "low", label: "Low — stability over yield", score: 3 },
          { value: "moderate", label: "Moderate", score: 3 },
          { value: "high", label: "High — value-add and repositioning", score: 3, priority: "Confirm reserves and contingency budget match the risk you are taking." },
        ],
      },
      contactQuestion(),
    ],
  },
];

export function getAssessment(slug: string): AssessmentDefinition | undefined {
  return ASSESSMENTS.find(a => a.slug === slug);
}

export function assessmentForSituation(situation: EntryPathId): AssessmentDefinition | undefined {
  return ASSESSMENTS.find(a => a.situation === situation);
}

// ---------------------------------------------------------------------------
// Rules engine
// ---------------------------------------------------------------------------

const LEVEL_SUMMARY: Record<ReadinessLevel, string> = {
  Ready:
    "Your authority, your numbers, and your timing line up. What remains is execution, and execution rewards a written plan.",
  "Nearly Ready":
    "The direction is sound and one or two inputs are still estimates. Closing those gaps now costs days; discovering them later costs money.",
  "Needs Planning":
    "You have a direction but not yet a plan. This is the right moment to build the numbers and confirm the paperwork, before anything becomes irreversible.",
  "Action Required":
    "At least one item on your answers needs attention before anything else moves. Handle it first — the rest of the plan depends on it.",
};

function pickNextAction(
  assessment: AssessmentDefinition,
  level: ReadinessLevel,
  priorities: string[],
): string {
  if (level === "Action Required" && priorities.length > 0) return priorities[0];
  if (level === "Ready") {
    return `Bring your numbers to a strategy call and leave with a written ${assessment.situation === "buyers" ? "buying" : "action"} plan and a date-by-date sequence.`;
  }
  if (level === "Nearly Ready") {
    return priorities[0] ?? "Close the remaining gap in writing this week, then set your target date.";
  }
  return (
    priorities[0] ??
    `Read the ${assessment.title.replace(" Assessment", "")} guide, then book a call to pressure-test your assumptions.`
  );
}

export function evaluateAssessment(
  assessment: AssessmentDefinition,
  answers: Record<string, string>,
  context: { consultationRequested?: boolean; contactProvided?: boolean } = {},
): AssessmentResult {
  const chosen: { q: AssessmentQuestion; o: AssessmentOption }[] = [];
  for (const q of assessment.questions) {
    const o = q.options.find(opt => opt.value === answers[q.id]);
    if (o) chosen.push({ q, o });
  }

  const factorScores = chosen.map(({ q, o }) => ({ factor: q.factor, score: o.score, max: 3 }));
  const total = chosen.reduce((sum, c) => sum + c.o.score, 0);
  const max = chosen.length * 3 || 1;
  const ratio = total / max;
  const urgent = chosen.some(c => c.o.urgent);
  const blocking = chosen.filter(c => c.o.score === 0).length;

  let level: ReadinessLevel;
  if (urgent || blocking >= 2) level = "Action Required";
  else if (ratio >= 0.85 && blocking === 0) level = "Ready";
  else if (ratio >= 0.68) level = "Nearly Ready";
  else if (ratio >= 0.45) level = "Needs Planning";
  else level = "Action Required";

  // Priorities: lowest-scoring answers first, deduplicated, capped at three.
  const ranked = [...chosen].sort((a, b) => a.o.score - b.o.score);
  const priorities: string[] = [];
  for (const c of ranked) {
    if (c.o.priority && !priorities.includes(c.o.priority)) priorities.push(c.o.priority);
    if (priorities.length === 3) break;
  }

  const risks: string[] = [];
  for (const c of ranked) {
    if (c.o.risk && !risks.includes(c.o.risk)) risks.push(c.o.risk);
    if (risks.length === 3) break;
  }

  // Internal qualification — never rendered to the visitor.
  let points = chosen.reduce((sum, c) => sum + (c.o.leadPoints ?? 0), 0);
  const signals: string[] = [];
  if (answers["timeline"] === "0-90") signals.push("0-90 day timeline");
  if (answers["property"] === "yes" || answers["destination"] === "specific") {
    signals.push("Property identified");
  }
  if (answers["equity"] === "exact" || answers["equity"] === "yes") signals.push("Equity indicated");
  if (urgent) {
    points += 20;
    signals.push("Time-sensitive situation");
  }
  if (context.contactProvided) {
    points += 15;
    signals.push("Contact information provided");
  }
  if (context.consultationRequested) {
    points += 25;
    signals.push("Consultation requested");
  }
  const tier: LeadTier = points >= 80 ? "High priority" : points >= 45 ? "Qualified" : "Nurture";

  return {
    level,
    summary: LEVEL_SUMMARY[level],
    priorities,
    risks,
    nextAction: pickNextAction(assessment, level, priorities),
    guideSlug: assessment.guideSlug,
    publicationIds: assessment.publicationIds,
    qualification: { tier, points, signals },
    factorScores,
  };
}
