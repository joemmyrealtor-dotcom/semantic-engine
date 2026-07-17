import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, KpiCard, SectionTitle } from "@/components/ui-kit";
import { useSnapshot } from "@/lib/use-snapshot";
import { RequirePermission } from "@/components/require-permission";
import { computeCutoverReadiness } from "@/lib/data/launch-gates";
import { computeMonitoring } from "@/lib/data/monitoring";

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
  const env = typeof import.meta !== "undefined" ? (import.meta as unknown as { env: Record<string, string | undefined> }).env : {};
  const readiness = useMemo(() => (s ? computeCutoverReadiness(s, env, s.activeWorkspaceId) : null), [s, env]);
  const monitoring = useMemo(() => (s ? computeMonitoring(s) : null), [s]);
  if (!s || !readiness || !monitoring) return <LoadingState />;

  const passing = readiness.gates.filter(g => g.status === "PASS").length;
  const staleCount = readiness.staleGateIds.length;

  return (
    <>
      <PageHeader
        title="Cutover Command Center"
        description="Production readiness at a glance · append-only evidence · staleness-aware."
      />
      <PageBody>
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <KpiCard label="Production GO" value={readiness.ready ? "UNLOCKED" : "LOCKED"} tone={readiness.ready ? "evergreen" : "warn"} hint={`${passing}/${readiness.gates.length} PASS`} />
          <KpiCard label="Blocking gates" value={readiness.blockingGateIds.length} tone={readiness.blockingGateIds.length ? "warn" : "evergreen"} hint={readiness.blockingGateIds.join(", ") || "none"} />
          <KpiCard label="Stale evidence" value={staleCount} tone={staleCount ? "warn" : "evergreen"} hint={readiness.staleGateIds.join(", ") || "current"} />
          <KpiCard label="Monitoring" value={monitoring.overall.toUpperCase()} tone={monitoring.overall === "ok" ? "evergreen" : monitoring.overall === "warning" ? "gold" : "warn"} />
        </div>

        <SectionTitle hint={`generated ${readiness.generatedAt.slice(11, 19)}Z`}>Hard gate ledger</SectionTitle>
        <div className="editorial-card divide-y divide-border text-sm" data-testid="cutover-ledger">
          {readiness.gates.map(g => (
            <div key={g.definition.id} className="p-3" data-testid={`cutover-${g.definition.id}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs text-muted-foreground mr-2">{g.definition.id}</span>
                  <span className="font-medium">{g.definition.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">· {g.definition.owner}</span>
                </div>
                <span
                  className={
                    g.status === "PASS" ? "text-evergreen text-xs uppercase tracking-widest"
                    : g.status === "STALE" ? "text-destructive/80 text-xs uppercase tracking-widest"
                    : g.status === "FAIL" ? "text-destructive text-xs uppercase tracking-widest"
                    : "text-gold text-xs uppercase tracking-widest"
                  }
                >
                  {g.status}
                </span>
              </div>
              <div className="text-xs text-muted-foreground pl-6 mt-1 space-y-0.5">
                <div>Verifier: <span className={g.verifier.passed ? "text-evergreen" : "text-destructive"}>{g.verifier.passed ? "OK" : "FAIL"}</span> — {g.verifier.detail}</div>
                {g.current ? (
                  <div>Attested v{g.current.version} by {g.current.attestedBy} at {new Date(g.current.attestedAt).toLocaleString()}</div>
                ) : <div>No evidence captured.</div>}
                {g.stale && <div className="text-destructive/80">Stale — {g.staleReason}</div>}
              </div>
            </div>
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
