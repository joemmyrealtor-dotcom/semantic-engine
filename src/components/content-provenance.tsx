// SEO/AEO hardening — visible provenance (E-E-A-T).
//
// Only repository-verified facts appear here: who wrote the content, who
// publishes it, what it is for, and its limits. No dates, credentials,
// review counts, or results are synthesized.

import { Link } from "@tanstack/react-router";
import { BookOpen, ShieldCheck, UserRound } from "lucide-react";
import { BRAND } from "@/lib/marketing/positioning";

export interface ContentProvenanceProps {
  /** What kind of page this is, e.g. "Guide", "Local guide", "Assessment". */
  kind: string;
  /** One line on how this page was produced or what it draws on. */
  basis: string;
}

export function ContentProvenance({ kind, basis }: ContentProvenanceProps) {
  return (
    <aside
      aria-label="Content provenance"
      data-testid="content-provenance"
      className="mx-auto max-w-3xl px-4 md:px-6"
    >
      <div className="rounded-lg border border-border bg-card p-5 text-sm">
        <h2 className="font-serif text-base text-heritage">About this {kind.toLowerCase()}</h2>
        <dl className="mt-3 space-y-2 text-muted-foreground">
          <div className="flex gap-2">
            <UserRound className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
            <div>
              <dt className="inline font-medium text-heritage">Written by </dt>
              <dd className="inline">
                {BRAND.advisor}, {BRAND.publisher}.
              </dd>
            </div>
          </div>
          <div className="flex gap-2">
            <BookOpen className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
            <div>
              <dt className="inline font-medium text-heritage">Basis </dt>
              <dd className="inline">{basis}</dd>
            </div>
          </div>
          <div className="flex gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-evergreen" aria-hidden="true" />
            <div>
              <dt className="inline font-medium text-heritage">Limits </dt>
              <dd className="inline">
                Educational content only. Not legal, tax, or financial advice. Confirm anything
                specific to your situation with your attorney, CPA, or lender. Equal Housing
                Opportunity.
              </dd>
            </div>
          </div>
        </dl>
        <p className="mt-3 text-xs">
          <Link to="/editorial-policy" className="underline hover:text-heritage">
            How this content is written, reviewed, and corrected
          </Link>
        </p>
      </div>
    </aside>
  );
}
