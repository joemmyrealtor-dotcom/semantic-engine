import { describe, expect, it } from "vitest";
import { indexableRecords, intentMap, missingIntentRecords, orphanIntentRecords, getIntentRecord } from "../intent-map";
import { buildCannibalizationReport, similarity } from "../cannibalization";
import { authorityIssues, buildAuthorityGraph, linkEquityDistribution, linkPlanFor, tierFor } from "../authority";
import { evidenceIntegrity, evidenceLedger } from "../search-evidence";
import { searchConsoleStatus, summarizeByPage } from "../search-console";
import { buildGa4Payload, GA4_KEY_CONVERSIONS } from "../ga4-contract";
import { classifyReferrer, discoveryCoverage } from "../ai-discovery";
import { buildLaunchPackage, robotsTxt } from "../indexing-launch";
import { buildRichResultReport, validatePath } from "../rich-results";
import { buildQualityGate } from "../quality-gate";
import { reviewPage } from "../lifecycle";
import { auditSocialPreviews } from "../social-preview";
import { indexablePaths } from "../indexation";

describe("search intent map", () => {
  it("covers every indexable sitemap URL", () => {
    expect(missingIntentRecords()).toEqual([]);
    expect(orphanIntentRecords()).toEqual([]);
    expect(indexableRecords().length).toBe(indexablePaths().length);
  });

  it("records the full canonical fact set per page", () => {
    for (const r of indexableRecords()) {
      expect(r.url.startsWith("http")).toBe(true);
      expect(r.title.length).toBeGreaterThan(3);
      expect(r.primaryKeyword.length).toBeGreaterThan(2);
      expect(r.cta.length).toBeGreaterThan(0);
      expect(r.schemaTypes.length).toBeGreaterThan(0);
      expect(r.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("keeps the governed console out of the indexable set", () => {
    expect(getIntentRecord("/")?.indexable).toBe(false);
    expect(intentMap().some(r => r.path === "/refer" && r.indexable)).toBe(false);
  });
});

describe("cannibalization audit", () => {
  const report = buildCannibalizationReport();

  it("compares every indexable URL and applies no automatic action", () => {
    expect(report.comparedUrls).toBe(indexableRecords().length);
    expect(report.actionsApplied).toBe(false);
    expect(report.findings.length).toBe(report.comparedUrls);
  });

  it("emits only the five allowed verdicts", () => {
    const allowed = ["KEEP", "DIFFERENTIATE", "CONSOLIDATE", "NOINDEX", "REDIRECT"];
    for (const f of report.findings) expect(allowed).toContain(f.verdict);
  });

  it("scores similarity symmetrically and within bounds", () => {
    expect(similarity("probate sale brea", "probate sale brea")).toBe(1);
    expect(similarity("probate sale brea", "kitchen renovation")).toBe(0);
  });

  it("finds no duplicate canonical URLs", () => {
    expect(report.findings.filter(f => f.verdict === "REDIRECT" && f.reason.includes("same canonical"))).toEqual([]);
  });
});

describe("authority hierarchy", () => {
  it("gives every page a valid parent with no cycles", () => {
    expect(authorityIssues()).toEqual([]);
  });

  it("concentrates link equity rather than spreading it evenly", () => {
    const dist = linkEquityDistribution();
    const t1 = dist.find(d => d.tier === "T1")!;
    const t4 = dist.find(d => d.tier === "T4")!;
    expect(t1.share).toBeGreaterThan(0);
    // Per-page emphasis must be strictly higher for commercial hubs.
    expect(t1.share / Math.max(1, t1.pages)).toBeGreaterThan(t4.share / Math.max(1, t4.pages));
  });

  it("gives hubs featured children and children an upward link", () => {
    const graph = buildAuthorityGraph();
    const hub = graph.find(n => n.path === "/local")!;
    expect(hub.featuredChildren.length).toBeGreaterThan(0);
    for (const node of graph) {
      if (node.path !== "/home") expect(node.upwardLink).toBeTruthy();
    }
  });

  it("tiers commercial surfaces above long-tail answers", () => {
    expect(tierFor(getIntentRecord("/sellers")!)).toBe("T1");
    const answer = indexableRecords().find(r => r.pageType === "answer")!;
    expect(tierFor(answer)).toBe("T4");
    expect(linkPlanFor("/sellers")?.conversion).toContain("/contact");
  });
});

describe("semrush evidence retention", () => {
  it("preserves every observation with a disposition and reason", () => {
    const ledger = evidenceLedger();
    expect(ledger.length).toBeGreaterThan(20);
    for (const row of ledger) {
      expect(row.researchDate).toBe("2026-08-09");
      expect(row.database).toBe("us");
      expect(row.reason.length).toBeGreaterThan(10);
      expect(["SELECTED", "REJECTED"]).toContain(row.disposition);
    }
  });

  it("marks unmeasured demand as unknown rather than zero", () => {
    const integrity = evidenceIntegrity();
    expect(integrity.fabricatedValues).toBe(0);
    expect(integrity.unmeasured).toBeGreaterThan(0);
    expect(evidenceLedger().filter(r => r.demandInferred).every(r => r.searchVolume === null)).toBe(true);
  });
});

describe("search console readiness", () => {
  it("reports unavailable rather than zero before connection", () => {
    const status = searchConsoleStatus(null);
    expect(status.state).toBe("not-connected");
    expect(status.metricsAvailable).toBe(false);
    expect(summarizeByPage(null)).toEqual([]);
  });

  it("summarizes only supplied rows", () => {
    const rows = summarizeByPage([
      { page: "/local/probate/brea", query: "probate sale brea", impressions: 100, clicks: 5, ctr: 0.05, position: 8 },
      { page: "/local/probate/brea", query: "probate realtor brea", impressions: 50, clicks: 1, ctr: 0.02, position: 12 },
    ]);
    expect(rows[0]!.impressions).toBe(150);
    expect(rows[0]!.clicks).toBe(6);
    expect(rows[0]!.topQueries[0]).toBe("probate sale brea");
  });
});

describe("GA4 contract", () => {
  it("declares the nine key conversions", () => {
    for (const name of [
      "guide_download",
      "assessment_started",
      "assessment_completed",
      "contact_submitted",
      "consultation_request",
      "referral_submitted",
      "professional_resource_request",
      "phone_click",
      "email_click",
    ]) {
      expect(GA4_KEY_CONVERSIONS).toContain(name);
    }
  });

  it("rejects PII parameters and values", () => {
    const byKey = buildGa4Payload("contact_submitted", { email: "a@b.com", page_path: "/contact" });
    expect(byKey.valid).toBe(false);
    expect(byKey.payload["email"]).toBeUndefined();

    const byValue = buildGa4Payload("consultation_clicked", { page_path: "call me at 714-555-1234" });
    expect(byValue.valid).toBe(false);
  });

  it("drops unmapped keys but keeps allowed ones", () => {
    const result = buildGa4Payload("assessment_completed", {
      assessment_id: "seller-readiness",
      readiness_level: "Ready",
      nonsense: "x",
    });
    expect(result.valid).toBe(true);
    expect(result.event).toBe("assessment_completed");
    expect(result.dropped).toContain("nonsense");
  });
});

describe("AI discovery measurement", () => {
  it("classifies assistants, engines, and unattributed traffic", () => {
    expect(classifyReferrer("https://chatgpt.com/c/123").source).toBe("chatgpt");
    expect(classifyReferrer("https://www.perplexity.ai/search").source).toBe("perplexity");
    expect(classifyReferrer("https://www.bing.com/search?q=x").source).toBe("bing");
    expect(classifyReferrer("https://www.google.com/").source).toBe("google-organic");
    expect(classifyReferrer("").source).toBe("direct-or-unattributed");
  });

  it("does not claim AI citations are fully measurable", () => {
    const coverage = discoveryCoverage();
    expect(coverage.unmeasurable).toBeGreaterThan(0);
    expect(coverage.caveat).toMatch(/not directly measurable/i);
  });
});

describe("indexing launch package", () => {
  const pkg = buildLaunchPackage();

  it("is prepared but never submitted", () => {
    expect(pkg.submitted).toBe(false);
    expect(pkg.indexNow.enabled).toBe(false);
    expect(pkg.verificationPlans.every(p => p.submitted === false)).toBe(true);
  });

  it("blocks while the canonical origin is provisional", () => {
    expect(pkg.originStatus.status).toBe("BLOCKED");
    expect(pkg.readiness).toBe("BLOCKED");
  });

  it("allows AI crawlers and disallows operator surfaces", () => {
    const txt = robotsTxt("https://example.com");
    expect(txt).toContain("User-agent: OAI-SearchBot");
    expect(txt).toContain("Disallow: /admin/");
    expect(txt).toContain("Sitemap: https://example.com/sitemap.xml");
  });

  it("declares URL policies for host, slash, and 404 behaviour", () => {
    const ids = pkg.urlPolicies.map(p => p.id);
    expect(ids).toEqual(expect.arrayContaining(["https", "host", "trailing-slash", "404"]));
  });
});

describe("rich results", () => {
  it("emits valid structured data for every indexable page", () => {
    const report = buildRichResultReport();
    expect(report.issues.filter(i => i.severity === "error")).toEqual([]);
    expect(report.status).toBe("PASS");
  });

  it("validates the required entity types", () => {
    expect(validatePath("/local/probate")).toEqual([]);
    expect(validatePath("/nope")[0]!.severity).toBe("error");
  });
});

describe("content quality gate", () => {
  const report = buildQualityGate();

  it("evaluates every indexable page against twelve checks", () => {
    expect(report.pages.length).toBe(indexableRecords().length);
    for (const page of report.pages) expect(page.checks.length).toBe(12);
  });

  it("blocks nothing on unsupported market claims", () => {
    const claims = report.pages.flatMap(p => p.checks.filter(c => c.id === "Q4" && c.status === "FAIL").map(() => p.path));
    expect(claims).toEqual([]);
  });
});

describe("social discovery", () => {
  it("gives every page a unique share card with a self-referencing URL", () => {
    const audit = auditSocialPreviews();
    expect(audit.duplicateTitles).toEqual([]);
    expect(audit.missingCanonical).toEqual([]);
    expect(audit.unsafeCopy).toEqual([]);
    expect(audit.previews[0]!.imageWidth).toBe("1200");
    expect(audit.previews[0]!.imageHeight).toBe("630");
    expect(audit.previews[0]!.twitterCard).toBe("summary_large_image");
  });
});

describe("30/60/90 review framework", () => {
  it("returns insufficient data before Search Console is connected", () => {
    const result = reviewPage({ path: "/local/probate/brea", window: 30, performance: null, engagement: null, indexed: null });
    expect(result.decision).toBe("INSUFFICIENT_DATA");
  });

  it("routes low-impression pages to differentiation at 30 days", () => {
    const result = reviewPage({
      path: "/local/probate/brea",
      window: 30,
      performance: { page: "/local/probate/brea", impressions: 10, clicks: 0, ctr: 0, position: 40, topQueries: [] },
      engagement: null,
      indexed: true,
    });
    expect(result.decision).toBe("IMPROVE_DIFFERENTIATION");
  });

  it("routes traffic without engagement to a conversion change at 60 days", () => {
    const result = reviewPage({
      path: "/sellers",
      window: 60,
      performance: { page: "/sellers", impressions: 1000, clicks: 40, ctr: 0.04, position: 6, topQueries: [] },
      engagement: { guideDownloads: 0, assessmentStarts: 0, assessmentCompletions: 0, consultations: 0, qualifiedLeads: 0, crmOpportunities: 0 },
      indexed: true,
    });
    expect(result.decision).toBe("IMPROVE_CONVERSION");
  });

  it("expands supporting content for pages producing qualified leads at 90 days", () => {
    const result = reviewPage({
      path: "/probate",
      window: 90,
      performance: { page: "/probate", impressions: 2000, clicks: 120, ctr: 0.06, position: 4, topQueries: [] },
      engagement: { guideDownloads: 10, assessmentStarts: 8, assessmentCompletions: 5, consultations: 2, qualifiedLeads: 2, crmOpportunities: 1 },
      indexed: true,
    });
    expect(result.decision).toBe("EXPAND_SUPPORTING_CONTENT");
  });
});
