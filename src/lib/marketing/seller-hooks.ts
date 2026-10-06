// Seller conversion content: the ten seller questions ("curiosity hooks")
// and the per-city pre-listing checklist. Educational content only.

export interface SellerHook {
  id: string;
  question: string;
  answer: string;
}

export const SELLER_HOOKS: SellerHook[] = [
  { id: "H01", question: "Which repairs do buyers actually pay you back for?", answer: "Usually the inexpensive, visible items — paint, lighting, landscaping, small fixes. Large remodels rarely return their full cost before a sale." },
  { id: "H02", question: "What will you really net after every cost?", answer: "Subtract the loan payoff, commissions, escrow and title fees, transfer tax, prorated property tax, repairs and any credits. The list price is not your number." },
  { id: "H03", question: "Why do offers in the same ZIP code differ so much?", answer: "Condition, lot, street, school boundary, financing terms and timing all move price. A ZIP-wide average hides those differences." },
  { id: "H04", question: "Sell first, buy first, or rent back?", answer: "Each trades certainty for convenience. A written timeline with your loan and cash position shows which risk you can carry." },
  { id: "H05", question: "How do you clear out an inherited home?", answer: "Secure the property, document contents, set aside personal items for heirs, then use estate sale, donation and haul-away in that order." },
  { id: "H06", question: "What if several heirs must approve the sale?", answer: "Confirm who holds legal authority first, agree on a decision process in writing, and share the same numbers with every heir." },
  { id: "H07", question: "Why do some listings sell fast while others sit?", answer: "Price relative to recent comparable sales, presentation in the first week, and how easy the home is to show matter most." },
  { id: "H08", question: "Should you sell as-is or renovate first?", answer: "Compare the expected price gain against cost, carrying time and risk. Many homes do best with targeted, low-cost preparation." },
  { id: "H09", question: "What makes an offer strong besides price?", answer: "Loan type and approval strength, down payment, contingency periods, close date and rent-back terms can be worth more than a higher number." },
  { id: "H10", question: "How far off can an online home estimate be?", answer: "Automated estimates cannot see condition, upgrades or layout. Treat them as a starting point and check them against local comparable sales." },
];

/** Practical pre-listing checklist for one city. */
export function cityListingChecklist(city: string): string[] {
  return [
    `Pull the last 6 months of closed sales within your part of ${city}, not the city-wide average.`,
    "Estimate net proceeds after payoff, commissions, escrow, title, transfer tax and repairs.",
    "Fix only the low-cost visible items buyers notice in photos and showings.",
    "Gather permits, HOA documents and any past inspection reports before listing.",
    `Decide your move timeline — sell first, buy first, or rent back — before choosing a ${city} list date.`,
  ];
}
