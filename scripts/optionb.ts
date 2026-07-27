import { buildSeedSnapshot } from "@/lib/data/seed";
import { createBackup, verifyBackupIntegrity, verifyMigration } from "@/lib/data/backups";
import { SCHEMA_VERSION } from "@/lib/data/schema";
import { createHash } from "node:crypto";
import { writeFileSync, statSync } from "node:fs";

const executionStart = new Date().toISOString();
const snap = buildSeedSnapshot();
const backup = createBackup(snap, {
  label: "DR-DRILL Option B Application Baseline",
  reason: "DR Drill Phase 2A.1 Option B — application backup mechanics validation only (isolated non-production; does not replace BL-20260721T165326Z-postremediation).",
  actor: "dr-drill-custodian",
});
const captureTs = new Date().toISOString();

const integrity = verifyBackupIntegrity(backup);
const parsedPayload = JSON.parse(backup.payload);
const migration = verifyMigration(parsedPayload);

const baselineId = `BL-APPDRILL-${captureTs.replace(/[-:.]/g,"").replace("Z","Z")}`;
const filePath = `/mnt/documents/baselines/${baselineId}.json`;
const fileBody = JSON.stringify({ baselineId, capturedAt: captureTs, kind: "application-drill-baseline", backup }, null, 2);
writeFileSync(filePath, fileBody);
const fileSize = statSync(filePath).size;
const fileSha = createHash("sha256").update(fileBody).digest("hex");

// Required-fields check (13)
const required = ["id","label","reason","actor","schemaVersion","entityCount","bytes","hash","workspaceId","payload","restoredAt","createdAt","updatedAt"];
const fieldReport = required.map(k => ({ field: k, present: k in backup, type: typeof (backup as any)[k] }));

const evidence = {
  documentType: "DR-DRILL-PHASE-2A1-OPTIONB-EVIDENCE",
  version: "1.0",
  status: "DRAFT-PENDING-OWNER-REVIEW",
  scope: {
    boundary: "Application backup mechanics only",
    doesNot: [
      "recover BL-20260721T165326Z-postremediation",
      "validate production database recovery",
      "establish production RPO",
      "replace or supersede the July 21 artifact",
    ],
    environment: "isolated non-production; deterministic governed fixture (buildSeedSnapshot); no PII; no production credentials; no production connectivity; no production requests",
  },
  executionStart,
  capturedAt: captureTs,
  completedAt: "",
  baseline: {
    baselineId, storageLocation: filePath, fileSize, fileSha256: fileSha,
    custodian: "dr-drill-custodian",
    rpoDesignation: "Drill-artifact only (no production RPO implication)",
  },
  backupSummary: {
    id: backup.id, label: backup.label, reason: backup.reason, actor: backup.actor,
    schemaVersion: backup.schemaVersion, entityCount: backup.entityCount, bytes: backup.bytes,
    hash: backup.hash, workspaceId: backup.workspaceId,
    createdAt: backup.createdAt, updatedAt: backup.updatedAt, restoredAt: backup.restoredAt,
  },
  validation: {
    createBackupExecuted: true,
    serialization: { ok: typeof backup.payload === "string" && backup.payload.length === backup.bytes, bytes: backup.bytes },
    requiredFields: { count: required.length, allPresent: fieldReport.every(f=>f.present), fields: fieldReport },
    payloadParsing: { ok: true, topLevelKeys: Object.keys(parsedPayload).length },
    dataSnapshotStructural: {
      schemaVersion: parsedPayload.schemaVersion,
      schemaVersionMatches: parsedPayload.schemaVersion === SCHEMA_VERSION,
      hasActiveWorkspaceId: typeof parsedPayload.activeWorkspaceId === "string",
      hasBackupsArray: Array.isArray(parsedPayload.backups),
    },
    verifyBackupIntegrity: integrity,
    verifyMigration: migration,
  },
  proposedControls: {
    retention: "Retain for DR drill lifecycle; purge on drill closure per governance",
    writeOnce: "Filesystem-level immutability proposed (chmod 0444) — not applied by this evidence step",
    accessRestriction: "Read-only to named custodian and Owner; no external distribution",
  },
  notPerformed: [
    "restoreFromBackup", "performGovernedRestore", "IndexedDB writes/close/reopen/reload",
    "Phase 2B harness creation", "production requests",
    "changes to application code, schema, gates, users, memberships, secrets, production state, or existing retained artifacts",
  ],
  julyBaseline: { id: "BL-20260721T165326Z-postremediation", state: "unchanged; not superseded" },
  downstreamGates: {
    phase2B: "BLOCKED",
    productionReleaseStandardV1: "BLOCKED",
    operationsCommandCenterV1: "BLOCKED",
    restoreCapability: "UNVERIFIED",
    productionRPO: "NOT ESTABLISHED",
  },
};
evidence.completedAt = new Date().toISOString();

const jsonPath = "/mnt/documents/dr-drill-v1.0/phase-2a1/DR-DRILL-PHASE-2A1-OPTIONB-EVIDENCE-v1.0.json";
writeFileSync(jsonPath, JSON.stringify(evidence, null, 2));

const md = `# DR Drill Phase 2A.1 — Option B Application-Drill Baseline Evidence v1.0

**Status:** DRAFT — PENDING OWNER REVIEW
**Document type:** ${evidence.documentType}

## Scope boundary (accepted)
- Application backup mechanics only.
- Does NOT recover BL-20260721T165326Z-postremediation.
- Does NOT validate production database recovery.
- Does NOT establish production RPO.
- Does NOT replace or supersede the July 21 artifact.

## Environment
${evidence.scope.environment}

## Timestamps
- executionStart: \`${evidence.executionStart}\`
- capturedAt: \`${evidence.capturedAt}\`
- completedAt: \`${evidence.completedAt}\`

## Baseline artifact
| Field | Value |
|---|---|
| Baseline ID | \`${baselineId}\` |
| Storage location | \`${filePath}\` |
| File size (bytes) | ${fileSize} |
| SHA-256 | \`${fileSha}\` |
| Named custodian | dr-drill-custodian |
| RPO designation | Drill-artifact only (no production RPO implication) |

## BackupSnapshot summary
| Field | Value |
|---|---|
| id | ${backup.id} |
| label | ${backup.label} |
| actor | ${backup.actor} |
| schemaVersion | ${backup.schemaVersion} |
| entityCount | ${backup.entityCount} |
| bytes | ${backup.bytes} |
| hash | \`${backup.hash}\` |
| workspaceId | ${backup.workspaceId} |
| createdAt | ${backup.createdAt} |
| updatedAt | ${backup.updatedAt} |
| restoredAt | ${backup.restoredAt} |

## Validation
- createBackup executed: PASS
- Serialization ok (payload length === bytes): ${evidence.validation.serialization.ok ? "PASS" : "FAIL"}
- Required 13 fields present: ${evidence.validation.requiredFields.allPresent ? "PASS" : "FAIL"}
- Payload parsing: PASS (${evidence.validation.payloadParsing.topLevelKeys} top-level keys)
- DataSnapshot structural — schemaVersion === 9: ${evidence.validation.dataSnapshotStructural.schemaVersionMatches ? "PASS" : "FAIL"} (value: ${evidence.validation.dataSnapshotStructural.schemaVersion})
- verifyBackupIntegrity: ${integrity.ok ? "PASS" : "FAIL"} (${integrity.reason})
- verifyMigration: ${migration.ok ? "PASS" : "FAIL"} (${migration.issues.length} issues)

## Proposed controls (not enforced by this step)
- Retention: ${evidence.proposedControls.retention}
- Write-once: ${evidence.proposedControls.writeOnce}
- Access restriction: ${evidence.proposedControls.accessRestriction}

## Not performed (out of scope for Option B)
${evidence.notPerformed.map(x=>`- ${x}`).join("\n")}

## Downstream gates
- Phase 2B: BLOCKED
- Production Release Standard v1: BLOCKED
- Operations Command Center v1: BLOCKED
- Restore capability: UNVERIFIED
- Production RPO: NOT ESTABLISHED

## July 21 artifact
- \`BL-20260721T165326Z-postremediation\` — unchanged and not superseded.
`;
const mdPath = "/mnt/documents/dr-drill-v1.0/phase-2a1/DR-DRILL-PHASE-2A1-OPTIONB-EVIDENCE-v1.0.md";
writeFileSync(mdPath, md);

// Custody record
const custody = {
  documentType: "DR-DRILL-PHASE-2A1-OPTIONB-CUSTODY",
  version: "1.0",
  baselineId, storageLocation: filePath, fileSize, fileSha256: fileSha,
  namedCustodian: "dr-drill-custodian",
  chainOfCustody: [
    { event: "created", at: captureTs, actor: "dr-drill-custodian", location: filePath },
    { event: "sha256-recorded", at: evidence.completedAt, actor: "dr-drill-custodian", sha256: fileSha },
  ],
  proposedControls: evidence.proposedControls,
  status: "PARTIALLY ESTABLISHED (proposed controls not yet enforced)",
};
writeFileSync("/mnt/documents/dr-drill-v1.0/phase-2a1/DR-DRILL-PHASE-2A1-OPTIONB-CUSTODY-v1.0.json", JSON.stringify(custody, null, 2));
writeFileSync("/mnt/documents/dr-drill-v1.0/phase-2a1/DR-DRILL-PHASE-2A1-OPTIONB-CUSTODY-v1.0.md",
`# Option B Custody Record v1.0

- Baseline ID: \`${baselineId}\`
- Storage: \`${filePath}\`
- Size: ${fileSize} bytes
- SHA-256: \`${fileSha}\`
- Custodian: dr-drill-custodian
- Status: PARTIALLY ESTABLISHED (proposed controls not yet enforced)

## Chain of custody
- created @ ${captureTs}
- sha256-recorded @ ${evidence.completedAt}

## Proposed controls
- Retention: ${evidence.proposedControls.retention}
- Write-once: ${evidence.proposedControls.writeOnce}
- Access: ${evidence.proposedControls.accessRestriction}
`);

console.log(JSON.stringify({ baselineId, filePath, fileSize, fileSha, integrity, migration, entityCount: backup.entityCount }, null, 2));
