import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, SectionTitle, StatusBadge, EmptyState } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { generateDraftKnowledgeObjects } from "@/lib/data/service";
import type { KnowledgeObject, KnowledgeObjectType } from "@/lib/data/schema";
import { toast } from "sonner";

const ALL_TYPES: KnowledgeObjectType[] = ["Definition","Why It Matters","Principle","Example","Scenario","Joe's Strategy","Mistake Alert","FAQ","Reflection Question"];

type NewKOSearch = { concept?: string; framework?: string; pub?: string; chapter?: string };

export const Route = createFileRoute("/knowledge-objects/new")({
  head: () => ({ meta: [{ title: "Knowledge Object Factory — Legacy Platform" }] }),
  validateSearch: (raw: Record<string, unknown>): NewKOSearch => ({
    concept: typeof raw.concept === "string" ? raw.concept : undefined,
    framework: typeof raw.framework === "string" ? raw.framework : undefined,
    pub: typeof raw.pub === "string" ? raw.pub : undefined,
    chapter: typeof raw.chapter === "string" ? raw.chapter : undefined,
  }),
  component: KOFactoryPage,
});

function KOFactoryPage() {
  const s = useSnapshot();
  const search = Route.useSearch();
  const [selConcepts, setSelConcepts] = useState<string[]>(search.concept ? [search.concept] : []);
  const [selFrameworks, setSelFrameworks] = useState<string[]>(search.framework ? [search.framework] : []);
  const [types, setTypes] = useState<KnowledgeObjectType[]>(["Definition","Why It Matters","Principle"]);
  const [drafts, setDrafts] = useState<KnowledgeObject[]>([]);

  if (!s) return <LoadingState />;

  const approvedConcepts = s.concepts.filter(c => c.status === "Canonical" || c.status === "Approved" || selConcepts.includes(c.id));
  const approvedFrameworks = s.frameworks.filter(f => f.status === "Canonical" || f.status === "Approved" || selFrameworks.includes(f.id));
  const toggle = <T,>(arr: T[], v: T, setter: (a: T[]) => void) => setter(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const generate = () => {
    if (selConcepts.length === 0 || types.length === 0) return toast.error("Pick at least one Concept and one object type.");
    const d = generateDraftKnowledgeObjects({ conceptIds: selConcepts, frameworkIds: selFrameworks, types, promptId: "PR-002" });
    setDrafts(d);
    toast.success(`Generated ${d.length} draft Knowledge Objects locally.`);
  };

  const commit = async () => {
    for (const d of drafts) await Repo.create("knowledgeObjects", d);
    toast.success("Drafts written to repository (Draft status, human review required).");
    setDrafts([]);
  };

  return (
    <>
      <PageHeader eyebrow="Knowledge Object Factory" title="Draft from approved sources"
        description="Local demo generation. Drafts are marked human-review-required and cannot become Canonical without recorded approval." />
      <PageBody>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="editorial-card p-5">
            <SectionTitle>Source Concepts</SectionTitle>
            <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
              {approvedConcepts.map(c => (
                <label key={c.id} className="flex items-start gap-2 text-sm py-1 cursor-pointer">
                  <Checkbox checked={selConcepts.includes(c.id)} onCheckedChange={() => toggle(selConcepts, c.id, setSelConcepts)} />
                  <span><span className="font-mono text-xs text-slate-ink">{c.id}</span> {c.canonicalName}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="editorial-card p-5">
            <SectionTitle>Source Frameworks</SectionTitle>
            <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
              {approvedFrameworks.map(f => (
                <label key={f.id} className="flex items-start gap-2 text-sm py-1 cursor-pointer">
                  <Checkbox checked={selFrameworks.includes(f.id)} onCheckedChange={() => toggle(selFrameworks, f.id, setSelFrameworks)} />
                  <span><span className="font-mono text-xs text-slate-ink">{f.id}</span> {f.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="editorial-card p-5">
            <SectionTitle>Object types</SectionTitle>
            <div className="space-y-1">
              {ALL_TYPES.map(t => (
                <label key={t} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                  <Checkbox checked={types.includes(t)} onCheckedChange={() => toggle(types, t, setTypes)} />
                  <span>{t}</span>
                </label>
              ))}
            </div>
            <Button onClick={generate} className="mt-4 w-full">Generate drafts locally</Button>
            <p className="text-[11px] text-muted-foreground mt-2">Uses deterministic local templates. Not connected to any AI provider.</p>
          </div>
        </div>

        <div className="mt-8">
          <SectionTitle hint={drafts.length ? `${drafts.length} pending drafts` : undefined}>Draft results</SectionTitle>
          {drafts.length === 0 ? <EmptyState title="No drafts yet" description="Pick sources and types above, then generate." /> : (
            <>
              <div className="editorial-card divide-y divide-border">
                {drafts.map(d => (
                  <div key={d.id} className="p-4">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-xs text-slate-ink">{d.id}</span>
                      <StatusBadge status={d.status} />
                      <span className="text-[11px] uppercase tracking-widest text-gold">{d.type}</span>
                    </div>
                    <div className="font-medium">{d.title}</div>
                    <div className="text-sm text-slate-ink mt-1">{d.body}</div>
                    <div className="text-[11px] text-muted-foreground mt-2">
                      Sources: {d.sourceConceptIds.join(", ")}{d.sourceFrameworkIds.length ? " · " + d.sourceFrameworkIds.join(", ") : ""} · Prompt {d.promptId} · Generated {d.generatedAt?.slice(0, 19).replace("T", " ")}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={commit}>Commit drafts to repository</Button>
                <Button variant="outline" onClick={() => setDrafts([])}>Discard</Button>
              </div>
            </>
          )}
        </div>
      </PageBody>
    </>
  );
}
