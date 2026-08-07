import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/public-shell";
import { AssessmentRunner } from "@/components/assessment-runner";
import { getAssessment, type AssessmentDefinition } from "@/lib/marketing/assessments";
import { BRAND } from "@/lib/marketing/positioning";

export const Route = createFileRoute("/assessments/$slug")({
  loader: ({ params }) => {
    const assessment = getAssessment(params.slug);
    if (!assessment) throw notFound();
    return { assessment };
  },
  head: ({ loaderData }) => {
    const a = loaderData?.assessment;
    if (!a) {
      return {
        meta: [
          { title: "Assessment unavailable | Legacy Forge" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const url = `${BRAND.origin}/assessments/${a.slug}`;
    return {
      meta: [
        { title: a.metaTitle },
        { name: "description", content: a.metaDescription },
        { property: "og:title", content: a.metaTitle },
        { property: "og:description", content: a.metaDescription },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: AssessmentNotFound,
  component: AssessmentRoute,
});

function AssessmentNotFound() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-24 md:px-6">
        <h1 className="font-serif text-3xl text-heritage">That assessment does not exist</h1>
        <Button asChild className="mt-6">
          <Link to="/assessments">See all assessments</Link>
        </Button>
      </div>
    </PublicShell>
  );
}

function AssessmentRoute() {
  const { assessment } = Route.useLoaderData() as { assessment: AssessmentDefinition };
  return (
    <PublicShell>
      <header className="mx-auto max-w-3xl px-4 pt-14 pb-8 md:px-6 md:pt-20">
        <div className="text-[10px] uppercase tracking-[0.22em] text-gold">
          {assessment.id} · {assessment.audience}
        </div>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-heritage md:text-4xl">
          {assessment.title}
        </h1>
        <p className="mt-4 text-muted-foreground">{assessment.description}</p>
      </header>
      <AssessmentRunner assessment={assessment} />
    </PublicShell>
  );
}
