import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { ASSESSMENTS } from "@/lib/marketing/assessments";
import { BRAND } from "@/lib/marketing/positioning";

const TITLE = "Real Estate Readiness Assessments | Legacy Forge";
const DESC =
  "Six situation-specific assessments — seller, buyer, probate, downsizing, distressed property, and investor — each producing priorities, risks, and a next action.";
const URL = `${BRAND.origin}/assessments`;

export const Route = createFileRoute("/assessments/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: AssessmentsIndex,
});

function AssessmentsIndex() {
  return (
    <PublicShell>
      <header className="mx-auto max-w-6xl px-4 pt-14 pb-8 md:px-6 md:pt-20">
        <div className="text-[10px] uppercase tracking-[0.22em] text-gold">Assessments</div>
        <h1 className="mt-3 max-w-3xl font-serif text-3xl leading-tight text-heritage md:text-5xl">
          Find out where you actually stand
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground md:text-lg">
          Every question maps to a decision factor. You get a readiness level, your top priorities,
          the risks in your answers, and a recommended next action — no email required.
        </p>
      </header>
      <div className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 md:grid-cols-2 md:px-6 lg:grid-cols-3">
        {ASSESSMENTS.map(a => (
          <Link
            key={a.id}
            to="/assessments/$slug"
            params={{ slug: a.slug }}
            className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-gold"
          >
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold">{a.audience}</div>
            <h2 className="mt-2 font-serif text-lg text-heritage">{a.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{a.description}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm text-heritage">
              Start · {a.questions.length} questions
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </PublicShell>
  );
}
