import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/public-shell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AnswerFirst } from "@/components/answer-first";
import { ContentProvenance } from "@/components/content-provenance";
import { RelatedResources } from "@/components/related-resources";
import { cityCluster } from "@/lib/marketing/internal-links";
import { CITY_GUIDES, cityJsonLd, getCityGuide, type CityGuide } from "@/lib/marketing/cities";
import { BRAND } from "@/lib/marketing/positioning";
import { publicMeta, canonicalLink } from "@/lib/marketing/seo";
import { jsonLdScript, siteGraph, breadcrumbGraph, faqGraph } from "@/lib/marketing/schema";

export const Route = createFileRoute("/local-guides/$city")({
  loader: ({ params }) => {
    const guide = getCityGuide(params.city);
    if (!guide) throw notFound();
    return { guide };
  },
  head: ({ loaderData }) => {
    const guide = loaderData?.guide;
    if (!guide) {
      return {
        meta: [
          { title: "Guide unavailable | Legacy Forge" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }
    const path = `/local-guides/${guide.slug}`;
    return {
      meta: publicMeta({
        path,
        title: guide.metaTitle,
        description: guide.metaDescription,
      }),
      links: [canonicalLink(path)],
      scripts: [
        // Site entity graph is emitted once here; the city page itself
        // describes an area served, never a local storefront.
        jsonLdScript(siteGraph([guide.city, guide.county])),
        jsonLdScript(
          breadcrumbGraph([
            { name: "Home", path: "/home" },
            { name: "Local guides", path: "/local-guides" },
            { name: guide.city, path },
          ]),
        ),
        { type: "application/ld+json", children: JSON.stringify(cityJsonLd(guide)) },
        ...(guide.faqs.length > 0 ? [jsonLdScript(faqGraph(path, guide.faqs))] : []),
      ],
    };
  },

  notFoundComponent: CityNotFound,
  component: CityGuideRoute,
});

function CityNotFound() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-24 md:px-6">
        <h1 className="font-serif text-3xl text-heritage">We do not have that city guide yet</h1>
        <p className="mt-3 text-muted-foreground">
          Browse the submarkets we cover, or ask us about yours.
        </p>
        <Button asChild className="mt-6">
          <Link to="/local-guides">See all local guides</Link>
        </Button>
      </div>
    </PublicShell>
  );
}

function CityGuideRoute() {
  const { guide } = Route.useLoaderData() as { guide: CityGuide };
  const others = CITY_GUIDES.filter(c => c.slug !== guide.slug);

  return (
    <PublicShell>
      <article>
        <Breadcrumbs
          crumbs={[
            { name: "Home", path: "/home" },
            { name: "Local guides", path: "/local-guides" },
            { name: guide.city, path: `/local-guides/${guide.slug}` },
          ]}
        />
        <header className="mx-auto max-w-6xl px-4 pt-8 pb-8 md:px-6 md:pt-12">
          <div className="text-[10px] uppercase tracking-[0.22em] text-gold">
            {guide.county} · Local guide
          </div>
          <h1 className="mt-3 max-w-3xl font-serif text-3xl leading-tight text-heritage md:text-5xl">
            {guide.city} real estate: the decisions that actually move your outcome
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">{guide.intro}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/contact">Book a {guide.city} strategy call</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/assessments">Take the readiness assessment</Link>
            </Button>
          </div>
        </header>

        <div className="mb-8">
          <AnswerFirst
            question={`What should you know before selling or buying in ${guide.city}?`}
            answer={guide.intro}
            points={guide.marketNotes.slice(0, 3)}
          />
        </div>



        <section aria-label="Market notes" className="border-y border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
            <h2 className="font-serif text-2xl text-heritage">What matters in {guide.city}</h2>
            <ul className="mt-5 grid gap-4 md:grid-cols-3">
              {guide.marketNotes.map(n => (
                <li key={n} className="flex gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-evergreen" aria-hidden="true" />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-4 py-14 md:px-6">
          <section>
            <h2 className="font-serif text-2xl text-heritage">Start where you are</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {guide.situations.map(s => (
                <Link
                  key={s.title}
                  to={s.to}
                  className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-gold"
                >
                  <h3 className="font-serif text-lg text-heritage">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h2 className="font-serif text-2xl text-heritage">Areas we work in {guide.city}</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {guide.neighborhoods.join(" · ")}
            </p>
          </section>

          <section className="mt-12">
            <h2 className="font-serif text-2xl text-heritage">{guide.city} questions we get</h2>
            <dl className="mt-4 space-y-5">
              {guide.faqs.map(f => (
                <div key={f.q}>
                  <dt className="font-medium text-heritage">{f.q}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-12">
            <h2 className="font-serif text-2xl text-heritage">Nearby submarkets</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {others.map(c => (
                <li key={c.slug}>
                  <Link
                    to="/local-guides/$city"
                    params={{ city: c.slug }}
                    className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-gold hover:text-heritage"
                  >
                    {c.city}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <p className="mt-10 text-xs text-muted-foreground">
            Educational content only. Not legal, tax, or financial advice. Equal Housing
            Opportunity.
          </p>
        </div>
      </article>
    </PublicShell>
  );
}
