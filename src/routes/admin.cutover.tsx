import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, KpiCard, SectionTitle } from "@/components/ui-kit";
import { useSnapshot } from "@/lib/use-snapshot";
import { RequirePermission } from "@/components/require-permission";
import { computeMonitoring } from "@/lib/data/monitoring";
import {
  AuthoritativeGatesPanel, useAuthoritativeReadiness,
} from "@/components/launch-gates-panel";
import { LAUNCH_GATE_DEFINITIONS } from "@/lib/data/launch-gates";

export const Route = createFileRoute("/admin/cutover")({
  head: () => ({ meta: [{ title: "Cutover Command Center — Legacy Platform" }] }),
  component: () => (
    <RequirePermission permission="maintenance.manage" label="Cutover Command Center">
      <CutoverPage />
    </RequirePermission>
  ),
});

function CutoverPage() {
  const s = useSnapshot();
  const monitoring = useMemo(() => (s ? computeMonitoring(s) : null), [s]);
  const readiness = useAuthoritativeReadiness(s?.activeWorkspaceId ?? "");
  if (!s || !monitoring) return <LoadingState />;

  const authoritative = !readiness.isError && !!readiness.data;
  const data = readiness.data;
  const passing = data?.gates.filter(g => g.status === "PASS").length ?? 0;
  const staleCount = data?.staleGateIds.length ?? 0;
  const blocking = data?.blockingGateIds.length ?? 4;

  return (
    <>
      <PageHeader
        title="Cutover Command Center"
        description="Server-authoritative readiness · append-only evidence · re-locks on drift."
      />
      <PageBody>
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <KpiCard label="Production GO" value={authoritative && data!.ready ? "UNLOCKED" : "LOCKED"} tone={authoritative && data!.ready ? "evergreen" : "warn"} hint={authoritative ? `${passing}/${data!.gates.length} PASS` : "server unreachable"} />
          <KpiCard label="Blocking gates" value={blocking} tone={blocking ? "warn" : "evergreen"} hint={data?.blockingGateIds.join(", ") || (authoritative ? "none" : "unknown")} />
          <KpiCard label="Stale evidence" value={staleCount} tone={staleCount ? "warn" : "evergreen"} hint={data?.staleGateIds.join(", ") || "current"} />
          <KpiCard label="Monitoring" value={monitoring.overall.toUpperCase()} tone={monitoring.overall === "ok" ? "evergreen" : monitoring.overall === "warning" ? "gold" : "warn"} />
        </div>

        <SectionTitle hint={authoritative ? `server @ ${data!.generatedAt.slice(11, 19)}Z` : "server unreachable"}>
          Hard gate ledger
        </SectionTitle>
        <div data-testid="cutover-ledger">
          <AuthoritativeGatesPanel workspaceId={s.activeWorkspaceId} showAttestControls={false} />
        </div>

        {/* Stable per-gate anchors for tests / deep-linking */}
        <div className="sr-only" aria-hidden="true">
          {(["H1", "H2", "H3", "H4"] as const).map(id => (
            <div key={id} data-testid={`cutover-${id}`}>{LAUNCH_GATE_DEFINITIONS[id].name}</div>
          ))}
        </div>

        <SectionTitle hint="from computeMonitoring">Cutover sequence</SectionTitle>
        <ol className="editorial-card p-4 text-sm space-y-2 list-decimal pl-6">
          <li>Confirm all four hard gates report PASS in the ledger above.</li>
          <li>Re-run <Link to="/admin/monitoring" className="underline">monitoring diagnostics</Link>; expect overall <span className="font-mono">ok</span>.</li>
          <li>Trigger baseline backup and verify SHA-256 integrity in <Link to="/admin/backups" className="underline">backups</Link>.</li>
          <li>Flip production traffic. Any gate transitioning to STALE re-locks the cutover automatically.</li>
          <li>Rollback trigger: any critical monitoring signal OR any gate flipping off PASS post-cutover.</li>
        </ol>

        <div className="mt-6 text-xs text-muted-foreground">
          <Link to="/admin/deployment" className="underline">← Back to deployment readiness</Link>
        </div>
      </PageBody>
    </>
  );
}
