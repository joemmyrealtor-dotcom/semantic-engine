// SEO/AEO hardening — related-resources block for topic clusters.

import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { RelatedLink } from "@/lib/marketing/internal-links";

export function RelatedResources({
  links,
  heading = "Keep going from here",
  intro,
}: {
  links: RelatedLink[];
  heading?: string;
  intro?: string;
}) {
  if (links.length === 0) return null;
  return (
    <section
      aria-labelledby="related-resources"
      data-testid="related-resources"
      className="mx-auto max-w-3xl px-4 py-10 md:px-6"
    >
      <h2 id="related-resources" className="font-serif text-2xl text-heritage">
        {heading}
      </h2>
      {intro && <p className="mt-2 text-sm text-muted-foreground">{intro}</p>}
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {links.map(l => (
          <li key={`${l.kind}-${l.to}-${l.label}`}>
            <Link
              to={l.to}
              className="group flex h-full flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-gold"
            >
              <span className="text-[10px] uppercase tracking-[0.2em] text-gold">{l.kind}</span>
              <span className="mt-1 font-medium text-heritage">{l.label}</span>
              <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {l.description}
              </span>
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-heritage">
                Open
                <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
