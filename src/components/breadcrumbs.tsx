// SEO/AEO hardening — visible breadcrumb trail.
//
// Renders the same trail that breadcrumbGraph() emits as JSON-LD, so the
// structured data always mirrors what a person can see and click.

import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { Crumb } from "@/lib/marketing/schema";

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  if (crumbs.length < 2) return null;
  return (
    <nav aria-label="Breadcrumb" className="mx-auto max-w-6xl px-4 pt-6 md:px-6">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.path} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3" aria-hidden="true" />}
              {last ? (
                <span aria-current="page" className="text-heritage">
                  {c.name}
                </span>
              ) : (
                <Link to={c.path} className="hover:text-heritage hover:underline">
                  {c.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
