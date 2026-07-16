import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, KpiCard, SectionTitle } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { workspaceMetrics, exportWorkspace } from "@/lib/data/workspaces";
import { appendAudit } from "@/lib/data/audit";
import { getRole, currentCan } from "@/lib/data/auth";

export const Route = createFileRoute("/admin/workspaces")({
  head: () => ({ meta: [{ title: "Workspaces — Legacy Platform" }] }),
  component: WorkspacesPage,
});

function WorkspacesPage() {
  const s = useSnapshot();
  const active = useMemo(() => s?.workspaces.find(w => w.id === s.activeWorkspaceId), [s]);
  if (!s || !active) return <LoadingState />;

  const switchTo = async (id: string) => {
    if (!currentCan("workspace.switch")) { toast.error("Permission denied"); return; }
    const next = { ...s, activeWorkspaceId: id, auditEvents: appendAudit(s.auditEvents, { actor: "current-user", actorRole: getRole(), workspaceId: id, action: "workspace-switch", entityType: "workspace", entityId: id, reason: `switched from ${s.activeWorkspaceId}` }) };
    await Repo.replaceAll(next);
    toast.success(`Switched to ${id}`);
  };

  const downloadExport = (id: string) => {
    const payload = exportWorkspace(s, id);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `workspace-${id}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader title="Workspaces" description="Multi-tenant isolation, branding, and per-workspace settings." />
      <PageBody>
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <KpiCard label="Workspaces" value={s.workspaces.length} />
          <KpiCard label="Active" value={active.name} hint={active.id} tone="gold" />
          <KpiCard label="Isolated" value={s.workspaces.filter(w => w.isolated).length} />
          <KpiCard label="Retention (active)" value={`${active.settings.retentionDays}d`} />
        </div>
        <SectionTitle>Registry</SectionTitle>
        <div className="grid md:grid-cols-2 gap-4">
          {s.workspaces.map(w => {
            const m = workspaceMetrics(s, w.id);
            const isActive = w.id === s.activeWorkspaceId;
            return (
              <div key={w.id} className="editorial-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center size-8 rounded font-serif text-sm" style={{ background: w.branding.primary, color: w.branding.accent }}>{w.branding.logoInitials}</span>
                      <div>
                        <div className="font-serif text-heritage">{w.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{w.id} · {w.slug}</div>
                      </div>
                    </div>
                  </div>
                  {isActive ? <span className="text-xs uppercase tracking-widest text-gold">Active</span> : <Button size="sm" variant="outline" onClick={() => switchTo(w.id)}>Activate</Button>}
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div><div className="text-muted-foreground">Assets</div><div className="font-mono">{m.assets}</div></div>
                  <div><div className="text-muted-foreground">Releases</div><div className="font-mono">{m.releases}</div></div>
                  <div><div className="text-muted-foreground">Runs</div><div className="font-mono">{m.runs}</div></div>
                  <div><div className="text-muted-foreground">Audit</div><div className="font-mono">{m.auditEvents}</div></div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <div className="text-muted-foreground">
                    {w.isolated ? "Isolated" : "Shared"} · default role {w.settings.defaultRole} · {w.settings.requireHumanReview ? "review required" : "review optional"}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => downloadExport(w.id)}>Export</Button>
                </div>
              </div>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}
