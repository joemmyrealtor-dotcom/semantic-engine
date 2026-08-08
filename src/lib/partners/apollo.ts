// Task 26 — Apollo research cohort.
//
// Apollo is used for research and qualification only. Nothing here contacts a
// professional; it normalizes people records, deduplicates them against the
// existing store, and reports cohort coverage against the 100-record plan.

import {
  PARTNER_TYPES,
  TARGET_GEOGRAPHY,
  marketFor,
  partnerIdentityKey,
  type Partner,
  type PartnerInput,
} from "./schema";
import { scorePartner } from "./scoring";
import { loadPartners, upsertPartner } from "./store";

/* ------------------------------------------------------- Apollo raw shape */

export interface ApolloPerson {
  id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  linkedin_url?: string;
  city?: string;
  state?: string;
  organization?: { name?: string; website_url?: string; primary_phone?: { number?: string } };
  employment_history?: { title?: string }[];
}

const TITLE_MAP: { match: RegExp; typeId: string }[] = [
  { match: /probate/i, typeId: "probate_attorney" },
  { match: /estate plan/i, typeId: "estate_planning_attorney" },
  { match: /trust(s)? (attorney|counsel|lawyer)/i, typeId: "trust_attorney" },
  { match: /family law|divorce/i, typeId: "divorce_attorney" },
  { match: /\bcpa\b|certified public accountant|tax (partner|manager|advisor)/i, typeId: "cpa" },
  { match: /fiduciary|conservator|trustee/i, typeId: "fiduciary" },
  { match: /financial (advisor|planner)|wealth (advisor|manager)|cfp/i, typeId: "financial_advisor" },
  { match: /senior move|move manager/i, typeId: "senior_move_manager" },
  { match: /placement|assisted living|senior living/i, typeId: "placement_professional" },
  { match: /property manager|property management/i, typeId: "property_manager" },
  { match: /contractor|general contractor|remodel/i, typeId: "contractor" },
  { match: /estate sale|liquidat/i, typeId: "estate_sale_company" },
  { match: /title (officer|rep|representative)|title company/i, typeId: "title_professional" },
  { match: /escrow/i, typeId: "escrow_professional" },
  { match: /attorney|lawyer|counsel|esq/i, typeId: "estate_planning_attorney" },
];

export function classifyTitle(title: string): string | undefined {
  for (const row of TITLE_MAP) if (row.match.test(title)) return row.typeId;
  return undefined;
}

export function normalizeApolloPerson(raw: ApolloPerson): PartnerInput | null {
  const name =
    raw.name?.trim() || [raw.first_name, raw.last_name].filter(Boolean).join(" ").trim();
  if (!name) return null;
  const title = raw.title ?? raw.employment_history?.[0]?.title ?? "";
  const partnerTypeId = classifyTitle(`${title} ${raw.organization?.name ?? ""}`);
  if (!partnerTypeId) return null;
  const city = raw.city?.trim() ?? "";
  const market = marketFor(city);
  return {
    contactName: name,
    company: raw.organization?.name ?? "",
    role: title,
    partnerTypeId,
    city,
    county: market?.county ?? (raw.state ? `${raw.state}` : ""),
    email: raw.email ?? "",
    phone: raw.organization?.primary_phone?.number ?? "",
    website: raw.organization?.website_url ?? "",
    linkedinUrl: raw.linkedin_url ?? "",
    apolloId: raw.id ?? "",
    serviceArea: city ? [city] : [],
    leadSource: "apollo",
    outreachStatus: "review_pending",
    relationshipStage: "Identified",
  };
}

export interface IngestResult {
  received: number;
  created: number;
  merged: number;
  skipped: number;
  partners: Partner[];
}

/** Ingest a research batch. Duplicates merge into the existing record. */
export function ingestApolloBatch(rows: ApolloPerson[]): IngestResult {
  const result: IngestResult = { received: rows.length, created: 0, merged: 0, skipped: 0, partners: [] };
  const seen = new Set<string>();
  for (const raw of rows) {
    const input = normalizeApolloPerson(raw);
    if (!input) {
      result.skipped += 1;
      continue;
    }
    const key = partnerIdentityKey(input);
    if (seen.has(key)) {
      result.skipped += 1;
      continue;
    }
    seen.add(key);
    const { partner, created } = upsertPartner(input);
    result.partners.push(partner);
    if (created) result.created += 1;
    else result.merged += 1;
  }
  return result;
}

/* ------------------------------------------------------------ the cohort */

export interface CohortSegment {
  id: string;
  label: string;
  partnerTypeIds: string[];
  target: number;
  /** Apollo search parameters an operator (or the server fn) can run as-is. */
  titles: string[];
  cities: string[];
}

const CORE = TARGET_GEOGRAPHY.filter(m => m.wave <= 2).map(m => m.city);

export const COHORT_SEGMENTS: CohortSegment[] = [
  {
    id: "probate-trust-attorneys",
    label: "Probate and trust attorneys",
    partnerTypeIds: ["probate_attorney", "trust_attorney", "estate_planning_attorney"],
    target: 30,
    titles: ["Probate Attorney", "Trust and Estate Attorney", "Estate Planning Attorney"],
    cities: CORE,
  },
  {
    id: "family-law",
    label: "Family law attorneys",
    partnerTypeIds: ["divorce_attorney"],
    target: 10,
    titles: ["Family Law Attorney", "Divorce Attorney"],
    cities: CORE,
  },
  {
    id: "cpas-fiduciaries",
    label: "CPAs and professional fiduciaries",
    partnerTypeIds: ["cpa", "fiduciary"],
    target: 20,
    titles: ["CPA", "Tax Partner", "Professional Fiduciary", "Licensed Fiduciary"],
    cities: CORE,
  },
  {
    id: "advisors",
    label: "Financial advisors",
    partnerTypeIds: ["financial_advisor"],
    target: 15,
    titles: ["Financial Advisor", "Wealth Manager", "Certified Financial Planner"],
    cities: CORE,
  },
  {
    id: "senior-services",
    label: "Senior services",
    partnerTypeIds: ["senior_move_manager", "placement_professional", "estate_sale_company"],
    target: 15,
    titles: ["Senior Move Manager", "Placement Specialist", "Estate Sale Owner"],
    cities: CORE,
  },
  {
    id: "property-transaction",
    label: "Property and transaction professionals",
    partnerTypeIds: ["property_manager", "contractor", "title_professional", "escrow_professional"],
    target: 10,
    titles: ["Property Manager", "Title Representative", "Escrow Officer", "General Contractor"],
    cities: CORE,
  },
];

export const COHORT_TARGET = COHORT_SEGMENTS.reduce((n, s) => n + s.target, 0);

export interface CohortCoverageRow extends CohortSegment {
  actual: number;
  priorityA: number;
  reachable: number;
  complete: boolean;
}

export function buildCohortCoverage(partners = loadPartners()): {
  rows: CohortCoverageRow[];
  target: number;
  actual: number;
  complete: boolean;
} {
  const rows = COHORT_SEGMENTS.map(seg => {
    const inSeg = partners.filter(p => seg.partnerTypeIds.includes(p.partnerTypeId));
    return {
      ...seg,
      actual: inSeg.length,
      priorityA: inSeg.filter(p => p.referralFitTier === "Priority A").length,
      reachable: inSeg.filter(p => p.email || p.linkedinUrl).length,
      complete: inSeg.length >= seg.target,
    };
  });
  const actual = rows.reduce((n, r) => n + r.actual, 0);
  return { rows, target: COHORT_TARGET, actual, complete: rows.every(r => r.complete) };
}

/** Deterministic research cohort used for verification and demos. */
export function buildResearchCohortFixture(size = COHORT_TARGET): ApolloPerson[] {
  const out: ApolloPerson[] = [];
  const cities = TARGET_GEOGRAPHY.map(m => m.city);
  let i = 0;
  for (const seg of COHORT_SEGMENTS) {
    for (let n = 0; n < seg.target && out.length < size; n += 1) {
      const typeId = seg.partnerTypeIds[n % seg.partnerTypeIds.length] as string;
      const def = PARTNER_TYPES.find(t => t.id === typeId);
      const city = cities[i % cities.length] as string;
      i += 1;
      out.push({
        id: `apollo_fixture_${seg.id}_${n}`,
        name: `${def?.label ?? "Professional"} ${n + 1}`,
        title: def?.label ?? "Professional",
        email: `contact${n + 1}@${seg.id}.example.com`,
        linkedin_url: `https://www.linkedin.com/in/${seg.id}-${n + 1}`,
        city,
        state: "CA",
        organization: {
          name: `${city} ${def?.label ?? "Practice"} Group`,
          website_url: `https://${seg.id}-${n + 1}.example.com`,
        },
      });
    }
  }
  return out;
}

/** Tier distribution across the current cohort. */
export function tierBreakdown(partners = loadPartners()) {
  const counts = { "Priority A": 0, "Priority B": 0, "Priority C": 0, Research: 0 };
  for (const p of partners) counts[p.referralFitTier] += 1;
  return counts;
}

export function previewScore(input: PartnerInput) {
  return scorePartner({
    partnerTypeId: input.partnerTypeId,
    city: input.city ?? "",
    serviceArea: input.serviceArea ?? [],
    website: input.website ?? "",
    linkedinUrl: input.linkedinUrl ?? "",
    emailPresent: Boolean(input.email),
  });
}
