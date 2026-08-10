// Task 17 — read-only SEO/AEO + discovery release readiness.
//
// Operator surface only. Noindex, gated to operators, and it changes no state:
// it reports whether the search, AI, social, and local identity layer is safe
// to publish under the ten-point Task 17 gate.

import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageBody } from "@/components/page-header";
import { SectionTitle } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { RequirePermission } from "@/components/require-permission";
import { buildReleaseAudit, type AuditStatus } from "@/lib/marketing/release-audit";
import { buildDomainPackage } from "@/lib/marketing/domain";
import { buildDiscoveryReadiness } from "@/lib/marketing/discovery-readiness";
import { buildGbpPack } from "@/lib/marketing/gbp";
import { buildAuthorityAudit } from "@/lib/marketing/authority-audit";
import { buildProofReport } from "@/lib/marketing/proof";
import { buildExternalAuthorityPlan } from "@/lib/marketing/citations";

export const Route = createFileRoute("/admin/seo-readiness")({
  head: () => ({
    meta: [
      { title: "SEO/AEO Release Readiness — Legacy Platform" },
      { name: "description", content: "Task 17 search, AI, social, and local identity release checks." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SeoReadinessRoute,
});

function tone(status: string) {
  if (status === "PASS" || status === "READY") return "default" as const;
  if (status === "REVIEW" || status === "EMPTY" || status === "PENDING") return "secondary" as const;
  return "destructive" as const;
}

function SeoReadinessRoute() {
  return (
    <RequirePermission permission="integration.manage" label="SEO release readiness">
      <SeoReadinessPanel />
    </RequirePermission>
  );
}

function Row({ status, label, note }: { status: string; label: string; note: string }) {
  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={tone(status)}>{status}</Badge>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{note}</p>
    </li>
  );
}

function SeoReadinessPanel() {
  const audit = buildReleaseAudit();
  const domain = buildDomainPackage();
  const discovery = buildDiscoveryReadiness();
  const gbp = buildGbpPack();
  const authority = buildAuthorityAudit();
  const proof = buildProofReport();
  const citations = buildExternalAuthorityPlan();

  return (
    <>
      <PageHeader
        title="SEO/AEO Release Readiness"
        description="Task 17 — canonical domain, discovery integrations, authority state, proof integrity, and citation plan."
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={tone(audit.status)}>{audit.status}</Badge>
          <span className="text-sm text-muted-foreground">
            Canonical origin: <code>{audit.origin}</code> · {audit.indexableCount} indexable URLs ·{" "}
            {audit.checks.filter(c => c.status === "PASS").length}/{audit.checks.length} gate checks passing
          </span>
        </div>

        <SectionTitle>Task 17 gate (T17-1 – T17-10)</SectionTitle>
        <ul className="space-y-3">
          {audit.checks.map(check => (
            <li key={check.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={tone(check.status)}>{check.status}</Badge>
                <code className="text-xs text-muted-foreground">{check.id}</code>
                <span className="text-sm font-medium">{check.label}</span>
                {check.launchCritical && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">launch critical</span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{check.detail}</p>
            </li>
          ))}
        </ul>

        <SectionTitle>Production domain package</SectionTitle>
        <ul className="space-y-3">
          <Row
            status={domain.status}
            label={`Canonical host — ${domain.origin}`}
            note={`${domain.redirects.length} redirects prepared · ${domain.leaks.length} provisional-hostname leaks across ${domain.leakSurfaces.length} surfaces · HTTPS enforced · ${domain.hostPolicy.canonicalHost} canonical`}
          />
          {domain.blockers.map(b => (
            <Row key={b} status="BLOCKED" label="Domain blocker" note={b} />
          ))}
        </ul>

        <SectionTitle>Discovery integrations</SectionTitle>
        <ul className="space-y-3">
          {discovery.sections.map(section => (
            <Row
              key={section.id}
              status={section.state}
              label={section.title}
              note={`${section.checklist.length} prepared steps · ${section.summary}${
                section.blockers.length ? ` · ${section.blockers.join(" ")}` : ""
              }`}
            />
          ))}
          <Row
            status={gbp.status}
            label="Google Business Profile"
            note={`${gbp.services.length} services · ${gbp.serviceAreas.length} service areas · ${gbp.posts.length} scheduled post templates · ${gbp.blockers.length} blockers`}
          />
        </ul>

        <SectionTitle>Sitewide authority audit</SectionTitle>
        <ul className="space-y-3">
          <Row
            status={authority.status}
            label={`${authority.urls.length} URLs stated`}
            note={Object.entries(authority.counts)
              .map(([state, count]) => `${state} ${count}`)
              .join(" · ")}
          />
        </ul>

        <SectionTitle>Proof and citations</SectionTitle>
        <ul className="space-y-3">
          <Row status={proof.status} label="Review and proof engine" note={proof.detail} />
          <Row
            status={citations.status}
            label="External authority plan"
            note={`${citations.plays.length} earned-link plays · ${citations.targets.length} citation targets · outreach sent: no${
              citations.blockers.length ? ` · ${citations.blockers.join(" ")}` : ""
            }`}
          />
        </ul>

        <p className="mt-6 text-xs text-muted-foreground">
          Read-only. Production publication remains BLOCKED until Tasks 14–17 close.
        </p>
      </PageBody>
    </>
  );
}
