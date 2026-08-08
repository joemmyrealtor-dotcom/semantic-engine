// Task 26 — Professional entry pages: /for/$audience
//
// Peer-level pages for attorneys, CPAs/fiduciaries, advisors, senior
// services, and property/transaction professionals.

import { useEffect } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CheckCircle2, Download, FileText, Handshake } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { publicMeta, canonicalLink } from "@/lib/marketing/seo";
import { publicMeta, canonicalLink } from "@/lib/marketing/seo";
import { jsonLdScript, siteGraph, breadcrumbGraph } from "@/lib/marketing/schema";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { trackAction } from "@/lib/marketing/analytics";
import {
  PROFESSIONAL_AUDIENCES,
  REFERRAL_STANDARDS,
  professionalPage,
} from "@/lib/partners/pages";
import { RESOURCE_KITS, kitMarkdown } from "@/lib/partners/resource-kit";
import { partnerTypesForAudience, type ProfessionalAudience } from "@/lib/partners/schema";

export const Route = createFileRoute("/for/$audience")({
  beforeLoad: ({ params }) => {
    if (!PROFESSIONAL_AUDIENCES.includes(params.audience as ProfessionalAudience)) throw notFound();
  },
  head: ({ params }) => {
    const page = professionalPage(params.audience);
    const path = `/for/${params.audience}`;
    const title = page?.metaTitle ?? "For Professionals | Legacy Forge";
    const description =
      page?.metaDescription ??
      "Property decision support for attorneys, CPAs, fiduciaries, advisors, and senior service professionals in Orange County.";
    return {
      meta: publicMeta({ path, title, description }),
      links: [canonicalLink(path)],
      scripts: [
        jsonLdScript(siteGraph()),
        jsonLdScript(
          breadcrumbGraph([
            { name: "Home", path: "/home" },
            { name: "For professionals", path: "/for/attorneys" },
            { name: page?.navLabel ?? params.audience, path },
          ]),
        ),
      ],
    };
  },
  component: ProfessionalRoute,
});

function ProfessionalRoute() {
  const { audience } = Route.useParams();
  const page = professionalPage(audience);

  useEffect(() => {
    if (page) trackAction("partner_page_viewed", { label: page.slug });
  }, [page]);

  if (!page) return null;
  const kit = RESOURCE_KITS[page.audience];

  function downloadKit() {
    const blob = new Blob([kitMarkdown(kit)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `legacy-forge-resource-kit-${page?.slug}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    trackAction("partner_kit_requested", { label: page?.slug ?? audience });
  }

  return (
    <PublicShell>
      <article className="mx-auto max-w-4xl px-4 py-12">
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">For professionals</p>
        <h1 className="mt-2 font-serif text-4xl text-heritage">{page.title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{page.intro}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/refer" onClick={() => trackAction("referral_partner_clicked", { label: page.slug })}>
              <Handshake className="mr-1 size-4" aria-hidden="true" />
              Refer a client
            </Link>
          </Button>
          <Button variant="outline" onClick={downloadKit}>
            <Download className="mr-1 size-4" aria-hidden="true" />
            Download the resource kit
          </Button>
        </div>

        <section className="mt-12">
          <h2 className="font-serif text-2xl text-heritage">How I work with your practice</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {page.understanding.map(u => (
              <div key={u.heading} className="rounded-lg border border-border bg-card p-5">
                <h3 className="font-medium text-heritage">{u.heading}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{u.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl text-heritage">The referral process</h2>
          <ol className="mt-4 space-y-3">
            {page.process.map((p, i) => (
              <li key={p.step} className="flex gap-3 rounded-lg border border-border bg-card p-4">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-heritage text-xs text-background">
                  {i + 1}
                </span>
                <div>
                  <div className="font-medium text-heritage">{p.step}</div>
                  <p className="text-sm text-muted-foreground">{p.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12 rounded-lg border border-gold bg-card p-6">
          <h2 className="font-serif text-2xl text-heritage">
            <FileText className="mr-2 inline size-5 text-gold" aria-hidden="true" />
            {kit.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{page.kitBlurb}</p>
          <ul className="mt-4 space-y-2">
            {kit.items.map(item => (
              <li key={item.id} className="text-sm">
                <span className="font-medium text-heritage">{item.title}</span>
                <span className="text-muted-foreground"> — {item.summary}</span>
              </li>
            ))}
          </ul>
          <Button className="mt-5" onClick={downloadKit}>
            <Download className="mr-1 size-4" aria-hidden="true" />
            Download the kit (free, no reciprocity)
          </Button>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl text-heritage">My standards with professionals</h2>
          <ul className="mt-4 space-y-2">
            {[...page.standards, ...REFERRAL_STANDARDS].map(s => (
              <li key={s} className="flex gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-evergreen" aria-hidden="true" />
                {s}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl text-heritage">Who this page is for</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {partnerTypesForAudience(page.audience)
              .map(t => t.label)
              .join(", ")}
            .
          </p>
          <nav className="mt-6 flex flex-wrap gap-2" aria-label="Other professional pages">
            {PROFESSIONAL_AUDIENCES.filter(a => a !== page.audience).map(a => (
              <Button key={a} asChild variant="ghost" size="sm">
                <Link to="/for/$audience" params={{ audience: a }}>
                  {professionalPage(a)?.navLabel}
                </Link>
              </Button>
            ))}
          </nav>
        </section>
      </article>
    </PublicShell>
  );
}
