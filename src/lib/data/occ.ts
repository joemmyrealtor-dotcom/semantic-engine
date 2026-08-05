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

/** Severity ordering used to escalate a panel to its worst blocking row. */
const STATE_SEVERITY: Record<PanelState, number> = {
  OK: 0,
  ATTENTION: 1,
  STALE: 2,
  UNVERIFIED: 3,
  "NOT IMPLEMENTED": 4,
  "NOT ESTABLISHED": 5,
  CRITICAL: 6,
  BLOCKED: 7,
};

/**
 * A panel state must never be less severe than its worst BLOCKING row. A row
 * reading UNVERIFIED / NOT ESTABLISHED / BLOCKED is unresolved evidence and
 * must be visible at panel level so the S1 roll-up cannot under-report.
 */
export function escalateToWorstBlockingRow(panel: DraftPanel): DraftPanel {
  const worst = panel.rows.reduce<PanelState>((acc, r) => {
    if (!r.state || !BLOCKING_STATES.includes(r.state)) return acc;
    return STATE_SEVERITY[r.state] > STATE_SEVERITY[acc] ? r.state : acc;
  }, panel.state);
  return worst === panel.state ? panel : { ...panel, state: worst };
}



const READINESS_NONE: PanelReadiness = {
  componentExists: "NO",
  operationalDataExists: "NO",
  dataIsCurrent: "NO",
  dataIsApplicationAccessible: "NO",
  dashboardIntegrationExists: "NO",
};

/**
 * Complete currently-held governance, CI, recovery, and release risk set.
 * These are carried-forward limitations, not an accepted risk register.
 */
export const HELD_RISKS: PanelRow[] = [
  { label: "Production Release Standard v1.0.3", value: "PENDING EXTERNAL AUTHORING", state: "NOT IMPLEMENTED" },
  { label: "Operations Command Center v1.0.2", value: "PENDING EXTERNAL AUTHORING", state: "NOT IMPLEMENTED" },
  { label: "GitHub Actions enforcement (SECURITY DEFINER)", value: "NOT VERIFIED", state: "UNVERIFIED",
    note: "Local guard accepted; remote workflow run not evidenced." },
  { label: "Branch protection requiring the SECDEF status check", value: "PENDING", state: "UNVERIFIED" },
  { label: "Production database restore", value: "UNVERIFIED", state: "UNVERIFIED",
    note: "Application-drill restore evidence is separate and does not cover production." },
  { label: "Production infrastructure recovery", value: "UNVERIFIED", state: "UNVERIFIED" },
  { label: "Production RPO", value: "NOT ESTABLISHED", state: "NOT ESTABLISHED" },
  { label: "Production RTO", value: "NOT ESTABLISHED", state: "NOT ESTABLISHED" },
  { label: "Production rollback capability", value: "NOT ESTABLISHED", state: "NOT ESTABLISHED" },
  { label: "Production release activity", value: "BLOCKED", state: "BLOCKED" },
];



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
    const REQUIRED_GATES = ["H1", "H2", "H3", "H4"];
    const hg = hardGates;
    const byId = new Map((hg?.gates ?? []).map(g => [g.gateId, g]));
    // Source-data timestamps are gate ATTESTATION times. computeReadinessServer
    // .generatedAt is a report-computation time and is never used here.
    const attestations = REQUIRED_GATES.map(id => byId.get(id)?.attestedAt ?? null);
    const allAttested = hg?.authoritative === true && attestations.every(
      a => typeof a === "string" && !Number.isNaN(Date.parse(a)),
    );
    // Aggregate freshness is governed by the LEAST-FRESH required attestation.
    const ts = allAttested
      ? (attestations as string[]).reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b))
      : null;
    const stale = allAttested && isStale(ts, 1);
    let state: PanelState = "UNVERIFIED";
    if (hg?.authoritative) {
      state = !allAttested ? "UNVERIFIED"
        : stale ? "STALE"
        : hg.gates.some(g => g.status === "STALE") ? "STALE"
        : hg.ready ? "OK" : "ATTENTION";
    }
    panels.push({
      id: "S3",
      title: "Hard gates H1–H4",
      state,
      summary: hg?.authoritative
        ? `${hg.gates.filter(g => g.status === "PASS").length}/4 PASS · production GO ${hg.ready ? "UNLOCKED" : "LOCKED"}${allAttested ? "" : " · attestation evidence incomplete, freshness UNVERIFIED"}`
        : "Authoritative server readiness unavailable — hard-gate state UNVERIFIED.",
      source: "Launch-gate attestation evidence (attested_at) via computeReadinessServer — report generation time is not a source timestamp",
      sourceClass: allAttested ? "EXISTING" : "UNVERIFIED",
      sourceTimestamp: ts,
      freshnessHours: 1,
      readiness: {
        componentExists: "YES",
        operationalDataExists: hg?.authoritative ? "YES" : "UNVERIFIED",
        dataIsCurrent: allAttested ? (stale ? "NO" : "YES") : "UNVERIFIED",
        dataIsApplicationAccessible: hg?.authoritative ? "YES" : "UNVERIFIED",
        dashboardIntegrationExists: "YES",
      },
      rows: REQUIRED_GATES.map(id => {
        const g = byId.get(id);
        const attested = g?.attestedAt && !Number.isNaN(Date.parse(g.attestedAt)) ? g.attestedAt : null;
        const trustworthy = hg?.authoritative === true && !!attested;
        return {
          label: id,
          value: trustworthy ? (g?.status ?? "UNVERIFIED") : "UNVERIFIED",
          state: (!trustworthy ? "UNVERIFIED"
            : g?.status === "PASS" ? "OK"
            : g?.status === "STALE" ? "STALE"
            : g?.status === "FAIL" ? "CRITICAL" : "ATTENTION") as PanelState,
          note: `${g?.verifierDetail ?? "Server verifier not reachable"} · ${attested ? `attested ${attested} by ${g?.attestedBy ?? "—"}` : "no trustworthy attestation timestamp"} · fingerprint ${g?.buildFingerprint ?? "unknown"}`,
        };
      }),
      notes: [
        "Read-only view. Attestation controls are intentionally absent from this dashboard.",
        "Source freshness derives from the least-fresh required H1–H4 attestation timestamp; a missing attestation renders the panel UNVERIFIED.",
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
    // Production release activity is BLOCKED pending accepted external
    // governance. The panel state must never read OK while that holds.
    const state: PanelState = "BLOCKED";
    void failing;
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
        { label: "Production release activity", value: "BLOCKED", state: "BLOCKED" as PanelState,
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
    // computeMonitoring().generatedAt is a REPORT COMPUTATION time, not a
    // source-data timestamp. No trustworthy source timestamp exists for the
    // aggregated signal set, so freshness stays UNVERIFIED.
    const ts: string | null = null;
    const state: PanelState = alerting.some(a => a.state === "critical") ? "CRITICAL"
      : alerting.length ? "ATTENTION" : "UNVERIFIED";
    panels.push({
      id: "S6",
      title: "Monitoring alerts",
      state,
      summary: `${alerting.length} monitoring signal(s) non-nominal · ${execAlerts.length} executive alert rule(s)`,
      source: "computeMonitoring(snapshot) + snapshot.executiveAlerts — no source-data timestamp available",
      sourceClass: "EXISTING",
      sourceTimestamp: ts,
      freshnessHours: 1,
      readiness: {
        componentExists: "YES",
        operationalDataExists: "YES",
        dataIsCurrent: "UNVERIFIED",
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
    // No trustworthy snapshot/record timestamp exists for the isolation scan
    // input; the current time proves only when the calculation ran.
    const state: PanelState = leak.ok ? "UNVERIFIED" : "ATTENTION";
    panels.push({
      id: "S8",
      title: "Workspace-isolation status",
      state,
      summary: leak.ok
        ? `${(snap.workspaces ?? []).length} workspace(s) · no orphaned or unscoped rows · freshness UNVERIFIED`
        : `${leak.unscopedEntities.length} unscoped · ${leak.crossWorkspaceEntities.length} foreign-scoped rows`,
      source: "detectWorkspaceLeakage(snapshot) — no source-data timestamp available",
      sourceClass: "EXISTING",
      sourceTimestamp: null,
      freshnessHours: 1,
      readiness: {
        componentExists: "YES",
        operationalDataExists: "YES",
        dataIsCurrent: "UNVERIFIED",
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
        ...HELD_RISKS,
      ],
      notes: [
        "Risk items shown are limitations carried forward, not an accepted register.",
        "This is the complete currently-held governance, CI, recovery, and release risk set.",
      ],
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

  // ---------- S1 Executive health summary (roll-up of S2–S12) ----------
  // Every panel first escalates to its worst BLOCKING row so unresolved
  // evidence (e.g. S5 production recovery / RPO / RTO / rollback rows, S12
  // production recovery evidence) can never be hidden behind a panel-level
  // OK / ATTENTION / STALE reading.
  const escalated = panels.map(escalateToWorstBlockingRow);
  panels.length = 0;
  panels.push(...escalated);

  const blockingRowCount = panels.reduce(
    (n, p) => n + p.rows.filter(r => r.state && BLOCKING_STATES.includes(r.state)).length, 0,
  );
  const blocking = panels.filter(p =>
    BLOCKING_STATES.includes(p.state) ||
    p.rows.some(r => r.state && BLOCKING_STATES.includes(r.state)),
  );
  const attention = panels.filter(p =>
    !blocking.includes(p) && (p.state === "ATTENTION" || p.state === "STALE"),
  );
  const rollupState: PanelState = blocking.length ? "BLOCKED" : attention.length ? "ATTENTION" : "OK";
  const s1: DraftPanel = {
    id: "S1",
    title: "Executive health summary",
    state: rollupState,
    summary: blocking.length
      ? `BLOCKED — ${blocking.length} of ${panels.length} sections blocked, unverified, not implemented, or not established · ${blockingRowCount} unresolved row(s)`
      : attention.length
        ? `${attention.length} section(s) require attention`
        : "All aggregated sections nominal",
    source: "Aggregate roll-up of OCC sections S2–S12, panel states and blocking row states (no independent data source)",
    sourceClass: "EXISTING",
    // A roll-up has no single source-data timestamp; contributing panels carry
    // their own. Report-computation time is never presented as source freshness.
    sourceTimestamp: null,
    freshnessHours: null,
    readiness: {
      componentExists: "YES",
      operationalDataExists: "YES",
      dataIsCurrent: "UNVERIFIED",
      dataIsApplicationAccessible: "YES",
      dashboardIntegrationExists: "YES",
    },
    rows: panels.map(p => {
      const blockingRows = p.rows.filter(r => r.state && BLOCKING_STATES.includes(r.state));
      return {
        label: `${p.id} ${p.title}`,
        value: p.state,
        state: p.state,
        note: `${p.sourceTimestamp ? `source ${p.sourceTimestamp}` : "source timestamp UNVERIFIED"}${
          blockingRows.length ? ` · ${blockingRows.length} unresolved row(s): ${blockingRows.map(r => r.label).join(", ")}` : ""
        }`,
      };
    }),
    notes: [
      "S1 aggregates S2–S12 only. Application-layer monitoring signal detail is shown in S6.",
      "Any BLOCKED, CRITICAL, UNVERIFIED, NOT IMPLEMENTED, or NOT ESTABLISHED section — or any such ROW inside a section — forces a BLOCKED roll-up.",
      "Unresolved production recovery, RPO, RTO, or rollback rows always force BLOCKED.",
    ],
  };


  return [s1, ...panels].map(p => ({ ...p, computedAt: now }));
}
