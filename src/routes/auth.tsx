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
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const redirect = typeof search.redirect === "string" ? search.redirect : undefined;
    return {
      redirect: redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : undefined,
    };
  },
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
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setHasSession(!!data.session);
      if (data.session) nav({ to: search.redirect ?? "/" });
    });
    return () => { alive = false; };
  }, [nav, search.redirect]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
        nav({ to: search.redirect ?? "/" });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/auth" },
        });
        if (error) throw error;
        toast.success("Check your email to confirm");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        toast.success("Password reset email sent. Check your inbox.");
        setMode("signin");
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

  const title = mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password";
  const cta = mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset email";

  return (
    <>
      <PageHeader title={title} description="Access the JM Advisory Press governance surface." />
      <PageBody>
        <div className="max-w-md">
          <form onSubmit={handleSubmit} className="editorial-card p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
              </div>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Working…" : cta}
            </Button>
            {mode !== "forgot" && (
              <>
                <div className="text-xs text-muted-foreground text-center">or</div>
                <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
                  Continue with Google
                </Button>
              </>
            )}
            <div className="text-sm text-center space-y-2">
              {mode === "signin" && (
                <>
                  <div>
                    <button type="button" className="underline underline-offset-2 text-muted-foreground" onClick={() => setMode("forgot")}>
                      Forgot password?
                    </button>
                  </div>
                  <div>
                    <button type="button" className="underline underline-offset-2 text-muted-foreground" onClick={() => setMode("signup")}>
                      Need an account? Create one
                    </button>
                  </div>
                </>
              )}
              {mode === "signup" && (
                <button type="button" className="underline underline-offset-2 text-muted-foreground" onClick={() => setMode("signin")}>
                  Already have an account? Sign in
                </button>
              )}
              {mode === "forgot" && (
                <button type="button" className="underline underline-offset-2 text-muted-foreground" onClick={() => setMode("signin")}>
                  Back to sign in
                </button>
              )}
            </div>
          </form>
        </div>
      </PageBody>
    </>
  );
}
