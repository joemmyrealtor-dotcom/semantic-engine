// Public route: password recovery landing. Supabase redirects here with a
// recovery token in the URL hash; the client library exchanges it and fires
// a PASSWORD_RECOVERY event, after which updateUser({ password }) is allowed.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageBody } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Legacy Platform" },
      { name: "description", content: "Set a new password for your Legacy Platform account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase JS auto-processes the recovery hash on load. Listen for the
    // PASSWORD_RECOVERY event OR an existing session to enable the form.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      nav({ to: "/" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Reset password" description="Choose a new password for your account." />
      <PageBody>
        <div className="max-w-md">
          <form onSubmit={handleSubmit} className="editorial-card p-6 space-y-4">
            {!ready && (
              <p className="text-sm text-muted-foreground">
                Waiting for recovery link… open this page from the password-reset email you received.
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" disabled={!ready} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" disabled={!ready} />
            </div>
            <Button type="submit" disabled={busy || !ready} className="w-full">
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        </div>
      </PageBody>
    </>
  );
}
