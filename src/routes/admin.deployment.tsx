import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, KpiCard, SectionTitle } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { startupDiagnostics, releaseCandidateReadiness, maintenanceGate } from "@/lib/data/deployment";
import { appendAudit } from "@/lib/data/audit";
import { getRole, currentCan, setRole, permissionsFor } from "@/lib/data/auth";
import { ALL_ROLES, type Role } from "@/lib/data/schema";

export const Route = createFileRoute("/admin/deployment")({
  head: () => ({ meta: [{ title: "Deployment Readiness — Legacy Platform" }] }),
  component: DeploymentPage,
});

function DeploymentPage() {
  const s = useSnapshot();
  const env = typeof import.meta !== "undefined" ? (import.meta as unknown as { env: Record<string, string | undefined> }).env : {};
  const diags = useMemo(() => (s ? startupDiagnostics(env, s) : []), [s, env]);
  const rc = useMemo(() => (s ? releaseCandidateReadiness(env, s) : null), [s, env]);
  const gate = useMemo(() => (s ? maintenanceGate(s, getRole()) : { allowed: true, reason: "" }), [s]);
  if (!s || !rc) return <LoadingState />;

  const toggleMaintenance = async () => {
    if (!currentCan("maintenance.manage")) { toast.error("Permission denied"); return; }
    const next = !s.maintenanceMode.enabled;
    const mm = { ...s.maintenanceMode, enabled: next, reason: next ? "Manual toggle" : "", since: next ? new Date().toISOString() : null, by: "current-user" };
    const audit = appendAudit(s.auditEvents, { actor: "current-user", actorRole: getRole(), workspaceId: s.activeWorkspaceId, action: "maintenance-mode-change", entityType: "system", entityId: "maintenance", reason: next ? "enabled" : "disabled", before: { enabled: s.maintenanceMode.enabled }, after: { enabled: next } });
    await Repo.replaceAll({ ...s, maintenanceMode: mm, auditEvents: audit });
    toast.success(next ? "Maintenance mode ON" : "Maintenance mode OFF");
  };

  const toggleFlag = async (key: string) => {
    if (!currentCan("featureflag.manage")) { toast.error("Permission denied"); return; }
    const flags = s.featureFlags.map(f => f.key === key ? { ...f, enabled: !f.enabled, updatedAt: new Date().toISOString() } : f);
    const audit = appendAudit(s.auditEvents, { actor: "current-user", actorRole: getRole(), workspaceId: s.activeWorkspaceId, action: "feature-flag-change", entityType: "featureFlag", entityId: key, reason: "toggle" });
    await Repo.replaceAll({ ...s, featureFlags: flags, auditEvents: audit });
  };

  const rcTone = rc.state === "ready" ? "evergreen" : rc.state === "conditional" ? "gold" : "warn";

  return (
    <>
      <PageHeader title="Deployment Readiness" description="Startup diagnostics · feature flags · maintenance mode · RC1 report." />
      <PageBody>
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <KpiCard label="RC1 State" value={rc.state.toUpperCase()} tone={rcTone} hint={`score ${rc.score}`} />
          <KpiCard label="Blockers" value={rc.blockers.length} tone={rc.blockers.length ? "warn" : "evergreen"} />
          <KpiCard label="Warnings" value={rc.warnings.length} tone={rc.warnings.length ? "gold" : "evergreen"} />
          <KpiCard label="Maintenance" value={s.maintenanceMode.enabled ? "ON" : "OFF"} tone={s.maintenanceMode.enabled ? "warn" : "evergreen"} />
        </div>

        {!gate.allowed && (
          <div className="editorial-card p-4 border-destructive/40 mb-6">
            <div className="text-sm text-destructive">Maintenance gate: {gate.reason}</div>
          </div>
        )}

        <SectionTitle>Startup diagnostics</SectionTitle>
        <div className="editorial-card divide-y divide-border mb-6 text-sm">
          {diags.map(d => (
            <div key={d.name} className="p-3 flex items-center justify-between">
              <div className="font-medium">{d.name}</div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs">{d.detail}</span>
                <span className={d.ok ? "text-evergreen text-xs uppercase tracking-widest" : "text-destructive text-xs uppercase tracking-widest"}>{d.ok ? "ok" : "fail"}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <SectionTitle>Feature flags</SectionTitle>
            <div className="editorial-card divide-y divide-border text-sm">
              {s.featureFlags.map(f => (
                <div key={f.id} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{f.key}</div>
                    <div className="text-xs text-muted-foreground">{f.description} · {f.audience}</div>
                  </div>
                  <Button size="sm" variant={f.enabled ? "default" : "outline"} onClick={() => toggleFlag(f.key)}>{f.enabled ? "On" : "Off"}</Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionTitle>Maintenance & role</SectionTitle>
            <div className="editorial-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Maintenance mode</div>
                  <div className="text-xs text-muted-foreground">Allow roles: {s.maintenanceMode.allowRoles.join(", ")}</div>
                </div>
                <Button size="sm" onClick={toggleMaintenance}>{s.maintenanceMode.enabled ? "Disable" : "Enable"}</Button>
              </div>
              <div className="pt-3 border-t border-border">
                <div className="text-sm font-medium mb-2">Current role (demo)</div>
                <select
                  value={getRole()}
                  onChange={e => { setRole(e.target.value as typeof ALL_ROLES[number]); toast.success(`Role set to ${e.target.value}`); }}
                  className="border border-border rounded px-2 py-1 text-sm bg-background w-full"
                >
                  {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <div className="text-xs text-muted-foreground mt-2">Permissions: {permissionsFor(getRole()).length}</div>
              </div>
            </div>
          </div>
        </div>

        <SectionTitle hint={`state: ${rc.state}`}>Release Candidate 1 report</SectionTitle>
        <div className="editorial-card p-4 text-sm space-y-2">
          <div><span className="text-muted-foreground">Score:</span> <span className="font-mono">{rc.score}/100</span></div>
          <div><span className="text-muted-foreground">Monitoring:</span> {rc.monitoring}</div>
          {rc.blockers.length > 0 && (
            <div>
              <div className="uppercase text-xs tracking-widest text-destructive mt-2 mb-1">Blockers</div>
              <ul className="list-disc pl-5 space-y-0.5">{rc.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </div>
          )}
          {rc.warnings.length > 0 && (
            <div>
              <div className="uppercase text-xs tracking-widest text-gold mt-2 mb-1">Warnings</div>
              <ul className="list-disc pl-5 space-y-0.5">{rc.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}
          {rc.state === "ready" && <div className="text-evergreen mt-2">✓ Recommended for RC1 promotion.</div>}
        </div>
      </PageBody>
    </>
  );
}
