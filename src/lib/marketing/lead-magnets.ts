// Task 22 — Lead magnet catalog.
//
// Content only. Each magnet maps to an entry path and to the CRM
// fields defined in src/lib/marketing/attribution.ts.

import type { EntryPathId } from "./positioning";

export interface LeadMagnet {
  id: string;
  entryPath: EntryPathId;
  title: string;
  promise: string;
  format: string;
  contents: string[];
  cta: string;
}

export const LEAD_MAGNETS: LeadMagnet[] = [
  {
    id: "seller-net-sheet",
    entryPath: "sellers",
    title: "The Seller Net Sheet Worksheet",
    promise: "See what you actually walk away with before you ever list.",
    format: "Worksheet + line-by-line explanation",
    contents: [
      "Every deduction between list price and wire: payoff, commissions, concessions, prorations, and title.",
      "Two-scenario comparison: as-is sale versus prepared sale.",
      "The three line items sellers most often forget.",
    ],
    cta: "Get the net sheet",
  },
  {
    id: "buyer-walkaway",
    entryPath: "buyers",
    title: "The Buyer's Walk-Away Number",
    promise: "Decide your ceiling in writing before emotion sets the price.",
    format: "Decision worksheet",
    contents: [
      "Payment, reserves, and total cost-of-ownership math in one page.",
      "Offer-strength levers that cost you nothing.",
      "Contingency windows and what each one actually protects.",
    ],
    cta: "Get the worksheet",
  },
  {
    id: "probate-first-90",
    entryPath: "probate",
    title: "Probate: The First 90 Days",
    promise: "Know what you are allowed to do, and in what order.",
    format: "Sequenced checklist",
    contents: [
      "Authority: full versus limited, and what each permits.",
      "Notice, appraisal, and confirmation requirements in sequence.",
      "The property decisions that must wait, and the ones that cannot.",
    ],
    cta: "Get the checklist",
  },
  {
    id: "inherited-keep-or-sell",
    entryPath: "inherited-property",
    title: "Keep, Rent, or Sell: The Inherited Property Model",
    promise: "Put the family math on one page before the family meeting.",
    format: "Comparison model",
    contents: [
      "Stepped-up basis and what it means for your tax exposure.",
      "True carrying cost per month, including the costs nobody budgets.",
      "A structure for deciding when heirs disagree.",
    ],
    cta: "Get the model",
  },
  {
    id: "downsizing-sequence",
    entryPath: "downsizing",
    title: "The Downsizing Sequence Plan",
    promise: "Move smaller without a gap you cannot cover.",
    format: "Sequencing planner",
    contents: [
      "Sell-first versus buy-first, with the exposure of each.",
      "Bridge options and what they really cost.",
      "Property tax base transfer considerations for eligible sellers.",
    ],
    cta: "Get the plan",
  },
  {
    id: "distress-options",
    entryPath: "distressed-property",
    title: "Your Options While You Still Have All of Them",
    promise: "Foreclosure, short sale, or workout — mapped against your timeline.",
    format: "Timeline + options map",
    contents: [
      "The California default and sale timeline, stage by stage.",
      "What each option does to your credit, your equity, and your record.",
      "The deadlines that quietly remove options.",
    ],
    cta: "See the options map",
  },
  {
    id: "investor-underwriting",
    entryPath: "investing",
    title: "The One-Page Underwriting Sheet",
    promise: "Underwrite before you fall in love with a property.",
    format: "Underwriting template",
    contents: [
      "Income, expense, and reserve assumptions that survive contact with reality.",
      "Return measures side by side: cash-on-cash, cap rate, and total return.",
      "1031 exchange timing checkpoints.",
    ],
    cta: "Get the template",
  },
];

export function magnetsFor(entryPath: EntryPathId): LeadMagnet[] {
  return LEAD_MAGNETS.filter(m => m.entryPath === entryPath);
}
