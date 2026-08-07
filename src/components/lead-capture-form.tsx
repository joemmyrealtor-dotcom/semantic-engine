// Task 24 — One reusable lead-capture form for every conversion surface.
//
// Presentation only: validation, scoring, CRM mapping and analytics all
// live in src/lib/marketing/lead-capture.ts.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ENTRY_PATHS } from "@/lib/marketing/positioning";
import type { LeadQualification } from "@/lib/marketing/assessments";
import {
  CONSENT_TEXT,
  TIMELINE_OPTIONS,
  captureLead,
  leadFormSchema,
  type LeadCaptureOutcome,
  type LeadFormValues,
} from "@/lib/marketing/lead-capture";

export interface LeadCaptureFormProps {
  heading: string;
  blurb?: string;
  submitLabel: string;
  formId: string;
  leadSource: string;
  campaign: string;
  defaultSituation?: string;
  guideId?: string;
  guideSlug?: string;
  assessmentId?: string;
  readinessLevel?: string;
  qualification?: LeadQualification;
  showProperty?: boolean;
  showMotivation?: boolean;
  showReferralSource?: boolean;
  showConsultation?: boolean;
  disclaimer?: string;
  onSuccess?: (outcome: LeadCaptureOutcome, values: LeadFormValues) => void;
  children?: React.ReactNode;
}

export function LeadCaptureForm(props: LeadCaptureFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    const candidate = {
      firstName: String(fd.get("firstName") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      city: String(fd.get("city") ?? ""),
      situation: String(fd.get("situation") ?? ""),
      timeline: String(fd.get("timeline") ?? ""),
      propertyAddress: String(fd.get("propertyAddress") ?? ""),
      motivation: String(fd.get("motivation") ?? ""),
      referralSource: String(fd.get("referralSource") ?? ""),
      consultationRequested: fd.get("consultationRequested") === "on",
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
    setPending(true);
    try {
      const outcome = await captureLead({
        values: parsed.data,
        leadSource: props.leadSource,
        campaign: props.campaign,
        formId: props.formId,
        ...(props.guideId ? { guideId: props.guideId } : {}),
        ...(props.guideSlug ? { guideSlug: props.guideSlug } : {}),
        ...(props.assessmentId ? { assessmentId: props.assessmentId } : {}),
        ...(props.readinessLevel ? { readinessLevel: props.readinessLevel } : {}),
        ...(props.qualification ? { qualification: props.qualification } : {}),
      });
      props.onSuccess?.(outcome, parsed.data);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-serif text-2xl text-heritage">{props.heading}</h2>
      {props.blurb && <p className="mt-2 text-sm text-muted-foreground">{props.blurb}</p>}
      {props.children}

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
            defaultValue={props.defaultSituation ?? ENTRY_PATHS[0]?.id}
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

        {props.showProperty && (
          <Field
            id="propertyAddress"
            label="Property address (optional)"
            error={errors["propertyAddress"]}
          >
            <Input
              id="propertyAddress"
              name="propertyAddress"
              autoComplete="street-address"
              maxLength={160}
            />
          </Field>
        )}
        {props.showReferralSource && (
          <Field id="referralSource" label="Who referred you (optional)" error={errors["referralSource"]}>
            <Input id="referralSource" name="referralSource" maxLength={120} />
          </Field>
        )}
      </div>

      {props.showMotivation && (
        <div className="mt-4">
          <Field id="motivation" label="What is driving this move? (optional)" error={errors["motivation"]}>
            <Textarea id="motivation" name="motivation" rows={3} maxLength={600} />
          </Field>
        </div>
      )}

      {props.showConsultation && (
        <div className="mt-4 flex items-start gap-2">
          <input
            id="consultationRequested"
            name="consultationRequested"
            type="checkbox"
            className="mt-1"
          />
          <Label htmlFor="consultationRequested" className="text-sm font-normal text-muted-foreground">
            Yes — I would like a consultation about my situation.
          </Label>
        </div>
      )}

      <div className="mt-5 flex items-start gap-2">
        <input id="consent" name="consent" type="checkbox" className="mt-1" />
        <Label htmlFor="consent" className="text-xs font-normal leading-relaxed text-muted-foreground">
          {CONSENT_TEXT}{" "}
          <Link to="/privacy" className="underline">
            Privacy policy
          </Link>
          .
        </Label>
      </div>
      {errors["consent"] && <p className="mt-1 text-xs text-destructive">{errors["consent"]}</p>}

      <Button type="submit" size="lg" className="mt-5" disabled={pending}>
        {pending && <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" />}
        {props.submitLabel}
      </Button>
      {props.disclaimer && (
        <p className="mt-3 text-xs text-muted-foreground">{props.disclaimer}</p>
      )}
    </form>
  );
}

export function Field({
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
