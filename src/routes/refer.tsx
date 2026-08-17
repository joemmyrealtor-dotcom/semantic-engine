// Task 26 — Secure referral intake: /refer

import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { Field } from "@/components/lead-capture-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { absoluteUrl } from "@/lib/marketing/site";
import { trackAction } from "@/lib/marketing/analytics";
import { PARTNER_TYPES } from "@/lib/partners/schema";
import { REFERRAL_STANDARDS } from "@/lib/partners/pages";
import {
  REFERRAL_PERMISSION_TEXT,
  REFERRAL_SITUATIONS,
  REFERRAL_URGENCY,
  referralSchema,
  submitReferral,
} from "@/lib/partners/referral";

const TITLE = "Refer a Client | Professional Referral Intake";
const DESCRIPTION =
  "Secure referral intake for attorneys, CPAs, fiduciaries, advisors, and senior service professionals. Confirmed client permission required. No referral fees.";

export const Route = createFileRoute("/refer")({
  head: () => ({
    // Private professional workflow, not an organic landing page.
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "noindex,follow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/refer") },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/refer") }],
  }),
  component: ReferRoute,
});

function ReferRoute() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    trackAction("partner_referral_started", { label: "refer" });
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    const parsed = referralSchema.safeParse({
      partnerName: String(fd.get("partnerName") ?? ""),
      partnerFirm: String(fd.get("partnerFirm") ?? ""),
      partnerEmail: String(fd.get("partnerEmail") ?? ""),
      partnerTypeId: String(fd.get("partnerTypeId") ?? ""),
      clientFirstName: String(fd.get("clientFirstName") ?? ""),
      clientEmail: String(fd.get("clientEmail") ?? ""),
      clientPhone: String(fd.get("clientPhone") ?? ""),
      clientCity: String(fd.get("clientCity") ?? ""),
      situation: String(fd.get("situation") ?? ""),
      urgency: String(fd.get("urgency") ?? ""),
      context: String(fd.get("context") ?? ""),
      clientPermission: fd.get("clientPermission") === "on",
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await submitReferral(parsed.data);
      setDone(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Professional referral</p>
        <h1 className="mt-2 font-serif text-4xl text-heritage">Refer a client</h1>
        <p className="mt-4 text-muted-foreground">
          For attorneys, CPAs, fiduciaries, advisors, and senior service professionals. I will
          contact your client and report the outcome back to you either way. Timing depends on the
          situation and current availability, so no fixed turnaround is promised.
        </p>

        <ul className="mt-6 space-y-2 rounded-lg border border-border bg-card p-5">
          {REFERRAL_STANDARDS.map(s => (
            <li key={s} className="flex gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-evergreen" aria-hidden="true" />
              {s}
            </li>
          ))}
        </ul>

        {done ? (
          <div
            aria-live="polite"
            data-testid="referral-thank-you"
            className="mt-8 rounded-lg border border-gold bg-card p-6"
          >
            <CheckCircle2 className="size-6 text-evergreen" aria-hidden="true" />
            <h2 className="mt-3 font-serif text-2xl text-heritage">Referral received</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              I will reach out to your client within one business day and let you know how it goes.
              Nothing is shared with anyone else.
            </p>
            <Button asChild className="mt-5" variant="outline">
              <Link to="/for/$audience" params={{ audience: "attorneys" }}>
                Back to the professional pages
              </Link>
            </Button>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            noValidate
            className="mt-8 rounded-lg border border-border bg-card p-6"
          >
            <h2 className="font-serif text-2xl text-heritage">About you</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field id="partnerName" label="Your name" error={errors["partnerName"]}>
                <Input id="partnerName" name="partnerName" maxLength={120} required />
              </Field>
              <Field id="partnerFirm" label="Firm (optional)" error={errors["partnerFirm"]}>
                <Input id="partnerFirm" name="partnerFirm" maxLength={160} />
              </Field>
              <Field id="partnerEmail" label="Your email" error={errors["partnerEmail"]}>
                <Input id="partnerEmail" name="partnerEmail" type="email" maxLength={255} required />
              </Field>
              <Field id="partnerTypeId" label="Your profession" error={errors["partnerTypeId"]}>
                <select
                  id="partnerTypeId"
                  name="partnerTypeId"
                  defaultValue=""
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="" disabled>
                    Choose one
                  </option>
                  {PARTNER_TYPES.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <h2 className="mt-8 font-serif text-2xl text-heritage">About your client</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field id="clientFirstName" label="Client first name" error={errors["clientFirstName"]}>
                <Input id="clientFirstName" name="clientFirstName" maxLength={60} required />
              </Field>
              <Field id="clientEmail" label="Client email" error={errors["clientEmail"]}>
                <Input id="clientEmail" name="clientEmail" type="email" maxLength={255} required />
              </Field>
              <Field id="clientPhone" label="Client phone (optional)" error={errors["clientPhone"]}>
                <Input id="clientPhone" name="clientPhone" type="tel" maxLength={30} />
              </Field>
              <Field id="clientCity" label="Client city" error={errors["clientCity"]}>
                <Input id="clientCity" name="clientCity" maxLength={80} required />
              </Field>
              <Field id="situation" label="Situation" error={errors["situation"]}>
                <select
                  id="situation"
                  name="situation"
                  defaultValue=""
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="" disabled>
                    Choose one
                  </option>
                  {REFERRAL_SITUATIONS.map(s => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="urgency" label="Timing" error={errors["urgency"]}>
                <select
                  id="urgency"
                  name="urgency"
                  defaultValue=""
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="" disabled>
                    Choose one
                  </option>
                  {REFERRAL_URGENCY.map(u => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-4">
              <Field id="context" label="Context I should know (optional)" error={errors["context"]}>
                <Textarea id="context" name="context" rows={4} maxLength={600} />
              </Field>
            </div>

            <div className="mt-5 flex items-start gap-2">
              <input id="clientPermission" name="clientPermission" type="checkbox" className="mt-1" />
              <Label
                htmlFor="clientPermission"
                className="text-xs font-normal leading-relaxed text-muted-foreground"
              >
                {REFERRAL_PERMISSION_TEXT}{" "}
                <Link to="/privacy" className="underline">
                  Privacy policy
                </Link>
                .
              </Label>
            </div>
            {errors["clientPermission"] && (
              <p className="mt-1 text-xs text-destructive">{errors["clientPermission"]}</p>
            )}

            <Button type="submit" size="lg" className="mt-5" disabled={pending}>
              {pending && <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" />}
              Send referral
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              No referral fees are paid or accepted. This form is for professional referrals only.
            </p>
          </form>
        )}
      </div>
    </PublicShell>
  );
}
