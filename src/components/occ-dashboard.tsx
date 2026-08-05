// Operations Command Center — PROVISIONAL read-only dashboard.
//
// Renders the twelve OCC sections (S1–S12). Strictly read-only: no publish,
// rollback, restore, database, baseline-capture, or gate re-attestation
// controls are rendered here.

import { useMemo, useSyncExternalStore } from "react";
import { useSnapshot } from "@/lib/use-snapshot";
import { LoadingState, SectionTitle } from "@/components/ui-kit";
import { useAuthoritativeReadiness } from "@/components/launch-gates-panel";
import { getActor, subscribeActor, isSessionExpired } from "@/lib/data/actor";
import {
  buildOccReport, OCC_PROVISIONAL_LABEL,
  type HardGateInput, type OccPanel, type PanelState, type ReadinessValue,
} from "@/lib/data/occ";

function stateClass(state: PanelState): string {
  switch (state) {
    case "OK": return "text-evergreen border-evergreen/40 bg-evergreen/10";
    case "ATTENTION": return "text-gold border-gold/50 bg-gold/10";
    case "CRITICAL": return "bg-destructive text-destructive-foreground border-destructive";
    case "BLOCKED": return "bg-destructive text-destructive-foreground border-destructive";
    case "STALE": return "text-gold border-gold/50 bg-gold/10";
    default: return "text-muted-foreground border-border bg-muted";
  }
}

function StatePill({ state }: { state: PanelState }) {
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap ${stateClass(state)}`}>
      {state}
    </span>
  );
}

function ReadinessCell({ label, value }: { label: string; value: ReadinessValue }) {
  const cls = value === "YES" ? "text-evergreen" : value === "NO" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="flex items-center justify-between gap-2 border border-border rounded px-2 py-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-[10px] font-semibold ${cls}`}>{value}</span>
    </div>
  );
}

function PanelCard({ panel }: { panel: OccPanel }) {
  return (
    <section className="editorial-card p-4" data-testid={`occ-panel-${panel.id}`} aria-labelledby={`occ-${panel.id}-title`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`occ-${panel.id}-title`} className="font-serif text-base text-heritage">
            <span className="font-mono text-xs text-slate-ink mr-2">{panel.id}</span>{panel.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">{panel.summary}</p>
        </div>
        <span data-testid={`occ-${panel.id}-state`}><StatePill state={panel.state} /></span>
      </div>

      <dl className="mt-3 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
        <div><dt className="inline uppercase tracking-wider">Source class: </dt>
          <dd className="inline font-semibold" data-testid={`occ-${panel.id}-class`}>{panel.sourceClass}</dd></div>
        <div><dt className="inline uppercase tracking-wider">Source data timestamp: </dt>
          <dd className="inline font-mono" data-testid={`occ-${panel.id}-timestamp`}>{panel.sourceTimestamp ?? "UNVERIFIED"}</dd></div>
        <div><dt className="inline uppercase tracking-wider">Report computed at: </dt>
          <dd className="inline font-mono" data-testid={`occ-${panel.id}-computed`}>{panel.computedAt}</dd></div>
        <div><dt className="inline uppercase tracking-wider">Freshness threshold: </dt>
          <dd className="inline">{panel.freshnessHours === null ? "not applicable" : `${panel.freshnessHours} h`}</dd></div>
        <div className="sm:col-span-2"><dt className="inline uppercase tracking-wider">Source: </dt>
          <dd className="inline">{panel.source}</dd></div>
      </dl>


      <div className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        <ReadinessCell label="Component exists" value={panel.readiness.componentExists} />
        <ReadinessCell label="Operational data exists" value={panel.readiness.operationalDataExists} />
        <ReadinessCell label="Data is current" value={panel.readiness.dataIsCurrent} />
        <ReadinessCell label="Data is application-accessible" value={panel.readiness.dataIsApplicationAccessible} />
        <ReadinessCell label="Dashboard integration exists" value={panel.readiness.dashboardIntegrationExists} />
      </div>

      {panel.rows.length > 0 && (
        <ul className="mt-3 divide-y divide-border border-t border-border">
          {panel.rows.map((r, i) => (
            <li
              key={`${panel.id}-${i}`}
              className="py-2 flex flex-wrap items-start justify-between gap-2 text-sm"
              data-testid={`occ-${panel.id}-row-${i}`}
              data-row-label={r.label}
              data-row-state={r.state ?? ""}
            >
              <div className="min-w-0">
                <div className="font-medium break-words">{r.label}</div>
                {r.note && <div className="text-[11px] text-muted-foreground break-words">{r.note}</div>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs break-all">{r.value}</span>
                {r.state && <StatePill state={r.state} />}
              </div>
            </li>
          ))}
        </ul>
      )}

      {panel.notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground list-disc pl-4">
          {panel.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
    </section>
  );
}

export function OperationsCommandCenter() {
  const s = useSnapshot();
  const actor = useSyncExternalStore(subscribeActor, getActor, getActor);
  const authenticated = actor.source !== "anonymous" && !isSessionExpired(actor);
  const workspaceId = s?.activeWorkspaceId ?? "WS-001";
  const readiness = useAuthoritativeReadiness(workspaceId);

  const hardGates: HardGateInput | null = useMemo(() => {
    if (!readiness.data) return null;
    return {
      authoritative: true,
      generatedAt: readiness.data.generatedAt,
      ready: readiness.data.ready,
      gates: readiness.data.gates.map(g => ({
        gateId: g.gateId,
        status: g.status,
        attestedAt: g.current?.attested_at ?? null,
        attestedBy: g.current?.attested_by ?? null,
        stale: g.stale,
        verifierPassed: g.verifier.passed,
        verifierDetail: g.verifier.detail,
        buildFingerprint: g.buildFingerprint,
      })),
    };
  }, [readiness.data]);

  const panels = useMemo(() => (s ? buildOccReport(s, hardGates) : null), [s, hardGates]);

  // No authenticated actor → no OCC content of any kind. Operational status
  // and gate evidence are protected content and must not render anonymously.
  if (!authenticated) {
    return (
      <div
        data-testid="occ-unauthenticated"
        role="status"
        className="editorial-card border-border p-4 text-sm text-muted-foreground"
      >
        Sign in to view operational status. This content is unavailable without an authenticated session.
      </div>
    );
  }

  if (!s || !panels) return <LoadingState label="Loading Operations Command Center…" />;

  return (
    <div data-testid="occ-dashboard">
      <div
        role="status"
        data-testid="occ-provisional-banner"
        className="editorial-card border-gold/60 bg-gold/10 p-3 mb-4 text-xs font-semibold uppercase tracking-widest text-heritage"
      >
        {OCC_PROVISIONAL_LABEL}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Read-only. OCC v1.0.1 remains REVIEWED, NOT ACCEPTED; OCC v1.0.2 is pending external authoring and
        Owner acceptance. Production release activity remains BLOCKED. No publish, rollback, restore, database,
        baseline-capture, or gate re-attestation controls are available on this dashboard.
      </p>
      <SectionTitle hint={`${panels.length} sections`}>Operations Command Center</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        {panels.map(p => <PanelCard key={p.id} panel={p} />)}
      </div>
    </div>
  );
}
