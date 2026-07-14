import type { Role } from "./schema";

const ORDER: Role[] = ["Viewer", "Contributor", "Reviewer", "Editor", "Owner"];

// Local demo role — centralized stub for future auth integration.
let currentRole: Role = "Editor";
const listeners = new Set<() => void>();

export function getRole(): Role { return currentRole; }
export function setRole(r: Role) { currentRole = r; for (const l of listeners) l(); }
export function subscribeRole(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); }

export function atLeast(min: Role): boolean {
  return ORDER.indexOf(currentRole) >= ORDER.indexOf(min);
}

export function can(action: "read" | "create" | "update" | "delete" | "approve" | "release"): boolean {
  switch (action) {
    case "read": return true;
    case "create":
    case "update": return atLeast("Contributor");
    case "delete": return atLeast("Editor");
    case "approve": return atLeast("Reviewer");
    case "release": return atLeast("Owner");
  }
}
