// Local SEO Expansion — shared renderer for wave-one local pages.
//
// One component serves both the county hub and the city pages so the AEO
// structure (question → direct answer → factors → scenarios → decision path →
// costs → local context → PAA → engagement paths) is identical everywhere and
// can be verified by a single test.

import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AnswerFirst } from "@/components/answer-first";
import { ContentProvenance } from "@/components/content-provenance";
import { RelatedResources } from "@/components/related-resources";
import type { RelatedLink } from "@/lib/marketing/internal-links";
import { GUIDES } from "@/lib/marketing/lead-magnets";
import { ASSESSMENTS } from "@/lib/marketing/assessments";
import { PROFESSIONAL_PAGES } from "@/lib/partners/pages";
import { citiesForCluster, getLocalHub, type LocalPageSpec } from "@/lib/marketing/local-pages";

export function localCrumbs(spec: LocalPageSpec) {
  const base = [
    { name: "Home", path: "/home" },
    { name: "Local", path: "/local" },
  ];
  if (spec.level === "hub") return [...base, { name: spec.clusterLabel, path: spec.path }];
  return [
    ...base,
    { name: spec.clusterLabel, path: `/local/${spec.cluster}` },
    { name: spec.place, path: spec.path },
  ];
}

function engagementLinks(spec: LocalPageSpec): RelatedLink[] {
  const links: RelatedLink[] = [];
  const guide = GUIDES.find(g => g.slug === spec.guideSlug);
  if (guide) {
    links.push({
      label: guide.title,
      to: `/guides/${guide.slug}`,
      description: guide.promise,
      kind: "guide",
    });
  }
  const assessment = ASSESSMENTS.find(a => a.slug === spec.assessmentSlug);
  if (assessment) {
    links.push({
      label: assessment.title,
      to: `/assessments/${assessment.slug}`,
      description: assessment.description,
      kind: "assessment",
    });
  }
  links.push({
    label: `${spec.clusterLabel} — the full plan`,
    to: spec.pillarPath,
    description: "The situation plan this local page sits under.",
    kind: "pillar",
  });
  links.push({
    label: `Working with ${PROFESSIONAL_PAGES[spec.referralAudience].navLabel.toLowerCase()}`,
    to: `/for/${spec.referralAudience}`,
    description: "How we coordinate with the professionals already advising you.",
    kind: "hub",
  });
  if (spec.level === "city") {
    links.push({
      label: `${spec.place} real estate guide`,
      to: `/local-guides/${spec.geography}`,
      description: `Housing stock, submarkets, and process notes for ${spec.place}.`,
      kind: "city",
    });
  }
  return links;
}

export function LocalPageView({ spec }: { spec: LocalPageSpec }) {
  const siblings = citiesForCluster(spec.cluster).filter(p => p.path !== spec.path);
  const hub = getLocalHub(spec.cluster);

  return (
    <article>
      <Breadcrumbs crumbs={localCrumbs(spec)} />

      <header className="mx-auto max-w-6xl px-4 pt-8 pb-8 md:px-6 md:pt-12">
        <div className="text-[10px] uppercase tracking-[0.22em] text-gold">
          {spec.place} · {spec.clusterLabel}
        </div>
        <h1 className="mt-3 max-w-3xl font-serif text-3xl leading-tight text-heritage md:text-5xl">
          {spec.question}
        </h1>
      </header>

      <AnswerFirst
        question="Short answer"
        answer={spec.directAnswer}
        points={spec.keyFactors.slice(0, 3)}
      />

      <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
        <section>
          <h2 className="font-serif text-2xl text-heritage">What actually decides this</h2>
          <ul className="mt-5 space-y-3">
            {spec.keyFactors.map(f => (
              <li key={f} className="flex gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-evergreen" aria-hidden="true" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl text-heritage">Situations we see most</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {spec.scenarios.map(s => (
              <div key={s.title} className="rounded-lg border border-border bg-card p-5">
                <h3 className="font-serif text-lg text-heritage">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl text-heritage">The decision path, in order</h2>
          <ol className="mt-5 space-y-3">
            {spec.decisionPath.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm text-muted-foreground">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-gold text-xs text-heritage">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl text-heritage">Costs and timing to plan for</h2>
          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {spec.costTiming.map(c => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl text-heritage">
            What is specific to {spec.place}
          </h2>
          <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
            {spec.localConsiderations.map(n => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            <span className="text-heritage">Areas covered: </span>
            {spec.neighborhoods.join(" · ")}
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl text-heritage">People also ask</h2>
          <dl className="mt-4 space-y-5">
            {spec.paa.map(f => (
              <div key={f.q}>
                <dt className="font-medium text-heritage">{f.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-12 rounded-lg border border-gold/40 bg-card p-6">
          <h2 className="font-serif text-2xl text-heritage">Your next step</h2>
          <p className="mt-2 text-sm text-muted-foreground">{spec.nextStep}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/contact">Book a {spec.place} strategy call</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/assessments/$slug" params={{ slug: spec.assessmentSlug }}>
                Take the {spec.clusterLabel.toLowerCase()} assessment
              </Link>
            </Button>
          </div>
        </section>

        {(siblings.length > 0 || (hub && hub.path !== spec.path)) && (
          <section className="mt-12">
            <h2 className="font-serif text-2xl text-heritage">
              {spec.clusterLabel} in nearby areas
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {hub && hub.path !== spec.path && (
                <li>
                  <Link
                    to="/local/$cluster/"
                    params={{ cluster: spec.cluster }}
                    className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-gold hover:text-heritage"
                  >
                    {spec.clusterLabel} across Orange County
                  </Link>
                </li>
              )}
              {siblings.map(s => (
                <li key={s.path}>
                  <Link
                    to="/local/$cluster/$city"
                    params={{ cluster: s.cluster, city: s.geography }}
                    className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-gold hover:text-heritage"
                  >
                    {s.place}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-10 text-xs text-muted-foreground">
          Educational content only. Not legal, tax, or financial advice. Equal Housing
          Opportunity.
        </p>
      </div>

      <ContentProvenance
        kind="local situation page"
        basis={`Written from transaction, probate, and trust work in ${spec.place} and the surrounding Orange County submarkets. Process and decision guidance only — no performance claims, no market predictions, and no community characterizations.`}
      />

      <RelatedResources
        links={engagementLinks(spec)}
        heading={`Keep going on ${spec.clusterLabel.toLowerCase()} in ${spec.place}`}
        intro="Every page here has one job: get you to a decision you can defend."
      />
    </article>
  );
}
