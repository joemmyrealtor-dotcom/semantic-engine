import { describe, it, expect } from "vitest";
import { buildDomainPackage, hostnameLeaks, provisionalHostRedirects, HOST_POLICY } from "../domain";
import { buildDiscoveryReadiness, ga4PiiReview, ga4ConversionMap, PRIORITY_CONVERSIONS } from "../discovery-readiness";
import { buildGbpPack, GBP_SERVICES, gbpServiceAreas } from "../gbp";
import { buildAuthorityAudit } from "../authority-audit";
import { buildProofReport, publishableProof, proofViolations, CASE_STUDY_TEMPLATES, socialProofAssets } from "../proof";
import { buildExternalAuthorityPlan, AUTHORITY_PLAYS, napRecord } from "../citations";
import { buildReleaseAudit } from "../release-audit";
import { CHANNELS, CHANNEL_LIMITS, assetsFor, localAssetsFor } from "../distribution";
import { ANSWERS } from "../answers";
import { LOCAL_PAGES } from "../local-pages";
import { isProvisionalOrigin } from "../site";

describe("production domain package", () => {
  it("enforces apex-canonical, https, and lowercase host policy", () => {
    expect(HOST_POLICY.canonicalHostForm).toBe("apex");
    expect(HOST_POLICY.wwwRule).toMatch(/301/);
    expect(HOST_POLICY.httpsRule).toMatch(/301|HSTS/);
  });

  it("plans redirects away from the provisional host", () => {
    const redirects = provisionalHostRedirects("https://legacyforge.com");
    expect(redirects.length).toBe(3);
    for (const r of redirects) {
      expect(r.status).toBe(301);
      expect(r.applied).toBe(false);
      expect(r.to.startsWith("https://legacyforge.com")).toBe(true);
    }
    expect(provisionalHostRedirects()).toEqual([]);
  });

  it("detects every provisional hostname still emitted", () => {
    const leaks = hostnameLeaks();
    const pkg = buildDomainPackage();
    if (isProvisionalOrigin(pkg.origin)) {
      expect(leaks.length).toBeGreaterThan(0);
      expect(pkg.status).not.toBe("PASS");
    } else {
      expect(leaks).toEqual([]);
    }
  });
});

describe("discovery readiness", () => {
  it("maps every priority conversion to an instrumented event", () => {
    const rows = ga4ConversionMap();
    expect(rows.length).toBe(PRIORITY_CONVERSIONS.length);
    expect(rows.filter(r => r.status === "MISSING")).toEqual([]);
  });

  it("passes the PII review with no identifying parameters", () => {
    const review = ga4PiiReview();
    expect(review.violations).toEqual([]);
    expect(review.reviewed).toBe(true);
  });

  it("covers GSC, Bing/IndexNow, GA4, and GBP and submits nothing", () => {
    const readiness = buildDiscoveryReadiness();
    expect(readiness.sections.map(s => s.id).sort()).toEqual(["bing", "ga4", "gbp", "gsc"]);
    expect(readiness.submitted).toBe(false);
    for (const section of readiness.sections) expect(section.checklist.length).toBeGreaterThan(0);
  });
});

describe("google business profile pack", () => {
  it("declares services, real service areas, and a post rotation", () => {
    const pack = buildGbpPack();
    expect(GBP_SERVICES.length).toBeGreaterThanOrEqual(8);
    expect(gbpServiceAreas().length).toBeGreaterThan(0);
    expect(pack.posts.length).toBeGreaterThanOrEqual(12);
    for (const post of pack.posts) expect(post.url.startsWith("http")).toBe(true);
  });
});

describe("sitewide authority audit", () => {
  const report = buildAuthorityAudit();

  it("states every indexable URL exactly once", () => {
    const paths = report.urls.map(u => u.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.length).toBeGreaterThan(100);
  });

  it("uses only the six advisory states and justifies each", () => {
    const allowed = ["KEEP", "IMPROVE", "CONSOLIDATE", "NOINDEX", "REDIRECT", "REVIEW"];
    for (const url of report.urls) {
      expect(allowed).toContain(url.state);
      expect(url.rationale.length).toBeGreaterThan(10);
    }
  });

  it("never executes a change", () => {
    expect(report.executed).toBe(false);
  });
});

describe("review and proof engine", () => {
  it("fabricates nothing: the ledger ships empty and renders nothing", () => {
    expect(publishableProof()).toEqual([]);
    expect(proofViolations()).toEqual([]);
    expect(buildProofReport().status).toBe("EMPTY");
    expect(socialProofAssets().every(a => !a.renderable)).toBe(true);
  });

  it("rejects unverified or unconsented entries", () => {
    const bad = [
      { id: "r1", category: "seller" as const, source: "google" as const, quote: "Great", attribution: "A", authoredAt: "2026-01-01", consentOnFile: false, verified: false },
    ];
    const violations = proofViolations(bad);
    expect(violations.length).toBeGreaterThanOrEqual(3);
  });

  it("ships case-study templates with release requirements, not content", () => {
    expect(CASE_STUDY_TEMPLATES.length).toBeGreaterThanOrEqual(6);
    for (const t of CASE_STUDY_TEMPLATES) {
      expect(t.status).toBe("TEMPLATE");
      expect(t.requirements.join(" ")).toMatch(/release/i);
    }
  });
});

describe("external authority plan", () => {
  it("earns links instead of buying them", () => {
    const plan = buildExternalAuthorityPlan();
    expect(plan.outreachSent).toBe(false);
    expect(AUTHORITY_PLAYS.length).toBeGreaterThanOrEqual(10);
    for (const play of AUTHORITY_PLAYS) {
      expect(play.disallowed.join(" ")).toMatch(/No paid links/);
      expect(play.contribution.length).toBeGreaterThan(20);
    }
  });

  it("does not invent a NAP", () => {
    const nap = napRecord();
    expect(nap.address).toBeNull();
    expect(nap.phone).toBeNull();
  });
});

describe("multi-platform distribution", () => {
  it("covers eight channels including Instagram and referral partners", () => {
    expect(CHANNELS).toContain("instagram");
    expect(CHANNELS).toContain("partner");
    expect(CHANNELS.length).toBe(8);
  });

  it("emits one in-limit draft per channel for answers and local pages", () => {
    for (const answer of ANSWERS.slice(0, 3)) {
      const assets = assetsFor(answer);
      expect(assets.map(a => a.channel)).toEqual(CHANNELS);
      for (const asset of assets) expect(asset.body.length).toBeLessThanOrEqual(CHANNEL_LIMITS[asset.channel]);
    }
    for (const spec of LOCAL_PAGES.slice(0, 3)) {
      const assets = localAssetsFor(spec);
      expect(assets.map(a => a.channel)).toEqual(CHANNELS);
      for (const asset of assets) expect(asset.body.length).toBeLessThanOrEqual(CHANNEL_LIMITS[asset.channel]);
    }
  });
});

describe("Task 17 ten-point gate", () => {
  const audit = buildReleaseAudit();

  it("runs exactly ten checks, T17-1 through T17-10", () => {
    expect(audit.checks.map(c => c.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `T17-${i + 1}`),
    );
  });

  it("blocks release while the canonical origin is provisional", () => {
    expect(audit.checks.find(c => c.id === "T17-1")?.status).toBe("BLOCKED");
    expect(audit.status).toBe("BLOCKED");
  });

  it("keeps analytics PII-safe as a launch-critical check", () => {
    const pii = audit.checks.find(c => c.id === "T17-6")!;
    expect(pii.status).toBe("PASS");
    expect(pii.launchCritical).toBe(true);
  });
});
