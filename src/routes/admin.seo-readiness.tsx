// Task 17 — read-only SEO/AEO release readiness.
//
// Operator surface only. Noindex by default (root route directive), gated to
// operators, and it changes no state: it reports whether the search, AI, and
// social identity layer is safe to publish.

import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageBody } from "@/components/page-header";
import { SectionTitle } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { RequirePermission } from "@/components/require-permission";
import { buildReleaseAudit, type AuditStatus } from "@/lib/marketing/release-audit";

export const Route = createFileRoute("/admin/seo-readiness")({
  head: () => ({
    meta: [
      { title: "SEO/AEO Release Readiness — Legacy Platform" },
      { name: "description", content: "Task 17 search, AI, and social identity release checks." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SeoReadinessRoute,
});

function tone(status: AuditStatus) {
  if (status === "PASS") return "default" as const;
  if (status === "REVIEW") return "secondary" as const;
  return "destructive" as const;
}

function SeoReadinessRoute() {
  return (
    <RequirePermission permission="integration.manage" label="SEO release readiness">
      <SeoReadinessPanel />
    </RequirePermission>
  );
}

function SeoReadinessPanel() {
  const audit = buildReleaseAudit();

  return (
    <>
      <PageHeader
        title="SEO/AEO Release Readiness"
        description="Task 17 — canonical identity, indexation boundary, and local content quality."
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={tone(audit.status)}>{audit.status}</Badge>
          <span className="text-sm text-muted-foreground">
            Canonical origin: <code>{audit.origin}</code> · {audit.indexableCount} indexable URLs
          </span>
        </div>

        <SectionTitle>Checks</SectionTitle>
        <ul className="space-y-3">
          {audit.checks.map(check => (
            <li key={check.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={tone(check.status)}>{check.status}</Badge>
                <span className="text-sm font-medium">{check.label}</span>
                {check.launchCritical && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    launch critical
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{check.detail}</p>
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
