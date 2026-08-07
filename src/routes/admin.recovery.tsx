// Task 16 — Read-only recovery evidence dashboard.
//
// Shows the last drill, last verified restore, current RPO/RTO, CRM queue
// health, migration backup status, failed leads, and the acceptance matrix.
// Infrastructure recovery remains UNVERIFIED here by design.

import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageBody } from "@/components/page-header";
import { KpiCard, SectionTitle } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RequirePermission } from "@/components/require-permission";
import {
  ROLLBACK_DECISIONS,
  buildRecoveryDashboard,
  buildRpoTable,
  loadEvidence,
  runAllRecoveryDrills,
  type RecoveryDashboard,
  type RecoveryEvidence,
  type RecoverySituation,
} from "@/lib/data/recovery";

export const Route = createFileRoute("/admin/recovery")({
  head: () => ({
    meta: [
      { title: "Recovery Evidence — Legacy Platform" },
      { name: "description", content: "Application-layer recovery drills, RPO/RTO measurement, and rollback decisions." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecoveryRoute,
});

function RecoveryRoute() {
  return (
    <RequirePermission permission="integration.manage" label="Recovery evidence">
      <RecoveryPanel />
    </RequirePermission>
  );
}

const STATE_TONE: Record<string, string> = {
  VERIFIED: "text-evergreen",
  MEASURED: "text-evergreen",
  UNVERIFIED: "text-gold",
  BLOCKED: "text-destructive",
};

function RecoveryPanel() {
  const [dash, setDash] = useState<RecoveryDashboard | null>(null);
  const [evidence, setEvidence] = useState<RecoveryEvidence[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    setEvidence([...loadEvidence()].reverse());
    setDash(buildRecoveryDashboard());
  }, []);
  useEffect(refresh, [refresh]);

  const runDrills = async () => {
    setBusy(true);
    try {
      await runAllRecoveryDrills("Operator (session)");
      refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!dash) return null;
  const rpo = buildRpoTable(evidence.slice().reverse());

  return (
    <>
      <PageHeader
        title="Recovery Evidence"
        description="Task 16 — application-layer recovery: lead recovery, CRM retry recovery, and migration rollback with measured RPO and RTO. Infrastructure recovery stays UNVERIFIED until external hosting work closes."
        actions={
          <Button size="sm" onClick={runDrills} disabled={busy}>
            {busy ? "Running drills…" : "Run recovery drills"}
          </Button>
        }
      />
      <PageBody>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Last drill" value={dash.lastDrill ? dash.lastDrill.finalState.replace(/_/g, " ") : "None"} hint={dash.lastDrill?.endedAt ?? "Run a drill to record evidence"} />
          <KpiCard label="Current RPO" value={dash.currentRpoRecordsLost === null ? "—" : `${dash.currentRpoRecordsLost} records`} hint="Records unrecoverable in the last drill" />
          <KpiCard label="Current RTO" value={dash.currentRtoSeconds === null ? "—" : `${dash.currentRtoSeconds.toFixed(3)}s`} hint="Detect → restore → resume → verify" />
          <KpiCard label="Failed leads" value={String(dash.failedLeadCount)} hint={`CRM queue: ${dash.crmQueueHealth}`} />
        </div>

        <SectionTitle>Acceptance matrix</SectionTitle>
        <div className="rounded-lg border border-border divide-y divide-border">
          {dash.acceptance.map(a => (
            <div key={a.item} className="flex items-start justify-between gap-4 p-3">
              <div>
                <p className="text-sm font-medium">{a.item}</p>
                <p className="text-xs text-muted-foreground">{a.note}</p>
              </div>
              <span className={`text-xs font-semibold ${STATE_TONE[a.state] ?? "text-muted-foreground"}`}>{a.state}</span>
            </div>
          ))}
        </div>

        <SectionTitle>Operational status</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-4 text-sm">
            <p className="font-medium">CRM queue health</p>
            <p className="text-muted-foreground">
              {dash.crmQueue.total} record(s) · {dash.crmQueue.delivered} delivered · {dash.crmQueue.retrying} retrying · {dash.crmQueue.failed} failed
            </p>
          </div>
          <div className="rounded-lg border border-border p-4 text-sm">
            <p className="font-medium">Migration backup status</p>
            <p className="text-muted-foreground">{dash.migrationBackupStatus}</p>
          </div>
          <div className="rounded-lg border border-border p-4 text-sm">
            <p className="font-medium">Last successful restore</p>
            <p className="text-muted-foreground">{dash.lastSuccessfulRestore?.endedAt ?? "Not recorded"}</p>
          </div>
          <div className="rounded-lg border border-border p-4 text-sm">
            <p className="font-medium">Evidence integrity</p>
            <p className="text-muted-foreground">
              {dash.evidenceCount} sealed record(s) · status {dash.evidenceStatus}
            </p>
          </div>
        </div>

        <SectionTitle>RPO by failure scenario</SectionTitle>
        <div className="rounded-lg border border-border divide-y divide-border">
          {rpo.map(row => (
            <div key={row.situation} className="p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{row.label}</p>
                <span className="text-xs text-muted-foreground">
                  target {row.target} · observed{" "}
                  {row.observedRecordsLost === null ? "not drilled" : `${row.observedRecordsLost} records lost`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{row.maximumLoss}</p>
            </div>
          ))}
        </div>

        <SectionTitle>Rollback decision framework</SectionTitle>
        <div className="rounded-lg border border-border divide-y divide-border">
          {(Object.keys(ROLLBACK_DECISIONS) as RecoverySituation[]).map(key => {
            const d = ROLLBACK_DECISIONS[key];
            return (
              <div key={key} className="p-3 text-sm space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{d.label}</p>
                  <div className="flex gap-1">
                    <Badge variant="secondary">{d.primaryAction.replace(/_/g, " ")}</Badge>
                    <Badge variant="outline">then {d.secondaryAction.replace(/_/g, " ")}</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Detection: {d.detection}</p>
                <p className="text-xs text-muted-foreground">Escalate when: {d.escalateWhen}</p>
                <p className="text-xs text-muted-foreground">
                  Targets: RPO {d.rpoTargetSeconds}s · RTO {d.rtoTargetSeconds}s · Owner {d.owner}
                </p>
              </div>
            );
          })}
        </div>

        <SectionTitle>Recovery evidence records</SectionTitle>
        {evidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">No drills recorded in this browser yet.</p>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            {evidence.map(e => (
              <div key={e.scenarioId} className="p-3 text-sm space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{e.scenario}</p>
                  <span className={e.integrity.ok ? "text-xs text-evergreen" : "text-xs text-destructive"}>
                    {e.finalState.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {e.scenarioId} · operator {e.operator} · {e.startedAt} → {e.endedAt}
                </p>
                <p className="text-xs text-muted-foreground">
                  Failure: {e.failureIntroduced} · Data affected: {e.dataAffected} · Action: {e.recoveryAction.replace(/_/g, " ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  RPO {e.rpoRecordsLost} records / {e.rpoSeconds}s · RTO {e.rtoSeconds.toFixed(3)}s (detect {e.rtoBreakdown.detectMs}ms, restore {e.rtoBreakdown.restoreMs}ms, resume {e.rtoBreakdown.resumeMs}ms, verify {e.rtoBreakdown.verifyMs}ms)
                </p>
                <p className="text-xs font-mono text-muted-foreground break-all">hash {e.hash}</p>
                <ul className="text-xs text-muted-foreground list-disc pl-5">
                  {e.integrity.checks.map(c => (
                    <li key={c.name}>
                      {c.ok ? "PASS" : "FAIL"} — {c.name} ({c.detail})
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
