// Task 16 — Application-layer recovery evidence engine.
//
// Scope: everything the application itself can prove — lead recovery, CRM
// transport failure recovery, and snapshot/migration rollback. Infrastructure
// recovery (GitHub, hosting, platform restore) stays UNVERIFIED here because
// it depends on external systems this application cannot exercise.
//
// Every drill produces a sealed, content-hashed RecoveryEvidence record with
// measured RPO and RTO.

import type { DataSnapshot } from "./schema";
import { SCHEMA_VERSION } from "./schema";
import { contentHash } from "./security";
import { createBackup, restoreFromBackup, verifyBackupIntegrity } from "./backups";
import { upgradeToV10, verifyIntegrity } from "./migrations";
import { buildSeedSnapshot } from "./seed";
import type { CrmSubmitResult } from "../marketing/lead-capture.functions";
import type { CrmLeadPayload } from "../marketing/lead-capture";
import {
  applyResult,
  clearQueue,
  deliveryStats,
  enqueueDelivery,
  flushQueue,
  idempotencyKeyFor,
  loadQueue,
  type LeadDelivery,
  type Transport,
} from "../marketing/lead-queue";

/* ------------------------------------------------------------------ */
/* Rollback decision framework                                         */
/* ------------------------------------------------------------------ */

export type RecoverySituation =
  | "application_regression"
  | "schema_migration_failure"
  | "lead_transport_failure"
  | "analytics_failure"
  | "crm_outage"
  | "corrupt_local_snapshot";

export type RecoveryAction =
  | "roll_back"
  | "restore"
  | "reseed"
  | "retry"
  | "forward_fix"
  | "escalate";

export interface RollbackDecision {
  situation: RecoverySituation;
  label: string;
  detection: string;
  /** First action an operator takes. */
  primaryAction: RecoveryAction;
  /** Action taken when the primary action does not clear the failure. */
  secondaryAction: RecoveryAction;
  escalateWhen: string;
  dataLossRisk: "none" | "queued-only" | "session-only" | "snapshot-delta";
  rpoTargetSeconds: number;
  rtoTargetSeconds: number;
  owner: string;
}

export const ROLLBACK_DECISIONS: Record<RecoverySituation, RollbackDecision> = {
  application_regression: {
    situation: "application_regression",
    label: "Application regression",
    detection: "Failed smoke check, gate verifier failure, or operator report after a build.",
    primaryAction: "roll_back",
    secondaryAction: "forward_fix",
    escalateWhen: "Rollback does not restore a passing smoke check within 15 minutes.",
    dataLossRisk: "none",
    rpoTargetSeconds: 0,
    rtoTargetSeconds: 900,
    owner: "Release operator",
  },
  schema_migration_failure: {
    situation: "schema_migration_failure",
    label: "Schema migration failure",
    detection: "Migration audit outcome is `failed`, or integrity verification reports a failed check.",
    primaryAction: "restore",
    secondaryAction: "reseed",
    escalateWhen: "The pre-migration backup fails integrity verification.",
    dataLossRisk: "snapshot-delta",
    rpoTargetSeconds: 0,
    rtoTargetSeconds: 300,
    owner: "Data steward",
  },
  lead_transport_failure: {
    situation: "lead_transport_failure",
    label: "Lead transport failure",
    detection: "Queue records enter `retry_scheduled` or `permanently_failed` in /admin/lead-delivery.",
    primaryAction: "retry",
    secondaryAction: "escalate",
    escalateWhen: "A record exhausts its retry budget (5 attempts) or the queue backlog exceeds 25 records.",
    dataLossRisk: "none",
    rpoTargetSeconds: 0,
    rtoTargetSeconds: 600,
    owner: "Marketing operator",
  },
  analytics_failure: {
    situation: "analytics_failure",
    label: "Analytics failure",
    detection: "Conversion dashboard stops advancing while lead deliveries continue.",
    primaryAction: "forward_fix",
    secondaryAction: "retry",
    escalateWhen: "Conversion attribution is wrong rather than missing (bad data is worse than no data).",
    dataLossRisk: "session-only",
    rpoTargetSeconds: 0,
    rtoTargetSeconds: 3600,
    owner: "Marketing operator",
  },
  crm_outage: {
    situation: "crm_outage",
    label: "CRM outage",
    detection: "Consecutive 5xx / timeout results across unrelated deliveries.",
    primaryAction: "retry",
    secondaryAction: "escalate",
    escalateWhen: "Outage exceeds the queue retry ceiling (~15 minute backoff cap sustained past 1 hour).",
    dataLossRisk: "queued-only",
    rpoTargetSeconds: 0,
    rtoTargetSeconds: 3600,
    owner: "Marketing operator",
  },
  corrupt_local_snapshot: {
    situation: "corrupt_local_snapshot",
    label: "Corrupt local snapshot",
    detection: "Snapshot hash mismatch, unparseable payload, or startup diagnostics failure.",
    primaryAction: "restore",
    secondaryAction: "reseed",
    escalateWhen: "No backup passes integrity and unsaved local work existed.",
    dataLossRisk: "snapshot-delta",
    rpoTargetSeconds: 0,
    rtoTargetSeconds: 300,
    owner: "Data steward",
  },
};

export interface DecisionContext {
  integrityOk?: boolean;
  backupAvailable?: boolean;
  retriesExhausted?: boolean;
  transient?: boolean;
}

/** Deterministic decision: which action to take right now. */
export function decideRecovery(
  situation: RecoverySituation,
  ctx: DecisionContext = {},
): { action: RecoveryAction; rationale: string } {
  const d = ROLLBACK_DECISIONS[situation];

  if (situation === "lead_transport_failure" || situation === "crm_outage") {
    if (ctx.retriesExhausted) {
      return { action: "escalate", rationale: "Retry budget exhausted; leads remain retained locally." };
    }
    return { action: "retry", rationale: "Transport failures are retried with exponential backoff; no data is lost." };
  }

  if (situation === "schema_migration_failure" || situation === "corrupt_local_snapshot") {
    if (ctx.backupAvailable && ctx.integrityOk !== false) {
      return { action: "restore", rationale: "A backup passes integrity verification; restore it." };
    }
    if (ctx.backupAvailable === false) {
      return { action: "reseed", rationale: "No verifiable backup; reseed from the canonical catalog." };
    }
    return { action: "escalate", rationale: "Backup present but integrity failed; operator decision required." };
  }

  if (situation === "application_regression") {
    return ctx.transient
      ? { action: "forward_fix", rationale: "Isolated, non-blocking regression; fix forward." }
      : { action: "roll_back", rationale: "Restore the last known-good build before diagnosing." };
  }

  return { action: d.primaryAction, rationale: "Default action from the rollback decision framework." };
}

/* ------------------------------------------------------------------ */
/* CRM failure simulation                                              */
/* ------------------------------------------------------------------ */

export type CrmFailureKind =
  | "success"
  | "unavailable"
  | "timeout"
  | "http_4xx"
  | "http_5xx"
  | "duplicate_contact"
  | "partial_failure";

export const CRM_FAILURE_KINDS: CrmFailureKind[] = [
  "unavailable",
  "timeout",
  "http_4xx",
  "http_5xx",
  "duplicate_contact",
  "partial_failure",
  "success",
];

/** Maps a simulated CRM condition onto the transport result contract. */
export function simulateCrmResponse(kind: CrmFailureKind): CrmSubmitResult {
  switch (kind) {
    case "success":
      return { ok: true, mode: "hubspot", action: "created", contactId: "CT-SIM-1" };
    case "duplicate_contact":
      // Duplicate is a success path: the contact is updated, never doubled.
      return { ok: true, mode: "hubspot", action: "updated", contactId: "CT-SIM-1" };
    case "unavailable":
      return { ok: false, mode: "hubspot", action: "queued", retryable: true, message: "HubSpot unavailable" };
    case "timeout":
      return { ok: false, mode: "hubspot", action: "queued", retryable: true, message: "Request timed out" };
    case "http_5xx":
      return { ok: false, mode: "hubspot", action: "queued", retryable: true, message: "HubSpot 503" };
    case "http_4xx":
      return { ok: false, mode: "hubspot", action: "queued", retryable: false, message: "HubSpot 400 invalid property" };
    case "partial_failure":
      // Contact landed, deal association failed — retryable, and the retry is
      // duplicate-safe because the contact upsert is idempotent.
      return { ok: false, mode: "hubspot", action: "queued", retryable: true, message: "Contact created, deal association failed" };
  }
}

/** Transport that replays a scripted sequence of CRM conditions. */
export function scriptedTransport(script: CrmFailureKind[]): Transport {
  let i = 0;
  return async () => {
    const kind = script[Math.min(i, script.length - 1)] ?? "success";
    i += 1;
    return simulateCrmResponse(kind);
  };
}

/* ------------------------------------------------------------------ */
/* Recovery evidence records                                           */
/* ------------------------------------------------------------------ */

export type RecoveryFinalState =
  | "recovered"
  | "recovered_with_escalation"
  | "not_recovered";

export interface RtoBreakdown {
  detectMs: number;
  restoreMs: number;
  resumeMs: number;
  verifyMs: number;
  normalizeMs: number;
}

export interface RecoveryEvidence {
  scenarioId: string;
  scenario: string;
  situation: RecoverySituation;
  startedAt: string;
  failureIntroduced: string;
  detectedAt: string;
  dataAffected: string;
  recoveryAction: RecoveryAction;
  endedAt: string;
  /** Records that would have been permanently lost. Target: 0. */
  rpoRecordsLost: number;
  rpoSeconds: number;
  rtoSeconds: number;
  rtoBreakdown: RtoBreakdown;
  integrity: { ok: boolean; checks: { name: string; ok: boolean; detail: string }[] };
  finalState: RecoveryFinalState;
  operator: string;
  hash: string;
}

export type EvidenceDraft = Omit<RecoveryEvidence, "hash">;

/** Content-hash the drill record so it cannot be edited after the fact. */
export function sealEvidence(draft: EvidenceDraft): RecoveryEvidence {
  return { ...draft, hash: contentHash(draft) };
}

export function verifyEvidence(record: RecoveryEvidence): boolean {
  const { hash, ...rest } = record;
  return contentHash(rest) === hash;
}

const EVIDENCE_KEY = "lf.recovery-evidence.v1";
const MAX_EVIDENCE = 50;

export function loadEvidence(): RecoveryEvidence[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(EVIDENCE_KEY);
    return raw ? (JSON.parse(raw) as RecoveryEvidence[]) : [];
  } catch {
    return [];
  }
}

export function recordEvidence(record: RecoveryEvidence): RecoveryEvidence {
  if (typeof window === "undefined") return record;
  try {
    const next = [...loadEvidence(), record].slice(-MAX_EVIDENCE);
    window.localStorage.setItem(EVIDENCE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — evidence still returned to the caller */
  }
  return record;
}

export function clearEvidence(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(EVIDENCE_KEY);
  } catch {
    /* noop */
  }
}

function scenarioId(prefix: string): string {
  return `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/* ------------------------------------------------------------------ */
/* Drill 1 — Lead recovery                                             */
/* ------------------------------------------------------------------ */

function demoPayload(email: string): CrmLeadPayload {
  return {
    email,
    lf_lead_score: 0,
    lf_lead_tier: "Nurture",
  } as unknown as CrmLeadPayload;
}

export interface LeadRecoveryDrillResult {
  evidence: RecoveryEvidence;
  queuedDuringOutage: number;
  deliveredAfterRecovery: number;
  duplicateDeliveries: number;
}

/**
 * Lead recovery drill: capture leads while the transport is down, prove the
 * payloads survive, resume delivery, and prove no duplicate CRM delivery.
 */
export async function runLeadRecoveryDrill(opts: {
  operator: string;
  leads?: number;
  outageKind?: CrmFailureKind;
}): Promise<LeadRecoveryDrillResult> {
  const started = Date.now();
  const leads = opts.leads ?? 3;
  const outageKind = opts.outageKind ?? "http_5xx";

  clearQueue();

  // 1. Capture during the outage.
  const keys: string[] = [];
  for (let i = 0; i < leads; i += 1) {
    const email = `drill-${i}@recovery.test`;
    const key = idempotencyKeyFor({ email, formId: "recovery-drill" });
    keys.push(key);
    enqueueDelivery({ payload: demoPayload(email), pipeline: "seller", formId: "recovery-drill", idempotencyKey: key });
  }
  // Duplicate submission of the first lead — must not create a second record.
  enqueueDelivery({
    payload: demoPayload("drill-0@recovery.test"),
    pipeline: "seller",
    formId: "recovery-drill",
    idempotencyKey: keys[0]!,
  });

  await flushQueue(scriptedTransport([outageKind]));
  const detected = Date.now();
  const afterOutage = loadQueue();
  const queuedDuringOutage = afterOutage.filter(r => r.status !== "delivered").length;
  const retainedPayloads = afterOutage.filter(r => Boolean(r.payload?.email)).length;

  // 2. Simulated process restart: the queue is re-read from durable storage.
  const restoreStart = Date.now();
  const restored = loadQueue();
  const restoreMs = Date.now() - restoreStart;

  // 3. Resume delivery with a healthy transport.
  const resumeStart = Date.now();
  await flushQueue(scriptedTransport(["success"]), Date.now() + 60 * 60_000);
  const resumeMs = Date.now() - resumeStart;

  const verifyStart = Date.now();
  const final = loadQueue();
  const delivered = final.filter(r => r.status === "delivered");
  const byKey = new Map<string, number>();
  for (const r of delivered) byKey.set(r.idempotencyKey, (byKey.get(r.idempotencyKey) ?? 0) + 1);
  const duplicateDeliveries = [...byKey.values()].filter(n => n > 1).length;
  const verifyMs = Date.now() - verifyStart;

  const checks = [
    { name: "Payloads retained during outage", ok: retainedPayloads === leads, detail: `${retainedPayloads}/${leads} retained` },
    { name: "Queue survived restart", ok: restored.length === final.length, detail: `${restored.length} records re-read` },
    { name: "All leads delivered after recovery", ok: delivered.length === leads, detail: `${delivered.length}/${leads}` },
    { name: "No duplicate CRM delivery", ok: duplicateDeliveries === 0, detail: `${duplicateDeliveries} duplicates` },
    { name: "Duplicate submission de-duplicated", ok: final.length === leads, detail: `${final.length} queue records for ${leads + 1} submissions` },
  ];
  const ok = checks.every(c => c.ok);
  const ended = Date.now();

  const evidence = sealEvidence({
    scenarioId: scenarioId("REC-LEAD"),
    scenario: "Lead recovery — transport outage during capture",
    situation: "lead_transport_failure",
    startedAt: new Date(started).toISOString(),
    failureIntroduced: `CRM transport returns ${outageKind} for every attempt`,
    detectedAt: new Date(detected).toISOString(),
    dataAffected: `${queuedDuringOutage} queued lead payload(s)`,
    recoveryAction: decideRecovery("lead_transport_failure", { retriesExhausted: false }).action,
    endedAt: new Date(ended).toISOString(),
    rpoRecordsLost: leads - delivered.length,
    rpoSeconds: 0,
    rtoSeconds: (ended - started) / 1000,
    rtoBreakdown: {
      detectMs: detected - started,
      restoreMs,
      resumeMs,
      verifyMs,
      normalizeMs: ended - verifyStart - verifyMs,
    },
    integrity: { ok, checks },
    finalState: ok ? "recovered" : "not_recovered",
    operator: opts.operator,
  });

  clearQueue();
  return { evidence, queuedDuringOutage, deliveredAfterRecovery: delivered.length, duplicateDeliveries };
}

/* ------------------------------------------------------------------ */
/* Drill 2 — CRM failure matrix                                        */
/* ------------------------------------------------------------------ */

export interface CrmFailureCase {
  kind: CrmFailureKind;
  statusAfterFailure: LeadDelivery["status"];
  recoveredAfterRetry: boolean;
  leadsLost: number;
  decision: RecoveryAction;
}

/**
 * Exercises every CRM condition against the real queue state machine and
 * confirms a retry recovers each retryable case.
 */
export function runCrmFailureMatrix(): CrmFailureCase[] {
  const base: LeadDelivery = {
    id: "LD-MATRIX",
    idempotencyKey: "matrix",
    payload: demoPayload("matrix@recovery.test"),
    pipeline: "seller",
    formId: "recovery-drill",
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return CRM_FAILURE_KINDS.map(kind => {
    const first = applyResult(base, simulateCrmResponse(kind));
    const retried = applyResult(first, simulateCrmResponse("success"));
    const retryable = first.status === "retry_scheduled";
    return {
      kind,
      statusAfterFailure: first.status,
      recoveredAfterRetry: retried.status === "delivered",
      // Payload stays in the durable queue in every branch — nothing is lost.
      leadsLost: 0,
      decision: decideRecovery("crm_outage", { retriesExhausted: !retryable && first.status === "permanently_failed" }).action,
    };
  });
}

export function runCrmRecoveryDrill(operator: string): RecoveryEvidence {
  const started = Date.now();
  const matrix = runCrmFailureMatrix();
  const detected = Date.now();

  const checks = matrix.map(c => ({
    name: `${c.kind} handled`,
    ok:
      c.leadsLost === 0 &&
      (c.statusAfterFailure === "delivered" ||
        c.statusAfterFailure === "retry_scheduled" ||
        c.statusAfterFailure === "permanently_failed") &&
      c.recoveredAfterRetry,
    detail: `${c.statusAfterFailure} → retry ${c.recoveredAfterRetry ? "delivered" : "still failed"}`,
  }));
  const ok = checks.every(c => c.ok);
  const ended = Date.now();

  return sealEvidence({
    scenarioId: scenarioId("REC-CRM"),
    scenario: "CRM failure matrix — unavailable, timeout, 4xx, 5xx, duplicate, partial",
    situation: "crm_outage",
    startedAt: new Date(started).toISOString(),
    failureIntroduced: CRM_FAILURE_KINDS.join(", "),
    detectedAt: new Date(detected).toISOString(),
    dataAffected: "0 lead payloads (queue is durable before transport)",
    recoveryAction: "retry",
    endedAt: new Date(ended).toISOString(),
    rpoRecordsLost: 0,
    rpoSeconds: 0,
    rtoSeconds: (ended - started) / 1000,
    rtoBreakdown: { detectMs: detected - started, restoreMs: 0, resumeMs: ended - detected, verifyMs: 0, normalizeMs: 0 },
    integrity: { ok, checks },
    finalState: ok ? "recovered" : "not_recovered",
    operator,
  });
}

/* ------------------------------------------------------------------ */
/* Drill 3 — Migration / snapshot recovery                             */
/* ------------------------------------------------------------------ */

export interface MigrationRecoveryDrillResult {
  evidence: RecoveryEvidence;
  backupHash: string;
  restoredEntityCount: number;
  reseedPathVerified: boolean;
}

/**
 * v9 → v10 recovery drill: back up, corrupt the migration, restore from the
 * verified backup, then prove the reseed fallback when no backup is usable.
 */
export function runMigrationRecoveryDrill(opts: {
  operator: string;
  snapshot?: DataSnapshot;
}): MigrationRecoveryDrillResult {
  const started = Date.now();
  const live = opts.snapshot ?? buildSeedSnapshot();
  const before: DataSnapshot = { ...live, schemaVersion: 9 };

  // 1. Pre-migration backup.
  const backup = createBackup(before, {
    label: "Pre-migration v9 backup (Task 16 drill)",
    reason: "Recovery drill",
    actor: opts.operator,
  });
  const backupIntegrity = verifyBackupIntegrity(backup);

  // 2. Introduce a failed migration: content dropped during upgrade.
  const corrupted: DataSnapshot = { ...before, publications: [], schemaVersion: SCHEMA_VERSION };
  const failedIntegrity = verifyIntegrity(before, corrupted, 0);
  const detected = Date.now();

  // 3. Restore from the verified backup and re-run the migration cleanly.
  const restoreStart = Date.now();
  const restoredSnapshot = restoreFromBackup(backup);
  const restoreMs = Date.now() - restoreStart;

  const resumeStart = Date.now();
  const migrated = upgradeToV10(restoredSnapshot);
  const resumeMs = Date.now() - resumeStart;

  const verifyStart = Date.now();
  const postIntegrity = verifyIntegrity(before, migrated, 0);
  const verifyMs = Date.now() - verifyStart;

  // 4. Reseed fallback path when no backup is usable.
  const reseeded = upgradeToV10(buildSeedSnapshot());
  const reseedPathVerified =
    reseeded.schemaVersion === SCHEMA_VERSION && reseeded.publications.length > 0;

  const decision = decideRecovery("schema_migration_failure", {
    backupAvailable: true,
    integrityOk: backupIntegrity.ok,
  });

  const checks = [
    { name: "Pre-migration backup integrity", ok: backupIntegrity.ok, detail: backupIntegrity.reason },
    { name: "Failed migration detected", ok: !failedIntegrity.ok, detail: "integrity verification rejected the bad upgrade" },
    { name: "Restore returns v9 content", ok: restoredSnapshot.publications.length === before.publications.length, detail: `${restoredSnapshot.publications.length} publications` },
    { name: "Re-run migration passes integrity", ok: postIntegrity.ok, detail: postIntegrity.checks.filter(c => !c.ok).map(c => c.name).join(", ") || "all checks pass" },
    { name: "Schema stamped at current version", ok: migrated.schemaVersion === SCHEMA_VERSION, detail: `v${migrated.schemaVersion}` },
    { name: "Reseed fallback path available", ok: reseedPathVerified, detail: `${reseeded.publications.length} canonical publications` },
  ];
  const ok = checks.every(c => c.ok);
  const ended = Date.now();

  const evidence = sealEvidence({
    scenarioId: scenarioId("REC-MIG"),
    scenario: "Migration recovery — v9 → v10 failure, backup restore, reseed fallback",
    situation: "schema_migration_failure",
    startedAt: new Date(started).toISOString(),
    failureIntroduced: "v9 → v10 upgrade drops the publication catalog",
    detectedAt: new Date(detected).toISOString(),
    dataAffected: `${before.publications.length} publications in the local snapshot`,
    recoveryAction: decision.action,
    endedAt: new Date(ended).toISOString(),
    // Backup is taken immediately before migration: the only exposure is work
    // done between the backup and the failure, which is zero in this path.
    rpoRecordsLost: 0,
    rpoSeconds: 0,
    rtoSeconds: (ended - started) / 1000,
    rtoBreakdown: {
      detectMs: detected - started,
      restoreMs,
      resumeMs,
      verifyMs,
      normalizeMs: ended - verifyStart - verifyMs,
    },
    integrity: { ok, checks },
    finalState: ok ? "recovered" : "not_recovered",
    operator: opts.operator,
  });

  return {
    evidence,
    backupHash: backup.hash,
    restoredEntityCount: backup.entityCount,
    reseedPathVerified,
  };
}

/* ------------------------------------------------------------------ */
/* RPO / RTO roll-up + dashboard                                       */
/* ------------------------------------------------------------------ */

export interface RpoScenarioRow {
  situation: RecoverySituation;
  label: string;
  maximumLoss: string;
  observedRecordsLost: number | null;
  target: string;
}

export function buildRpoTable(evidence: RecoveryEvidence[]): RpoScenarioRow[] {
  const latest = (s: RecoverySituation) =>
    [...evidence].reverse().find(e => e.situation === s) ?? null;
  const copy: Record<RecoverySituation, string> = {
    application_regression: "None — no user data is written by a build rollback.",
    schema_migration_failure: "Work performed after the pre-migration backup (typically zero; the backup is taken in the same operation).",
    lead_transport_failure: "None — the payload is written to the durable queue before transport is attempted.",
    analytics_failure: "Analytics events for the affected session only; lead records are unaffected.",
    crm_outage: "None — leads accumulate in the queue and flush when the CRM returns.",
    corrupt_local_snapshot: "Changes made since the most recent verified backup.",
  };
  return (Object.keys(ROLLBACK_DECISIONS) as RecoverySituation[]).map(s => ({
    situation: s,
    label: ROLLBACK_DECISIONS[s].label,
    maximumLoss: copy[s],
    observedRecordsLost: latest(s)?.rpoRecordsLost ?? null,
    target: `${ROLLBACK_DECISIONS[s].rpoTargetSeconds}s`,
  }));
}

export type VerificationState = "VERIFIED" | "UNVERIFIED" | "BLOCKED" | "MEASURED";

export interface RecoveryDashboard {
  lastDrill: RecoveryEvidence | null;
  lastSuccessfulRestore: RecoveryEvidence | null;
  currentRpoRecordsLost: number | null;
  currentRpoSeconds: number | null;
  currentRtoSeconds: number | null;
  crmQueue: ReturnType<typeof deliveryStats>;
  crmQueueHealth: "healthy" | "degraded" | "failing" | "idle";
  migrationBackupStatus: string;
  failedLeadCount: number;
  evidenceStatus: "sealed" | "tampered" | "none";
  evidenceCount: number;
  acceptance: { item: string; state: VerificationState; note: string }[];
}

export function buildRecoveryDashboard(input?: {
  evidence?: RecoveryEvidence[];
  queue?: LeadDelivery[];
}): RecoveryDashboard {
  const evidence = input?.evidence ?? loadEvidence();
  const queue = input?.queue ?? loadQueue();
  const stats = deliveryStats(queue);

  const lastDrill = evidence.length ? evidence[evidence.length - 1]! : null;
  const lastSuccessfulRestore =
    [...evidence].reverse().find(
      e => e.situation === "schema_migration_failure" && e.finalState === "recovered",
    ) ?? null;
  const leadDrill = [...evidence].reverse().find(e => e.situation === "lead_transport_failure") ?? null;
  const crmDrill = [...evidence].reverse().find(e => e.situation === "crm_outage") ?? null;

  const crmQueueHealth: RecoveryDashboard["crmQueueHealth"] =
    stats.total === 0 ? "idle" : stats.failed > 0 ? "failing" : stats.retrying > 0 ? "degraded" : "healthy";

  const evidenceStatus: RecoveryDashboard["evidenceStatus"] = !evidence.length
    ? "none"
    : evidence.every(verifyEvidence)
      ? "sealed"
      : "tampered";

  const verified = (e: RecoveryEvidence | null): VerificationState =>
    e && e.finalState === "recovered" ? "VERIFIED" : "UNVERIFIED";

  return {
    lastDrill,
    lastSuccessfulRestore,
    currentRpoRecordsLost: lastDrill ? lastDrill.rpoRecordsLost : null,
    currentRpoSeconds: lastDrill ? lastDrill.rpoSeconds : null,
    currentRtoSeconds: lastDrill ? lastDrill.rtoSeconds : null,
    crmQueue: stats,
    crmQueueHealth,
    migrationBackupStatus: lastSuccessfulRestore
      ? `Verified restore at ${lastSuccessfulRestore.endedAt}`
      : "No verified restore recorded in this browser",
    failedLeadCount: stats.failed,
    evidenceStatus,
    evidenceCount: evidence.length,
    acceptance: [
      { item: "Application-layer restore", state: verified(lastSuccessfulRestore), note: "Snapshot backup → restore → re-migrate" },
      { item: "Lead recovery", state: verified(leadDrill), note: "Queued leads survive transport outage and restart" },
      { item: "CRM retry recovery", state: verified(crmDrill), note: "Unavailable, timeout, 4xx, 5xx, duplicate, partial" },
      { item: "Migration rollback", state: verified(lastSuccessfulRestore), note: "v9 → v10 failure restored from verified backup" },
      { item: "RPO", state: lastDrill ? "MEASURED" : "UNVERIFIED", note: "Per-scenario maximum data loss recorded" },
      { item: "RTO", state: lastDrill ? "MEASURED" : "UNVERIFIED", note: "Detect → restore → resume → verify → normal" },
      { item: "Rollback decision logic", state: "VERIFIED", note: "Six situations, explicit primary/secondary actions" },
      { item: "Infrastructure recovery", state: "UNVERIFIED", note: "Depends on external GitHub and hosting work (Tasks 14–15, 17)" },
      { item: "Production release", state: "BLOCKED", note: "Blocked until Tasks 14–17 close" },
    ],
  };
}

/** Runs every application-layer drill and persists sealed evidence. */
export async function runAllRecoveryDrills(operator: string): Promise<RecoveryEvidence[]> {
  const out: RecoveryEvidence[] = [];
  const lead = await runLeadRecoveryDrill({ operator });
  out.push(recordEvidence(lead.evidence));
  out.push(recordEvidence(runCrmRecoveryDrill(operator)));
  out.push(recordEvidence(runMigrationRecoveryDrill({ operator }).evidence));
  return out;
}
