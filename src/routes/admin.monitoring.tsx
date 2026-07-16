import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, KpiCard, SectionTitle } from "@/components/ui-kit";
import { useSnapshot } from "@/lib/use-snapshot";
import { computeMonitoring } from "@/lib/data/monitoring";

export const Route = createFileRoute("/admin/monitoring")({
  head: () => ({ meta: [{ title: "Monitoring — Legacy Platform" }] }),
  component: MonitoringDash,
});

function MonitoringDash() {
  const s = useSnapshot();
  const report = useMemo(() => (s ? computeMonitoring(s) : null), [s]);
  if (!s || !report) return <LoadingState />;
  const toneMap = { ok: "evergreen", warning: "gold", critical: "warn" } as const;
  return (
    <>
      <PageHeader title="System Monitoring" description="API · Automation · Webhooks · Storage · Migration · Jobs · Audit · Backups." />
      <PageBody>
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <KpiCard label="Overall" value={report.overall.toUpperCase()} tone={toneMap[report.overall]} />
          <KpiCard label="Signals" value={report.signals.length} />
          <KpiCard label="Perf counters" value={report.perf.totalCalls} hint={`${report.perf.totalMs.toFixed(0)} ms tracked`} />
          <KpiCard label="Slowest" value={report.perf.slowest?.name ?? "—"} hint={report.perf.slowest ? `${report.perf.slowest.totalMs.toFixed(0)} ms` : ""} />
        </div>
        <SectionTitle>Signals</SectionTitle>
        <div className="editorial-card divide-y divide-border mb-6">
          {report.signals.map(sig => (
            <div key={sig.name} className="p-3 flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">{sig.name}</div>
                {sig.note && <div className="text-xs text-muted-foreground">{sig.note}</div>}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs">{sig.value}</span>
                <span className={
                  sig.state === "ok" ? "text-evergreen text-xs uppercase tracking-widest" :
                  sig.state === "warning" ? "text-gold text-xs uppercase tracking-widest" :
                  "text-destructive text-xs uppercase tracking-widest"
                }>{sig.state}</span>
              </div>
            </div>
          ))}
        </div>
        <SectionTitle>Performance counters</SectionTitle>
        {report.perf.counters.length === 0 ? (
          <div className="text-sm text-muted-foreground">No memoized calls recorded yet — perform actions to populate.</div>
        ) : (
          <div className="editorial-card divide-y divide-border text-sm">
            {report.perf.counters.map(c => (
              <div key={c.name} className="p-3 grid grid-cols-5 gap-2">
                <div className="font-mono">{c.name}</div>
                <div className="text-muted-foreground text-xs">calls {c.calls}</div>
                <div className="text-muted-foreground text-xs">hits {c.hits}</div>
                <div className="text-muted-foreground text-xs">misses {c.misses}</div>
                <div className="text-muted-foreground text-xs text-right">{c.totalMs.toFixed(1)} ms</div>
              </div>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
