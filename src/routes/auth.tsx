// Workstream 9 Blocker #1 — Production sign-in surface.
//
// A single public route (no auth gate) that hosts email/password sign-in
// and Google OAuth. On success we hydrate the actor context from the
// Supabase session; the root subscriber (see __root.tsx) also refreshes
// on `onAuthStateChange`. Sign-out is exposed from the app-shell header.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageBody } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Legacy Platform" },
      { name: "description", content: "Sign in to the JM Advisory Press Legacy Platform." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setHasSession(!!data.session);
      if (data.session) nav({ to: "/" });
    });
    return () => { alive = false; };
  }, [nav]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
        nav({ to: "/" });
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/auth" },
        });
        if (error) throw error;
        toast.success("Check your email to confirm");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/auth" },
      });
      if (error) throw error;
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  if (hasSession === null) return null;

  return (
    <>
      <PageHeader title={mode === "signin" ? "Sign in" : "Create account"} description="Access the JM Advisory Press governance surface." />
      <PageBody>
        <div className="max-w-md">
          <form onSubmit={handleSubmit} className="editorial-card p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
            <div className="text-xs text-muted-foreground text-center">or</div>
            <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
              Continue with Google
            </Button>
            <div className="text-sm text-center">
              <button type="button" className="underline underline-offset-2 text-muted-foreground" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
              </button>
            </div>
          </form>
        </div>
      </PageBody>
    </>
  );
}
