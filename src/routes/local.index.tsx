import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/public-shell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AnswerFirst } from "@/components/answer-first";
import { LOCAL_HUBS, citiesForCluster } from "@/lib/marketing/local-pages";
import { publicMeta, canonicalLink } from "@/lib/marketing/seo";
import { jsonLdScript, siteGraph, breadcrumbGraph } from "@/lib/marketing/schema";

const TITLE = "Local situation pages for Orange County | Legacy Forge";
const DESCRIPTION =
  "Probate, inherited property, divorce, trust, selling, and distressed-property decisions answered city by city across north Orange County.";

export const Route = createFileRoute("/local/")({
  head: () => ({
    meta: publicMeta({ path: "/local", title: TITLE, description: DESCRIPTION }),
    links: [canonicalLink("/local")],
    scripts: [
      jsonLdScript(siteGraph()),
      jsonLdScript(
        breadcrumbGraph([
          { name: "Home", path: "/home" },
          { name: "Local", path: "/local" },
        ]),
      ),
    ],
  }),
  component: LocalIndex,
});

function LocalIndex() {
  return (
    <PublicShell>
      <Breadcrumbs
        crumbs={[
          { name: "Home", path: "/home" },
          { name: "Local", path: "/local" },
        ]}
      />
      <header className="mx-auto max-w-6xl px-4 pt-8 pb-8 md:px-6 md:pt-12">
        <div className="text-[10px] uppercase tracking-[0.22em] text-gold">Orange County</div>
        <h1 className="mt-3 max-w-3xl font-serif text-3xl leading-tight text-heritage md:text-5xl">
          Local situation pages
        </h1>
      </header>

      <AnswerFirst
        question="What is on these pages?"
        answer="Each page answers one question, for one situation, in one place: what decides the outcome, the scenarios we see most, the decision path in order, and what it costs in time and money. Start with your situation, then narrow to your city."
      />

      <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
        {LOCAL_HUBS.map(hub => {
          const cities = citiesForCluster(hub.cluster);
          return (
            <section key={hub.path} className="mb-10">
              <h2 className="font-serif text-2xl text-heritage">
                <Link to="/local/$cluster" params={{ cluster: hub.cluster }} className="hover:underline">
                  {hub.clusterLabel} in Orange County
                </Link>
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{hub.question}</p>
              {cities.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {cities.map(c => (
                    <li key={c.path}>
                      <Link
                        to="/local/$cluster/$city"
                        params={{ cluster: c.cluster, city: c.geography }}
                        className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-gold hover:text-heritage"
                      >
                        {c.place}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </PublicShell>
  );
}
