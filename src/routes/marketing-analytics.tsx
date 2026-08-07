import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  computeConversionMetrics,
  loadConversionEvents,
  clearConversionEvents,
  type ConversionMetrics,
} from "@/lib/marketing/conversion-store";
import { queuedLeads, type CrmLeadPayload } from "@/lib/marketing/lead-capture";
import { CRM_PIPELINES } from "@/lib/marketing/crm-schema";

export const Route = createFileRoute("/marketing-analytics")({
  head: () => ({
    meta: [
      { title: "Conversion Dashboard | Legacy Forge" },
      {
        name: "description",
        content:
          "Internal conversion reporting: guide downloads, assessment completions, and consultation requests by city, situation, and source.",
      },
      { property: "og:title", content: "Conversion Dashboard | Legacy Forge" },
      {
        property: "og:description",
        content: "Marketing conversion reporting for Legacy Forge lead capture.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MarketingAnalyticsRoute,
});

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; conversions: number; views: number }[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-1">Segment</th>
                <th className="pb-1 text-right">Views</th>
                <th className="pb-1 text-right">Conversions</th>
                <th className="pb-1 text-right">Rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const total = r.views + r.conversions;
                const rate = total ? Math.round((r.conversions / total) * 100) : 0;
                return (
                  <tr key={r.key} className="border-t border-border">
                    <td className="py-1.5">{r.key}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.views}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.conversions}</td>
                    <td className="py-1.5 text-right tabular-nums">{rate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function MarketingAnalyticsRoute() {
  const [metrics, setMetrics] = useState<ConversionMetrics | null>(null);
  const [leads, setLeads] = useState<CrmLeadPayload[]>([]);

  function refresh() {
    setMetrics(computeConversionMetrics(loadConversionEvents()));
    setLeads(queuedLeads().slice(-25).reverse());
  }

  useEffect(refresh, []);

  return (
    <AppShell>
      <PageHeader
        title="Conversion Dashboard"
        description="Traffic, conversions, and lead quality by city, situation, and source. Reported from the local conversion store; CRM records live in HubSpot."
      />
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={refresh}>
            Refresh
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              clearConversionEvents();
              refresh();
            }}
          >
            Clear local events
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Sessions" value={metrics?.visitors ?? 0} />
          <Metric label="Page views" value={metrics?.pageViews ?? 0} />
          <Metric label="Guide downloads" value={metrics?.guideDownloads ?? 0} />
          <Metric label="Consultation requests" value={metrics?.consultationRequests ?? 0} />
          <Metric label="Assessments started" value={metrics?.assessmentStarts ?? 0} />
          <Metric label="Assessments completed" value={metrics?.assessmentCompletions ?? 0} />
          <Metric label="Qualified+ leads" value={metrics?.qualifiedLeads ?? 0} />
          <Metric label="Hot leads" value={metrics?.hotLeads ?? 0} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Breakdown title="By city" rows={metrics?.byCity ?? []} />
          <Breakdown title="By situation" rows={metrics?.bySituation ?? []} />
          <Breakdown title="By traffic source" rows={metrics?.bySource ?? []} />
          <Breakdown title="By landing page" rows={metrics?.byLandingPage ?? []} />
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent captured leads</CardTitle>
          </CardHeader>
          <CardContent>
            {leads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leads captured on this device yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {leads.map((l, i) => (
                  <li
                    key={`${l.email}-${l.lf_submitted_at}-${i}`}
                    className="flex flex-wrap items-center gap-2 border-t border-border pt-2 first:border-0 first:pt-0"
                  >
                    <Badge variant="outline">{l.lf_lead_classification}</Badge>
                    <span className="tabular-nums text-muted-foreground">{l.lf_lead_score}</span>
                    <span>{l.lf_situation}</span>
                    <span className="text-muted-foreground">{l.city}</span>
                    <span className="text-muted-foreground">{l.utm_source}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(l.lf_submitted_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">CRM pipelines</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {CRM_PIPELINES.map(p => (
              <div key={p.id} className="rounded-md border border-border p-3">
                <div className="font-medium">{p.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{p.stages.join(" → ")}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
