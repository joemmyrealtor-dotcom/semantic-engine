import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageBody } from "@/components/page-header";
import { SectionTitle } from "@/components/ui-kit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Scale, Home, FileHeart, Gavel, Users } from "lucide-react";
import { publicMeta, canonicalLink } from "@/lib/marketing/seo";
import { absoluteUrl } from "@/lib/marketing/site";

export const Route = createFileRoute("/attorney-partners")({
  head: () => ({
    meta: publicMeta({
      path: "/attorney-partners",
      title: "Attorneys — Legacy Platform for Legal Practices",
      description:
        "Legacy Forge for attorneys: client-ready legacy, estate and family documentation systems for real estate, probate, divorce and family law practices.",
    }),
    links: [canonicalLink("/attorney-partners")],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Legacy Forge for Attorneys",
          serviceType: "Legacy and estate documentation systems for law firms",
          url: absoluteUrl("/attorney-partners"),
          provider: {
            "@type": "Organization",
            name: "JM Advisory Press",
            url: absoluteUrl("/"),
          },
          areaServed: "US",
          audience: {
            "@type": "Audience",
            audienceType: "Real estate, probate, divorce and family law attorneys",
          },
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Attorney Practice Areas",
            itemListElement: [
              "Real Estate",
              "Probate",
              "Divorce",
              "Family Law",
            ].map((n) => ({
              "@type": "Offer",
              itemOffered: { "@type": "Service", name: `${n} Legacy Toolkit` },
            })),
          },
        }),
      },
    ],
  }),
  component: AttorneysPage,
});

type Practice = {
  key: string;
  label: string;
  icon: typeof Home;
  headline: string;
  summary: string;
  painPoints: string[];
  offerings: { title: string; detail: string }[];
  deliverables: string[];
  pitch: string;
};

const PRACTICES: Practice[] = [
  {
    key: "real-estate",
    label: "Real Estate",
    icon: Home,
    headline: "Turn every closing into a long-term legacy relationship.",
    summary:
      "Real estate attorneys touch the single largest asset most families own — yet the relationship usually ends at the closing table. Legacy Forge packages the title, ownership and transfer knowledge you already produce into client-facing assets that keep you engaged after the deal closes.",
    painPoints: [
      "Transactional relationships that end at closing with no follow-on work",
      "Repeated explanation of title, deed and ownership structures to every client",
      "Referral partners (agents, lenders) with nothing branded to hand out",
      "No systematic path from a closing file to estate or entity planning work",
    ],
    offerings: [
      { title: "Ownership Structure Explainers", detail: "Joint tenancy, tenancy in common, community property and trust-held title explained in plain language, branded to your firm." },
      { title: "Closing-to-Legacy Handoff Pack", detail: "A post-closing packet that positions deed placement, beneficiary alignment and entity ownership as the natural next step." },
      { title: "Agent & Lender Co-Marketing Kit", detail: "Referral-partner materials your network can distribute with your name on every page." },
      { title: "Transfer-on-Death Deed Toolkit", detail: "Jurisdiction-aware client worksheets and checklists for probate-avoiding transfers." },
    ],
    deliverables: [
      "Branded client education library",
      "Closing packet inserts",
      "Referral partner one-pagers",
      "Intake and follow-up sequences",
    ],
    pitch: "Best fit for firms doing 10+ residential or commercial closings per month that want recurring planning work from the same client base.",
  },
  {
    key: "probate",
    label: "Probate",
    icon: Gavel,
    headline: "Bring order — and a repeatable process — to grieving families.",
    summary:
      "Probate work is emotionally heavy and administratively repetitive. Legacy Forge converts your process into structured, reusable client materials so families always know the next step and your team stops rebuilding the same explanations file after file.",
    painPoints: [
      "Executors who need the same twelve questions answered on every matter",
      "Heir communication consuming billable hours with no leverage",
      "Difficulty positioning post-probate planning to the next generation",
      "Inconsistent documentation across paralegals and associates",
    ],
    offerings: [
      { title: "Executor Orientation Pack", detail: "A step-by-step, phase-based guide covering appointment, inventory, notice, creditor claims and distribution." },
      { title: "Heir Communication Templates", detail: "Standardized status letters and timeline explainers that reduce inbound calls." },
      { title: "Asset Discovery Workbook", detail: "Structured intake that captures accounts, deeds, digital assets and beneficiary designations in one pass." },
      { title: "Next-Generation Planning Bridge", detail: "Materials that convert probate heirs into planning clients without a hard sell." },
    ],
    deliverables: [
      "Executor guides and checklists",
      "Timeline and phase visualizations",
      "Family status letter library",
      "Post-probate planning offers",
    ],
    pitch: "Best fit for probate and estate administration practices carrying 20+ open matters who want lower administrative drag per file.",
  },
  {
    key: "divorce",
    label: "Divorce",
    icon: Scale,
    headline: "Clarity under pressure, documented and defensible.",
    summary:
      "Divorce clients make permanent financial decisions during the worst months of their lives. Legacy Forge gives your firm structured asset, beneficiary and post-decree materials that reduce confusion, shorten discovery cycles and protect clients from the mistakes that surface years later.",
    painPoints: [
      "Clients who cannot produce a complete financial picture at intake",
      "Beneficiary designations left unchanged long after the decree",
      "Repeated explanation of property division and support mechanics",
      "No structured post-decree follow-through offering",
    ],
    offerings: [
      { title: "Financial Disclosure Workbook", detail: "A guided asset, debt, income and benefit inventory that speeds discovery and reduces supplemental requests." },
      { title: "Post-Decree Cleanup Checklist", detail: "Titles, deeds, retirement designations, insurance and estate documents — everything that must change after the judgment." },
      { title: "Property Division Explainers", detail: "Marital vs. separate property, retirement division and support mechanics in client-readable language." },
      { title: "Co-Parenting Documentation Kit", detail: "Records, schedules and expense logs structured for later evidentiary use." },
    ],
    deliverables: [
      "Intake and disclosure workbooks",
      "Post-decree action checklists",
      "Client education explainers",
      "Structured evidence logs",
    ],
    pitch: "Best fit for family law firms handling contested and high-asset matters who want faster, cleaner discovery and a defined post-decree service.",
  },
  {
    key: "family-law",
    label: "Family Law",
    icon: FileHeart,
    headline: "Serve the whole family system, not a single matter.",
    summary:
      "Family law spans guardianship, adoption, elder matters, custody modification and blended-family planning. Legacy Forge organizes that breadth into a coherent service catalog so clients see one firm capable of guiding the family across decades instead of a series of disconnected engagements.",
    painPoints: [
      "Episodic engagements with long gaps and lost relationships",
      "Blended family and guardianship complexity explained ad hoc",
      "Elder and incapacity issues surfacing too late to plan for",
      "No unified narrative connecting your practice areas",
    ],
    offerings: [
      { title: "Guardianship & Conservatorship Guides", detail: "Petition through annual accounting, mapped for family decision-makers." },
      { title: "Blended Family Planning Framework", detail: "Inheritance, custody and beneficiary alignment for second marriages and step-children." },
      { title: "Elder Transition Playbook", detail: "Capacity, care funding, powers of attorney and family-meeting facilitation materials." },
      { title: "Family Continuity Review", detail: "An annual, billable check-in structured around life events rather than legal triggers." },
    ],
    deliverables: [
      "Practice-area service catalog",
      "Life-event client journeys",
      "Family meeting facilitation kits",
      "Annual review program",
    ],
    pitch: "Best fit for generalist family practices that want to raise lifetime client value with recurring, relationship-based engagements.",
  },
];

function AttorneysPage() {
  return (
    <>
      <PageHeader
        eyebrow="Market Segment"
        title="Attorneys"
        description="Legacy Forge packages your firm's expertise into branded, client-ready knowledge systems. Choose a practice area to see the positioning, offerings and deliverables built for it."
      />
      <PageBody>
        <div className="grid gap-3 md:grid-cols-4 mb-6">
          {[
            { label: "Practice areas covered", value: "4" },
            { label: "Prebuilt deliverable types", value: "16" },
            { label: "Client-facing asset templates", value: "40+" },
            { label: "Typical launch window", value: "2–4 weeks" },
          ].map(k => (
            <div key={k.label} className="editorial-card p-4">
              <div className="text-2xl font-serif">{k.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{k.label}</div>
            </div>
          ))}
        </div>

        <Tabs defaultValue={PRACTICES[0].key}>
          <TabsList className="flex flex-wrap h-auto">
            {PRACTICES.map(p => {
              const Icon = p.icon;
              return (
                <TabsTrigger key={p.key} value={p.key} className="gap-2">
                  <Icon className="size-4" />
                  {p.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {PRACTICES.map(p => (
            <TabsContent key={p.key} value={p.key} className="mt-6 space-y-6">
              <section className="editorial-card p-6">
                <h2 className="font-serif text-2xl leading-snug">{p.headline}</h2>
                <p className="text-sm text-muted-foreground mt-3 max-w-3xl">{p.summary}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {p.deliverables.map(d => (
                    <Badge key={d} variant="secondary">{d}</Badge>
                  ))}
                </div>
              </section>

              <div className="grid gap-6 lg:grid-cols-3">
                <section className="editorial-card p-5 lg:col-span-1">
                  <SectionTitle>What they struggle with</SectionTitle>
                  <ul className="space-y-2 text-sm">
                    {p.painPoints.map(pt => (
                      <li key={pt} className="flex gap-2">
                        <span className="mt-1.5 size-1.5 rounded-full bg-primary shrink-0" />
                        <span className="text-muted-foreground">{pt}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="editorial-card p-5 lg:col-span-2">
                  <SectionTitle>What we offer them</SectionTitle>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {p.offerings.map(o => (
                      <div key={o.title} className="border border-border rounded-md p-4">
                        <div className="text-sm font-medium">{o.title}</div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{o.detail}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section className="editorial-card p-5 flex items-start gap-3">
                <Users className="size-4 mt-0.5 text-primary shrink-0" />
                <div>
                  <SectionTitle>Who to target</SectionTitle>
                  <p className="text-sm text-muted-foreground">{p.pitch}</p>
                </div>
              </section>
            </TabsContent>
          ))}
        </Tabs>
      </PageBody>
    </>
  );
}
