import { useEffect } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/public-shell";
import { GuideLeadForm } from "@/components/guide-lead-form";
import { getGuide, type GuideDefinition } from "@/lib/marketing/lead-magnets";
import { getAssessment } from "@/lib/marketing/assessments";
import { BRAND } from "@/lib/marketing/positioning";
import { trackEvent } from "@/lib/marketing/analytics";
import { publicMeta, canonicalLink } from "@/lib/marketing/seo";
import { jsonLdScript, siteGraph, breadcrumbGraph, articleGraph } from "@/lib/marketing/schema";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AnswerFirst } from "@/components/answer-first";
import { ContentProvenance } from "@/components/content-provenance";
import { RelatedResources } from "@/components/related-resources";
import { guideCluster } from "@/lib/marketing/internal-links";

export const Route = createFileRoute("/guides/$slug")({
  loader: ({ params }) => {
    const guide = getGuide(params.slug);
    if (!guide) throw notFound();
    return { guide };
  },
  head: ({ loaderData }) => {
    const guide = loaderData?.guide;
    if (!guide) {
      return {
        meta: [{ title: "Guide unavailable | Legacy Forge" }, { name: "robots", content: "noindex,nofollow" }],
      };
    }
    const path = `/guides/${guide.slug}`;
    return {
      meta: publicMeta({
        path,
        title: guide.metaTitle,
        description: guide.metaDescription,
        type: "article",
      }),
      links: [canonicalLink(path)],
      scripts: [
        jsonLdScript(siteGraph()),
        jsonLdScript(
          breadcrumbGraph([
            { name: "Home", path: "/home" },
            { name: "Guides", path: "/guides" },
            { name: guide.title, path },
          ]),
        ),
        jsonLdScript(
          articleGraph({
            path,
            headline: guide.title,
            description: guide.metaDescription,
            about: [guide.audience, guide.promise],
            isPartOfPath: "/guides",
          }),
        ),
      ],
    };
  },
  notFoundComponent: GuideNotFound,
  component: GuideRoute,
});

function GuideNotFound() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-24 md:px-6">
        <h1 className="font-serif text-3xl text-heritage">That guide is not published</h1>
        <Button asChild className="mt-6">
          <Link to="/guides">See all guides</Link>
        </Button>
      </div>
    </PublicShell>
  );
}

function GuideRoute() {
  const { guide } = Route.useLoaderData() as { guide: GuideDefinition };
  const assessment = getAssessment(guide.assessmentSlug);

  useEffect(() => {
    trackEvent("guide_viewed", { guideId: guide.id, situation: guide.situation });
  }, [guide.id, guide.situation]);

  return (
    <PublicShell>
      <article>
        <header className="mx-auto max-w-6xl px-4 pt-14 pb-10 md:px-6 md:pt-20">
          <div className="text-[10px] uppercase tracking-[0.22em] text-gold">
            Guide {guide.id} · v{guide.version} · {guide.audience}
          </div>
          <h1 className="mt-3 max-w-3xl font-serif text-3xl leading-tight text-heritage md:text-5xl">
            {guide.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            {guide.promise}
          </p>
        </header>

        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-8 md:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            {guide.sections.map(s => (
              <section key={s.heading} className="mb-10">
                <h2 className="font-serif text-2xl text-heritage">{s.heading}</h2>
                <p className="mt-3 leading-relaxed text-foreground/90">{s.body}</p>
                {s.bullets && (
                  <ul className="mt-4 space-y-2">
                    {s.bullets.map(b => (
                      <li key={b} className="flex gap-2 text-sm text-muted-foreground">
                        <Check className="mt-0.5 size-4 shrink-0 text-evergreen" aria-hidden="true" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            <section className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-serif text-2xl text-heritage">Your checklist</h2>
              <ul className="mt-4 space-y-2">
                {guide.checklist.map(c => (
                  <li key={c} className="flex gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-evergreen" aria-hidden="true" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-10">
              <h2 className="font-serif text-2xl text-heritage">Go deeper</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {assessment && (
                  <Link
                    to="/assessments/$slug"
                    params={{ slug: assessment.slug }}
                    className="rounded-lg border border-border p-4 transition-colors hover:border-gold"
                  >
                    <div className="text-[10px] uppercase tracking-[0.2em] text-gold">
                      Assessment
                    </div>
                    <div className="mt-1 font-serif text-lg text-heritage">{assessment.title}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{assessment.description}</p>
                  </Link>
                )}
                <Link
                  to="/resources"
                  className="rounded-lg border border-border p-4 transition-colors hover:border-gold"
                >
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gold">
                    Supporting publications
                  </div>
                  <div className="mt-1 font-serif text-lg text-heritage">
                    {guide.publicationIds.join(", ")}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Full-length guides in the Legacy Forge library.
                  </p>
                </Link>
              </div>
            </section>

            <p className="mt-8 text-xs text-muted-foreground">{guide.disclaimer}</p>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <GuideLeadForm guide={guide} />
          </aside>
        </div>
      </article>
    </PublicShell>
  );
}
