// Seller conversion content: the ten seller questions ("curiosity hooks")
// and the per-city pre-listing checklist. Educational content only.
// Copy below is owner-approved wording — change only with owner review.

export interface SellerHook {
  id: string;
  question: string;
  answer: string;
}

export const SELLER_HOOKS: SellerHook[] = [
  { id: "H01", question: "Which repairs are most likely to improve your sale result?", answer: "Fresh paint, lighting, landscaping, cleaning, and minor repairs often improve buyer response. Before spending more, compare the expected price gain with the cost, time, and disruption." },
  { id: "H02", question: "What will you net after every selling cost?", answer: "Start with the expected sale price. Subtract the mortgage payoff, negotiated broker compensation, escrow and title charges, transfer tax, prorated taxes, repairs, credits, liens, and HOA charges. Your net proceeds matter more than the list price." },
  { id: "H03", question: "Why do offers vary so much within the same ZIP code?", answer: "Condition, lot, street, floor plan, upgrades, buyer financing, and timing all affect price and terms. A ZIP-wide average often hides property-level differences." },
  { id: "H04", question: "Should you sell first, buy first, or request a rent-back?", answer: "Each option changes your timing, cash needs, housing certainty, and negotiating position. A written plan based on financing, equity, and backup housing helps identify the safest sequence." },
  { id: "H05", question: "How do you clear out an inherited home?", answer: "First confirm legal authority. Secure the property, photograph rooms and contents, and protect items intended for heirs. Then compare estate sale, donation, storage, and haul-away options before removing property." },
  { id: "H06", question: "What if several heirs must approve the sale?", answer: "First identify the trustee, executor, administrator, or other person with signing authority. Set a written decision process and share the same pricing, cost, and offer information with every authorized decision-maker." },
  { id: "H07", question: "Why do some listings sell quickly while others sit?", answer: "First-week pricing, presentation, showing access, photography, and buyer feedback often determine momentum. Homes priced above comparable sales risk losing their strongest early attention." },
  { id: "H08", question: "Should you sell as-is or renovate first?", answer: "Compare the expected price increase with improvement cost, carrying time, permit needs, and execution risk. Many homes benefit more from repairs, cleaning, paint, and staging than from a large remodel." },
  { id: "H09", question: "What makes an offer strong besides price?", answer: "A strong offer combines verified financing, down payment, manageable contingencies, a reliable closing date, and useful possession terms. A lower price sometimes produces a safer closing or better net result." },
  { id: "H10", question: "How accurate is an online home estimate?", answer: "Online estimates use public records and broad market data. They often miss condition, layout, upgrades, lot position, and current buyer demand. Use the estimate as a starting point, then compare your home with recent local sales." },
];

/** Practical pre-listing checklist (owner-approved wording; same for every city). */
export function cityListingChecklist(_city: string): string[] {
  return [
    "Review closed sales from the past six months in the same neighborhood and property category. Expand the search only when comparable inventory is limited.",
    "Estimate net proceeds after mortgage payoff, negotiated broker compensation, escrow, title, transfer tax, prorated taxes, repairs, credits, liens, and HOA charges.",
    "Prioritize safety, function, cleanliness, curb appeal, and visible repairs before considering major renovations.",
    "Gather permits, warranties, HOA documents, solar agreements, inspection reports, and required seller disclosures.",
    "Decide whether to sell first, buy first, or request a rent-back before setting the listing date.",
  ];
}
