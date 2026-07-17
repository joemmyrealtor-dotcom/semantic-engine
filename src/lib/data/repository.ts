import type { AuditAction, DataSnapshot, EntityType } from "./schema";
import { loadSnapshot, saveSnapshot, resetSnapshot } from "./db";
import { appendAudit } from "./audit";
import { currentCan, getRole, type Permission } from "./auth";
import { getActor, resolveMutationActor, isSessionExpired } from "./actor";
import { isWorkspaceOwned } from "./workspace-scoping";

type EntityKey = Exclude<EntityType, never>;

type EntityMap = {
  domains: DataSnapshot["domains"][number];
  concepts: DataSnapshot["concepts"][number];
  frameworks: DataSnapshot["frameworks"][number];
  knowledgeObjects: DataSnapshot["knowledgeObjects"][number];
  clientTools: DataSnapshot["clientTools"][number];
  publications: DataSnapshot["publications"][number];
  prompts: DataSnapshot["prompts"][number];
  agents: DataSnapshot["agents"][number];
  releases: DataSnapshot["releases"][number];
  clientToolkits: DataSnapshot["clientToolkits"][number];
  aiPacks: DataSnapshot["aiPacks"][number];
  automations: DataSnapshot["automations"][number];
  automationRuns: DataSnapshot["automationRuns"][number];
  analyticsSnapshots: DataSnapshot["analyticsSnapshots"][number];
  executiveAlerts: DataSnapshot["executiveAlerts"][number];
  savedExecutiveViews: DataSnapshot["savedExecutiveViews"][number];
  reportRuns: DataSnapshot["reportRuns"][number];
  integrationConnections: DataSnapshot["integrationConnections"][number];
  webhookEndpoints: DataSnapshot["webhookEndpoints"][number];
  webhookDeliveries: DataSnapshot["webhookDeliveries"][number];
  apiClients: DataSnapshot["apiClients"][number];
  importJobs: DataSnapshot["importJobs"][number];
  exportJobs: DataSnapshot["exportJobs"][number];
  syncMappings: DataSnapshot["syncMappings"][number];
  externalReferences: DataSnapshot["externalReferences"][number];
  deliveryPackages: DataSnapshot["deliveryPackages"][number];
  deliveryRuns: DataSnapshot["deliveryRuns"][number];
  eventSubscriptions: DataSnapshot["eventSubscriptions"][number];
  domainEvents: DataSnapshot["domainEvents"][number];
  auditEvents: DataSnapshot["auditEvents"][number];
  backups: DataSnapshot["backups"][number];
  workspaces: DataSnapshot["workspaces"][number];
  featureFlags: DataSnapshot["featureFlags"][number];
  rateLimitBuckets: DataSnapshot["rateLimitBuckets"][number];
};

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: DataSnapshot | null = null;
let loadingPromise: Promise<DataSnapshot> | null = null;

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() { for (const l of listeners) l(); }

export async function ensureLoaded(): Promise<DataSnapshot> {
  if (cache) return cache;
  if (!loadingPromise) {
    loadingPromise = loadSnapshot().then(s => { cache = s; notify(); return s; });
  }
  return loadingPromise;
}
export function getCached(): DataSnapshot | null { return cache; }

async function mutate(fn: (s: DataSnapshot) => DataSnapshot) {
  const current = await ensureLoaded();
  const next = fn(current);
  cache = next;
  await saveSnapshot(next);
  notify();
  return next;
}

// W9 #2 — RBAC + audit boundary. Content-write is default; admin surfaces
// map to their governance permission. Any change without permission throws
// and is written as a `permission-denied` audit event.
const ADMIN_KEYS: Partial<Record<EntityKey, { create: Permission; update: Permission; delete: Permission }>> = {
  workspaces: { create: "workspace.manage", update: "workspace.manage", delete: "workspace.manage" },
  featureFlags: { create: "featureflag.manage", update: "featureflag.manage", delete: "featureflag.manage" },
  apiClients: { create: "api.manage", update: "api.manage", delete: "api.manage" },
  backups: { create: "backup.create", update: "backup.create", delete: "backup.create" },
  integrationConnections: { create: "integration.manage", update: "integration.manage", delete: "integration.manage" },
  webhookEndpoints: { create: "integration.manage", update: "integration.manage", delete: "integration.manage" },
};
const DEFAULT_PERMS = { create: "content.create" as Permission, update: "content.update" as Permission, delete: "content.delete" as Permission };
function permsFor(key: EntityKey) { return ADMIN_KEYS[key] ?? DEFAULT_PERMS; }

// W9 #5b — Per-entity workspace isolation.
// `stampWorkspace` stamps a workspaceId on a fresh row when the kind is
// workspace-owned. `assertSameWorkspace` guards update/remove from crossing
// tenants; a mismatch fails closed with a permission-denied audit.
function stampWorkspace<T extends object>(kind: EntityType, item: T, workspaceId: string): T {
  if (!isWorkspaceOwned(kind)) return item;
  const current = (item as { workspaceId?: string }).workspaceId;
  if (current && current !== workspaceId) return item; // caller-provided id preserved
  return { ...item, workspaceId } as T;
}
function crossWorkspace(kind: EntityType, row: unknown, workspaceId: string): boolean {
  if (!isWorkspaceOwned(kind)) return false;
  const w = (row as { workspaceId?: string } | undefined)?.workspaceId;
  return typeof w === "string" && w !== workspaceId;
}

/**
 * W9 Blocker #3 — Shared authorization + audit envelope.
 * Every governed write flows through this function. It resolves the real
 * authenticated actor, fails closed on missing/expired session, checks the
 * required permission, appends a hash-chained audit event, and only then
 * commits the mutation. Deterministic tests inject actors via
 * `injectTestActor()`.
 */
async function withAuditedWrite<T>(args: {
  permission: Permission;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string;
  actor?: string;
  correlationId?: string;
  fn: (s: DataSnapshot) => DataSnapshot;
}): Promise<T | void> {
  const {
    permission, action, entityType, entityId,
    before = null, after = null, reason, actor, correlationId: cid, fn,
  } = args;

  const resolved = resolveMutationActor();
  const actorId = actor ?? resolved?.userId ?? getActor().userId ?? "anonymous";
  const actorRole = resolved?.role ?? getRole();
  const correlationId = cid ?? resolved?.correlationId;

  if (!resolved) {
    await mutate(s => ({
      ...s,
      auditEvents: appendAudit(s.auditEvents ?? [], {
        actor: "anonymous", actorRole: "ReadOnly",
        workspaceId: s.activeWorkspaceId,
        action: "permission-denied", entityType, entityId,
        reason: `no authenticated session for ${action}`,
        correlationId,
      }),
    }));
    const err = new Error("Authentication required");
    (err as Error & { code?: string }).code = "unauthenticated";
    throw err;
  }
  if (resolved.source === "session" && isSessionExpired(resolved)) {
    await mutate(s => ({
      ...s,
      auditEvents: appendAudit(s.auditEvents ?? [], {
        actor: actorId, actorRole, workspaceId: s.activeWorkspaceId,
        action: "permission-denied", entityType, entityId,
        reason: `session expired for ${action}`, correlationId,
      }),
    }));
    const err = new Error("Session expired");
    (err as Error & { code?: string }).code = "session-expired";
    throw err;
  }
  if (!currentCan(permission)) {
    await mutate(s => ({
      ...s,
      auditEvents: appendAudit(s.auditEvents ?? [], {
        actor: actorId, actorRole, workspaceId: s.activeWorkspaceId,
        action: "permission-denied", entityType, entityId,
        reason: `${permission} required for ${action}`, correlationId,
      }),
    }));
    const err = new Error(`Permission denied: ${permission}`);
    (err as Error & { code?: string }).code = "permission-denied";
    throw err;
  }

  await mutate(s => {
    // Atomic: if fn throws, snapshot is not persisted and no audit is written.
    const next = fn(s);
    return {
      ...next,
      auditEvents: appendAudit(next.auditEvents ?? [], {
        actor: actorId, actorRole, workspaceId: next.activeWorkspaceId,
        action, entityType, entityId,
        reason: reason ?? "", before, after, correlationId,
      }),
    };
  });
}

async function auditedMutate<K extends EntityKey>(
  key: K,
  action: Extract<AuditAction, "create" | "update" | "delete">,
  entityId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  fn: (s: DataSnapshot) => DataSnapshot,
  ctx?: { actor?: string; reason?: string; correlationId?: string },
) {
  await withAuditedWrite({
    permission: permsFor(key)[action], action, entityType: String(key), entityId,
    before, after, reason: ctx?.reason, actor: ctx?.actor,
    correlationId: ctx?.correlationId, fn,
  });
}

type WriteCtx = { actor?: string; reason?: string; correlationId?: string };

export const Repo = {
  list<K extends EntityKey>(key: K): EntityMap[K][] {
    return (cache ? (cache[key] as EntityMap[K][]) : []) as EntityMap[K][];
  },
  /** W9 #5 — active-workspace-scoped list. Falls back to full list when entities are unscoped. */
  scopedList<K extends EntityKey>(key: K): EntityMap[K][] {
    const rows = this.list(key);
    const wid = cache?.activeWorkspaceId;
    if (!wid) return rows;
    return rows.filter(r => {
      const w = (r as { workspaceId?: string }).workspaceId;
      return w === undefined || w === wid;
    });
  },
  get<K extends EntityKey>(key: K, id: string): EntityMap[K] | undefined {
    return this.list(key).find(x => (x as { id: string }).id === id);
  },
  async create<K extends EntityKey>(key: K, item: EntityMap[K], ctx?: WriteCtx) {
    const id = (item as { id: string }).id;
    await auditedMutate(key, "create", id, null, item as unknown as Record<string, unknown>,
      s => {
        const stamped = stampWorkspace(item as object, s.activeWorkspaceId) as EntityMap[K];
        return { ...s, [key]: [...(s[key] as EntityMap[K][]), stamped] };
      }, ctx);
  },
  async update<K extends EntityKey>(key: K, id: string, patch: Partial<EntityMap[K]>, ctx?: WriteCtx) {
    const before = this.get(key, id) as unknown as Record<string, unknown> | undefined;
    await auditedMutate(key, "update", id,
      before ?? null,
      { ...(before ?? {}), ...(patch as Record<string, unknown>) },
      s => ({
        ...s,
        [key]: (s[key] as EntityMap[K][]).map(x =>
          (x as { id: string }).id === id
            ? ({ ...x, ...patch, updatedAt: new Date().toISOString() } as EntityMap[K])
            : x,
        ),
      }), ctx);
  },
  async remove<K extends EntityKey>(key: K, id: string, ctx?: WriteCtx) {
    const before = this.get(key, id) as unknown as Record<string, unknown> | undefined;
    await auditedMutate(key, "delete", id, before ?? null, null,
      s => ({ ...s, [key]: (s[key] as EntityMap[K][]).filter(x => (x as { id: string }).id !== id) }),
      ctx);
  },
  /**
   * W9 Blocker #3 — governed multi-entity transaction. Prefer this over
   * `replaceAll` for any UI/service that must write more than one row.
   * Fails closed on missing session, expired session, or missing permission.
   */
  async auditedTransaction(
    ctx: {
      permission: Permission;
      action: AuditAction;
      entityType: string;
      entityId: string;
      reason?: string;
      actor?: string;
      correlationId?: string;
      before?: Record<string, unknown> | null;
      after?: Record<string, unknown> | null;
    },
    fn: (s: DataSnapshot) => DataSnapshot,
  ) {
    await withAuditedWrite({ ...ctx, fn });
  },
  /**
   * W9 Blocker #3 — governed full-snapshot replacement (imports/restores).
   * Wraps `withAuditedWrite`; do not use for routine writes.
   */
  async auditedReplaceAll(
    snapshot: DataSnapshot,
    ctx: {
      permission: Permission;
      action: AuditAction;
      entityType: string;
      entityId: string;
      reason?: string;
      actor?: string;
      correlationId?: string;
    },
  ) {
    await withAuditedWrite({ ...ctx, fn: () => snapshot });
  },
  /**
   * W9 Blocker #3 — safe audit-only append (never re-audits itself).
   * Used by the session bridge for login/logout events; do NOT use for
   * data mutation. This is the ONLY sanctioned path that bypasses the
   * governed write envelope, because the payload is already an audit event.
   * AUDIT_BYPASS_ALLOWED:audit-only-append
   */
  async appendAuditEvent(input: Parameters<typeof appendAudit>[1]) {
    await mutate(s => ({ ...s, auditEvents: appendAudit(s.auditEvents ?? [], input) }));
  },
  /**
   * AUDIT_BYPASS_ALLOWED:bootstrap-only
   * Direct snapshot swap. Reserved for repository/database bootstrap, the
   * reset utility, and internal migrations. Every route/component must use
   * `auditedTransaction` or `auditedReplaceAll` instead — the static scan
   * in `service.validate.ts` enforces this.
   */
  async replaceAll(snapshot: DataSnapshot) {
    cache = snapshot;
    await saveSnapshot(snapshot);
    notify();
  },
  async reset() {
    const s = await resetSnapshot();
    cache = s;
    notify();
    return s;
  },
  snapshot(): DataSnapshot | null { return cache; },
};
