// Search Authority Gate + Discovery Measurement Pack — operator surface.
//
// Read-only. Noindexed. Changes no state, submits nothing to any search
// engine, and applies no redirect or index action. It reports what the
// authority and measurement layers currently assert.

import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageBody } from "@/components/page-header";
import { SectionTitle } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { RequirePermission } from "@/components/require-permission";
import { buildCannibalizationReport } from "@/lib/marketing/cannibalization";
import { linkEquityDistribution, authorityIssues } from "@/lib/marketing/authority";
import { indexableRecords } from "@/lib/marketing/intent-map";
import { evidenceIntegrity } from "@/lib/marketing/search-evidence";
import { searchConsoleStatus } from "@/lib/marketing/search-console";
import { GA4_EVENTS, GA4_KEY_CONVERSIONS } from "@/lib/marketing/ga4-contract";
import { discoveryCoverage, DISCOVERY_SOURCES } from "@/lib/marketing/ai-discovery";
import { buildLaunchPackage } from "@/lib/marketing/indexing-launch";
import { buildRichResultReport } from "@/lib/marketing/rich-results";
import { buildQualityGate } from "@/lib/marketing/quality-gate";
import { auditSocialPreviews } from "@/lib/marketing/social-preview";
import { REVIEW_FRAMEWORK } from "@/lib/marketing/lifecycle";

export const Route = createFileRoute("/admin/search-authority")({
  head: () => ({
    meta: [
      { title: "Search Authority Gate — Legacy Platform" },
      { name: "description", content: "Cannibalization, authority hierarchy, and discovery measurement readiness." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SearchAuthorityRoute,
});

function tone(status: string) {
  if (status === "PASS" || status === "READY" || status === "KEEP") return "default" as const;
  if (status === "REVIEW" || status === "DIFFERENTIATE") return "secondary" as const;
  return "destructive" as const;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="mt-2 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function SearchAuthorityRoute() {
  return (
    <RequirePermission permission="integration.manage" label="Search authority gate">
      <SearchAuthorityPanel />
    </RequirePermission>
  );
}

function SearchAuthorityPanel() {
  const cannibal = buildCannibalizationReport();
  const equity = linkEquityDistribution();
  const issues = authorityIssues();
  const evidence = evidenceIntegrity();
  const gsc = searchConsoleStatus(null);
  const ai = discoveryCoverage();
  const launch = buildLaunchPackage();
  const rich = buildRichResultReport();
  const quality = buildQualityGate();
  const social = auditSocialPreviews();
  const records = indexableRecords();

  const flagged = cannibal.findings.filter(f => f.verdict !== "KEEP");

  return (
    <>
      <PageHeader
        title="Search Authority Gate"
        description="Cannibalization audit, authority hierarchy, evidence retention, and discovery measurement readiness. Read-only."
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={tone(quality.status)}>Quality gate {quality.status}</Badge>
          <Badge variant={tone(rich.status)}>Schema {rich.status}</Badge>
          <Badge variant={tone(social.status)}>Social {social.status}</Badge>
          <Badge variant={tone(launch.readiness)}>Launch package {launch.readiness}</Badge>
          <span className="text-sm text-muted-foreground">{records.length} indexable URLs</span>
        </div>

        <SectionTitle>Cannibalization audit</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.entries(cannibal.counts) as [string, number][]).map(([verdict, count]) => (
            <Card key={verdict} title={verdict}>
              <span className="text-2xl font-semibold text-foreground">{count}</span> pages
            </Card>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          No redirects, deletions, or index changes have been applied. Verdicts are advisory until authorized.
        </p>
        {flagged.length > 0 && (
          <ul className="mt-3 space-y-2">
            {flagged.slice(0, 25).map(f => (
              <li key={f.path} className="rounded-lg border border-border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={tone(f.verdict)}>{f.verdict}</Badge>
                  <code className="text-xs">{f.path}</code>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {f.reason} Competing with: {f.competitors.slice(0, 3).join(", ") || "—"}
                </p>
              </li>
            ))}
          </ul>
        )}

        <SectionTitle>Authority hierarchy and internal PageRank</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {equity.map(row => (
            <Card key={row.tier} title={`${row.tier} — ${row.pages} pages`}>
              {row.label}
              <div className="mt-1 text-foreground">{(row.share * 100).toFixed(1)}% of link emphasis</div>
            </Card>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {issues.length === 0 ? "Every page has a valid parent hub with no cycles." : `${issues.length} hierarchy issues.`}
        </p>

        <SectionTitle>Semrush evidence retention</SectionTitle>
        <Card title={`${evidence.observations} observations retained (${evidence.database}, ${evidence.researchDate})`}>
          {evidence.measured} measured · {evidence.unmeasured} unmeasured (recorded as unknown, not zero) ·{" "}
          {evidence.selected} selected · {evidence.rejected} rejected · {evidence.fabricatedValues} fabricated values.
        </Card>

        <SectionTitle>Search Console readiness</SectionTitle>
        <Card title={`State: ${gsc.state}`}>
          {gsc.detail} Dimensions ready: {gsc.dimensions.join(", ")}.
        </Card>

        <SectionTitle>GA4 event contract</SectionTitle>
        <Card title={`${GA4_EVENTS.length} mapped events · ${GA4_KEY_CONVERSIONS.length} key conversions`}>
          {GA4_KEY_CONVERSIONS.join(", ")}. PII parameters are rejected by contract.
        </Card>

        <SectionTitle>AI discovery measurement</SectionTitle>
        <Card title={`${DISCOVERY_SOURCES.length} sources classified`}>
          {ai.reliable} reliable · {ai.partial} partially attributable · {ai.unmeasurable} unmeasurable. {ai.caveat}
        </Card>

        <SectionTitle>Indexing launch package (prepared, not submitted)</SectionTitle>
        <Card title={`Readiness: ${launch.readiness}`}>
          Sitemap {launch.sitemapUrl} · {launch.sitemapUrlCount} URLs · IndexNow{" "}
          {launch.indexNow.enabled ? "enabled" : "disabled"} · {launch.redirects.length} redirects mapped.
          {launch.blockers.length > 0 && <div className="mt-1 text-destructive">{launch.blockers.join(" ")}</div>}
        </Card>

        <SectionTitle>Content quality gate</SectionTitle>
        <Card title={`${quality.launchEligible} of ${quality.pages.length} pages launch-eligible`}>
          {quality.pass} PASS · {quality.review} REVIEW · {quality.fail} FAIL.
          {quality.structuralIssues.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {quality.structuralIssues.slice(0, 10).map(i => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
        </Card>

        <SectionTitle>30/60/90-day decision framework</SectionTitle>
        <ul className="space-y-2">
          {REVIEW_FRAMEWORK.map(w => (
            <li key={w.window} className="rounded-lg border border-border bg-card p-3">
              <div className="text-sm font-medium">{w.window} days — {w.question}</div>
              <p className="mt-1 text-xs text-muted-foreground">{w.thresholds.join(" · ")}</p>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-xs text-muted-foreground">
          Read-only. Production publication remains BLOCKED until Tasks 14–17 close.
        </p>
      </PageBody>
    </>
  );
}
