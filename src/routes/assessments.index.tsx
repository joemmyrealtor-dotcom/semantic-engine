import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ASSESSMENTS } from "@/lib/marketing/assessments";
import { publicMeta, canonicalLink } from "@/lib/marketing/seo";
import { jsonLdScript, siteGraph, breadcrumbGraph } from "@/lib/marketing/schema";
import { absoluteUrl } from "@/lib/marketing/site";

const TITLE = "Real Estate Readiness Assessments | Legacy Forge";
const DESC =
  "Six situation-specific assessments — seller, buyer, probate, downsizing, distressed property, and investor — each producing priorities, risks, and a next action.";

const CRUMBS = [
  { name: "Home", path: "/home" },
  { name: "Assessments", path: "/assessments" },
];

export const Route = createFileRoute("/assessments/")({
  head: () => ({
    meta: publicMeta({ path: "/assessments", title: TITLE, description: DESC }),
    links: [canonicalLink("/assessments")],
    scripts: [
      jsonLdScript(siteGraph()),
      jsonLdScript(breadcrumbGraph(CRUMBS)),
      jsonLdScript({
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: ASSESSMENTS.map((a, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: a.title,
          url: absoluteUrl(`/assessments/${a.slug}`),
        })),
      }),
    ],
  }),
  component: AssessmentsIndex,
});

function AssessmentsIndex() {
  return (
    <PublicShell>
      <Breadcrumbs crumbs={CRUMBS} />
      <header className="mx-auto max-w-6xl px-4 pt-8 pb-8 md:px-6 md:pt-12">

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
