import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/public-shell";
import { LocalPageView, localCrumbs } from "@/components/local-page-view";
import { getLocalPage, type LocalPageSpec } from "@/lib/marketing/local-pages";
import { publicMeta, canonicalLink } from "@/lib/marketing/seo";
import { jsonLdScript, siteGraph, breadcrumbGraph, faqGraph, articleGraph } from "@/lib/marketing/schema";

export const Route = createFileRoute("/local/$cluster/$city")({
  loader: ({ params }) => {
    const spec = getLocalPage(params.cluster, params.city);
    if (!spec) throw notFound();
    return { spec };
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
        jsonLdScript(siteGraph([spec.place, "Orange County"])),
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
  notFoundComponent: LocalCityNotFound,
  component: LocalCityPage,
});

function LocalCityNotFound() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-24 md:px-6">
        <h1 className="font-serif text-3xl text-heritage">We do not cover that city for this situation yet</h1>
        <p className="mt-3 text-muted-foreground">
          Here are the local situation pages we publish today.
        </p>
        <Button asChild className="mt-6">
          <Link to="/local">See local situation hubs</Link>
        </Button>
      </div>
    </PublicShell>
  );
}

function LocalCityPage() {
  const { spec } = Route.useLoaderData() as { spec: LocalPageSpec };
  return (
    <PublicShell>
      <LocalPageView spec={spec} />
    </PublicShell>
  );
}
