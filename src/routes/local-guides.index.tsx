import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PublicShell, MarketingPage } from "@/components/public-shell";
import { PUBLIC_PAGES } from "@/lib/marketing/content";
import { publicHead } from "@/lib/marketing/head";
import { CITY_GUIDES } from "@/lib/marketing/cities";

export const Route = createFileRoute("/local-guides/")({
  head: () => publicHead("local-guides"),
  component: PublicMarketingRoute,
});

function PublicMarketingRoute() {
  return (
    <PublicShell>
      <section aria-labelledby="cities" className="mx-auto max-w-6xl px-4 pt-14 md:px-6">
        <h2 id="cities" className="font-serif text-2xl text-heritage md:text-3xl">
          City housing market briefings
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Each briefing covers how that city&rsquo;s market is behaving right now: pricing bands,
          absorption, buyer pool, and housing stock. Working through probate, an inherited property,
          a divorce, or a distressed sale?{" "}
          <Link to="/local" className="text-heritage underline underline-offset-4">
            Start at the Orange County situation pages
          </Link>{" "}
          instead — this section is research, not case help.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CITY_GUIDES.map(c => (
            <Link
              key={c.slug}
              to="/local-guides/$city"
              params={{ city: c.slug }}
              className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-gold"
            >
              <div className="text-[10px] uppercase tracking-[0.2em] text-gold">{c.county}</div>
              <h3 className="mt-2 font-serif text-lg text-heritage">{c.city}</h3>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{c.intro}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm text-heritage">
                Read the {c.city} guide
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <MarketingPage page={PUBLIC_PAGES["local-guides"]} />
    </PublicShell>
  );
}
