// Task 22A — Reusable lead-capture form with thank-you state.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ENTRY_PATHS } from "@/lib/marketing/positioning";
import {
  CONSENT_TEXT,
  TIMELINE_OPTIONS,
  buildCrmLeadPayload,
  leadFormSchema,
  queueLead,
  type LeadFormValues,
} from "@/lib/marketing/lead-capture";
import { trackEvent } from "@/lib/marketing/analytics";
import { guideMarkdown, type GuideDefinition } from "@/lib/marketing/lead-magnets";

function downloadGuide(guide: GuideDefinition) {
  const blob = new Blob([guideMarkdown(guide)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${guide.slug}-v${guide.version}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function GuideLeadForm({ guide }: { guide: GuideDefinition }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [city, setCity] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const candidate = {
      firstName: String(fd.get("firstName") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      city: String(fd.get("city") ?? ""),
      situation: String(fd.get("situation") ?? ""),
      timeline: String(fd.get("timeline") ?? ""),
      consent: fd.get("consent") === "on",
    };
    const parsed = leadFormSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    const values: LeadFormValues = parsed.data;
    setCity(values.city);

    const payload = buildCrmLeadPayload({
      values,
      guideId: guide.id,
      guideSlug: guide.slug,
      leadSource: guide.crmLeadSource,
      campaign: guide.crmCampaign,
    });
    queueLead(payload);
    trackEvent("guide_lead_submitted", {
      guideId: guide.id,
      situation: values.situation,
      city: values.city,
    });
    setSubmitted(true);
    downloadGuide(guide);
    trackEvent("guide_downloaded", { guideId: guide.id, situation: values.situation });
  }

  if (submitted) {
    return (
      <div
        aria-live="polite"
        className="rounded-lg border border-gold bg-card p-6"
        data-testid="guide-thank-you"
      >
        <CheckCircle2 className="size-6 text-evergreen" aria-hidden="true" />
        <h2 className="mt-3 font-serif text-2xl text-heritage">Your guide is downloading</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          If the download did not start, use the button below. The full guide is also readable on
          this page — nothing is hidden behind the form.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => downloadGuide(guide)}>
            <Download className="mr-1 size-4" aria-hidden="true" />
            Download again
          </Button>
          <Button asChild variant="outline">
            <Link
              to="/assessments/$slug"
              params={{ slug: guide.assessmentSlug }}
              onClick={() => trackEvent("consultation_cta_clicked", { guideId: guide.id, label: "assessment" })}
            >
              Take the matching assessment
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link
              to="/contact"
              onClick={() => trackEvent("consultation_cta_clicked", { guideId: guide.id, label: "contact" })}
            >
              {guide.primaryCta}
            </Link>
          </Button>
        </div>
        {city && (
          <p className="mt-4 text-xs text-muted-foreground">
            We noted {city} — local market notes are in the local guides section.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-serif text-2xl text-heritage">{guide.primaryCta}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Six short fields. You get the downloadable guide immediately.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label="First name" error={errors["firstName"]}>
          <Input id="firstName" name="firstName" autoComplete="given-name" maxLength={60} required />
        </Field>
        <Field id="email" label="Email" error={errors["email"]}>
          <Input id="email" name="email" type="email" autoComplete="email" maxLength={255} required />
        </Field>
        <Field id="phone" label="Phone (optional)" error={errors["phone"]}>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={30} />
        </Field>
        <Field id="city" label="City" error={errors["city"]}>
          <Input id="city" name="city" autoComplete="address-level2" maxLength={80} required />
        </Field>
        <Field id="situation" label="Your situation" error={errors["situation"]}>
          <select
            id="situation"
            name="situation"
            defaultValue={guide.situation}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {ENTRY_PATHS.map(p => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="timeline" label="Your timeline" error={errors["timeline"]}>
          <select
            id="timeline"
            name="timeline"
            defaultValue=""
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Choose one
            </option>
            {TIMELINE_OPTIONS.map(t => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-5 flex items-start gap-2">
        <input id="consent" name="consent" type="checkbox" className="mt-1" />
        <Label htmlFor="consent" className="text-xs font-normal leading-relaxed text-muted-foreground">
          {CONSENT_TEXT}
        </Label>
      </div>
      {errors["consent"] && (
        <p className="mt-1 text-xs text-destructive">{errors["consent"]}</p>
      )}

      <Button type="submit" size="lg" className="mt-5">
        {guide.primaryCta}
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">{guide.disclaimer}</p>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-sm text-heritage">
        {label}
      </Label>
      <div className="mt-1.5">{children}</div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
