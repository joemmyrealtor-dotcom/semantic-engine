import { createFileRoute } from "@tanstack/react-router";
import { PublicShell } from "@/components/public-shell";
import { ReadinessAssessment } from "@/components/readiness-assessment";
import { BRAND } from "@/lib/marketing/positioning";

const TITLE = "Real Estate Readiness Assessment | Legacy Forge";
const DESC =
  "Six questions on timeline, authority, numbers, condition, alignment, and pressure — then a scored readiness result and your next three steps.";

export const Route = createFileRoute("/assessment")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${BRAND.origin}/assessment` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${BRAND.origin}/assessment` }],
  }),
  component: AssessmentRoute,
});

function AssessmentRoute() {
  return (
    <PublicShell>
      <header className="mx-auto max-w-3xl px-4 pt-14 pb-2 md:px-6 md:pt-20">
        <div className="text-[10px] uppercase tracking-[0.22em] text-gold">Assessment</div>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-heritage md:text-4xl">
          How ready are you, really?
        </h1>
        <p className="mt-4 text-muted-foreground">
          Six questions. No email required to see your result. You will get a readiness score, the
          risks specific to your answers, and the next three steps that actually move you forward.
        </p>
      </header>
      <ReadinessAssessment />
    </PublicShell>
  );
}
