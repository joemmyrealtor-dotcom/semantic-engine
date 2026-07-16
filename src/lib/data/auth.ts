// Workstream 9 — Role-Based Access Control
//
// Nine enterprise roles plus legacy compatibility. Permissions map to the
// governed actions surfaced across the platform (create/update/delete on
// content, promote, release, approve, admin surfaces, API, backups).

import type { Role } from "./schema";

export const ROLE_RANK: Record<Role, number> = {
  Administrator: 100,
  Owner: 95,
  Publisher: 80,
  Editor: 70,
  Reviewer: 60,
  SME: 55,
  QA: 55,
  Operations: 50,
  Contributor: 40,
  Viewer: 20,
  ReadOnly: 10,
  APIClient: 30,
};

export type Permission =
  | "content.read" | "content.create" | "content.update" | "content.delete"
  | "content.promote"
  | "review.approve" | "review.reject"
  | "release.create" | "release.publish"
  | "automation.run" | "automation.approve"
  | "integration.manage" | "api.manage"
  | "backup.create" | "backup.restore"
  | "workspace.manage" | "workspace.switch"
  | "audit.read"
  | "monitoring.read"
  | "featureflag.manage" | "maintenance.manage"
  | "role.assign";

const MATRIX: Record<Role, Permission[]> = {
  Administrator: [
    "content.read","content.create","content.update","content.delete","content.promote",
    "review.approve","review.reject","release.create","release.publish",
    "automation.run","automation.approve","integration.manage","api.manage",
    "backup.create","backup.restore","workspace.manage","workspace.switch",
    "audit.read","monitoring.read","featureflag.manage","maintenance.manage","role.assign",
  ],
  Owner: [
    "content.read","content.create","content.update","content.delete","content.promote",
    "review.approve","review.reject","release.create","release.publish",
    "automation.run","automation.approve","integration.manage","api.manage",
    "backup.create","backup.restore","workspace.switch","audit.read","monitoring.read",
  ],
  Publisher: [
    "content.read","content.update","content.promote","release.create","release.publish",
    "workspace.switch","monitoring.read",
  ],
  Editor: [
    "content.read","content.create","content.update","content.delete","content.promote",
    "workspace.switch",
  ],
  SME: [
    "content.read","content.update","review.approve","review.reject","workspace.switch",
  ],
  Reviewer: [
    "content.read","review.approve","review.reject","workspace.switch",
  ],
  QA: [
    "content.read","review.approve","review.reject","content.update","workspace.switch",
  ],
  Operations: [
    "content.read","automation.run","automation.approve","integration.manage",
    "backup.create","monitoring.read","workspace.switch","audit.read","maintenance.manage",
  ],
  Contributor: [
    "content.read","content.create","content.update","workspace.switch",
  ],
  Viewer: ["content.read","workspace.switch"],
  ReadOnly: ["content.read"],
  APIClient: ["content.read","api.manage"],
};

let currentRole: Role = "Editor";
const listeners = new Set<() => void>();

export function getRole(): Role { return currentRole; }
export function setRole(r: Role) { currentRole = r; for (const l of listeners) l(); }
export function subscribeRole(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); }

export function atLeast(min: Role): boolean {
  return ROLE_RANK[currentRole] >= ROLE_RANK[min];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}
export function currentCan(permission: Permission): boolean {
  return hasPermission(currentRole, permission);
}

/** Legacy shim retained for existing call sites. */
export function can(action: "read" | "create" | "update" | "delete" | "approve" | "release"): boolean {
  const map: Record<typeof action, Permission> = {
    read: "content.read", create: "content.create", update: "content.update",
    delete: "content.delete", approve: "review.approve", release: "release.publish",
  };
  return currentCan(map[action]);
}

/** Governance gate — throws when the current role lacks a permission. */
export function requirePermission(permission: Permission, reason = ""): void {
  if (!currentCan(permission)) {
    const err = new Error(`Permission denied: ${permission}${reason ? ` (${reason})` : ""}`);
    (err as Error & { code?: string }).code = "permission-denied";
    throw err;
  }
}

export function permissionsFor(role: Role): Permission[] {
  return MATRIX[role] ?? [];
}
