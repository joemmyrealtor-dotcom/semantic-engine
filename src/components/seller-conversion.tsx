import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { LeadCaptureForm } from "@/components/lead-capture-form";
import { LICENSE } from "@/lib/marketing/positioning";
import { SELLER_HOOKS } from "@/lib/marketing/seller-hooks";
import { trackAction } from "@/lib/marketing/analytics";

export function SellerConversion() {
  const [done, setDone] = useState<string | null>(null);

  return (
    <>
      <section aria-label="Home value and selling strategy" className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-evergreen">For North Orange County sellers</p>
            <h2 className="mt-3 font-serif text-3xl text-heritage md:text-4xl">Protect your equity. Plan your next move.</h2>
            <p className="mt-4 text-muted-foreground">
              Get a home value based on local closed sales, an estimate of what you would actually net, and a written
              selling plan — before you commit to anything.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>Licensed since 2005</li>
              <li>Based in Brea</li>
              <li>DRE #{LICENSE.dreLicense}</li>
            </ul>
          </div>
          {done ? (
            <div role="status" className="rounded-lg border border-border bg-background p-6">
              <CheckCircle2 className="size-6 text-evergreen" aria-hidden="true" />
              <h3 className="mt-3 font-serif text-xl text-heritage">Thank you. Your request is in.</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Joe will review recent sales near your home and follow up to confirm the property details and your goals.
              </p>
              <p className="mt-4 text-sm">
                Prefer to talk now?{" "}
                <a className="font-medium text-heritage underline" href={LICENSE.phoneHref}
                  onClick={() => trackAction("phone_clicked", { label: "seller_thank_you_phone", ctaLocation: "seller_thank_you_phone" })}>
                  Call Joe at (562) 640-1466.
                </a>
              </p>
              <p className="mt-4 text-xs text-muted-foreground">Your information will be used to respond to this request.</p>
            </div>
          ) : (
            <LeadCaptureForm
              heading="Get My Home Value and Selling Strategy"
              blurb="A few short fields. No obligation."
              submitLabel="Get My Home Value and Selling Strategy"
              formId="sellers:home-value"
              leadSource="Seller home value request"
              campaign="seller-conversion"
              defaultSituation="sellers"
              showProperty
              showConsultation
              onSuccess={(_o, values) => setDone(values.firstName)}
            />
          )}
        </div>
      </section>

      <section aria-label="Ten questions sellers ask" className="mx-auto max-w-3xl px-4 py-14 md:px-6">
        <h2 className="font-serif text-2xl text-heritage">10 questions sellers ask before they list</h2>
        <div className="mt-6 divide-y divide-border">
          {SELLER_HOOKS.map(h => (
            <details key={h.id} className="py-4">
              <summary className="cursor-pointer font-medium text-heritage">{h.question}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{h.answer}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-sm">
          <Link to="/contact" className="font-medium text-heritage underline"
            onClick={() => trackAction("consultation_clicked", { label: "seller_questions_cta", ctaLocation: "seller_questions_cta" })}>
            Talk through your situation with Joe
          </Link>
        </p>
        <p className="mt-3 text-xs text-muted-foreground">Educational content only. Not legal, tax, or financial advice.</p>
      </section>
    </>
  );
}
