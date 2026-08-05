import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, KpiCard, SectionTitle, EmptyState } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { approveRun, rejectRun, cancelRun, executeRecipe } from "@/lib/data/automation";
import { OperationsCommandCenter } from "@/components/occ-dashboard";

export const Route = createFileRoute("/operations")({
  head: () => ({ meta: [{ title: "Operations — Legacy Platform" }] }),
  component: OperationsDashboard,
});

function OperationsDashboard() {
  const s = useSnapshot();
  const grouped = useMemo(() => {
    const runs = s?.automationRuns ?? [];
    return {
      pending: runs.filter(r => r.status === "waiting-approval"),
      failed: runs.filter(r => r.status === "failed"),
      running: runs.filter(r => r.status === "running" || r.status === "pending"),
      succeeded: runs.filter(r => r.status === "succeeded"),
    };
  }, [s]);

  if (!s) return <LoadingState />;

  const doApprove = async (runId: string, cpId: string) => {
    try {
      await Repo.auditedTransaction(
        { permission: "automation.approve", action: "approve", entityType: "automationRun", entityId: runId, reason: `checkpoint ${cpId} approved` },
        s0 => approveRun(s0, runId, cpId, "current-user").nextSnapshot,
      );
      toast.success("Checkpoint approved. Resuming run…");
      const snap = Repo.snapshot();
      const run = snap?.automationRuns.find(r => r.id === runId);
      const recipe = snap?.automations.find(a => a.id === run?.recipeId);
      if (snap && run && recipe) {
        await Repo.auditedTransaction(
          { permission: "automation.run", action: "automation-execute", entityType: "automationRun", entityId: runId, reason: "resume after approval" },
          s0 => executeRecipe({
            recipe, snapshot: s0, entityIds: run.entityIds,
            actor: "current-user", dryRun: run.dryRun,
            triggerEventId: `${run.triggerEventId}-resume`,
            ignoreConcurrency: true,
          }).nextSnapshot,
        );
      }
    } catch (e) { toast.error((e as Error).message); }
  };
  const doReject = async (runId: string, cpId: string) => {
    try {
      await Repo.auditedTransaction(
        { permission: "automation.approve", action: "reject", entityType: "automationRun", entityId: runId, reason: `checkpoint ${cpId} rejected` },
        s0 => rejectRun(s0, runId, cpId, "current-user", "Rejected by operator.").nextSnapshot,
      );
      toast.warning("Checkpoint rejected. Run cancelled.");
    } catch (e) { toast.error((e as Error).message); }
  };
  const doCancel = async (runId: string) => {
    try {
      await Repo.auditedTransaction(
        { permission: "automation.approve", action: "automation-cancel", entityType: "automationRun", entityId: runId, reason: "operator cancel" },
        s0 => cancelRun(s0, runId, "current-user").nextSnapshot,
      );
      toast.info("Run cancelled.");
    } catch (e) { toast.error((e as Error).message); }
  };
  const doRetry = async (runId: string) => {
    const run = s.automationRuns.find(r => r.id === runId);
    const recipe = run ? s.automations.find(a => a.id === run.recipeId) : null;
    if (!run || !recipe) return;
    try {
      let newRunId = "";
      await Repo.auditedTransaction(
        { permission: "automation.run", action: "automation-execute", entityType: "automationRun", entityId: runId, reason: "retry" },
        s0 => {
          const { nextSnapshot, run: nr } = executeRecipe({
            recipe, snapshot: s0, entityIds: run.entityIds, actor: "current-user",
            dryRun: false, triggerEventId: `${run.triggerEventId}-retry-${Date.now()}`,
          });
          newRunId = nr.id;
          return nextSnapshot;
        },
      );
      toast.success(`Retried as ${newRunId}.`);
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <>
      <PageHeader eyebrow="Governance" title="Operations Dashboard"
        description="Review pending approvals, failed automation runs, and current run activity." />
      <PageBody>
        <div className="mb-8">
          <OperationsCommandCenter />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <KpiCard label="Pending approval" value={grouped.pending.length} tone="gold" />
          <KpiCard label="Failed" value={grouped.failed.length} tone="warn" />
          <KpiCard label="Running / pending" value={grouped.running.length} />
          <KpiCard label="Succeeded" value={grouped.succeeded.length} tone="evergreen" />
        </div>

        <section className="mb-6">
          <SectionTitle hint={`${grouped.pending.length}`}>Awaiting approval</SectionTitle>
          {grouped.pending.length === 0 ? <EmptyState title="No approvals pending" description="All governance checkpoints are clear." /> : (
            <div className="space-y-3">
              {grouped.pending.map(r => {
                const cp = r.approvals.find(a => !a.approvedBy && !a.rejected);
                const recipe = s.automations.find(a => a.id === r.recipeId);
                const cpDef = recipe?.approvals.find(a => a.id === cp?.checkpointId);
                return (
                  <div key={r.id} className="editorial-card p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs text-slate-ink font-mono">{r.id} · {r.recipeId}@{r.recipeVersion}</div>
                        <Link to="/automations/$id" params={{ id: r.recipeId }} className="text-heritage hover:underline font-medium">{recipe?.name ?? r.recipeId}</Link>
                        <div className="text-xs text-muted-foreground">Targets: {r.entityIds.join(", ") || "—"}</div>
                        {cpDef && (
                          <div className="mt-2 text-xs">
                            <span className="text-slate-ink">Checkpoint {cpDef.id}</span> · Approver: {cpDef.approverRole}
                            {cpDef.instructions && <div className="mt-1 text-muted-foreground italic">"{cpDef.instructions}"</div>}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {cp && <Button size="sm" className="bg-evergreen text-evergreen-foreground hover:bg-evergreen/90" onClick={() => doApprove(r.id, cp.checkpointId)}>Approve</Button>}
                        {cp && <Button size="sm" variant="outline" onClick={() => doReject(r.id, cp.checkpointId)}>Reject</Button>}
                        <Button size="sm" variant="ghost" onClick={() => doCancel(r.id)}>Cancel run</Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mb-6">
          <SectionTitle hint={`${grouped.failed.length}`}>Failed runs</SectionTitle>
          {grouped.failed.length === 0 ? <EmptyState title="No failed runs" description="All recent automations completed successfully." /> : (
            <div className="space-y-3">
              {grouped.failed.map(r => (
                <div key={r.id} className="editorial-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs text-slate-ink font-mono">{r.id} · {r.recipeId}@{r.recipeVersion}</div>
                      <div className="text-xs text-muted-foreground">Targets: {r.entityIds.join(", ") || "—"} · {new Date(r.updatedAt).toLocaleString()}</div>
                      <div className="text-destructive text-sm mt-1">{r.errorSummary}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => doRetry(r.id)}>Retry</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </PageBody>
    </>
  );
}
