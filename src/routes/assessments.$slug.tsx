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
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }
    const path = `/assessments/${a.slug}`;
    return {
      meta: publicMeta({ path, title: a.metaTitle, description: a.metaDescription }),
      links: [canonicalLink(path)],
      scripts: [
        jsonLdScript(siteGraph()),
        jsonLdScript(
          breadcrumbGraph([
            { name: "Home", path: "/home" },
            { name: "Assessments", path: "/assessments" },
            { name: a.title, path },
          ]),
        ),
      ],
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
      <Breadcrumbs
        crumbs={[
          { name: "Home", path: "/home" },
          { name: "Assessments", path: "/assessments" },
          { name: assessment.title, path: `/assessments/${assessment.slug}` },
        ]}
      />
      <header className="mx-auto max-w-3xl px-4 pt-8 pb-8 md:px-6 md:pt-12">
        <div className="text-[10px] uppercase tracking-[0.22em] text-gold">
          {assessment.id} · {assessment.audience}
        </div>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-heritage md:text-4xl">
          {assessment.title}
        </h1>
        <p className="mt-4 text-muted-foreground">{assessment.description}</p>
      </header>

      <AnswerFirst
        question={`What does the ${assessment.title} tell you?`}
        answer={`${assessment.description} It takes a few minutes, runs entirely in your browser, and returns a readiness level, your top priorities, the risks in your answers, and a recommended next action. No email is required to see your result.`}
      />

      <AssessmentRunner assessment={assessment} />

      <RelatedResources
        links={guideCluster(assessment.situation)}
        heading="Read the guidance behind this assessment"
      />
    </PublicShell>
  );
}

