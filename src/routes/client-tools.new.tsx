import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, SectionTitle, StatusBadge } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateDraftClientTool } from "@/lib/data/service";
import type { ClientTool } from "@/lib/data/schema";
import { toast } from "sonner";

export const Route = createFileRoute("/client-tools/new")({
  head: () => ({ meta: [{ title: "Client Tool Generator — Legacy Platform" }] }),
  component: CTGenerator,
});

function CTGenerator() {
  const s = useSnapshot();
  const [kind, setKind] = useState<ClientTool["kind"]>("Worksheet");
  const [name, setName] = useState("");
  const [selConcepts, setSelConcepts] = useState<string[]>([]);
  const [selFrameworks, setSelFrameworks] = useState<string[]>([]);
  const [selKOs, setSelKOs] = useState<string[]>([]);
  const [draft, setDraft] = useState<ClientTool | null>(null);

  if (!s) return <LoadingState />;
  const toggle = <T,>(arr: T[], v: T, setter: (a: T[]) => void) => setter(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const build = () => {
    if (!name) return toast.error("Give the tool a name.");
    const d = generateDraftClientTool({ kind, name, conceptIds: selConcepts, frameworkIds: selFrameworks, koIds: selKOs, promptId: "PR-006" });
    setDraft(d);
  };
  const commit = async () => { if (draft) { await Repo.create("clientTools", draft); toast.success(`Draft ${draft.id} added.`); setDraft(null); setName(""); } };

  return (
    <>
      <PageHeader eyebrow="Client Tool Generator" title="Draft worksheet, checklist, or decision aid"
        description="Draft is generated locally from approved sources. Human review required before Approval." />
      <PageBody>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="editorial-card p-5 space-y-4">
            <SectionTitle>Tool</SectionTitle>
            <div><label className="text-xs uppercase tracking-wider text-slate-ink">Name</label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div><label className="text-xs uppercase tracking-wider text-slate-ink">Kind</label>
              <Select value={kind} onValueChange={v => setKind(v as ClientTool["kind"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Worksheet">Worksheet</SelectItem>
                  <SelectItem value="Checklist">Checklist</SelectItem>
                  <SelectItem value="Decision Aid">Decision Aid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={build} className="w-full">Generate draft</Button>
          </div>
          <div className="editorial-card p-5">
            <SectionTitle>Source Concepts</SectionTitle>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {s.concepts.filter(c => c.status === "Canonical").map(c => (
                <label key={c.id} className="flex items-start gap-2 text-sm py-1 cursor-pointer">
                  <Checkbox checked={selConcepts.includes(c.id)} onCheckedChange={() => toggle(selConcepts, c.id, setSelConcepts)} />
                  <span><span className="font-mono text-xs text-slate-ink">{c.id}</span> {c.canonicalName}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="editorial-card p-5">
            <SectionTitle>Source Frameworks</SectionTitle>
            <div className="max-h-40 overflow-y-auto space-y-1 mb-4">
              {s.frameworks.map(f => (
                <label key={f.id} className="flex items-start gap-2 text-sm py-1 cursor-pointer">
                  <Checkbox checked={selFrameworks.includes(f.id)} onCheckedChange={() => toggle(selFrameworks, f.id, setSelFrameworks)} />
                  <span><span className="font-mono text-xs text-slate-ink">{f.id}</span> {f.name}</span>
                </label>
              ))}
            </div>
            <SectionTitle>Source Knowledge Objects</SectionTitle>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {s.knowledgeObjects.filter(k => k.status === "Canonical").slice(0, 30).map(k => (
                <label key={k.id} className="flex items-start gap-2 text-xs py-1 cursor-pointer">
                  <Checkbox checked={selKOs.includes(k.id)} onCheckedChange={() => toggle(selKOs, k.id, setSelKOs)} />
                  <span><span className="font-mono text-slate-ink">{k.id}</span> {k.title}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {draft && (
          <div className="mt-6 editorial-card p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-xs">{draft.id}</span>
              <StatusBadge status={draft.status} />
              <span className="text-[11px] uppercase tracking-widest text-gold">{draft.kind}</span>
            </div>
            <div className="font-serif text-lg text-heritage">{draft.name}</div>
            <div className="text-sm text-slate-ink mt-1">{draft.purpose}</div>
            <div className="text-[11px] text-muted-foreground mt-2">
              Sources: {[...draft.sourceConceptIds, ...draft.sourceFrameworkIds, ...draft.sourceKnowledgeObjectIds].join(", ") || "None"} · Prompt {draft.promptId}
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={commit}>Add to registry</Button>
              <Button variant="outline" onClick={() => setDraft(null)}>Discard</Button>
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
