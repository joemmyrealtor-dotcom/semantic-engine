// Task 26 — Professional Resource Kit.
//
// Given away with no reciprocity requirement. The kit is generated as
// markdown so a professional can download it and hand pieces to a client.

import type { ProfessionalAudience } from "./schema";

export interface KitItem {
  id: string;
  title: string;
  kind: "checklist" | "worksheet" | "client-handout" | "guide";
  summary: string;
  bullets: string[];
}

export interface ResourceKit {
  audience: ProfessionalAudience;
  title: string;
  intro: string;
  items: KitItem[];
}

const COMMON: KitItem[] = [
  {
    id: "property-readiness",
    title: "Property Readiness Checklist",
    kind: "checklist",
    summary: "What has to be true before a property can be listed responsibly.",
    bullets: [
      "Authority confirmed: who can legally sign, and on what date",
      "Vesting and title reviewed for liens, heirship, and recorded interests",
      "Occupancy resolved: tenants, family members, and personal property",
      "Condition documented with photographs before anything is moved",
      "Valuation basis established and written down",
    ],
  },
  {
    id: "client-handout",
    title: "What a Sale Actually Requires (client handout)",
    kind: "client-handout",
    summary: "A one-page, plain-language explanation you can hand to a client.",
    bullets: [
      "The five steps, in order, with realistic timing",
      "What costs money and what does not",
      "Which decisions are reversible and which are not",
      "Who does what — and what the family still controls",
    ],
  },
];

export const RESOURCE_KITS: Record<ProfessionalAudience, ResourceKit> = {
  attorneys: {
    audience: "attorneys",
    title: "Property Resource Kit for Attorneys",
    intro:
      "Built for probate, trust, estate-planning, and family-law practices in Orange and Los Angeles County. Free, no reciprocity expected.",
    items: [
      ...COMMON,
      {
        id: "court-timeline",
        title: "Court Timeline and Property Sequencing Worksheet",
        kind: "worksheet",
        summary: "Maps authority, notice, and confirmation against listing milestones.",
        bullets: [
          "Authority type and the sale steps it permits",
          "Notice requirements and who receives them",
          "Confirmation and overbid exposure, where applicable",
          "The listing steps that must wait, and the ones that do not",
        ],
      },
      {
        id: "dissolution-property",
        title: "Dissolution Property Options Grid",
        kind: "guide",
        summary: "Buy-out, deferred sale, and immediate sale compared on the terms clients ask about.",
        bullets: [
          "Cash position at each option",
          "Refinance feasibility and its dependencies",
          "Occupancy and holding-cost consequences",
          "What each option requires from the settlement language",
        ],
      },
    ],
  },
  "cpas-fiduciaries": {
    audience: "cpas-fiduciaries",
    title: "Property Resource Kit for CPAs and Fiduciaries",
    intro:
      "For tax and fiduciary professionals who need documented, defensible property process. Free, no reciprocity expected.",
    items: [
      ...COMMON,
      {
        id: "basis-timing",
        title: "Basis and Timing Discussion Guide",
        kind: "guide",
        summary: "The property facts you need before you can advise on the tax outcome.",
        bullets: [
          "Acquisition history and improvement records",
          "Valuation date and the support behind it",
          "Occupancy history relevant to exclusions",
          "Exchange feasibility and its calendar",
        ],
      },
      {
        id: "fiduciary-file",
        title: "Fiduciary Property File Standard",
        kind: "checklist",
        summary: "What belongs in the file so a disposition decision can be defended later.",
        bullets: [
          "Written valuation basis and comparables",
          "Marketing plan and evidence of exposure",
          "Offer log with the reasoning for the accepted offer",
          "Beneficiary communications record",
        ],
      },
    ],
  },
  "financial-advisors": {
    audience: "financial-advisors",
    title: "Property Resource Kit for Financial Advisors",
    intro:
      "For advisors modeling the largest asset most clients own. Free, no reciprocity expected.",
    items: [
      ...COMMON,
      {
        id: "equity-worksheet",
        title: "Property Equity Worksheet",
        kind: "worksheet",
        summary: "Turns a single balance-sheet line into a modeled position.",
        bullets: [
          "Realistic net proceeds, not market value",
          "Annual carrying cost, including deferred maintenance",
          "Liquidity timeline under each disposition path",
          "Concentration risk as a percentage of net worth",
        ],
      },
      {
        id: "hold-sell",
        title: "Hold-versus-Sell Framework",
        kind: "guide",
        summary: "A structured comparison you can run inside a review meeting.",
        bullets: [
          "Return on equity if held, honestly calculated",
          "Alternative deployment of net proceeds",
          "Household capacity to manage the property",
          "The non-financial factors, named rather than ignored",
        ],
      },
    ],
  },
  "senior-services": {
    audience: "senior-services",
    title: "Property Resource Kit for Senior Service Professionals",
    intro:
      "For move managers, placement professionals, and estate-sale companies. Free, no reciprocity expected.",
    items: [
      ...COMMON,
      {
        id: "transition-calendar",
        title: "Transition Sequencing Calendar",
        kind: "worksheet",
        summary: "Aligns the move calendar with the property calendar so neither waits on the other.",
        bullets: [
          "Placement date as the anchor",
          "Contents clearing windows and access requirements",
          "Property preparation that can run in parallel",
          "The point after which carrying cost accrues for nothing",
        ],
      },
      {
        id: "family-conversation",
        title: "Family Conversation Guide",
        kind: "client-handout",
        summary: "Language for the hardest conversation in the process.",
        bullets: [
          "Separating the care decision from the property decision",
          "Giving each family member a defined role",
          "Handling disagreement without stalling the timeline",
          "What to decide now and what can genuinely wait",
        ],
      },
    ],
  },
  "property-managers": {
    audience: "property-managers",
    title: "Property Resource Kit for Property and Transaction Professionals",
    intro:
      "For property managers, contractors, title, and escrow professionals. Free, no reciprocity expected.",
    items: [
      ...COMMON,
      {
        id: "scope-return",
        title: "Pre-List Scope and Return Worksheet",
        kind: "worksheet",
        summary: "Which improvement dollars return, and which do not.",
        bullets: [
          "Condition items that block financing",
          "Cosmetic work with measurable return in this submarket",
          "Work that should be disclosed instead of performed",
          "Sequencing against the listing date",
        ],
      },
      {
        id: "vesting-triage",
        title: "Vesting Issue Triage Sheet",
        kind: "checklist",
        summary: "Surface the problems that stall closings, early.",
        bullets: [
          "Deceased party on title",
          "Trust vesting without successor documentation",
          "Recorded liens with no payoff contact",
          "Heirship uncertainty and the referral it needs",
        ],
      },
    ],
  },
};

export function kitMarkdown(kit: ResourceKit): string {
  const lines: string[] = [
    `# ${kit.title}`,
    "",
    kit.intro,
    "",
    "Prepared by Joe Melendez · JM Advisory Press · Brea, California",
    "",
    "This kit is provided free of charge. There is no reciprocity requirement and no",
    "obligation of any kind. It is educational material, not legal, tax, or financial advice.",
    "",
  ];
  for (const item of kit.items) {
    lines.push(`## ${item.title}`, "", `*${item.kind}* — ${item.summary}`, "");
    for (const b of item.bullets) lines.push(`- ${b}`);
    lines.push("");
  }
  return lines.join("\n");
}
