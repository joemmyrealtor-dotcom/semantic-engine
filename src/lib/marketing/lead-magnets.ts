// Task 22B — One governed lead-magnet framework.
//
// Every guide is a data record. Routes render them; nothing about a
// guide is hard-coded in a component. Adding a guide is a data change.

import type { EntryPathId } from "./positioning";
import { LEGAL_DISCLOSURE } from "./positioning";

export type GuideStatus = "Draft" | "Published";

export interface GuideSection {
  heading: string;
  body: string;
  bullets?: string[];
}

export interface GuideDefinition {
  id: string;
  slug: string;
  version: string;
  status: GuideStatus;
  audience: string;
  title: string;
  promise: string;
  description: string;
  situation: EntryPathId;
  publicationIds: string[];
  frameworkIds: string[];
  assessmentSlug: string;
  primaryCta: string;
  crmCampaign: string;
  crmLeadSource: string;
  metaTitle: string;
  metaDescription: string;
  disclaimer: string;
  sections: GuideSection[];
  checklist: string[];
}

const STANDARD_DISCLAIMER =
  "Educational content only. Not legal, tax, or financial advice. Consult your attorney, CPA, or lender before acting. Equal Housing Opportunity.";

export const GUIDES: GuideDefinition[] = [
  {
    id: "LM-001",
    slug: "seller-decision-guide",
    version: "1.0.0",
    status: "Published",
    audience: "Homeowners considering selling",
    title: "The Seller Decision Guide",
    promise: "Decide whether to sell, when to sell, and what you actually walk away with.",
    description:
      "A structured decision guide for homeowners weighing a sale: pricing posture, preparation scope, net proceeds, and the sequencing that protects your equity.",
    situation: "sellers",
    publicationIds: ["PL-201", "PL-212"],
    frameworkIds: ["F-010"],
    assessmentSlug: "seller-readiness",
    primaryCta: "Get Your Seller Strategy",
    crmCampaign: "lf-seller-decision-guide",
    crmLeadSource: "Lead Magnet — Seller Decision Guide",
    metaTitle: "The Seller Decision Guide — Should You Sell? | Legacy Forge",
    metaDescription:
      "A free seller decision guide: pricing strategy, preparation scope, net proceeds math, and the sequencing that protects your equity in Orange County.",
    disclaimer: STANDARD_DISCLAIMER,
    sections: [
      {
        heading: "Start with the outcome, not the list price",
        body: "Most sellers begin with a price and reason backwards. That inverts the decision. The number that matters is what lands in your account after payoff, commissions, concessions, prorations, and title — and what that number has to accomplish next.",
        bullets: [
          "Write down what the proceeds must fund: a next purchase, a debt payoff, a family distribution.",
          "Establish the minimum acceptable net, not the hoped-for gross.",
          "Only then set a pricing strategy against the current buyer pool.",
        ],
      },
      {
        heading: "Condition strategy: what returns its cost",
        body: "Pre-listing work is an investment decision, not a taste decision. Some work reliably returns more than it costs because it moves a home from the as-is buyer pool into the retail pool. Most cosmetic upgrades do not.",
        bullets: [
          "Fix anything an inspector will flag as health, safety, or active leak.",
          "Address the first eight feet a buyer sees: entry, light, floors, paint.",
          "Skip discretionary remodels within 90 days of listing — you rarely recover the spread.",
        ],
      },
      {
        heading: "Pricing into a real buyer pool",
        body: "Price is a marketing decision with a short window. The first ten days generate the most qualified traffic you will ever get. Pricing above the pool costs you those days and then costs you again through reductions that read as weakness.",
      },
      {
        heading: "Timing and sequencing",
        body: "If you need to buy next, sequence matters more than price. Selling first with a rent-back is usually cheaper than carrying two payments; buying first is only safe when you can genuinely carry both.",
      },
      {
        heading: "The negotiation you have not planned for",
        body: "Most sellers plan for the offer negotiation and get surprised by the repair-request negotiation after inspection. Decide your credit ceiling and your walk-away position before the request arrives.",
      },
    ],
    checklist: [
      "Written net-proceeds estimate at three price points",
      "Payoff demand ordered and verified",
      "Pre-listing inspection scheduled",
      "Repair-credit ceiling decided in advance",
      "Next-housing plan documented",
    ],
  },
  {
    id: "LM-002",
    slug: "probate-property-roadmap",
    version: "1.0.0",
    status: "Published",
    audience: "Heirs, executors, administrators, and trustees",
    title: "The Probate and Inherited Property Roadmap",
    promise: "Know what you are allowed to do, in what order, and what it costs to wait.",
    description:
      "A sequenced roadmap for executors, administrators, and trustees handling California real property: authority, notice, appraisal, confirmation, and the keep-rent-sell decision.",
    situation: "probate",
    publicationIds: ["PL-203", "PL-206"],
    frameworkIds: ["F-010"],
    assessmentSlug: "probate-property",
    primaryCta: "Build Your Property Action Plan",
    crmCampaign: "lf-probate-property-roadmap",
    crmLeadSource: "Lead Magnet — Probate Property Roadmap",
    metaTitle: "Probate and Inherited Property Roadmap — California | Legacy Forge",
    metaDescription:
      "A free probate property roadmap for executors and heirs: authority, court requirements, carrying costs, and the keep, rent, or sell decision in Orange County.",
    disclaimer: STANDARD_DISCLAIMER,
    sections: [
      {
        heading: "Authority comes before everything",
        body: "Nothing is listed, promised, or cleaned out until authority is documented. Whether you hold full or limited authority under the Independent Administration of Estates Act — or act as successor trustee under a trust — determines what you can do without returning to court.",
        bullets: [
          "Locate the letters, the order, or the trust document naming you.",
          "Confirm full versus limited authority in writing.",
          "Identify every party entitled to notice before marketing begins.",
        ],
      },
      {
        heading: "The carrying cost nobody budgets",
        body: "An empty inherited property costs money every month: mortgage or taxes, vacant-property insurance, utilities, landscaping, and the slow depreciation of a house nobody is watching. Estimate the monthly figure honestly — it is the price of every month of indecision.",
      },
      {
        heading: "Keep, rent, or sell",
        body: "Each option carries a different tax posture, a different risk profile, and a different demand on the family. The stepped-up basis available at death is often the single largest variable, and it can change what looks like the obvious choice.",
        bullets: [
          "Keep: who pays, who maintains, who decides.",
          "Rent: real net yield after vacancy, management, and reserves.",
          "Sell: net proceeds, timing, and distribution mechanics.",
        ],
      },
      {
        heading: "When heirs disagree",
        body: "Disagreement among decision-makers is the most common cause of failed estate sales. Fix the decision structure first — who decides, by what standard, by what date — before you debate the property.",
      },
      {
        heading: "Sequencing the sale",
        body: "Appraisal, notice, marketing, and any required confirmation follow an order. Running them out of order creates delay and, in confirmation sales, exposes you to overbid dynamics you did not plan for.",
      },
    ],
    checklist: [
      "Authority documented and confirmed",
      "Date-of-death value established",
      "Monthly carrying cost calculated",
      "Notice list built",
      "Family decision structure agreed in writing",
    ],
  },
  {
    id: "LM-003",
    slug: "downsizing-made-simple",
    version: "1.0.0",
    status: "Published",
    audience: "Homeowners 55+ and families planning a smaller move",
    title: "Downsizing Made Simple",
    promise: "Move smaller without a gap you cannot cover or equity you cannot recover.",
    description:
      "A sequencing plan for downsizing homeowners: sell-first versus buy-first exposure, bridge options, property tax base considerations, and a realistic move timeline.",
    situation: "downsizing",
    publicationIds: ["PL-205"],
    frameworkIds: ["F-010"],
    assessmentSlug: "downsizing-readiness",
    primaryCta: "Create Your Downsizing Plan",
    crmCampaign: "lf-downsizing-made-simple",
    crmLeadSource: "Lead Magnet — Downsizing Made Simple",
    metaTitle: "Downsizing Made Simple — Sequence the Move | Legacy Forge",
    metaDescription:
      "A free downsizing plan: sell-first versus buy-first exposure, bridge options, property tax base transfer considerations, and a realistic timeline.",
    disclaimer: STANDARD_DISCLAIMER,
    sections: [
      {
        heading: "The real risk is the gap, not the price",
        body: "Downsizing rarely fails on price. It fails in the gap between leaving one home and entering the next — the temporary housing, the double payment, the storage, the second move.",
      },
      {
        heading: "Sell first or buy first",
        body: "Selling first with a negotiated rent-back gives you certainty of proceeds and one move. Buying first gives you certainty of destination and costs more. Choose deliberately, and price the option you choose.",
        bullets: [
          "Sell-first: strongest proceeds certainty, requires flexibility on destination.",
          "Buy-first: strongest destination certainty, requires carrying capacity.",
          "Contingent purchase: fewer sellers accept it, but it can be structured.",
        ],
      },
      {
        heading: "Property tax base considerations",
        body: "Eligible California homeowners may be able to transfer a property tax base to a replacement primary residence, subject to age, timing, and value rules. This can change the affordability of the next home materially. Verify eligibility with the county assessor before you rely on it.",
      },
      {
        heading: "Fifty years of belongings",
        body: "The most underestimated part of downsizing is not the transaction — it is the contents. Start the sort eight weeks before listing, one category at a time, with a decision rule per category.",
      },
      {
        heading: "The move plan",
        body: "Work backwards from your target occupancy date: closing, escrow length, offer window, marketing, preparation, sorting. Each step has a duration, and the plan should show them in sequence.",
      },
    ],
    checklist: [
      "Target occupancy date set",
      "Sell-first versus buy-first decided and priced",
      "Property tax base eligibility verified",
      "Net proceeds and next-home budget reconciled",
      "Contents sort started",
    ],
  },
  {
    id: "LM-004",
    slug: "pre-foreclosure-options",
    version: "1.0.0",
    status: "Published",
    audience: "Homeowners behind on payments or facing default",
    title: "Pre-Foreclosure Options Guide",
    promise: "See every option that is still open — before the deadlines close them.",
    description:
      "A timeline-driven options map for distressed California homeowners: reinstatement, workout, sale with equity, short sale, and the dates that quietly remove options.",
    situation: "distressed-property",
    publicationIds: ["PL-207"],
    frameworkIds: ["F-010"],
    assessmentSlug: "distressed-options",
    primaryCta: "Review Your Options Before the Deadline",
    crmCampaign: "lf-pre-foreclosure-options",
    crmLeadSource: "Lead Magnet — Pre-Foreclosure Options",
    metaTitle: "Pre-Foreclosure Options Guide — California Timeline | Legacy Forge",
    metaDescription:
      "A free pre-foreclosure guide: the California default timeline, reinstatement, workout, equity sale, and short sale — and the deadlines that remove options.",
    disclaimer: STANDARD_DISCLAIMER,
    sections: [
      {
        heading: "Options close on dates, not on readiness",
        body: "The single most expensive belief in a distressed situation is that there is still time. Options in California disappear at recorded milestones. Knowing where you sit on that timeline is the whole decision.",
      },
      {
        heading: "The timeline, stage by stage",
        body: "Missed payments, lender contact requirements, a recorded notice of default, the reinstatement window, a recorded notice of sale, and the sale date itself. Each stage removes something. Each stage also has an action that is still available.",
      },
      {
        heading: "Do you have equity?",
        body: "This is the fork in the road. With equity, a conventional sale usually beats every distressed alternative and preserves both proceeds and credit. Without equity, a short sale or a lender workout becomes the conversation.",
        bullets: [
          "Equity sale: you control price, timing, and proceeds.",
          "Short sale: lender approval required, longer timeline, credit impact.",
          "Workout, forbearance, or modification: keeps the home when income supports it.",
        ],
      },
      {
        heading: "What each path does to you afterward",
        body: "Credit impact, deficiency exposure, tax treatment, and future financing eligibility differ sharply between a sale, a short sale, and a completed foreclosure. Compare the aftermath, not just the relief.",
      },
      {
        heading: "Who to talk to first",
        body: "In many situations the right first call is a HUD-approved housing counselor or an attorney, not an agent. If that is your situation, we will tell you so.",
      },
    ],
    checklist: [
      "Current loan status and exact amounts owed confirmed",
      "Any recorded notices located with dates",
      "Equity position estimated",
      "Reinstatement amount requested from the servicer",
      "Counselor or attorney consultation scheduled if needed",
    ],
  },
  {
    id: "LM-005",
    slug: "buyer-decision-guide",
    version: "1.0.0",
    status: "Published",
    audience: "Buyers and first-time buyers",
    title: "The Buyer Decision Guide",
    promise: "Buy well without overpaying, and know your walk-away number before you need it.",
    description:
      "A decision guide for buyers: financing posture, total cost of ownership, offer leverage that costs nothing, contingency strategy, and a written ceiling.",
    situation: "buyers",
    publicationIds: ["PL-202", "PL-213"],
    frameworkIds: ["F-010"],
    assessmentSlug: "buyer-readiness",
    primaryCta: "Build Your Buying Plan",
    crmCampaign: "lf-buyer-decision-guide",
    crmLeadSource: "Lead Magnet — Buyer Decision Guide",
    metaTitle: "The Buyer Decision Guide — Buy Without Overpaying | Legacy Forge",
    metaDescription:
      "A free buyer decision guide: financing posture, true cost of ownership, offer leverage, contingency strategy, and a written walk-away number.",
    disclaimer: STANDARD_DISCLAIMER,
    sections: [
      {
        heading: "Decide your ceiling in writing",
        body: "Emotion sets prices in competitive markets. A written walk-away number, decided before you tour, is the cheapest protection available to a buyer. It converts a bidding decision into a plan you already made calmly.",
      },
      {
        heading: "Financing posture is leverage",
        body: "Underwritten pre-approval, a responsive lender, and a realistic appraisal position are worth more to a seller than a slightly higher price from a weaker buyer. Strengthen your posture before you shop.",
        bullets: [
          "Full underwriting, not a soft pre-qualification.",
          "Verified funds for down payment and closing costs.",
          "A lender who will speak to the listing agent.",
        ],
      },
      {
        heading: "Total cost of ownership",
        body: "Payment is not cost. Add taxes, insurance, any HOA or Mello-Roos, maintenance reserve, and the utilities of a larger home. A home you can buy and a home you can own are different homes.",
      },
      {
        heading: "Contingencies and what each protects",
        body: "Inspection, appraisal, and loan contingencies each protect a distinct risk. Shortening them is a real concession with a real price — never waive one you do not understand.",
      },
      {
        heading: "Offer terms that cost you nothing",
        body: "Close date, rent-back flexibility, deposit size, and communication discipline routinely win offers against higher prices. Use the free levers before the expensive one.",
      },
    ],
    checklist: [
      "Written walk-away number",
      "Underwritten pre-approval in hand",
      "Total monthly cost of ownership modeled",
      "Contingency strategy decided in advance",
      "Reserve target after closing set",
    ],
  },
  {
    id: "LM-006",
    slug: "sell-vs-rent",
    version: "1.0.0",
    status: "Published",
    audience: "Owners deciding whether to retain or dispose of a property",
    title: "The Sell vs. Rent Decision Guide",
    promise: "Compare keeping and selling on the same page, with the same math.",
    description:
      "A side-by-side model for owners deciding whether to keep a property as a rental or sell it: real net yield, tax posture, risk tolerance, and exit optionality.",
    situation: "inherited-property",
    publicationIds: ["PL-204", "PL-206"],
    frameworkIds: ["F-010"],
    assessmentSlug: "investor-readiness",
    primaryCta: "Compare Your Options",
    crmCampaign: "lf-sell-vs-rent",
    crmLeadSource: "Lead Magnet — Sell vs Rent",
    metaTitle: "Sell vs. Rent Decision Guide — Run the Same Math | Legacy Forge",
    metaDescription:
      "A free sell-versus-rent model: true net rental yield, tax posture, risk tolerance, and exit optionality compared side by side for California owners.",
    disclaimer: STANDARD_DISCLAIMER,
    sections: [
      {
        heading: "Rent is not the yield",
        body: "Gross rent flatters every retain decision. Net yield after vacancy, management, maintenance reserve, insurance, taxes, and the occasional bad year is the number to compare against the proceeds of a sale invested elsewhere.",
        bullets: [
          "Assume vacancy, not perfect occupancy.",
          "Reserve for capital items: roof, HVAC, sewer, plumbing.",
          "Price your own time if you self-manage.",
        ],
      },
      {
        heading: "The tax posture differs sharply",
        body: "Basis, depreciation, primary-residence exclusion windows, and 1031 exchange eligibility all change the comparison. For inherited property, the step-up in basis often makes a near-term sale far more efficient than it appears.",
      },
      {
        heading: "Risk you can actually carry",
        body: "A rental is a business with tenants, liability, and regulation. The question is not whether it can produce a return — it is whether you want the job at the return it produces.",
      },
      {
        heading: "Optionality has value",
        body: "Selling converts an illiquid, concentrated, locally correlated asset into optionality. Keeping preserves an appreciating asset and a fixed-rate loan you may never replace. Name which one your situation actually needs.",
      },
      {
        heading: "Decide with a review date",
        body: "If the comparison is close, the honest answer is often 'keep and review in twelve months' with specific conditions written down that would change the decision.",
      },
    ],
    checklist: [
      "True net yield calculated with reserves",
      "Basis and tax posture confirmed with a CPA",
      "Management plan decided",
      "Exit conditions written down",
      "Sale net proceeds modeled for comparison",
    ],
  },
];

export function getGuide(slug: string): GuideDefinition | undefined {
  return GUIDES.find(g => g.slug === slug && g.status === "Published");
}

export function guidesForSituation(situation: EntryPathId): GuideDefinition[] {
  return GUIDES.filter(g => g.situation === situation && g.status === "Published");
}

/** Render the web-readable guide as a downloadable Markdown document. */
export function guideMarkdown(guide: GuideDefinition): string {
  const lines: string[] = [
    `# ${guide.title}`,
    "",
    `_${guide.promise}_`,
    "",
    `Audience: ${guide.audience}`,
    `Version ${guide.version} · Legacy Forge`,
    "",
    LEGAL_DISCLOSURE,
    "",
  ];
  for (const s of guide.sections) {
    lines.push(`## ${s.heading}`, "", s.body, "");
    if (s.bullets) {
      for (const b of s.bullets) lines.push(`- ${b}`);
      lines.push("");
    }
  }
  lines.push("## Your checklist", "");
  for (const c of guide.checklist) lines.push(`- [ ] ${c}`);
  lines.push("", "---", "", guide.disclaimer, "");
  return lines.join("\n");
}
