// Workstream 9 Blocker #1 — Session-driven actor bootstrap.
//
// A single subscriber that keeps the app-wide ActorContext (see actor.ts)
// aligned with the current Supabase auth session. Mounted once from the
// app shell so every mutation path — governed studios, admin, API — sees
// the real signed-in identity instead of a fabricated "current-user".

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  setActorFromSession, clearActor, subscribeActor, getActor,
} from "@/lib/data/actor";
import { appendAudit } from "@/lib/data/audit";
import { Repo } from "@/lib/data/repository";
import { getRole } from "@/lib/data/auth";
import { useState } from "react";

export function useAuthSessionBridge() {
  const [, force] = useState(0);
  useEffect(() => { const un = subscribeActor(() => force(x => x + 1)); return () => { un(); }; }, []);

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const s = data.session;
      if (s?.user) {
        setActorFromSession({
          userId: s.user.id,
          email: s.user.email ?? null,
          displayLabel: s.user.user_metadata?.display_name ?? s.user.email ?? s.user.id,
          expiresAt: s.expires_at ?? null,
        });
      }
    }
    hydrate();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        if (session?.user) {
          setActorFromSession({
            userId: session.user.id,
            email: session.user.email ?? null,
            displayLabel: session.user.user_metadata?.display_name ?? session.user.email ?? session.user.id,
            expiresAt: session.expires_at ?? null,
          });
          // Best-effort login audit (safe — no tokens included).
          const snap = Repo.snapshot();
          if (snap && event === "SIGNED_IN") {
            Repo.replaceAll({
              ...snap,
              auditEvents: appendAudit(snap.auditEvents ?? [], {
                actor: session.user.id, actorRole: getRole(),
                workspaceId: snap.activeWorkspaceId, action: "login",
                entityType: "session", entityId: session.user.id,
                reason: "Supabase session established",
              }),
            }).catch(() => { /* best effort */ });
          }
        }
      } else if (event === "SIGNED_OUT") {
        const prev = getActor();
        const snap = Repo.snapshot();
        if (snap && prev.source === "session") {
          Repo.replaceAll({
            ...snap,
            auditEvents: appendAudit(snap.auditEvents ?? [], {
              actor: prev.userId, actorRole: prev.role,
              workspaceId: snap.activeWorkspaceId, action: "logout",
              entityType: "session", entityId: prev.userId,
              reason: "Supabase sign-out",
            }),
          }).catch(() => { /* best effort */ });
        }
        clearActor("signed-out");
      }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return getActor();
}
