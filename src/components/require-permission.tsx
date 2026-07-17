// Route-level permission gate for admin/governed studios.
// Enforces sign-in AND role permission; shows accessible loading /
// signed-out / forbidden / expired states.

import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuthSessionBridge } from "@/lib/data/session-bridge";
import { hasPermission, type Permission } from "@/lib/data/auth";
import { isDevRuntime, isSessionExpired } from "@/lib/data/actor";

export function RequirePermission({
  permission, children, label,
}: { permission: Permission; children: ReactNode; label?: string }) {
  const actor = useAuthSessionBridge();

  // In DEV we honour the demo role for the offline harness.
  const signedIn = actor.source === "session" || isDevRuntime();
  if (!signedIn) {
    return (
      <div role="alert" aria-live="polite" className="max-w-md mx-auto mt-24 editorial-card p-6 text-center">
        <div className="text-[11px] uppercase tracking-[0.22em] text-gold">Sign in required</div>
        <h1 className="font-serif text-2xl text-heritage mt-2">{label ?? "Governed surface"}</h1>
        <p className="text-sm text-muted-foreground mt-2">Sign in to access this area.</p>
        <Link to="/auth"><Button className="mt-4">Sign in</Button></Link>
      </div>
    );
  }
  if (isSessionExpired(actor)) {
    return (
      <div role="alert" className="max-w-md mx-auto mt-24 editorial-card p-6 text-center">
        <h1 className="font-serif text-2xl text-heritage">Session expired</h1>
        <p className="text-sm text-muted-foreground mt-2">Please sign in again to continue.</p>
        <Link to="/auth"><Button className="mt-4">Re-authenticate</Button></Link>
      </div>
    );
  }
  if (!hasPermission(actor.role, permission)) {
    return (
      <div role="alert" className="max-w-md mx-auto mt-24 editorial-card p-6 text-center">
        <div className="text-[11px] uppercase tracking-[0.22em] text-destructive">Forbidden</div>
        <h1 className="font-serif text-2xl text-heritage mt-2">Access denied</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Your role ({actor.role}) does not include <code className="text-xs">{permission}</code>.
        </p>
        <Link to="/"><Button variant="outline" className="mt-4">Back to dashboard</Button></Link>
      </div>
    );
  }
  return <>{children}</>;
}
