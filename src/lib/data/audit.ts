// Workstream 9 — Immutable audit trail
//
// Append-only ledger with hash-chained integrity. Each event stores
// redacted before/after payloads, the actor, workspace, reason, and
// any approvals. Chain-verify runs deterministically over the ledger.

import type { AuditAction, AuditEvent, DataSnapshot, Role } from "./schema";
import { contentHash, redactSecrets } from "./security";

export function nextAuditId(existing: AuditEvent[]): string {
  const nums = existing.map(e => Number(e.id.replace(/^AUDIT-/, ""))).filter(n => !isNaN(n));
  return `AUDIT-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
}

export interface AuditInput {
  actor: string;
  actorRole: Role;
  workspaceId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  reason?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  approvals?: { by: string; role: Role; at: string }[];
  correlationId?: string;
  at?: string;
}

export function buildAuditEvent(prev: AuditEvent | null, input: AuditInput, id: string): AuditEvent {
  const at = input.at ?? new Date().toISOString();
  const before = input.before ? redactSecrets(input.before) : null;
  const after = input.after ? redactSecrets(input.after) : null;
  const prevHash = prev?.hash ?? "GENESIS";
  const payload = { id, at, actor: input.actor, action: input.action, entityType: input.entityType, entityId: input.entityId, before, after };
  const hash = contentHash({ prevHash, payload });
  return {
    id, at, actor: input.actor, actorRole: input.actorRole,
    workspaceId: input.workspaceId, action: input.action,
    entityType: input.entityType, entityId: input.entityId,
    reason: input.reason ?? "", before, after,
    approvals: input.approvals ?? [],
    correlationId: input.correlationId ?? id,
    hash, prevHash,
  };
}

export function appendAudit(events: AuditEvent[], input: AuditInput): AuditEvent[] {
  const id = nextAuditId(events);
  const prev = events[events.length - 1] ?? null;
  return [...events, buildAuditEvent(prev, input, id)];
}

/** Verify the entire chain — returns { ok, brokenAt } for the first mismatch. */
export function verifyAuditChain(events: AuditEvent[]): { ok: boolean; brokenAt: string | null; count: number } {
  let prevHash = "GENESIS";
  for (const e of events) {
    if (e.prevHash !== prevHash) return { ok: false, brokenAt: e.id, count: events.length };
    const expected = contentHash({
      prevHash,
      payload: { id: e.id, at: e.at, actor: e.actor, action: e.action, entityType: e.entityType, entityId: e.entityId, before: e.before, after: e.after },
    });
    if (expected !== e.hash) return { ok: false, brokenAt: e.id, count: events.length };
    prevHash = e.hash;
  }
  return { ok: true, brokenAt: null, count: events.length };
}

export function filterAudit(snap: DataSnapshot, q: { actor?: string; action?: AuditAction; entityId?: string; workspaceId?: string; since?: string }): AuditEvent[] {
  return snap.auditEvents.filter(e =>
    (!q.actor || e.actor === q.actor) &&
    (!q.action || e.action === q.action) &&
    (!q.entityId || e.entityId === q.entityId) &&
    (!q.workspaceId || e.workspaceId === q.workspaceId) &&
    (!q.since || Date.parse(e.at) >= Date.parse(q.since))
  );
}

export function auditDiff(before: Record<string, unknown> | null, after: Record<string, unknown> | null): { key: string; from: unknown; to: unknown }[] {
  const b = before ?? {}; const a = after ?? {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const out: { key: string; from: unknown; to: unknown }[] = [];
  for (const k of keys) {
    if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) out.push({ key: k, from: b[k], to: a[k] });
  }
  return out;
}
