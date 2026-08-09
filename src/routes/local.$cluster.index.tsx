import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/public-shell";
import { LocalPageView, localCrumbs } from "@/components/local-page-view";
import { getLocalHub, citiesForCluster } from "@/lib/marketing/local-pages";
import { publicMeta, canonicalLink } from "@/lib/marketing/seo";
import { jsonLdScript, siteGraph, breadcrumbGraph, faqGraph, articleGraph } from "@/lib/marketing/schema";

export const Route = createFileRoute("/local/$cluster")({
  loader: ({ params }) => {
    const spec = getLocalHub(params.cluster);
    if (!spec) throw notFound();
    return { spec, cities: citiesForCluster(params.cluster) };
  },
  head: ({ loaderData }) => {
    const spec = loaderData?.spec;
    if (!spec) {
      return {
        meta: [
          { title: "Page unavailable | Legacy Forge" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }
    return {
      meta: publicMeta({ path: spec.path, title: spec.metaTitle, description: spec.metaDescription }),
      links: [canonicalLink(spec.path)],
      scripts: [
        jsonLdScript(siteGraph([spec.place])),
        jsonLdScript(breadcrumbGraph(localCrumbs(spec))),
        jsonLdScript(
          articleGraph({
            path: spec.path,
            headline: spec.question,
            description: spec.metaDescription,
          }),
        ),
        jsonLdScript(faqGraph(spec.path, spec.paa)),
      ],
    };
  },
  notFoundComponent: HubNotFound,
  component: LocalClusterHub,
});

function HubNotFound() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-24 md:px-6">
        <h1 className="font-serif text-3xl text-heritage">We do not cover that topic locally yet</h1>
        <p className="mt-3 text-muted-foreground">Browse the local situation hubs we publish today.</p>
        <Button asChild className="mt-6">
          <Link to="/local">See local situation hubs</Link>
        </Button>
      </div>
    </PublicShell>
  );
}

function LocalClusterHub() {
  const { spec, cities } = Route.useLoaderData();
  return (
    <PublicShell>
      <LocalPageView spec={spec} />
      {cities.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 pb-16 md:px-6">
          <h2 className="font-serif text-2xl text-heritage">{spec.clusterLabel} by city</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {cities.map(c => (
              <li key={c.path}>
                <Link
                  to="/local/$cluster/$city"
                  params={{ cluster: c.cluster, city: c.geography }}
                  className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-gold"
                >
                  <span className="font-medium text-heritage">{c.place}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{c.question}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PublicShell>
  );
}
