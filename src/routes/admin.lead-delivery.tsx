// Task 25 — Operator view for CRM lead delivery. Internal only; separate
// from every public marketing surface.

import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageBody } from "@/components/page-header";
import { KpiCard, SectionTitle } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { RequirePermission } from "@/components/require-permission";
import {
  deliveryStats,
  flushQueue,
  isBulkDeliveryPaused,
  loadQueue,
  retryDelivery,
  setBulkDeliveryPaused,
  type LeadDelivery,
} from "@/lib/marketing/lead-queue";

import { hubspotTransport } from "@/lib/marketing/lead-capture";

export const Route = createFileRoute("/admin/lead-delivery")({
  head: () => ({
    meta: [
      { title: "Lead Delivery — Legacy Platform" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LeadDeliveryRoute,
});

const STATUS_TONE: Record<string, string> = {
  delivered: "text-evergreen",
  pending: "text-muted-foreground",
  sending: "text-gold",
  retry_scheduled: "text-gold",
  failed: "text-destructive",
  permanently_failed: "text-destructive",
};

function LeadDeliveryRoute() {
  return (
    <RequirePermission permission="integration.manage" label="Lead delivery">
      <LeadDeliveryPanel />
    </RequirePermission>
  );
}

function LeadDeliveryPanel() {
  const [records, setRecords] = useState<LeadDelivery[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [paused, setPaused] = useState(true);

  const refresh = useCallback(() => {
    setRecords([...loadQueue()].reverse());
    setPaused(isBulkDeliveryPaused());
  }, []);
  useEffect(refresh, [refresh]);

  const stats = deliveryStats(records);

  return (
    <>
      <PageHeader
        title="CRM Lead Delivery"
        description="HubSpot delivery status for every captured lead: attempts, retries, record IDs, and failures. Operators can force a retry."
      />
      <PageBody>
        <div className="grid gap-4 md:grid-cols-5 mb-6">
          <KpiCard label="Queued total" value={stats.total} />
          <KpiCard label="Delivered" value={stats.delivered} tone="evergreen" />
          <KpiCard label="In flight" value={stats.inFlight} />
          <KpiCard label="Retry scheduled" value={stats.retrying} tone="gold" />
          <KpiCard label="Failed" value={stats.failed} tone={stats.failed ? "warn" : "evergreen"} />
        </div>

        <div className="editorial-card p-3 mb-4 text-sm">
          <span className="uppercase tracking-widest text-xs text-muted-foreground">
            Bulk delivery
          </span>{" "}
          <span className={paused ? "text-gold" : "text-evergreen"}>
            {paused ? "PAUSED" : "ENABLED"}
          </span>
          <p className="text-xs text-muted-foreground mt-1">
            While paused, new conversions deliver individually and historical queued records are
            never flushed automatically.
          </p>
        </div>

        <div className="flex gap-2 mb-4">
          <Button size="sm" variant="outline" onClick={refresh}>
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setBulkDeliveryPaused(!paused);
              refresh();
            }}
          >
            {paused ? "Enable bulk delivery" : "Pause bulk delivery"}
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              setBusy("all");
              await flushQueue(hubspotTransport, Date.now() + 60 * 60_000);
              setBusy(null);
              refresh();
            }}
            disabled={busy !== null || paused}
            title={paused ? "Bulk delivery is paused" : undefined}
          >
            Flush due deliveries
          </Button>
        </div>


        <SectionTitle>Deliveries</SectionTitle>
        {records.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No lead deliveries recorded on this device.
          </div>
        ) : (
          <div className="editorial-card divide-y divide-border text-sm">
            {records.map(r => (
              <div key={r.id} className="p-3 grid gap-2 md:grid-cols-12 md:items-center">
                <div className="md:col-span-3">
                  <div className="font-medium">{r.payload.firstname}</div>
                  <div className="text-xs text-muted-foreground">{r.payload.email}</div>
                </div>
                <div className="md:col-span-2 text-xs">
                  <div>{r.payload.lf_situation}</div>
                  <div className="text-muted-foreground">
                    {r.pipeline} · {r.payload.city}
                  </div>
                </div>
                <div className="md:col-span-2 text-xs">
                  <div>{r.payload.lf_lead_classification}</div>
                  <div className="text-muted-foreground">
                    score {r.payload.lf_lead_score} · {r.payload.utm_source}
                  </div>
                </div>
                <div className="md:col-span-2 text-xs">
                  <div className={`uppercase tracking-widest ${STATUS_TONE[r.status] ?? ""}`}>
                    {r.status.replace("_", " ")}
                  </div>
                  <div className="text-muted-foreground">
                    {r.result ?? "—"} · attempts {r.attempts}
                  </div>
                </div>
                <div className="md:col-span-2 text-xs text-muted-foreground">
                  <div>
                    last {r.lastAttemptAt ? new Date(r.lastAttemptAt).toLocaleString() : "—"}
                  </div>
                  <div className="font-mono">{r.hubspotContactId ?? "no CRM id"}</div>
                  {r.error && <div className="text-destructive">{r.error}</div>}
                </div>
                <div className="md:col-span-1 md:text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null || r.status === "delivered"}
                    onClick={async () => {
                      setBusy(r.id);
                      await retryDelivery(r.id, hubspotTransport);
                      setBusy(null);
                      refresh();
                    }}
                  >
                    {busy === r.id ? "Retrying…" : "Retry"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
