import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PublicShell } from "@/components/public-shell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AnswerFirst } from "@/components/answer-first";
import { ContentProvenance } from "@/components/content-provenance";
import { RelatedResources } from "@/components/related-resources";
import { Button } from "@/components/ui/button";
import {
  getAnswer,
  localAnglesFor,
  metaDescriptionFor,
  metaTitleFor,
  answersByAudience,
} from "@/lib/marketing/answers";
import { guideCluster } from "@/lib/marketing/internal-links";
import { publicMeta, canonicalLink } from "@/lib/marketing/seo";
import { jsonLdScript, siteGraph, breadcrumbGraph, articleGraph, faqGraph } from "@/lib/marketing/schema";

export const Route = createFileRoute("/answers/$slug")({
  loader: ({ params }) => {
    const answer = getAnswer(params.slug);
    if (!answer) throw notFound();
    return { answer };
  },
  head: ({ loaderData }) => {
    const answer = loaderData?.answer;
    if (!answer) {
      return {
        meta: [
          { title: "Answer unavailable | Legacy Forge" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }
    const path = `/answers/${answer.slug}`;
    return {
      meta: publicMeta({
        path,
        title: metaTitleFor(answer),
        description: metaDescriptionFor(answer),
        type: "article",
      }),
      links: [canonicalLink(path)],
      scripts: [
        jsonLdScript(siteGraph()),
        jsonLdScript(
          breadcrumbGraph([
            { name: "Home", path: "/home" },
            { name: "Answers", path: "/answers" },
            { name: answer.question, path },
          ]),
        ),
        jsonLdScript(
          articleGraph({
            path,
            headline: answer.question,
            description: metaDescriptionFor(answer),
            about: [answer.cluster, answer.audience === "seller" ? "Selling a home" : "Buying a home"],
            isPartOfPath: "/answers",
          }),
        ),
        jsonLdScript(faqGraph(path, [{ q: answer.question, a: answer.shortAnswer }])),
      ],
    };
  },
  component: AnswerPage,
});

function AnswerPage() {
  const { answer } = Route.useLoaderData();
  const locals = localAnglesFor(answer);
  const siblings = answersByAudience(answer.audience)
    .filter(a => a.cluster === answer.cluster && a.slug !== answer.slug)
    .slice(0, 4);

  return (
    <PublicShell>
      <Breadcrumbs
        crumbs={[
          { name: "Home", path: "/home" },
          { name: "Answers", path: "/answers" },
          { name: answer.question, path: `/answers/${answer.slug}` },
        ]}
      />

      <header className="mx-auto max-w-3xl px-4 pt-8 pb-6 md:px-6 md:pt-12">
        <div className="text-[10px] uppercase tracking-[0.22em] text-gold">
          {answer.audience === "seller" ? "Seller question" : "Buyer question"} · {answer.cluster}
        </div>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-heritage md:text-4xl">
          {answer.question}
        </h1>
      </header>

      <AnswerFirst question="Short answer" answer={answer.shortAnswer} />

      {answer.detail && (
        <section className="mx-auto max-w-3xl px-4 py-8 md:px-6">
          <h2 className="font-serif text-2xl text-heritage">What drives the answer</h2>
          <p className="mt-3 leading-relaxed text-foreground/90">{answer.detail}</p>
        </section>
      )}

      {locals.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 pb-8 md:px-6">
          <h2 className="font-serif text-2xl text-heritage">How this plays locally</h2>
          <ul className="mt-4 space-y-3">
            {locals.map(l => (
              <li key={l.slug} className="rounded-lg border border-border bg-card p-4">
                <Link
                  to="/local-guides/$city"
                  params={{ city: l.slug }}
                  className="font-medium text-heritage underline-offset-4 hover:underline"
                >
                  {l.city}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">{l.note}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {siblings.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 pb-8 md:px-6">
          <h2 className="font-serif text-2xl text-heritage">More on {answer.cluster.toLowerCase()}</h2>
          <ul className="mt-4 space-y-2">
            {siblings.map(s => (
              <li key={s.slug}>
                <Link
                  to="/answers/$slug"
                  params={{ slug: s.slug }}
                  className="text-heritage underline-offset-4 hover:underline"
                >
                  {s.question}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto max-w-3xl px-4 pb-8 md:px-6">
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/guides/$slug" params={{ slug: answer.guideSlug }}>
              Read the full {answer.audience} guide
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/assessments/$slug" params={{ slug: answer.assessmentSlug }}>
              Take the readiness assessment
            </Link>
          </Button>
        </div>
      </section>

      <ContentProvenance
        kind="answer"
        basis={`Drawn from ${answer.publicationId} in the Legacy Forge publication library, reviewed under the editorial policy.`}
      />

      <RelatedResources links={guideCluster(answer.situation, answer.assessmentSlug)} />
    </PublicShell>
  );
}
