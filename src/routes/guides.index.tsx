import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GUIDES } from "@/lib/marketing/lead-magnets";
import { publicMeta, canonicalLink } from "@/lib/marketing/seo";
import { jsonLdScript, siteGraph, breadcrumbGraph } from "@/lib/marketing/schema";
import { absoluteUrl } from "@/lib/marketing/site";

const TITLE = "Free Real Estate Decision Guides | Legacy Forge";
const DESC =
  "Six decision guides for sellers, buyers, heirs, downsizers, distressed owners, and owners weighing sell versus rent. Written to be used, not skimmed.";

export const Route = createFileRoute("/guides/")({
  head: () => ({
    meta: publicMeta({ path: "/guides", title: TITLE, description: DESC }),
    links: [canonicalLink("/guides")],
    scripts: [
      jsonLdScript(siteGraph()),
      jsonLdScript(
        breadcrumbGraph([
          { name: "Home", path: "/home" },
          { name: "Guides", path: "/guides" },
        ]),
      ),
      jsonLdScript({
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: GUIDES.map((g, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: g.title,
          url: absoluteUrl(`/guides/${g.slug}`),
        })),
      }),
    ],
  }),
  component: GuidesIndex,

});

function GuidesIndex() {
  return (
    <PublicShell>
      <Breadcrumbs
        crumbs={[
          { name: "Home", path: "/home" },
          { name: "Guides", path: "/guides" },
        ]}
      />
      <header className="mx-auto max-w-6xl px-4 pt-8 pb-8 md:px-6 md:pt-12">
        <div className="text-[10px] uppercase tracking-[0.22em] text-gold">Guides</div>
        <h1 className="mt-3 max-w-3xl font-serif text-3xl leading-tight text-heritage md:text-5xl">
          Decision guides, not brochures
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground md:text-lg">
          Each guide is readable in full on the page. The download is a convenience, not a
          paywall.
        </p>
      </header>
      <div className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 md:grid-cols-2 md:px-6 lg:grid-cols-3">
        {GUIDES.map(g => (
          <Link
            key={g.id}
            to="/guides/$slug"
            params={{ slug: g.slug }}
            className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-gold"
          >
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold">{g.audience}</div>
            <h2 className="mt-2 font-serif text-lg text-heritage">{g.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{g.promise}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm text-heritage">
              {g.primaryCta}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </PublicShell>
  );
}
