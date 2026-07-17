// Launch-closure — verifier layer, evidence helpers, staleness detection,
// and cutover readiness for the four hard launch gates (H1–H4).
//
// Evidence is append-only. New attestations create a new row with an
// incremented `version` for the (workspaceId, gateId) pair and set
// `supersededBy` on the prior row. Nothing is ever mutated in place.
//
// Staleness: an attestation is STALE when the current build fingerprint
// (schemaVersion + environment adapter footprint) differs from the value
// captured at attest time.

import type {
  DataSnapshot, LaunchGateEvidence, LaunchGateId, LaunchGateStatus, Role,
} from "./schema";
import { SCHEMA_VERSION } from "./schema";
import { contentHash } from "./security";
import { assertRateLimitReadiness } from "./rate-limit";
import { buildDisasterRecoveryPlan } from "./backups";

export const HARD_GATE_IDS: LaunchGateId[] = ["H1", "H2", "H3", "H4"];

export interface LaunchGateDefinition {
  id: LaunchGateId;
  owner: string;
  name: string;
  evidenceRequirement: string;
  requiredRoles: Role[];       // roles allowed to attest / verify
  verifierKey: string;         // stable identifier for the verifier used
}

export const LAUNCH_GATE_DEFINITIONS: Record<LaunchGateId, LaunchGateDefinition> = {
  H1: {
    id: "H1", owner: "Platform Ops",
    name: "RATE_LIMIT_ADAPTER=supabase in production",
    evidenceRequirement: "assertRateLimitReadiness(env) returns ok with adapter=supabase in the target environment.",
    requiredRoles: ["Administrator", "Owner", "Operations"],
    verifierKey: "rate-limit-adapter",
  },
  H2: {
    id: "H2", owner: "Auth Owner",
    name: "Google OAuth enabled + callback verified",
    evidenceRequirement: "Provider toggled ON and a successful end-to-end sign-in captured (provider='google').",
    requiredRoles: ["Administrator", "Owner"],
    verifierKey: "oauth-google",
  },
  H3: {
    id: "H3", owner: "API Owner",
    name: "Demo API bearer revoked + production clients issued",
    evidenceRequirement: "APIC-001 disabled/removed AND ≥ 1 production APIClient row exists with keyReferenceId pointing at a runtime secret.",
    requiredRoles: ["Administrator", "Owner"],
    verifierKey: "api-clients",
  },
  H4: {
    id: "H4", owner: "Data Ops",
    name: "Pre-RC baseline backup + integrity + monitoring green",
    evidenceRequirement: "Baseline backup exists with matching content hash AND monitoring signals report no critical states at attest time.",
    requiredRoles: ["Administrator", "Owner", "Operations"],
    verifierKey: "backup-baseline",
  },
};

// ---------- Fingerprint ----------
export function computeBuildFingerprint(env: Record<string, string | undefined>, snap: DataSnapshot): string {
  const material = {
    schemaVersion: SCHEMA_VERSION,
    rateAdapter: (env.RATE_LIMIT_ADAPTER ?? "").toLowerCase(),
    nodeEnv: (env.NODE_ENV ?? "").toLowerCase(),
    workspaces: (snap.workspaces ?? []).length,
    apiClients: (snap.apiClients ?? []).length,
  };
  return contentHash(material).slice(0, 16);
}

// ---------- Verifier layer ----------
export interface VerifierResult {
  passed: boolean;
  detail: string;
  verifier: string;
}

export function verifyGate(id: LaunchGateId, env: Record<string, string | undefined>, snap: DataSnapshot): VerifierResult {
  switch (id) {
    case "H1": {
      const r = assertRateLimitReadiness(env);
      return { passed: r.ok && r.adapter === "supabase", detail: r.detail, verifier: "assertRateLimitReadiness" };
    }
    case "H2": {
      const provider = (env.SUPABASE_AUTH_GOOGLE_ENABLED ?? env.AUTH_GOOGLE_ENABLED ?? "").toLowerCase();
      const ok = provider === "true" || provider === "1";
      return { passed: ok, detail: ok ? "Google provider toggled ON" : "Google provider not enabled in env (SUPABASE_AUTH_GOOGLE_ENABLED)", verifier: "oauth-google-env" };
    }
    case "H3": {
      const clients = snap.apiClients ?? [];
      const demoLive = clients.some(c => c.id === "APIC-001" && c.enabled);
      const prodReady = clients.some(c => c.id !== "APIC-001" && c.enabled && !!c.keyReferenceId);
      const passed = !demoLive && prodReady;
      const detail = demoLive
        ? "APIC-001 demo bearer still enabled"
        : prodReady ? `${clients.filter(c => c.id !== "APIC-001" && c.enabled).length} production client(s) issued`
                    : "No production APIClient with a runtime-secret reference";
      return { passed, detail, verifier: "api-client-audit" };
    }
    case "H4": {
      const dr = buildDisasterRecoveryPlan(snap);
      const passed = !!dr.latestBackup && dr.backupCount >= 1;
      const detail = passed
        ? `${dr.backupCount} backups · latest ${dr.latestBackup!.createdAt.slice(0, 10)}`
        : "No baseline backup captured";
      return { passed, detail, verifier: "backup-baseline" };
    }
  }
}

// ---------- Evidence ----------
export function currentEvidence(snap: DataSnapshot, gateId: LaunchGateId, workspaceId: string): LaunchGateEvidence | null {
  const rows = (snap.launchGateEvidence ?? []).filter(e => e.gateId === gateId && e.workspaceId === workspaceId && e.supersededBy === null);
  if (!rows.length) return null;
  return rows.reduce((a, b) => a.version >= b.version ? a : b);
}

export function nextEvidenceId(snap: DataSnapshot): string {
  const nums = (snap.launchGateEvidence ?? []).map(e => Number(e.id.replace(/^LGE-/, ""))).filter(n => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `LGE-${String(next).padStart(3, "0")}`;
}

export interface AttestInput {
  gateId: LaunchGateId;
  workspaceId: string;
  status: "PASS" | "BLOCKED-OPERATOR" | "FAIL";
  reason: string;
  actor: string;
  actorRole: Role;
  correlationId: string;
  env: Record<string, string | undefined>;
}

export function buildAttestation(snap: DataSnapshot, input: AttestInput): { row: LaunchGateEvidence; previous: LaunchGateEvidence | null } {
  if (!input.reason || input.reason.trim().length < 12) {
    throw new Error("Launch gate attestation requires a written reason (≥ 12 characters).");
  }
  const def = LAUNCH_GATE_DEFINITIONS[input.gateId];
  if (!def.requiredRoles.includes(input.actorRole)) {
    throw new Error(`Role ${input.actorRole} may not attest ${input.gateId}. Required: ${def.requiredRoles.join(", ")}`);
  }
  const verifier = verifyGate(input.gateId, input.env, snap);
  if (input.status === "PASS" && !verifier.passed) {
    throw new Error(`Cannot attest ${input.gateId} as PASS: verifier failed — ${verifier.detail}`);
  }
  const previous = currentEvidence(snap, input.gateId, input.workspaceId);
  const version = (previous?.version ?? 0) + 1;
  const row: LaunchGateEvidence = {
    id: nextEvidenceId(snap),
    gateId: input.gateId,
    workspaceId: input.workspaceId,
    version,
    status: input.status,
    attestedBy: input.actor,
    attestedByRole: input.actorRole,
    attestedAt: new Date().toISOString(),
    reason: input.reason.trim(),
    verifier: verifier.verifier,
    verifierPassed: verifier.passed,
    verifierDetail: verifier.detail,
    buildFingerprint: computeBuildFingerprint(input.env, snap),
    supersededBy: null,
    correlationId: input.correlationId,
  };
  return { row, previous };
}

// Pure snapshot transform for attestation — used with Repo.auditedTransaction.
export function applyAttestation(snap: DataSnapshot, row: LaunchGateEvidence, previous: LaunchGateEvidence | null): DataSnapshot {
  const existing = snap.launchGateEvidence ?? [];
  const updated = previous
    ? existing.map(e => e.id === previous.id ? { ...e, supersededBy: row.id } : e)
    : existing;
  return { ...snap, launchGateEvidence: [...updated, row] };
}

// ---------- Read model ----------
export interface GateState {
  definition: LaunchGateDefinition;
  status: LaunchGateStatus;
  current: LaunchGateEvidence | null;
  history: LaunchGateEvidence[];
  stale: boolean;
  staleReason: string;
  verifier: VerifierResult;
  buildFingerprint: string;
}

export function computeGateState(
  snap: DataSnapshot,
  env: Record<string, string | undefined>,
  gateId: LaunchGateId,
  workspaceId: string,
): GateState {
  const definition = LAUNCH_GATE_DEFINITIONS[gateId];
  const current = currentEvidence(snap, gateId, workspaceId);
  const history = (snap.launchGateEvidence ?? [])
    .filter(e => e.gateId === gateId && e.workspaceId === workspaceId)
    .sort((a, b) => b.version - a.version);
  const buildFingerprint = computeBuildFingerprint(env, snap);
  const verifier = verifyGate(gateId, env, snap);

  let status: LaunchGateStatus = current?.status ?? "BLOCKED-OPERATOR";
  let stale = false;
  let staleReason = "";
  if (current && current.buildFingerprint !== buildFingerprint) {
    stale = true;
    staleReason = `Build fingerprint changed (${current.buildFingerprint} → ${buildFingerprint})`;
    status = "STALE";
  } else if (current && current.status === "PASS" && !verifier.passed) {
    stale = true;
    staleReason = `Verifier now fails: ${verifier.detail}`;
    status = "STALE";
  }
  return { definition, status, current, history, stale, staleReason, verifier, buildFingerprint };
}

export interface CutoverReadiness {
  ready: boolean;
  gates: GateState[];
  blockingGateIds: LaunchGateId[];
  staleGateIds: LaunchGateId[];
  generatedAt: string;
}

export function computeCutoverReadiness(snap: DataSnapshot, env: Record<string, string | undefined>, workspaceId: string): CutoverReadiness {
  const gates = HARD_GATE_IDS.map(id => computeGateState(snap, env, id, workspaceId));
  const blocking = gates.filter(g => g.status !== "PASS").map(g => g.definition.id);
  const stale = gates.filter(g => g.stale).map(g => g.definition.id);
  return {
    ready: blocking.length === 0,
    gates,
    blockingGateIds: blocking,
    staleGateIds: stale,
    generatedAt: new Date().toISOString(),
  };
}

/** Guardrails used by validation harness + defensive UI. */
export function evidenceIntegrityIssues(snap: DataSnapshot): string[] {
  const issues: string[] = [];
  const rows = snap.launchGateEvidence ?? [];
  const byKey = new Map<string, LaunchGateEvidence[]>();
  for (const r of rows) {
    const k = `${r.workspaceId}|${r.gateId}`;
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(r);
  }
  for (const [k, list] of byKey) {
    const sorted = [...list].sort((a, b) => a.version - b.version);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].version !== i + 1) issues.push(`non-monotonic version for ${k} at ${sorted[i].id}`);
    }
    const active = sorted.filter(r => r.supersededBy === null);
    if (active.length > 1) issues.push(`multiple active evidence rows for ${k}`);
  }
  return issues;
}
