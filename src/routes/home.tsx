import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PublicShell, EntryPathGrid, TrustProofBand } from "@/components/public-shell";
import { AnswerFirst } from "@/components/answer-first";
import { ContentProvenance } from "@/components/content-provenance";
import { BRAND, CORE_PROMISE } from "@/lib/marketing/positioning";
import { publicMeta, canonicalLink } from "@/lib/marketing/seo";
import { jsonLdScript, siteGraph, breadcrumbGraph } from "@/lib/marketing/schema";

const TITLE = "Orange County Real Estate Guidance — Sellers, Buyers, Probate | Legacy Forge";
const DESCRIPTION =
  "Make smarter real estate decisions, protect your equity, and follow a clear plan. Guides and advisory for Orange County sellers, buyers, executors, heirs, downsizers, and investors.";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: publicMeta({ path: "/home", title: TITLE, description: DESCRIPTION }),
    links: [canonicalLink("/home")],
    scripts: [
      jsonLdScript(siteGraph()),
      jsonLdScript(breadcrumbGraph([{ name: "Home", path: "/home" }])),
    ],
  }),
  component: PublicHome,
});


function PublicHome() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 md:px-6 md:pt-24">
        <div className="text-[10px] uppercase tracking-[0.22em] text-gold">
          {BRAND.publisher} · Orange County
        </div>
        <h1 className="mt-4 max-w-4xl font-serif text-4xl leading-tight text-heritage md:text-6xl">
          {CORE_PROMISE}
        </h1>
        <p className="mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
          Most real estate advice is opinion delivered under pressure. Legacy Forge is a governed
          research library and advisory practice built around seven specific situations — so the
          guidance you get matches the decision you are actually making.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/contact">Book a strategy call</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/resources">Browse the guide library</Link>
          </Button>
        </div>
      </section>

      <TrustProofBand />
      <EntryPathGrid />

      <section className="mx-auto max-w-3xl px-4 pb-16 md:px-6">
        <h2 className="font-serif text-2xl text-heritage">How this works</h2>
        <ol className="mt-5 space-y-5">
          {[
            {
              t: "Start with your situation",
              d: "Selling, buying, probate, inherited property, downsizing, distress, or investment. Each path has its own guide, its own math, and its own timeline.",
            },
            {
              t: "Get the numbers on one page",
              d: "Value, carrying cost, payoff, tax exposure, and net proceeds. Decisions get easy once the numbers stop being abstract.",
            },
            {
              t: "Follow a written plan",
              d: "You leave every conversation with the sequence, the deadlines, and what would change the recommendation.",
            },
          ].map((s, i) => (
            <li key={s.t} className="flex gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-gold font-serif text-sm text-heritage">
                {i + 1}
              </span>
              <div>
                <h3 className="font-serif text-lg text-heritage">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </PublicShell>
  );
}
