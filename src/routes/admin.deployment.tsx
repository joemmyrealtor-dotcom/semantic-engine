import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, KpiCard, SectionTitle } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { startupDiagnostics, releaseCandidateReadiness, maintenanceGate } from "@/lib/data/deployment";
import { getRole, setRole, permissionsFor, currentCan } from "@/lib/data/auth";
import { ALL_ROLES, type Role, type DataSnapshot, type LaunchGateId } from "@/lib/data/schema";
import { RequirePermission } from "@/components/require-permission";
import { isDevRuntime, getActor } from "@/lib/data/actor";
import {
  HARD_GATE_IDS, LAUNCH_GATE_DEFINITIONS, computeGateState, buildAttestation, applyAttestation,
} from "@/lib/data/launch-gates";

export const Route = createFileRoute("/admin/deployment")({
  head: () => ({ meta: [{ title: "Deployment Readiness — Legacy Platform" }] }),
  component: () => (
    <RequirePermission permission="maintenance.manage" label="Deployment Readiness">
      <DeploymentPage />
    </RequirePermission>
  ),
});

function DeploymentPage() {
  const s = useSnapshot();
  const env = typeof import.meta !== "undefined" ? (import.meta as unknown as { env: Record<string, string | undefined> }).env : {};
  const diags = useMemo(() => (s ? startupDiagnostics(env, s) : []), [s, env]);
  const rc = useMemo(() => (s ? releaseCandidateReadiness(env, s) : null), [s, env]);
  const gate = useMemo(() => (s ? maintenanceGate(s, getRole()) : { allowed: true, reason: "" }), [s]);
  if (!s || !rc) return <LoadingState />;

  const toggleMaintenance = async () => {
    const next = !s.maintenanceMode.enabled;
    const who = getActor();
    try {
      await Repo.auditedTransaction(
        {
          permission: "maintenance.manage", action: "maintenance-mode-change",
          entityType: "system", entityId: "maintenance",
          reason: next ? "enabled" : "disabled",
          before: { enabled: s.maintenanceMode.enabled },
          after: { enabled: next },
        },
        s0 => ({ ...s0, maintenanceMode: { ...s0.maintenanceMode, enabled: next, reason: next ? "Manual toggle" : "", since: next ? new Date().toISOString() : null, by: who.userId } }),
      );
      toast.success(next ? "Maintenance mode ON" : "Maintenance mode OFF");
    } catch (e) { toast.error((e as Error).message); }
  };

  const toggleFlag = async (key: string) => {
    try {
      await Repo.auditedTransaction(
        { permission: "featureflag.manage", action: "feature-flag-change", entityType: "featureFlag", entityId: key, reason: "toggle" },
        s0 => ({ ...s0, featureFlags: s0.featureFlags.map(f => f.key === key ? { ...f, enabled: !f.enabled, updatedAt: new Date().toISOString() } : f) }),
      );
    } catch (e) { toast.error((e as Error).message); }
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
              {isDevRuntime() ? (
                <div className="pt-3 border-t border-border">
                  <div className="text-sm font-medium mb-2 flex items-center gap-2">
                    Current role
                    <span className="text-[10px] uppercase tracking-widest rounded bg-gold/20 text-gold px-1.5 py-0.5">Dev only</span>
                  </div>
                  <select
                    value={getRole()}
                    onChange={e => { setRole(e.target.value as Role); toast.success(`Role set to ${e.target.value}`); }}
                    className="border border-border rounded px-2 py-1 text-sm bg-background w-full"
                    aria-label="Development role selector"
                  >
                    {ALL_ROLES.map((r: Role) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <div className="text-xs text-muted-foreground mt-2">Permissions: {permissionsFor(getRole()).length} · shown only in development builds.</div>
                </div>
              ) : (
                <div className="pt-3 border-t border-border">
                  <div className="text-sm font-medium">Current role</div>
                  <div className="text-xs text-muted-foreground mt-1">{getActor().displayLabel} · <span className="font-mono">{getRole()}</span> · {permissionsFor(getRole()).length} permissions</div>
                  <div className="text-xs text-muted-foreground mt-1">Role assignment is managed through workspace memberships.</div>
                </div>
              )}
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

        <SectionTitle hint="docs/RC1-GATES.json">RC-1 entry gates</SectionTitle>
        <div className="editorial-card divide-y divide-border text-sm">
          {[
            { id: "G1", name: "Migrations applied (5/5, 19 tables, 60 policies)", status: "PASS" },
            { id: "G2", name: "Database linter — 0 actionable (6 intentional SECURITY DEFINER)", status: "PASS" },
            { id: "G3", name: "Rate-limit adapter fail-closed", status: "PASS" },
            { id: "G4", name: "Google OAuth provider enabled", status: "BLOCKED-OPERATOR" },
            { id: "G5", name: "Seed/demo API bearer rotation", status: "BLOCKED-OPERATOR" },
            { id: "G6", name: "Pre-RC baseline backup + monitoring green", status: "BLOCKED-OPERATOR" },
          ].map(g => (
            <div key={g.id} className="p-3 flex items-center justify-between">
              <div><span className="font-mono text-xs text-muted-foreground mr-2">{g.id}</span>{g.name}</div>
              <span className={`text-xs uppercase tracking-widest ${g.status === "PASS" ? "text-evergreen" : "text-gold"}`}>{g.status}</span>
            </div>
          ))}
        </div>

        <SectionTitle hint="docs/LAUNCH-CLOSURE.md">Launch-closure — hard gates</SectionTitle>
        <HardGatesPanel />
      </PageBody>
    </>
  );
}

type HardGateStatus = "PASS" | "BLOCKED-OPERATOR" | "FAIL";
interface HardGate {
  id: string; owner: string; name: string; status: HardGateStatus;
  evidence: string; timestamp: string | null; blockingReason: string | null;
}

const HARD_GATES: HardGate[] = [
  {
    id: "H1", owner: "Platform Ops",
    name: "RATE_LIMIT_ADAPTER=supabase set in production env",
    status: "BLOCKED-OPERATOR",
    evidence: "PASS requires: startupDiagnostics rate-limit row shows OK in prod env AND `env | grep RATE_LIMIT_ADAPTER` returns `supabase` on the production runtime.",
    timestamp: null,
    blockingReason: "No production env attestation captured. Rehearsal only — set env var and re-attest at cutover.",
  },
  {
    id: "H2", owner: "Auth Owner",
    name: "Google OAuth enabled + callback verified",
    status: "BLOCKED-OPERATOR",
    evidence: "PASS requires: Google provider toggled ON in Cloud Auth Settings AND a successful end-to-end sign-in from the published URL (screenshot or session row in auth.users with provider='google').",
    timestamp: null,
    blockingReason: "Provider not toggled and callback not verified in this environment.",
  },
  {
    id: "H3", owner: "API Owner",
    name: "APIC-001 disabled/deleted + fresh API clients provisioned as runtime secrets",
    status: "BLOCKED-OPERATOR",
    evidence: "PASS requires: APIC-001 row soft-deleted or disabled AND ≥1 new APIClient row exists AND its bearer stored in Project Settings → Secrets (never in code/commits).",
    timestamp: null,
    blockingReason: "Demo bearer still present; no production APIClient rows issued.",
  },
  {
    id: "H4", owner: "Data Ops",
    name: "pre-rc1-baseline backup captured + integrity verified + monitoring green",
    status: "BLOCKED-OPERATOR",
    evidence: "PASS requires: performBackup() returns BKP id AND verifyBackupIntegrity() returns matching SHA-256 hash AND /admin/monitoring shows all diagnostics green at the same timestamp.",
    timestamp: null,
    blockingReason: "No baseline BKP row present in workspace.",
  },
];

function HardGatesPanel() {
  const allPass = HARD_GATES.every(g => g.status === "PASS");
  return (
    <>
      <div className="editorial-card p-4 text-sm mb-4">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
          Production GO:{" "}
          <span className={allPass ? "text-evergreen" : "text-destructive"}>
            {allPass ? "UNLOCKED" : "LOCKED — hard gates open"}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          Production cutover is blocked while any hard gate below is not PASS. This is enforced by policy, not by a togglable flag.
        </div>
      </div>
      <div className="editorial-card divide-y divide-border text-sm">
        {HARD_GATES.map(g => (
          <div key={g.id} className="p-3">
            <div className="flex items-center justify-between mb-1">
              <div>
                <span className="font-mono text-xs text-muted-foreground mr-2">{g.id}</span>
                <span className="font-medium">{g.name}</span>
                <span className="text-xs text-muted-foreground ml-2">· {g.owner}</span>
              </div>
              <span
                className={`text-xs uppercase tracking-widest ${
                  g.status === "PASS" ? "text-evergreen" : g.status === "FAIL" ? "text-destructive" : "text-gold"
                }`}
              >
                {g.status}
              </span>
            </div>
            <div className="text-xs text-muted-foreground pl-6">
              <div><span className="uppercase tracking-widest text-[10px] mr-1">Evidence:</span>{g.evidence}</div>
              <div className="mt-1"><span className="uppercase tracking-widest text-[10px] mr-1">Timestamp:</span>{g.timestamp ?? "—"}</div>
              {g.blockingReason && (
                <div className="mt-1 text-destructive/80"><span className="uppercase tracking-widest text-[10px] mr-1">Blocking:</span>{g.blockingReason}</div>
              )}
            </div>
          </div>
        ))}
        <div className="p-3">
          <Button size="sm" variant="outline" disabled aria-disabled title="Locked while any hard gate is not PASS">
            Promote to production {allPass ? "" : "(locked)"}
          </Button>
        </div>
      </div>
    </>
  );
}

