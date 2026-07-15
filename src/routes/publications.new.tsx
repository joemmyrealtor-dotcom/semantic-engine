import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, SectionTitle } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { nextPublicationId, nextChapterId } from "@/lib/data/service";
import type { ChapterBlueprint, PublicationBlueprint, PublicationType } from "@/lib/data/schema";
import { PUBLICATION_TYPES } from "@/lib/data/schema";

export const Route = createFileRoute("/publications/new")({
  head: () => ({ meta: [{ title: "Assemble Publication — Legacy Platform" }] }),
  component: NewPublicationPage,
});

function NewPublicationPage() {
  const s = useSnapshot();
  const navigate = useNavigate();
  const [title, setTitle] = useState("New Publication");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState("General");
  const [publicationType, setType] = useState<PublicationType>("Guide");
  const [frameworkId, setFrameworkId] = useState<string>("__none__");
  const [selectedConcepts, setSelectedConcepts] = useState<string[]>([]);
  const [q, setQ] = useState("");

  const framework = useMemo(() => s?.frameworks.find(f => f.id === frameworkId) ?? null, [s, frameworkId]);

  // Suggest concepts governed by the chosen framework by default.
  const eligible = useMemo(() => {
    if (!s) return [];
    const base = framework ? s.concepts.filter(c => framework.governingConceptIds.includes(c.id)) : s.concepts;
    if (!q) return base;
    return base.filter(c => `${c.id} ${c.canonicalName}`.toLowerCase().includes(q.toLowerCase()));
  }, [s, framework, q]);

  if (!s) return <LoadingState />;

  const toggle = (id: string) => setSelectedConcepts(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id]);

  const create = async () => {
    if (selectedConcepts.length === 0) { toast.error("Select at least one Concept Family."); return; }
    const pubId = nextPublicationId(s);
    const now = new Date().toISOString();
    // Deterministic chapter IDs from a rolling counter derived from the current snapshot.
    let chSeq = 0;
    for (const p of s.publications) for (const ch of p.chapters) {
      const n = Number(ch.id.replace("CH-", "")); if (!Number.isNaN(n)) chSeq = Math.max(chSeq, n);
    }
    // Inherited framework list: chosen framework + frameworks that govern each concept.
    const inheritedFrameworkIds = (conceptId: string) => {
      const linked = s.frameworks.filter(f => f.governingConceptIds.includes(conceptId)).map(f => f.id);
      const set = new Set<string>([...(framework ? [framework.id] : []), ...linked]);
      return [...set];
    };
    const chapters: ChapterBlueprint[] = selectedConcepts.map((cid, i) => {
      chSeq += 1;
      const concept = s.concepts.find(c => c.id === cid)!;
      const objectives = [
        `Understand the canonical definition of ${concept.canonicalName}.`,
        `Apply ${concept.canonicalName} within the ${framework?.name ?? "governing"} framework.`,
        `Recognise when a decision violates ${concept.canonicalName}.`,
      ];
      return {
        id: `CH-${String(chSeq).padStart(3, "0")}`,
        order: (i + 1) * 10,
        title: concept.canonicalName,
        description: `Chapter assembled from Concept Family ${concept.id}.`,
        learningObjectives: objectives,
        domainIds: concept.domainIds,
        conceptIds: [concept.id],
        frameworkIds: inheritedFrameworkIds(concept.id),
        knowledgeObjectIds: s.knowledgeObjects.filter(k => k.sourceConceptIds.includes(concept.id)).slice(0, 6).map(k => k.id),
        clientToolIds: [],
        presentationLinks: [],
        reviewStatus: "Draft",
        editorialNotes: "",
        estimatedEffortHours: 4,
        chapterVersion: "0.1.0",
        parentChapterId: null,
        presentations: [],
        manufacturingStage: "Draft",
      };
    });
    const p: PublicationBlueprint = {
      id: pubId,
      title, description, audience, purpose: description,
      publicationType, tags: [], owner: "Editorial Board",
      frameworkId: framework?.id ?? null,
      effectiveDate: null, reviewDate: null,
      editorialNotes: "", reviewNotes: "",
      chapters, status: "Draft", version: "0.1.0",
      steward: "Editorial Board",
      manufacturingStage: "Draft",
      stageHistory: [{ stage: "Draft", at: now, actor: "Editorial Board", note: `Assembled from ${selectedConcepts.length} Concept Families${framework ? ` under ${framework.id}` : ""}.` }],
      archived: false, presentations: [],
      createdAt: now, updatedAt: now,
    };
    await Repo.create("publications", p);
    toast.success(`Assembled ${pubId} with ${chapters.length} chapters`);
    navigate({ to: "/publications/$id", params: { id: pubId } });
  };

  return (
    <>
      <PageHeader eyebrow="Publication Manufacturing Studio" title="Assemble from Concept Families"
        description="Draft a publication by selecting canonical Concept Families. Chapters reference sources — no content is duplicated." />
      <PageBody>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 editorial-card p-5 space-y-4">
            <SectionTitle>Metadata</SectionTitle>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
              <div className="space-y-1"><Label>Audience</Label><Input value={audience} onChange={e => setAudience(e.target.value)} /></div>
              <div className="space-y-1"><Label>Publication type</Label>
                <Select value={publicationType} onValueChange={v => setType(v as PublicationType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PUBLICATION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Governing framework</Label>
                <Select value={frameworkId} onValueChange={v => setFrameworkId(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None</SelectItem>
                    {s.frameworks.map(f => <SelectItem key={f.id} value={f.id}>{f.id} · {f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label>Description</Label><Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} /></div>

            <SectionTitle hint={`${selectedConcepts.length} selected · ${eligible.length} eligible${framework ? ` from ${framework.id}` : ""}`}>Concept Families</SectionTitle>
            <Input placeholder="Search concepts…" value={q} onChange={e => setQ(e.target.value)} />
            <div className="border border-border rounded max-h-[420px] overflow-y-auto divide-y divide-border">
              {eligible.map(c => (
                <label key={c.id} className="flex items-start gap-2 p-2 cursor-pointer text-sm hover:bg-accent/30">
                  <Checkbox checked={selectedConcepts.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-ink">{c.id}</span>
                      <span className="font-medium truncate">{c.canonicalName}</span>
                      <span className="ml-auto text-[9px] uppercase tracking-widest text-gold">{c.status}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{c.canonicalDefinition}</div>
                  </div>
                </label>
              ))}
              {eligible.length === 0 && <div className="p-3 text-xs text-muted-foreground">No concepts match.</div>}
            </div>
          </div>
          <aside className="editorial-card p-5 space-y-3 h-max">
            <SectionTitle>Assembly plan</SectionTitle>
            <div className="text-sm text-muted-foreground">
              One chapter per selected Concept Family. Learning objectives and 15-standard KO references are pre-suggested from repository data — all editable after creation.
            </div>
            <ul className="text-xs list-disc pl-4 space-y-1">
              <li>Framework: <span className="font-mono">{framework?.id ?? "—"}</span></li>
              <li>Chapters: {selectedConcepts.length}</li>
              <li>Governance: Draft (canonical review required to promote)</li>
            </ul>
            <Button className="w-full" onClick={create}>Assemble publication</Button>
            <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/publications" })}>Cancel</Button>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
