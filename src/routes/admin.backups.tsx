import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, KpiCard, SectionTitle, EmptyState } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createBackup, restoreFromBackup, verifyBackupIntegrity, buildDisasterRecoveryPlan, findRollbackTarget } from "@/lib/data/backups";
import { appendAudit } from "@/lib/data/audit";
import { getRole, currentCan } from "@/lib/data/auth";

export const Route = createFileRoute("/admin/backups")({
  head: () => ({ meta: [{ title: "Backups — Legacy Platform" }] }),
  component: BackupsPage,
});

function BackupsPage() {
  const s = useSnapshot();
  const dr = useMemo(() => (s ? buildDisasterRecoveryPlan(s) : null), [s]);
  if (!s || !dr) return <LoadingState />;

  const doBackup = async () => {
    if (!currentCan("backup.create")) { toast.error("Permission denied: backup.create"); return; }
    const bk = createBackup(s, { label: `Manual ${new Date().toISOString().slice(0, 10)}`, reason: "Admin-triggered", actor: "current-user" });
    const nextAudit = appendAudit(s.auditEvents, { actor: "current-user", actorRole: getRole(), workspaceId: s.activeWorkspaceId, action: "backup", entityType: "backup", entityId: bk.id, reason: "Manual backup" });
    await Repo.replaceAll({ ...s, backups: [...s.backups, bk], auditEvents: nextAudit });
    toast.success(`Backup ${bk.id} created (${(bk.bytes / 1024).toFixed(1)} KB)`);
  };

  const doRestore = async (id: string) => {
    if (!currentCan("backup.restore")) { toast.error("Permission denied: backup.restore"); return; }
    const bk = s.backups.find(b => b.id === id);
    if (!bk) return;
    try {
      const restored = restoreFromBackup(bk);
      const nextAudit = appendAudit(restored.auditEvents ?? [], { actor: "current-user", actorRole: getRole(), workspaceId: restored.activeWorkspaceId, action: "restore", entityType: "backup", entityId: bk.id, reason: "Manual restore" });
      await Repo.replaceAll({ ...restored, backups: [...restored.backups.map(b => b.id === bk.id ? { ...b, restoredAt: new Date().toISOString() } : b)], auditEvents: nextAudit });
      toast.success(`Restored from ${bk.id}`);
    } catch (e) { toast.error(String((e as Error).message)); }
  };

  const doRollback = async () => {
    const target = findRollbackTarget(s.backups, new Date().toISOString());
    if (!target) { toast.error("No rollback target available"); return; }
    await doRestore(target.id);
  };

  return (
    <>
      <PageHeader
        title="Backups & Recovery"
        description="Content-hashed snapshots for point-in-time recovery."
        actions={<div className="flex gap-2">
          <Button variant="outline" onClick={doRollback} disabled={!s.backups.length}>Rollback to previous</Button>
          <Button onClick={doBackup}>Create backup</Button>
        </div>}
      />
      <PageBody>
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <KpiCard label="Backups" value={dr.backupCount} />
          <KpiCard label="Latest" value={dr.latestBackup?.createdAt.slice(0, 10) ?? "—"} tone={dr.latestBackup ? "evergreen" : "warn"} />
          <KpiCard label="Oldest" value={dr.oldestBackupAt?.slice(0, 10) ?? "—"} />
          <KpiCard label="Actions" value={dr.recommendedActions.length} tone={dr.recommendedActions.length ? "gold" : "evergreen"} />
        </div>
        {dr.recommendedActions.length > 0 && (
          <div className="editorial-card p-4 border-gold/40 mb-6">
            <div className="text-xs uppercase tracking-widest text-gold mb-2">Recommendations</div>
            <ul className="text-sm list-disc pl-5 space-y-1">
              {dr.recommendedActions.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}
        <SectionTitle>Backup history</SectionTitle>
        {s.backups.length === 0 ? (
          <EmptyState title="No backups yet" description="Create one to enable rollback and disaster recovery." />
        ) : (
          <div className="editorial-card divide-y divide-border text-sm">
            {s.backups.slice().reverse().map(b => {
              const ok = verifyBackupIntegrity(b).ok;
              return (
                <div key={b.id} className="p-3 grid gap-2 md:grid-cols-[120px_1fr_auto] items-center">
                  <div className="font-mono text-xs">{b.id}</div>
                  <div>
                    <div className="font-medium">{b.label}</div>
                    <div className="text-xs text-muted-foreground">{b.createdAt.slice(0, 19).replace("T", " ")} · {b.entityCount} entities · {(b.bytes / 1024).toFixed(1)} KB · hash {b.hash} {ok ? <span className="text-evergreen">✓</span> : <span className="text-destructive">✗</span>}</div>
                    {b.restoredAt && <div className="text-xs text-gold">Restored at {b.restoredAt.slice(0, 19).replace("T", " ")}</div>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => doRestore(b.id)}>Restore</Button>
                </div>
              );
            })}
          </div>
        )}
      </PageBody>
    </>
  );
}
