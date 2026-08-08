// Task 26 — Referral partner system tests.

import { describe, it, expect, beforeEach } from "vitest";
import {
  PARTNER_TYPES,
  TARGET_GEOGRAPHY,
  partnerIdentityKey,
  marketFor,
} from "@/lib/partners/schema";
import { scorePartner } from "@/lib/partners/scoring";
import {
  buildCohortCoverage,
  buildResearchCohortFixture,
  classifyTitle,
  ingestApolloBatch,
  normalizeApolloPerson,
  COHORT_TARGET,
} from "@/lib/partners/apollo";
import { clearPartners, loadPartners, markReviewed, upsertPartner } from "@/lib/partners/store";
import { renderSequence, outreachReadiness, REVIEW_THRESHOLD } from "@/lib/partners/sequences";
import { buildLinkedInDraft } from "@/lib/partners/linkedin";
import { handoffPartner, partnerContactProperties } from "@/lib/partners/handoff";
import { buildReferralDashboard } from "@/lib/partners/dashboard";
import { referralSchema } from "@/lib/partners/referral";
import { RESOURCE_KITS, kitMarkdown } from "@/lib/partners/resource-kit";
import { PROFESSIONAL_AUDIENCES, professionalPage } from "@/lib/partners/pages";

beforeEach(() => {
  clearPartners();
});

describe("partner data model", () => {
  it("covers at least 14 partner types across Orange and LA County", () => {
    expect(PARTNER_TYPES.length).toBeGreaterThanOrEqual(14);
    expect(TARGET_GEOGRAPHY.some(m => m.county === "Orange County")).toBe(true);
    expect(TARGET_GEOGRAPHY.some(m => m.county === "Los Angeles County")).toBe(true);
    expect(marketFor("Brea")?.wave).toBe(1);
  });

  it("builds a stable identity key that prefers Apollo id, then email", () => {
    expect(partnerIdentityKey({ apolloId: "A1", email: "x@y.com" })).toBe("apollo:a1");
    expect(partnerIdentityKey({ email: "X@Y.com" })).toBe("email:x@y.com");
  });
});

describe("scoring", () => {
  it("puts a reachable core-market probate attorney in Priority A", () => {
    const s = scorePartner({
      partnerTypeId: "probate_attorney",
      city: "Brea",
      emailPresent: true,
      website: "https://example.com",
      linkedinUrl: "https://linkedin.com/in/x",
      yearsInMarket: 12,
    });
    expect(s.tier).toBe("Priority A");
    expect(s.factors).toHaveLength(10);
  });

  it("keeps an unreachable record in Research regardless of fit", () => {
    const s = scorePartner({ partnerTypeId: "probate_attorney", city: "Brea", emailPresent: false });
    expect(s.tier).toBe("Research");
  });

  it("scores out-of-area contractors below core-market attorneys", () => {
    const a = scorePartner({ partnerTypeId: "probate_attorney", city: "Brea", emailPresent: true });
    const b = scorePartner({ partnerTypeId: "contractor", city: "Fresno", emailPresent: true });
    expect(a.internalPoints).toBeGreaterThan(b.internalPoints);
  });
});

describe("apollo ingestion", () => {
  it("classifies titles onto partner types", () => {
    expect(classifyTitle("Probate Attorney")).toBe("probate_attorney");
    expect(classifyTitle("Escrow Officer")).toBe("escrow_professional");
    expect(classifyTitle("Software Engineer")).toBeUndefined();
  });

  it("skips records it cannot classify", () => {
    expect(normalizeApolloPerson({ name: "A B", title: "Software Engineer" })).toBeNull();
    expect(normalizeApolloPerson({ title: "Probate Attorney" })).toBeNull();
  });

  it("deduplicates a repeated Apollo record instead of creating a second partner", () => {
    const person = {
      id: "apollo_1",
      name: "Jane Doe",
      title: "Probate Attorney",
      email: "jane@firm.example.com",
      city: "Brea",
    };
    ingestApolloBatch([person]);
    const second = ingestApolloBatch([{ ...person, title: "Trust Attorney" }]);
    expect(second.created).toBe(0);
    expect(second.merged).toBe(1);
    expect(loadPartners()).toHaveLength(1);
  });

  it("builds the 100-record research cohort with full segment coverage", () => {
    const fixture = buildResearchCohortFixture();
    expect(fixture).toHaveLength(COHORT_TARGET);
    expect(COHORT_TARGET).toBe(100);
    const result = ingestApolloBatch(fixture);
    expect(result.created).toBe(100);
    const coverage = buildCohortCoverage();
    expect(coverage.actual).toBe(100);
    expect(coverage.complete).toBe(true);
  });
});

describe("outreach", () => {
  it("holds every touch in draft until the record is reviewed", () => {
    const { partner } = upsertPartner({
      contactName: "Jane Doe",
      partnerTypeId: "probate_attorney",
      email: "jane@firm.example.com",
      city: "Brea",
    });
    const draft = renderSequence(partner);
    expect(draft.touches).toHaveLength(5);
    expect(draft.state).toBe("draft");
    expect(draft.touches.every(t => t.state === "draft")).toBe(true);

    const reviewed = markReviewed(partner.id);
    expect(renderSequence(reviewed!).state).toBe("approved");
  });

  it("suppresses outreach for do-not-contact records", () => {
    const { partner } = upsertPartner({
      contactName: "Jane Doe",
      partnerTypeId: "cpa",
      email: "j@x.example.com",
      relationshipStage: "Do Not Contact",
    });
    expect(renderSequence(partner).state).toBe("suppressed");
  });

  it("blocks sequences until the review threshold is met", () => {
    ingestApolloBatch(buildResearchCohortFixture());
    expect(outreachReadiness(loadPartners()).canRunSequences).toBe(false);
    for (const p of loadPartners().slice(0, REVIEW_THRESHOLD)) markReviewed(p.id);
    expect(outreachReadiness(loadPartners()).canRunSequences).toBe(true);
  });

  it("keeps LinkedIn connection notes inside the character limit", () => {
    const { partner } = upsertPartner({
      contactName: "Jane Doe",
      partnerTypeId: "financial_advisor",
      email: "j@x.example.com",
      city: "Fullerton",
    });
    const draft = buildLinkedInDraft(partner);
    expect(draft.withinLimit).toBe(true);
    expect(draft.connectionNote).not.toMatch(/http/);
  });
});

describe("hubspot handoff", () => {
  it("maps partner properties without inventing a lead lifecycle", () => {
    const { partner } = upsertPartner({
      contactName: "Jane Doe",
      company: "Doe Law",
      partnerTypeId: "probate_attorney",
      email: "jane@doelaw.example.com",
      city: "Brea",
    });
    const props = partnerContactProperties(partner);
    expect(props["firstname"]).toBe("Jane");
    expect(props["lf_partner_type"]).toBe("probate_attorney");
    expect(props["hs_lead_source"]).toBe("apollo-referral-research");
  });

  it("skips records with no email and records the contact id when synced", async () => {
    const { partner: noEmail } = upsertPartner({
      contactName: "No Email",
      partnerTypeId: "cpa",
      apolloId: "a2",
    });
    expect((await handoffPartner(noEmail)).action).toBe("skipped");

    const { partner } = upsertPartner({
      contactName: "Jane Doe",
      partnerTypeId: "cpa",
      email: "jane@x.example.com",
    });
    const result = await handoffPartner(partner, async () => ({
      ok: true,
      mode: "hubspot" as const,
      action: "created" as const,
      contactId: "hs_1",
    }));
    expect(result.contactId).toBe("hs_1");
    expect(loadPartners().find(p => p.id === partner.id)?.hubspotContactId).toBe("hs_1");
  });
});

describe("referral intake", () => {
  it("requires confirmed client permission", () => {
    const base = {
      partnerName: "Jane Doe",
      partnerEmail: "jane@x.example.com",
      partnerTypeId: "probate_attorney",
      clientFirstName: "Sam",
      clientEmail: "sam@x.example.com",
      clientCity: "Brea",
      situation: "probate",
      urgency: "0-90",
    };
    expect(referralSchema.safeParse({ ...base, clientPermission: false }).success).toBe(false);
    expect(referralSchema.safeParse({ ...base, clientPermission: true }).success).toBe(true);
  });

  it("rejects an unknown profession", () => {
    const r = referralSchema.safeParse({
      partnerName: "Jane",
      partnerEmail: "j@x.example.com",
      partnerTypeId: "astronaut",
      clientFirstName: "Sam",
      clientEmail: "s@x.example.com",
      clientCity: "Brea",
      situation: "probate",
      urgency: "0-90",
      clientPermission: true,
    });
    expect(r.success).toBe(false);
  });
});

describe("resource kits and pages", () => {
  it("publishes a kit and an entry page for every audience", () => {
    for (const audience of PROFESSIONAL_AUDIENCES) {
      const page = professionalPage(audience);
      expect(page?.metaTitle.length).toBeLessThan(70);
      expect(page?.metaDescription.length).toBeLessThan(170);
      const kit = RESOURCE_KITS[audience];
      expect(kit.items.length).toBeGreaterThanOrEqual(3);
      expect(kitMarkdown(kit)).toContain("no reciprocity requirement");
    }
  });
});

describe("referral dashboard", () => {
  it("reports growth, stages, and honest revenue", () => {
    ingestApolloBatch(buildResearchCohortFixture().slice(0, 10));
    const dash = buildReferralDashboard();
    expect(dash.totalPartners).toBe(10);
    expect(dash.stages.reduce((n, s) => n + s.count, 0)).toBe(10);
    expect(dash.revenue.referralsConverted).toBe(0);
    expect(dash.conversion.contactRate).toBe(0);
  });
});
