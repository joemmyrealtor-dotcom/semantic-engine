// Public marketing shell + page renderer.
//
// Presentation only. Content comes from src/lib/marketing/content.ts and
// positioning comes from src/lib/marketing/positioning.ts.

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { PUBLIC_NAV, PUBLIC_LEGAL_NAV, type PublicPage } from "@/lib/marketing/content";
import { BRAND, CORE_PROMISE, ENTRY_PATHS, TRUST_PROOF } from "@/lib/marketing/positioning";
import { captureAttribution } from "@/lib/marketing/attribution";
import { recordIntentVisit } from "@/lib/marketing/lead-scoring";
import { trackEvent } from "@/lib/marketing/analytics";
import { ConsentBanner } from "@/components/consent-banner";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AnswerFirst } from "@/components/answer-first";
import { ContentProvenance } from "@/components/content-provenance";
import { RelatedResources } from "@/components/related-resources";
import { pillarCluster } from "@/lib/marketing/internal-links";
import { publicCrumbs } from "@/lib/marketing/head";


function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:px-6">
        <Link to="/home" className="flex flex-col leading-tight">
          <span className="text-[10px] uppercase tracking-[0.22em] text-gold">
            {BRAND.publisher}
          </span>
          <span className="font-serif text-lg text-heritage">{BRAND.name}</span>
        </Link>

        <nav aria-label="Primary" className="ml-auto hidden items-center gap-1 lg:flex">
          {PUBLIC_NAV.filter(n => n.to !== "/home" && n.to !== "/contact").map(n => (
            <Link
              key={n.to}
              to={n.to}
              activeProps={{ className: "text-heritage font-medium" }}
              className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-heritage"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to="/contact">Book a call</Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <nav aria-label="Mobile" className="space-y-0.5 p-4 pt-10">
                {PUBLIC_NAV.map(n => (
                  <Link
                    key={n.to}
                    to={n.to}
                    className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function PublicFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3 md:px-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-gold">{BRAND.publisher}</div>
          <div className="mt-1 font-serif text-xl text-heritage">{BRAND.name}</div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{CORE_PROMISE}</p>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-heritage">
            Where you are
          </h2>
          <ul className="mt-3 space-y-1.5">
            {ENTRY_PATHS.map(p => (
              <li key={p.id}>
                <Link to={p.to} className="text-sm text-muted-foreground hover:text-heritage">
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-heritage">
            Legal &amp; access
          </h2>
          <ul className="mt-3 space-y-1.5">
            {PUBLIC_LEGAL_NAV.map(n => (
              <li key={n.to}>
                <Link to={n.to} className="text-sm text-muted-foreground hover:text-heritage">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Educational content only. Not legal, tax, or financial advice. Equal Housing
            Opportunity.
          </p>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {BRAND.publisher}. Serving{" "}
        {BRAND.serviceArea.slice(0, 6).join(", ")}, and greater Orange County.
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  const [, setReady] = useState(false);
  useEffect(() => {
    captureAttribution();
    const path = window.location.pathname;
    recordIntentVisit(path);
    trackEvent("page_view", { label: path, dedupeKey: `page_view|${path}` });
    setReady(true);
  }, []);
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
      <ConsentBanner />
    </div>
  );
}


export function EntryPathGrid({ compact = false }: { compact?: boolean }) {
  return (
    <section aria-labelledby="entry-paths" className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <h2 id="entry-paths" className="font-serif text-2xl text-heritage md:text-3xl">
        Start where you actually are
      </h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Seven situations, seven different plans. Pick the one that matches yours.
      </p>
      <div className={cn("mt-8 grid gap-4", compact ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-3")}>
        {ENTRY_PATHS.map(p => (
          <Link
            key={p.id}
            to={p.to}
            className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-gold"
          >
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold">{p.label}</div>
            <p className="mt-2 font-serif text-lg text-heritage">{p.question}</p>
            <p className="mt-2 text-sm text-muted-foreground">{p.promiseLine}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm text-heritage">
              See the plan
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function TrustProofBand() {
  return (
    <section aria-labelledby="trust-proof" className="border-y border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <h2 id="trust-proof" className="font-serif text-2xl text-heritage">
          Why this is different
        </h2>
        <dl className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {TRUST_PROOF.map(t => (
            <div key={t.label}>
              <dt className="flex items-center gap-2 text-sm font-medium text-heritage">
                <Check className="size-4 text-evergreen" aria-hidden="true" />
                {t.label}
              </dt>
              <dd className="mt-1.5 text-sm text-muted-foreground">{t.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** Standard renderer for a content-driven public page. */
export function MarketingPage({ page, pageKey }: { page: PublicPage; pageKey?: string }) {
  const entry = ENTRY_PATHS.find(e => e.to === page.slug);
  const crumbs = pageKey
    ? publicCrumbs(pageKey)
    : [
        { name: "Home", path: "/home" },
        { name: page.navLabel, path: page.slug },
      ];

  return (
    <article>
      <Breadcrumbs crumbs={crumbs} />
      <header className="mx-auto max-w-6xl px-4 pt-8 pb-10 md:px-6 md:pt-12">
        <div className="text-[10px] uppercase tracking-[0.22em] text-gold">{page.eyebrow}</div>
        <h1 className="mt-3 max-w-3xl font-serif text-3xl leading-tight text-heritage md:text-5xl">
          {page.headline}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">{page.subhead}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to={page.primaryCta.to}>{page.primaryCta.label}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to={page.secondaryCta.to}>{page.secondaryCta.label}</Link>
          </Button>
        </div>
      </header>

      {entry && (
        <AnswerFirst
          question={entry.question}
          answer={page.subhead}
          points={page.sections[0]?.bullets?.slice(0, 3)}
        />
      )}


      {page.valueProps.length > 0 && (
        <section aria-label="Key points" className="border-y border-border bg-card">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 md:grid-cols-3 md:px-6">
            {page.valueProps.map(v => (
              <div key={v.title}>
                <h2 className="font-serif text-lg text-heritage">{v.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{v.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mx-auto max-w-3xl px-4 py-14 md:px-6">
        {page.sections.map(s => (
          <section key={s.heading} className="mb-10">
            <h2 className="font-serif text-2xl text-heritage">{s.heading}</h2>
            <p className="mt-3 leading-relaxed text-foreground/90">{s.body}</p>
            {s.bullets && (
              <ul className="mt-4 space-y-2">
                {s.bullets.map(b => (
                  <li key={b} className="flex gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-evergreen" aria-hidden="true" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {page.faqs.length > 0 && (
          <section aria-labelledby="faq" className="mt-14">
            <h2 id="faq" className="font-serif text-2xl text-heritage">
              Common questions
            </h2>
            <Accordion type="single" collapsible className="mt-4">
              {page.faqs.map((f, i) => (
                <AccordionItem key={f.q} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left text-heritage">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}

        {page.localHandoff && (
          <section className="mt-14 rounded-lg border border-border bg-background p-6">
            <h2 className="font-serif text-xl text-heritage">{page.localHandoff.label}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{page.localHandoff.blurb}</p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/local/$cluster" params={{ cluster: page.localHandoff.cluster }}>
                Open the Orange County hub
              </Link>
            </Button>
          </section>
        )}


        {!page.legal && (
          <section className="mt-14 rounded-lg border border-border bg-card p-6">
            <h2 className="font-serif text-xl text-heritage">{CORE_PROMISE}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Bring your situation and your numbers. You will leave the call with a plan, even if
              the plan is to wait.
            </p>
            <Button asChild className="mt-4">
              <Link to="/contact">Book a strategy call</Link>
            </Button>
          </section>
        )}
      </div>

      {!page.legal && (
        <ContentProvenance
          kind="page"
          basis="Written from documented Orange County transaction, probate, and distressed-property work, plus the governing documents involved in each decision."
        />
      )}

      {entry && (
        <RelatedResources
          links={pillarCluster(entry.id)}
          heading={`More for ${entry.label.toLowerCase()}`}
          intro="The guide, the assessment, and the local context that go with this plan."
        />
      )}

    </article>
  );
}
