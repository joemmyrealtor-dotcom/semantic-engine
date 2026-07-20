// Workstream 9 Blocker #1 — Session-driven actor bootstrap.
//
// A single subscriber that keeps the app-wide ActorContext (see actor.ts)
// aligned with the current Supabase auth session. Mounted once from the
// app shell so every mutation path — governed studios, admin, API — sees
// the real signed-in identity instead of a fabricated "current-user".

import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  setActorFromSession, clearActor, subscribeActor, getActor,
} from "@/lib/data/actor";
import { Repo } from "@/lib/data/repository";
import { getRole, setRole } from "@/lib/data/auth";
import type { Role } from "@/lib/data/schema";

const ROLE_MAP: Record<string, Role> = {
  owner: "Owner",
  admin: "Administrator",
  administrator: "Administrator",
  editor: "Editor",
  publisher: "Publisher",
  reviewer: "Reviewer",
  sme: "SME",
  qa: "QA",
  operations: "Operations",
  contributor: "Contributor",
  viewer: "Viewer",
};

async function resolveRoleForUser(userId: string): Promise<Role | null> {
  try {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error || !data?.length) return null;
    let best: Role | null = null;
    let bestRank = -1;
    const { ROLE_RANK } = await import("@/lib/data/auth");
    for (const row of data) {
      const mapped = ROLE_MAP[String(row.role).toLowerCase()];
      if (!mapped) continue;
      const rank = ROLE_RANK[mapped] ?? 0;
      if (rank > bestRank) { best = mapped; bestRank = rank; }
    }
    return best;
  } catch { return null; }
}

export function useAuthSessionBridge() {
  // Subscribe with useSyncExternalStore so any actor mutation that
  // happens BEFORE this component's effect runs (e.g. test-bridge
  // injection during app boot) is still observed on the very first
  // render. Previously we subscribed in useEffect + forceUpdate, which
  // opened a race: an inject that fired between render and effect was
  // lost until the next unrelated re-render or a manual reload().
  const actor = useSyncExternalStore(subscribeActor, getActor, getActor);

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const s = data.session;
      if (s?.user) {
        const role = await resolveRoleForUser(s.user.id);
        if (role) setRole(role);
        setActorFromSession({
          userId: s.user.id,
          email: s.user.email ?? null,
          displayLabel: s.user.user_metadata?.display_name ?? s.user.email ?? s.user.id,
          expiresAt: s.expires_at ?? null,
          role: role ?? undefined,
        });
      }
    }
    hydrate();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        if (session?.user) {
          const userId = session.user.id;
          resolveRoleForUser(userId).then(role => {
            if (role) setRole(role);
            setActorFromSession({
              userId,
              email: session.user.email ?? null,
              displayLabel: session.user.user_metadata?.display_name ?? session.user.email ?? userId,
              expiresAt: session.expires_at ?? null,
              role: role ?? undefined,
            });
            if (event === "SIGNED_IN") {
              Repo.appendAuditEvent({
                actor: userId, actorRole: role ?? getRole(),
                workspaceId: Repo.snapshot()?.activeWorkspaceId ?? "",
                action: "login",
                entityType: "session", entityId: userId,
                reason: "Supabase session established",
              }).catch(() => { /* best effort */ });
            }
          });
        }
      } else if (event === "SIGNED_OUT") {
        const prev = getActor();
        if (prev.source === "session") {
          Repo.appendAuditEvent({
            actor: prev.userId, actorRole: prev.role,
            workspaceId: Repo.snapshot()?.activeWorkspaceId ?? "",
            action: "logout",
            entityType: "session", entityId: prev.userId,
            reason: "Supabase sign-out",
          }).catch(() => { /* best effort */ });
        }
        clearActor("signed-out");
      }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return actor;
}
