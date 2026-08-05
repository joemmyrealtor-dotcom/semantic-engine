// Operations Command Center — PROVISIONAL implementation (Phase 2).
//
// Governance: OCC v1.0.1 is REVIEWED, NOT ACCEPTED. OCC v1.0.2 is pending
// external authoring and Owner acceptance. This module is a temporary
// implementation reference only and neither accepts, replaces, nor amends
// either specification.
//
// Data integrity rules enforced here:
//  - Only existing, application-accessible data is read.
//  - Nothing is invented, seeded, simulated, or inferred as a PASS.
//  - Absent trustworthy data renders UNVERIFIED.
//  - Proposed data sources render NOT IMPLEMENTED.
//  - Data older than its freshness threshold renders STALE.
//  - Production DB restore / infra recovery stay UNVERIFIED; production
//    RPO / RTO / rollback stay NOT ESTABLISHED.

import type { DataSnapshot } from "./schema";
import { computeMonitoring } from "./monitoring";
import { verifyAuditChain } from "./audit";
import { buildDisasterRecoveryPlan } from "./backups";
import { detectWorkspaceLeakage } from "./workspaces";

export const OCC_PROVISIONAL_LABEL =
  "PROVISIONAL IMPLEMENTATION. OCC v1.0.2 acceptance pending.";

export type SourceClass = "EXISTING" | "PROPOSED" | "UNVERIFIED";
export type PanelState =
  | "OK" | "ATTENTION" | "CRITICAL"
  | "UNVERIFIED" | "NOT IMPLEMENTED" | "STALE" | "NOT ESTABLISHED" | "BLOCKED";
export type ReadinessValue = "YES" | "NO" | "UNVERIFIED";

export interface PanelReadiness {
  componentExists: ReadinessValue;
  operationalDataExists: ReadinessValue;
  dataIsCurrent: ReadinessValue;
  dataIsApplicationAccessible: ReadinessValue;
  dashboardIntegrationExists: ReadinessValue;
}

export interface PanelRow {
  label: string;
  value: string;
  state?: PanelState;
  note?: string;
}

export interface OccPanel {
  id: string;                       // S1 … S12
  title: string;
  state: PanelState;
  summary: string;
  source: string;                   // human-readable source description
  sourceClass: SourceClass;
  /**
   * Timestamp of the underlying SOURCE DATA. Null when no trustworthy source
   * timestamp exists — a report-computation time is never substituted here.
   */
  sourceTimestamp: string | null;
  /** Timestamp at which this report was computed. Never proof of freshness. */
  computedAt: string;
  freshnessHours: number | null;    // defined threshold, null = not applicable
  readiness: PanelReadiness;
  rows: PanelRow[];
  notes: string[];
}

/** Panel states that block an aggregate roll-up from reporting OK. */
export const BLOCKING_STATES: PanelState[] = [
  "BLOCKED", "CRITICAL", "NOT IMPLEMENTED", "NOT ESTABLISHED", "UNVERIFIED",
];


const READINESS_NONE: PanelReadiness = {
  componentExists: "NO",
  operationalDataExists: "NO",
  dataIsCurrent: "NO",
  dataIsApplicationAccessible: "NO",
  dashboardIntegrationExists: "NO",
};

function isStale(iso: string | null, hours: number | null): boolean {
  if (!iso || hours === null) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > hours * 3_600_000;
}

function latestIso(list: (string | undefined | null)[]): string | null {
  const times = list.filter(Boolean) as string[];
  if (!times.length) return null;
  return times.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b));
}

/** Hard-gate input, supplied by the caller from the authoritative server read. */
export interface HardGateInput {
  authoritative: boolean;
  generatedAt: string | null;
  ready: boolean;
  gates: {
    gateId: string;
    status: string;
    attestedAt: string | null;
    attestedBy: string | null;
    stale: boolean;
    verifierPassed: boolean;
    verifierDetail: string;
    buildFingerprint: string;
  }[];
}

type DraftPanel = Omit<OccPanel, "computedAt">;

export function buildOccReport(
  snap: DataSnapshot,
  hardGates: HardGateInput | null,
): OccPanel[] {
  const panels: DraftPanel[] = [];
  const monitoring = computeMonitoring(snap);
  const now = new Date().toISOString();

  // S1 is built LAST (see below) as a true roll-up of S2–S12.


  // ---------- S2 Production gate status G1–G11 ----------
  {
    const ids = Array.from({ length: 11 }, (_, i) => `G${i + 1}`);
    panels.push({
      id: "S2",
      title: "Production gate status G1–G11",
      state: "NOT IMPLEMENTED",
      summary: "No application-accessible G1–G11 gate registry exists. Specification source is pending OCC v1.0.2 / PRS v1.0.3.",
      source: "PROPOSED — production release gate registry (not implemented)",
      sourceClass: "PROPOSED",
      sourceTimestamp: null,
      freshnessHours: null,
      readiness: READINESS_NONE,
      rows: ids.map(id => ({
        label: id,
        value: "NOT IMPLEMENTED",
        state: "NOT IMPLEMENTED",
        note: id === "G11" ? "Security gate G11 (SECURITY DEFINER execute grants) — CI enforcement NOT VERIFIED" : undefined,
      })),
      notes: [
        "No PASS value is inferred for any G-gate.",
        "Release Standard controls are not accepted governance; G-gate definitions remain external.",
      ],
    });
  }

  // ---------- S3 Hard gates H1–H4 ----------
  {
    const hg = hardGates;
    const ts = hg?.generatedAt ?? null;
    const stale = isStale(ts, 1);
    let state: PanelState = "UNVERIFIED";
    if (hg?.authoritative) {
      state = stale ? "STALE"
        : hg.gates.some(g => g.status === "STALE") ? "STALE"
        : hg.ready ? "OK" : "ATTENTION";
    }
    panels.push({
      id: "S3",
      title: "Hard gates H1–H4",
      state,
      summary: hg?.authoritative
        ? `${hg.gates.filter(g => g.status === "PASS").length}/4 PASS · production GO ${hg.ready ? "UNLOCKED" : "LOCKED"}`
        : "Authoritative server readiness unavailable — hard-gate state UNVERIFIED.",
      source: "computeReadinessServer (server-authoritative launch gate evidence)",
      sourceClass: hg?.authoritative ? "EXISTING" : "UNVERIFIED",
      sourceTimestamp: ts,
      freshnessHours: 1,
      readiness: {
        componentExists: "YES",
        operationalDataExists: hg?.authoritative ? "YES" : "UNVERIFIED",
        dataIsCurrent: hg?.authoritative ? (stale ? "NO" : "YES") : "UNVERIFIED",
        dataIsApplicationAccessible: hg?.authoritative ? "YES" : "UNVERIFIED",
        dashboardIntegrationExists: "YES",
      },
      rows: (hg?.gates.length ? hg.gates : ["H1", "H2", "H3", "H4"].map(id => ({
        gateId: id, status: "UNVERIFIED", attestedAt: null, attestedBy: null,
        stale: false, verifierPassed: false, verifierDetail: "Server verifier not reachable",
        buildFingerprint: "unknown",
      }))).map(g => ({
        label: g.gateId,
        value: hg?.authoritative ? g.status : "UNVERIFIED",
        state: !hg?.authoritative ? "UNVERIFIED"
          : g.status === "PASS" ? "OK"
          : g.status === "STALE" ? "STALE"
          : g.status === "FAIL" ? "CRITICAL" : "ATTENTION",
        note: `${g.verifierDetail}${g.attestedAt ? ` · attested ${g.attestedAt} by ${g.attestedBy ?? "—"}` : ""} · fingerprint ${g.buildFingerprint}`,
      })),
      notes: [
        "Read-only view. Attestation controls are intentionally absent from this dashboard.",
      ],
    });
  }

  // ---------- S4 Release readiness ----------
  {
    const releases = [...(snap.releases ?? [])].sort(
      (a, b) => Date.parse(b.updatedAt ?? b.createdAt) - Date.parse(a.updatedAt ?? a.createdAt),
    );
    const latest = releases[0] ?? null;
    const ts = latest ? (latest.updatedAt ?? latest.createdAt) : null;
    const stale = isStale(ts, 24 * 30);
    const failing = latest ? latest.gateChecklist.filter(g => !g.passed) : [];
    const state: PanelState = !latest ? "UNVERIFIED"
      : stale ? "STALE"
      : failing.length || latest.blockingErrors > 0 ? "ATTENTION" : "OK";
    panels.push({
      id: "S4",
      title: "Release readiness",
      state,
      summary: latest
        ? `${latest.id} · stage ${latest.stage} · ${latest.blockingErrors} blocking · ${latest.alignmentWarnings} warnings`
        : "No release record available — release readiness UNVERIFIED.",
      source: "snapshot.releases (application data layer)",
      sourceClass: latest ? "EXISTING" : "UNVERIFIED",
      sourceTimestamp: ts,
      freshnessHours: 24 * 30,
      readiness: {
        componentExists: "YES",
        operationalDataExists: latest ? "YES" : "NO",
        dataIsCurrent: latest ? (stale ? "NO" : "YES") : "UNVERIFIED",
        dataIsApplicationAccessible: "YES",
        dashboardIntegrationExists: "YES",
      },
      rows: [
        ...(latest?.gateChecklist ?? []).map(g => ({
          label: `${g.id} ${g.label}`,
          value: g.passed ? "PASSED" : "OPEN",
          state: (g.passed ? "OK" : "ATTENTION") as PanelState,
        })),
        { label: "Production release activity", value: "BLOCKED", state: "CRITICAL" as PanelState,
          note: "Release activity remains blocked pending accepted governance documents." },
      ],
      notes: ["Release-record gate checklist is application data, not the production G1–G11 registry (see S2)."],
    });
  }

  // ---------- S5 Backup and recovery status ----------
  {
    const dr = buildDisasterRecoveryPlan(snap);
    const ts = dr.latestBackup?.createdAt ?? null;
    const stale = isStale(ts, 24 * 7);
    const state: PanelState = !dr.latestBackup ? "UNVERIFIED" : stale ? "STALE" : "ATTENTION";
    panels.push({
      id: "S5",
      title: "Backup and recovery status",
      state,
      summary: dr.latestBackup
        ? `Application-drill scope only · ${dr.backupCount} snapshot(s) · latest ${dr.latestBackup.createdAt.slice(0, 10)}`
        : "No application-drill backup snapshot available.",
      source: "snapshot.backups (application-drill scope) — production scopes not application-accessible",
      sourceClass: "EXISTING",
      sourceTimestamp: ts,
      freshnessHours: 24 * 7,
      readiness: {
        componentExists: "YES",
        operationalDataExists: dr.latestBackup ? "YES" : "NO",
        dataIsCurrent: dr.latestBackup ? (stale ? "NO" : "YES") : "UNVERIFIED",
        dataIsApplicationAccessible: "YES",
        dashboardIntegrationExists: "YES",
      },
      rows: [
        { label: "Application-drill backups", value: `${dr.backupCount}`, state: dr.backupCount ? "OK" : "UNVERIFIED" },
        { label: "Application-drill latest snapshot", value: dr.latestBackup?.id ?? "—", state: dr.latestBackup ? "OK" : "UNVERIFIED",
          note: dr.latestBackup ? `hash ${dr.latestBackup.hash.slice(0, 16)}… · ${dr.latestBackup.entityCount} entities` : undefined },
        { label: "Production database restore", value: "UNVERIFIED", state: "UNVERIFIED" },
        { label: "Production infrastructure recovery", value: "UNVERIFIED", state: "UNVERIFIED" },
        { label: "Production RPO", value: "NOT ESTABLISHED", state: "NOT ESTABLISHED" },
        { label: "Production RTO", value: "NOT ESTABLISHED", state: "NOT ESTABLISHED" },
        { label: "Production rollback capability", value: "NOT ESTABLISHED", state: "NOT ESTABLISHED" },
      ],
      notes: [
        "Application-drill evidence is strictly separated from production backup and recovery evidence.",
        "No restore, rollback, or baseline-capture control is exposed here.",
      ],
    });
  }

  // ---------- S6 Monitoring alerts ----------
  {
    const alerting = monitoring.signals.filter(s => s.state !== "ok");
    const execAlerts = snap.executiveAlerts ?? [];
    const ts = monitoring.generatedAt;
    const state: PanelState = isStale(ts, 1) ? "STALE"
      : alerting.some(a => a.state === "critical") ? "CRITICAL"
      : alerting.length ? "ATTENTION" : "OK";
    panels.push({
      id: "S6",
      title: "Monitoring alerts",
      state,
      summary: `${alerting.length} monitoring signal(s) non-nominal · ${execAlerts.length} executive alert rule(s)`,
      source: "computeMonitoring(snapshot) + snapshot.executiveAlerts",
      sourceClass: "EXISTING",
      sourceTimestamp: ts,
      freshnessHours: 1,
      readiness: {
        componentExists: "YES",
        operationalDataExists: "YES",
        dataIsCurrent: isStale(ts, 1) ? "NO" : "YES",
        dataIsApplicationAccessible: "YES",
        dashboardIntegrationExists: "YES",
      },
      rows: alerting.length
        ? alerting.map(a => ({ label: a.name, value: a.value, state: (a.state === "critical" ? "CRITICAL" : "ATTENTION") as PanelState, note: a.note }))
        : [{ label: "Active alerts", value: "none", state: "OK" as PanelState }],
      notes: ["Application-layer signals only. External production alerting is not application-accessible."],
    });
  }

  // ---------- S7 Audit-chain status ----------
  {
    const events = snap.auditEvents ?? [];
    const chain = verifyAuditChain(events);
    const ts = latestIso(events.map(e => e.at));
    const stale = isStale(ts, 24 * 7);
    const state: PanelState = !events.length ? "UNVERIFIED" : !chain.ok ? "CRITICAL" : stale ? "STALE" : "OK";
    panels.push({
      id: "S7",
      title: "Audit-chain status",
      state,
      summary: events.length
        ? (chain.ok ? `${chain.count} events hash-verified` : `Chain broken at ${chain.brokenAt}`)
        : "No audit events available — chain integrity UNVERIFIED.",
      source: "verifyAuditChain(snapshot.auditEvents)",
      sourceClass: events.length ? "EXISTING" : "UNVERIFIED",
      sourceTimestamp: ts,
      freshnessHours: 24 * 7,
      readiness: {
        componentExists: "YES",
        operationalDataExists: events.length ? "YES" : "NO",
        dataIsCurrent: events.length ? (stale ? "NO" : "YES") : "UNVERIFIED",
        dataIsApplicationAccessible: "YES",
        dashboardIntegrationExists: "YES",
      },
      rows: [
        { label: "Events verified", value: `${chain.count}`, state: chain.ok ? "OK" : "CRITICAL" },
        { label: "Chain integrity", value: chain.ok ? "intact" : `broken at ${chain.brokenAt}`, state: chain.ok ? "OK" : "CRITICAL" },
      ],
      notes: ["Local application audit ledger. Server-side audit_events table is not read by this panel."],
    });
  }

  // ---------- S8 Workspace-isolation status ----------
  {
    const leak = detectWorkspaceLeakage(snap);
    const state: PanelState = leak.ok ? "OK" : "ATTENTION";
    panels.push({
      id: "S8",
      title: "Workspace-isolation status",
      state,
      summary: leak.ok
        ? `${(snap.workspaces ?? []).length} workspace(s) · no orphaned or unscoped rows`
        : `${leak.unscopedEntities.length} unscoped · ${leak.crossWorkspaceEntities.length} foreign-scoped rows`,
      source: "detectWorkspaceLeakage(snapshot)",
      sourceClass: "EXISTING",
      sourceTimestamp: now,
      freshnessHours: 1,
      readiness: {
        componentExists: "YES",
        operationalDataExists: "YES",
        dataIsCurrent: "YES",
        dataIsApplicationAccessible: "YES",
        dashboardIntegrationExists: "YES",
      },
      rows: [
        { label: "Orphaned audit rows", value: `${leak.orphanedAuditIds.length}`, state: leak.orphanedAuditIds.length ? "ATTENTION" : "OK" },
        { label: "Orphaned backup rows", value: `${leak.orphanedBackupIds.length}`, state: leak.orphanedBackupIds.length ? "ATTENTION" : "OK" },
        { label: "Unscoped entities", value: `${leak.unscopedEntities.length}`, state: leak.unscopedEntities.length ? "ATTENTION" : "OK" },
        { label: "Cross-workspace entities", value: `${leak.crossWorkspaceEntities.length}`, state: leak.crossWorkspaceEntities.length ? "ATTENTION" : "OK" },
      ],
      notes: ["Application-layer isolation only. Database RLS isolation is verified separately and is not read here."],
    });
  }

  // ---------- S9 Open incidents ----------
  {
    panels.push({
      id: "S9",
      title: "Open incidents",
      state: "NOT IMPLEMENTED",
      summary: "No incident registry exists in the application data layer.",
      source: "PROPOSED — incident registry (not implemented)",
      sourceClass: "PROPOSED",
      sourceTimestamp: null,
      freshnessHours: null,
      readiness: READINESS_NONE,
      rows: [{ label: "Incident registry", value: "NOT IMPLEMENTED", state: "NOT IMPLEMENTED" }],
      notes: ["No incident state is inferred from monitoring signals; see S6 for signal-level alerts."],
    });
  }

  // ---------- S10 Residual risks ----------
  {
    panels.push({
      id: "S10",
      title: "Residual risks",
      state: "NOT IMPLEMENTED",
      summary: "No application-accessible residual-risk register exists. Risk classification is held in external governance artifacts.",
      source: "PROPOSED — residual risk register (not implemented)",
      sourceClass: "PROPOSED",
      sourceTimestamp: null,
      freshnessHours: null,
      readiness: READINESS_NONE,
      rows: [
        { label: "Residual risk register", value: "NOT IMPLEMENTED", state: "NOT IMPLEMENTED" },
        { label: "Production recovery risk", value: "UNVERIFIED", state: "UNVERIFIED", note: "Carried forward from DR drill scope limitation." },
        { label: "CI enforcement of SECURITY DEFINER grants", value: "UNVERIFIED", state: "UNVERIFIED", note: "Local guard accepted; GitHub Actions enforcement not verified." },
      ],
      notes: ["Risk items shown are limitations carried forward, not an accepted register."],
    });
  }

  // ---------- S11 Owner approvals ----------
  {
    panels.push({
      id: "S11",
      title: "Owner approvals",
      state: "NOT IMPLEMENTED",
      summary: "No application-accessible Owner approval register exists. Owner decisions are recorded in external governance artifacts.",
      source: "PROPOSED — Owner approval register (not implemented)",
      sourceClass: "PROPOSED",
      sourceTimestamp: null,
      freshnessHours: null,
      readiness: READINESS_NONE,
      rows: [
        { label: "Owner approval register", value: "NOT IMPLEMENTED", state: "NOT IMPLEMENTED" },
        { label: "OCC v1.0.1", value: "REVIEWED, NOT ACCEPTED", state: "UNVERIFIED" },
        { label: "OCC v1.0.2", value: "PENDING EXTERNAL AUTHORING", state: "UNVERIFIED" },
      ],
      notes: ["Displayed governance states are labels only and confer no acceptance."],
    });
  }

  // ---------- S12 Evidence records ----------
  {
    const evidence = snap.launchGateEvidence ?? [];
    const ts = latestIso(evidence.map(e => e.attestedAt));
    const stale = isStale(ts, 24 * 30);
    const state: PanelState = !evidence.length ? "UNVERIFIED" : stale ? "STALE" : "OK";
    panels.push({
      id: "S12",
      title: "Evidence records",
      state,
      summary: evidence.length
        ? `${evidence.length} local launch-gate evidence row(s) · ${(snap.backups ?? []).length} application-drill snapshot(s)`
        : "No application-accessible evidence rows.",
      source: "snapshot.launchGateEvidence + snapshot.backups (local diagnostic copies)",
      sourceClass: evidence.length ? "EXISTING" : "UNVERIFIED",
      sourceTimestamp: ts,
      freshnessHours: 24 * 30,
      readiness: {
        componentExists: "YES",
        operationalDataExists: evidence.length ? "YES" : "NO",
        dataIsCurrent: evidence.length ? (stale ? "NO" : "YES") : "UNVERIFIED",
        dataIsApplicationAccessible: "YES",
        dashboardIntegrationExists: "YES",
      },
      rows: [
        ...evidence
          .slice()
          .sort((a, b) => Date.parse(b.attestedAt) - Date.parse(a.attestedAt))
          .slice(0, 8)
          .map(e => ({
            label: `${e.gateId} v${e.version}`,
            value: e.status,
            state: (e.status === "PASS" ? "OK" : "ATTENTION") as PanelState,
            note: `${e.attestedAt} · ${e.attestedBy} · fingerprint ${e.buildFingerprint}`,
          })),
        { label: "Production recovery evidence", value: "UNVERIFIED", state: "UNVERIFIED",
          note: "Separate from application-drill evidence above." },
      ],
      notes: ["Local diagnostic copies. Server-side evidence remains authoritative for hard gates (S3)."],
    });
  }

  return panels;
}
