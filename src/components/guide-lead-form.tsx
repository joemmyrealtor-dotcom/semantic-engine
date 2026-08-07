// Task 22A / 24 — Guide lead capture; wraps the shared lead-capture form.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadCaptureForm } from "@/components/lead-capture-form";
import { trackAction } from "@/lib/marketing/analytics";
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
  const [submitted, setSubmitted] = useState(false);
  const [city, setCity] = useState("");

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
              onClick={() =>
                trackAction("consultation_clicked", { guideId: guide.id, label: "assessment" })
              }
            >
              Take the matching assessment
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link
              to="/contact"
              onClick={() =>
                trackAction("consultation_clicked", { guideId: guide.id, label: "contact" })
              }
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
    <LeadCaptureForm
      heading={guide.primaryCta}
      blurb="A few short fields. You get the downloadable guide immediately."
      submitLabel={guide.primaryCta}
      formId={`guide:${guide.slug}`}
      leadSource={guide.crmLeadSource}
      campaign={guide.crmCampaign}
      defaultSituation={guide.situation}
      guideId={guide.id}
      guideSlug={guide.slug}
      showProperty
      showConsultation
      disclaimer={guide.disclaimer}
      onSuccess={(_outcome, values) => {
        setCity(values.city);
        setSubmitted(true);
        downloadGuide(guide);
        trackAction("lead_magnet_downloaded", {
          guideId: guide.id,
          leadMagnet: guide.id,
          situation: values.situation,
          city: values.city,
        });
      }}
    />
  );
}
