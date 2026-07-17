import type { AuditAction, DataSnapshot, EntityType } from "./schema";
import { loadSnapshot, saveSnapshot, resetSnapshot } from "./db";
import { appendAudit } from "./audit";
import { currentCan, getRole, type Permission } from "./auth";
import { getActor, resolveMutationActor, isSessionExpired } from "./actor";

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

// W9 #5 — Workspace stamping. When an entity type carries a `workspaceId`
// (or we're stamping a fresh row), attach the active workspace.
function stampWorkspace<T extends object>(item: T, workspaceId: string): T {
  if (workspaceId && typeof item === "object" && !("workspaceId" in item)) {
    return { ...item, workspaceId } as T;
  }
  return item;
}

async function auditedMutate<K extends EntityKey>(
  key: K,
  action: Extract<AuditAction, "create" | "update" | "delete">,
  entityId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  fn: (s: DataSnapshot) => DataSnapshot,
  ctx?: { actor?: string; reason?: string },
) {
  const perm = permsFor(key)[action];
  const actor = ctx?.actor ?? "current-user";
  if (!currentCan(perm)) {
    await mutate(s => ({
      ...s,
      auditEvents: appendAudit(s.auditEvents ?? [], {
        actor, actorRole: getRole(), workspaceId: s.activeWorkspaceId,
        action: "permission-denied", entityType: String(key), entityId,
        reason: `${perm} required for ${action}`,
      }),
    }));
    const err = new Error(`Permission denied: ${perm}`);
    (err as Error & { code?: string }).code = "permission-denied";
    throw err;
  }
  await mutate(s => {
    const next = fn(s);
    return {
      ...next,
      auditEvents: appendAudit(next.auditEvents ?? [], {
        actor, actorRole: getRole(), workspaceId: next.activeWorkspaceId,
        action, entityType: String(key), entityId,
        reason: ctx?.reason ?? "", before, after,
      }),
    };
  });
}

type WriteCtx = { actor?: string; reason?: string };

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
