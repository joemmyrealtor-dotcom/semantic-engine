// Task 16 — Recovery evidence engine tests.
import { describe, it, expect, beforeEach } from "vitest";
import {
  ROLLBACK_DECISIONS,
  buildRecoveryDashboard,
  buildRpoTable,
  clearEvidence,
  decideRecovery,
  loadEvidence,
  recordEvidence,
  runAllRecoveryDrills,
  runCrmFailureMatrix,
  runCrmRecoveryDrill,
  runLeadRecoveryDrill,
  runMigrationRecoveryDrill,
  sealEvidence,
  simulateCrmResponse,
  verifyEvidence,
  type RecoverySituation,
} from "@/lib/data/recovery";
import { clearQueue } from "@/lib/marketing/lead-queue";

beforeEach(() => {
  clearEvidence();
  clearQueue();
});

describe("rollback decision framework", () => {
  it("covers all six required situations", () => {
    const keys = Object.keys(ROLLBACK_DECISIONS) as RecoverySituation[];
    expect(keys).toHaveLength(6);
    for (const k of keys) {
      expect(ROLLBACK_DECISIONS[k].primaryAction).toBeTruthy();
      expect(ROLLBACK_DECISIONS[k].secondaryAction).toBeTruthy();
      expect(ROLLBACK_DECISIONS[k].escalateWhen.length).toBeGreaterThan(10);
    }
  });

  it("retries transport failures and escalates when retries are exhausted", () => {
    expect(decideRecovery("lead_transport_failure").action).toBe("retry");
    expect(decideRecovery("crm_outage", { retriesExhausted: true }).action).toBe("escalate");
  });

  it("restores with a good backup and reseeds without one", () => {
    expect(decideRecovery("schema_migration_failure", { backupAvailable: true, integrityOk: true }).action).toBe("restore");
    expect(decideRecovery("corrupt_local_snapshot", { backupAvailable: false }).action).toBe("reseed");
    expect(decideRecovery("schema_migration_failure", { backupAvailable: true, integrityOk: false }).action).toBe("escalate");
  });

  it("rolls back regressions but forward-fixes transient ones", () => {
    expect(decideRecovery("application_regression").action).toBe("roll_back");
    expect(decideRecovery("application_regression", { transient: true }).action).toBe("forward_fix");
    expect(decideRecovery("analytics_failure").action).toBe("forward_fix");
  });
});

describe("CRM failure simulation", () => {
  it("treats a duplicate contact as an idempotent update, not a failure", () => {
    const r = simulateCrmResponse("duplicate_contact");
    expect(r.ok).toBe(true);
    expect(r.action).toBe("updated");
  });

  it("marks 4xx as non-retryable and 5xx/timeout/unavailable as retryable", () => {
    expect(simulateCrmResponse("http_4xx").retryable).toBe(false);
    for (const k of ["http_5xx", "timeout", "unavailable", "partial_failure"] as const) {
      expect(simulateCrmResponse(k).retryable).toBe(true);
    }
  });

  it("exercises every failure kind and loses no leads", () => {
    const matrix = runCrmFailureMatrix();
    expect(matrix).toHaveLength(7);
    for (const c of matrix) {
      expect(c.leadsLost).toBe(0);
      expect(c.recoveredAfterRetry).toBe(true);
    }
  });
});

describe("lead recovery drill", () => {
  it("preserves queued leads through an outage and delivers each exactly once", async () => {
    const result = await runLeadRecoveryDrill({ operator: "Test Operator", leads: 3 });
    expect(result.queuedDuringOutage).toBe(3);
    expect(result.deliveredAfterRecovery).toBe(3);
    expect(result.duplicateDeliveries).toBe(0);
    expect(result.evidence.integrity.ok).toBe(true);
    expect(result.evidence.finalState).toBe("recovered");
    expect(result.evidence.rpoRecordsLost).toBe(0);
  });

  it("recovers from a timeout outage as well", async () => {
    const result = await runLeadRecoveryDrill({ operator: "Test Operator", leads: 2, outageKind: "timeout" });
    expect(result.deliveredAfterRecovery).toBe(2);
    expect(result.evidence.integrity.ok).toBe(true);
  });
});

describe("migration recovery drill", () => {
  it("detects a failed v9→v10 migration, restores, and verifies integrity", () => {
    const { evidence, backupHash, reseedPathVerified } = runMigrationRecoveryDrill({ operator: "Test Operator" });
    expect(backupHash).toBeTruthy();
    expect(reseedPathVerified).toBe(true);
    expect(evidence.recoveryAction).toBe("restore");
    expect(evidence.integrity.ok).toBe(true);
    expect(evidence.rpoRecordsLost).toBe(0);
    expect(evidence.rtoSeconds).toBeGreaterThanOrEqual(0);
  });
});

describe("evidence sealing", () => {
  it("hashes and verifies a record, and detects tampering", () => {
    const sealed = runCrmRecoveryDrill("Test Operator");
    expect(verifyEvidence(sealed)).toBe(true);
    expect(verifyEvidence({ ...sealed, operator: "Someone Else" })).toBe(false);
  });

  it("persists evidence across loads", () => {
    const sealed = sealEvidence({ ...runCrmRecoveryDrill("Test Operator") });
    recordEvidence(sealed);
    expect(loadEvidence().length).toBe(1);
  });
});

describe("recovery dashboard", () => {
  it("reports UNVERIFIED before drills and VERIFIED after", async () => {
    const before = buildRecoveryDashboard();
    expect(before.acceptance.find(a => a.item === "Lead recovery")?.state).toBe("UNVERIFIED");

    await runAllRecoveryDrills("Test Operator");
    const after = buildRecoveryDashboard();

    const state = (item: string) => after.acceptance.find(a => a.item === item)?.state;
    expect(state("Application-layer restore")).toBe("VERIFIED");
    expect(state("Lead recovery")).toBe("VERIFIED");
    expect(state("CRM retry recovery")).toBe("VERIFIED");
    expect(state("Migration rollback")).toBe("VERIFIED");
    expect(state("RPO")).toBe("MEASURED");
    expect(state("RTO")).toBe("MEASURED");
    expect(state("Rollback decision logic")).toBe("VERIFIED");
    expect(after.evidenceStatus).toBe("sealed");
    expect(after.evidenceCount).toBe(3);
  });

  it("keeps infrastructure recovery UNVERIFIED and production release BLOCKED", async () => {
    await runAllRecoveryDrills("Test Operator");
    const dash = buildRecoveryDashboard();
    expect(dash.acceptance.find(a => a.item === "Infrastructure recovery")?.state).toBe("UNVERIFIED");
    expect(dash.acceptance.find(a => a.item === "Production release")?.state).toBe("BLOCKED");
  });

  it("builds an RPO row for every scenario", () => {
    const rows = buildRpoTable(loadEvidence());
    expect(rows).toHaveLength(6);
    expect(rows.every(r => r.maximumLoss.length > 10)).toBe(true);
  });
});
