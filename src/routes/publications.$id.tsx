import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, StatusBadge, SectionTitle, ErrorState, KpiCard } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  PUBLICATION_STAGES, PUBLICATION_TYPES, PRESENTATION_KINDS,
  type PublicationBlueprint, type ChapterBlueprint, type PublicationStage,
  type PublicationType, type PresentationKind, type PresentationLink, type Status,
} from "@/lib/data/schema";
import {
  publicationCoverage, validatePublicationPromotion, appendStageHistory,
  chapterTree, nextChapterId, moveChapter, wouldCreateChapterCycle, chapterDescendantIds,
  isAdjacentStageTransition,
} from "@/lib/data/service";
import { PublicationStageBadge } from "@/components/publication-stage-badge";
import { CoverageBar } from "./publications.index";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2, Save, ChevronRight, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/publications/$id")({
  head: ({ params }) => ({ meta: [{ title: `${params.id} — Publication Editor` }] }),
  component: PublicationEditorPage,
});

const AUTOSAVE_MS = 800;

function PublicationEditorPage() {
  const { id } = Route.useParams();
  const s = useSnapshot();
  const navigate = useNavigate();
  const original = s?.publications.find(p => p.id === id);
  const [draft, setDraft] = useState<PublicationBlueprint | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (original && !draft) setDraft(original); }, [original, draft]);

  // Autosave through Repo
  useEffect(() => {
    if (!draft || !dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaving(true);
      await Repo.update("publications", id, draft);
      setSaving(false);
      setDirty(false);
    }, AUTOSAVE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [draft, dirty, id]);

  if (!s) return <LoadingState />;
  if (!original) return <ErrorState message={`Publication ${id} not found.`} />;
  if (!draft) return <LoadingState />;

  const set = <K extends keyof PublicationBlueprint>(k: K, v: PublicationBlueprint[K]) => {
    setDraft({ ...draft, [k]: v }); setDirty(true);
  };
  const setChapters = (chs: ChapterBlueprint[]) => set("chapters", chs);

  const cov = publicationCoverage(draft, s);

  const promote = async (target: PublicationStage) => {
    const result = validatePublicationPromotion(draft, target, s);
    if (!result.ok) {
      toast.error(`Cannot promote to ${target}: ${result.blockers[0]}`);
      return;
    }
    const next: PublicationBlueprint = {
      ...draft,
      manufacturingStage: target,
      stageHistory: appendStageHistory(draft, target, draft.owner || draft.steward, `Promoted to ${target}.`),
    };
    setDraft(next); setDirty(true);
    toast.success(`Promoted to ${target}.`);
  };

  const removePub = async () => {
    if (!confirm(`Delete ${draft.id}?`)) return;
    await Repo.remove("publications", draft.id);
    navigate({ to: "/publications" });
  };

  return (
    <>
      <PageHeader
        eyebrow="Publication Editor"
        title={<span className="flex items-center gap-3">{draft.title || "Untitled"} {draft.archived && <span className="text-xs uppercase tracking-widest text-destructive">Archived</span>}</span>}
        description={<span className="font-mono text-xs">{draft.id} · v{draft.version} · {draft.publicationType}</span>}
        actions={
          <>
            <PublicationStageBadge stage={draft.manufacturingStage} />
            <span className="text-xs text-muted-foreground">
              {saving ? "Saving…" : dirty ? "Unsaved…" : <span className="inline-flex items-center gap-1"><Save className="size-3" /> Saved</span>}
            </span>
            <Link to="/publications" className="text-sm underline text-heritage">← Registry</Link>
          </>
        }
      />
      <PageBody>
        {/* Coverage dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          <KpiCard label="Coverage" value={`${cov.coveragePercent}%`} hint={`${cov.brokenReferences.length} broken`} tone={cov.brokenReferences.length ? "warn" : "evergreen"} />
          <KpiCard label="Readiness" value={cov.readinessScore} hint="0–100" tone={cov.readinessScore >= 85 ? "evergreen" : cov.readinessScore >= 60 ? "gold" : "warn"} />
          <KpiCard label="Editorial" value={cov.editorialScore} hint="quality signal" />
          <KpiCard label="Canonical Compliance" value={`${cov.canonicalCompliance}%`} hint="referenced Concepts" />
          <KpiCard label="Chapters" value={draft.chapters.length} hint={`${cov.chaptersWithoutObjectives.length} missing LOs`} tone={cov.chaptersWithoutObjectives.length ? "warn" : "default"} />
          <KpiCard label="Human Review" value={`${Math.round(cov.humanReviewRatio * 100)}%`} hint="KOs reviewed" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <GeneralInfoCard draft={draft} set={set} />
            <ChaptersCard draft={draft} snapshot={s} onChapters={setChapters} />
            <CanonicalAssemblyCard draft={draft} snapshot={s} onChapters={setChapters} />
            <CoverageIntelligenceCard cov={cov} draft={draft} snapshot={s} />
            <PresentationsCard draft={draft} set={set} />
          </div>

          <aside className="space-y-4">
            <ManufacturingPipelineCard draft={draft} snapshot={s} promote={promote} />
            <StageHistoryCard draft={draft} />
            <MetadataCard draft={draft} set={set} />
            <DangerZone remove={removePub} />
          </aside>
        </div>
      </PageBody>
    </>
  );
}

/* ---------- General info ---------- */
function GeneralInfoCard({ draft, set }: { draft: PublicationBlueprint; set: <K extends keyof PublicationBlueprint>(k: K, v: PublicationBlueprint[K]) => void }) {
  const s = useSnapshot();
  return (
    <div className="editorial-card p-5 space-y-4">
      <SectionTitle>General information</SectionTitle>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Title"><Input value={draft.title} onChange={e => set("title", e.target.value)} /></Field>
        <Field label="Version"><Input value={draft.version} onChange={e => set("version", e.target.value)} /></Field>
        <Field label="Audience"><Input value={draft.audience} onChange={e => set("audience", e.target.value)} /></Field>
        <Field label="Owner"><Input value={draft.owner} onChange={e => set("owner", e.target.value)} /></Field>
        <Field label="Publication type">
          <Select value={draft.publicationType} onValueChange={v => set("publicationType", v as PublicationType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PUBLICATION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Governing framework">
          <Select value={draft.frameworkId ?? "__none__"} onValueChange={v => set("frameworkId", v === "__none__" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— None</SelectItem>
              {s?.frameworks.map(f => <SelectItem key={f.id} value={f.id}>{f.id} · {f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Effective date"><Input type="date" value={(draft.effectiveDate ?? "").slice(0, 10)} onChange={e => set("effectiveDate", e.target.value ? new Date(e.target.value).toISOString() : null)} /></Field>
        <Field label="Next review date"><Input type="date" value={(draft.reviewDate ?? "").slice(0, 10)} onChange={e => set("reviewDate", e.target.value ? new Date(e.target.value).toISOString() : null)} /></Field>
      </div>
      <Field label="Description"><Textarea rows={2} value={draft.description} onChange={e => set("description", e.target.value)} /></Field>
      <Field label="Purpose"><Textarea rows={2} value={draft.purpose} onChange={e => set("purpose", e.target.value)} /></Field>
      <Field label="Tags (comma separated)">
        <Input value={draft.tags.join(", ")} onChange={e => set("tags", e.target.value.split(",").map(x => x.trim()).filter(Boolean))} />
      </Field>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Editorial notes"><Textarea rows={3} value={draft.editorialNotes} onChange={e => set("editorialNotes", e.target.value)} /></Field>
        <Field label="Review notes"><Textarea rows={3} value={draft.reviewNotes} onChange={e => set("reviewNotes", e.target.value)} /></Field>
      </div>
    </div>
  );
}

/* ---------- Chapters ---------- */
function ChaptersCard({ draft, snapshot, onChapters }: { draft: PublicationBlueprint; snapshot: ReturnType<typeof useSnapshot>; onChapters: (chs: ChapterBlueprint[]) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tree = useMemo(() => chapterTree(draft.chapters), [draft.chapters]);
  const selected = draft.chapters.find(c => c.id === selectedId) ?? null;

  const addChapter = () => {
    if (!snapshot) return;
    const id = nextChapterId(snapshot);
    const maxOrder = draft.chapters.reduce((m, c) => Math.max(m, c.order), 0);
    const ch: ChapterBlueprint = {
      id, order: maxOrder + 10, title: "New chapter",
      learningObjectives: [], domainIds: [], conceptIds: [], frameworkIds: [],
      knowledgeObjectIds: [], clientToolIds: [], presentationLinks: [],
      reviewStatus: "Draft" as Status,
      description: "", editorialNotes: "", estimatedEffortHours: 0,
      chapterVersion: "0.1.0", parentChapterId: null, presentations: [],
      manufacturingStage: "Draft",
    };
    onChapters([...draft.chapters, ch]);
    setSelectedId(id);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const flat = [...draft.chapters].sort((a, b) => a.order - b.order);
    const to = idx + dir;
    if (to < 0 || to >= flat.length) return;
    onChapters(reorderChapters(flat, idx, to));
  };

  const remove = (id: string) => {
    if (!confirm(`Delete chapter ${id}?`)) return;
    const kept = draft.chapters.filter(c => c.id !== id).map(c => ({ ...c, parentChapterId: c.parentChapterId === id ? null : c.parentChapterId }));
    onChapters(kept);
    if (selectedId === id) setSelectedId(null);
  };

  const updateChapter = (patch: Partial<ChapterBlueprint>) => {
    if (!selected) return;
    onChapters(draft.chapters.map(c => c.id === selected.id ? { ...c, ...patch } : c));
  };

  const sortedFlat = [...draft.chapters].sort((a, b) => a.order - b.order);

  return (
    <div className="editorial-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <SectionTitle hint={`${draft.chapters.length} chapters`}>Chapter manufacturing</SectionTitle>
        <Button size="sm" onClick={addChapter}><Plus className="size-4 mr-1" /> Add chapter</Button>
      </div>
      {draft.chapters.length === 0 ? (
        <div className="text-sm text-muted-foreground">No chapters yet. Add one to begin assembly.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-border rounded divide-y divide-border max-h-[420px] overflow-y-auto">
            {tree.map(({ chapter, depth }) => {
              const idx = sortedFlat.findIndex(c => c.id === chapter.id);
              const active = chapter.id === selectedId;
              return (
                <div key={chapter.id} className={`px-2 py-2 flex items-center gap-2 text-sm ${active ? "bg-accent/60" : "hover:bg-accent/30"}`} style={{ paddingLeft: 8 + depth * 16 }}>
                  {depth > 0 && <ChevronRight className="size-3 text-muted-foreground shrink-0" />}
                  <button className="flex-1 text-left min-w-0" onClick={() => setSelectedId(chapter.id)}>
                    <div className="font-mono text-[10px] text-slate-ink">{chapter.id} · #{chapter.order}</div>
                    <div className="truncate">{chapter.title}</div>
                  </button>
                  <PublicationStageBadge stage={chapter.manufacturingStage} className="text-[9px]" />
                  <button className="p-1 text-muted-foreground hover:text-heritage disabled:opacity-30" disabled={idx === 0} onClick={() => move(idx, -1)}><ArrowUp className="size-3" /></button>
                  <button className="p-1 text-muted-foreground hover:text-heritage disabled:opacity-30" disabled={idx === sortedFlat.length - 1} onClick={() => move(idx, 1)}><ArrowDown className="size-3" /></button>
                  <button className="p-1 text-destructive/70 hover:text-destructive" onClick={() => remove(chapter.id)}><Trash2 className="size-3" /></button>
                </div>
              );
            })}
          </div>
          <div>
            {!selected ? (
              <div className="text-sm text-muted-foreground p-4 text-center border border-dashed border-border rounded">Select a chapter to edit.</div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="ID"><Input value={selected.id} disabled /></Field>
                  <Field label="Version"><Input value={selected.chapterVersion} onChange={e => updateChapter({ chapterVersion: e.target.value })} /></Field>
                </div>
                <Field label="Title"><Input value={selected.title} onChange={e => updateChapter({ title: e.target.value })} /></Field>
                <Field label="Description"><Textarea rows={2} value={selected.description} onChange={e => updateChapter({ description: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Parent chapter">
                    <Select value={selected.parentChapterId ?? "__root__"} onValueChange={v => updateChapter({ parentChapterId: v === "__root__" ? null : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__root__">— Top level</SelectItem>
                        {draft.chapters.filter(c => c.id !== selected.id).map(c => <SelectItem key={c.id} value={c.id}>{c.id} · {c.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Est. effort (hours)"><Input type="number" min={0} value={selected.estimatedEffortHours} onChange={e => updateChapter({ estimatedEffortHours: Number(e.target.value) || 0 })} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Review status">
                    <Select value={selected.reviewStatus} onValueChange={v => updateChapter({ reviewStatus: v as Status })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["Draft","In Review","Approved","Canonical","Deprecated","Archived"].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Manufacturing stage">
                    <Select value={selected.manufacturingStage} onValueChange={v => updateChapter({ manufacturingStage: v as PublicationStage })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PUBLICATION_STAGES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Learning objectives (one per line)">
                  <Textarea rows={3} value={selected.learningObjectives.join("\n")} onChange={e => updateChapter({ learningObjectives: e.target.value.split("\n").map(x => x.trim()).filter(Boolean) })} />
                </Field>
                <Field label="Editorial notes"><Textarea rows={2} value={selected.editorialNotes} onChange={e => updateChapter({ editorialNotes: e.target.value })} /></Field>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Canonical Assembly ---------- */
function CanonicalAssemblyCard({ draft, snapshot, onChapters }: { draft: PublicationBlueprint; snapshot: ReturnType<typeof useSnapshot>; onChapters: (chs: ChapterBlueprint[]) => void }) {
  const [chapterId, setChapterId] = useState<string>(draft.chapters[0]?.id ?? "");
  const [q, setQ] = useState("");
  const chapter = draft.chapters.find(c => c.id === chapterId);

  useEffect(() => {
    if (!chapter && draft.chapters[0]) setChapterId(draft.chapters[0].id);
  }, [chapter, draft.chapters]);

  if (!snapshot) return null;
  if (draft.chapters.length === 0) {
    return (
      <div className="editorial-card p-5">
        <SectionTitle>Canonical assembly</SectionTitle>
        <div className="text-sm text-muted-foreground">Add a chapter first to attach canonical assets.</div>
      </div>
    );
  }

  const toggle = <K extends "conceptIds" | "frameworkIds" | "knowledgeObjectIds" | "clientToolIds">(k: K, id: string) => {
    if (!chapter) return;
    const cur = chapter[k];
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
    onChapters(draft.chapters.map(c => c.id === chapter.id ? { ...c, [k]: next } : c));
  };

  const filterFn = <T extends { id: string }>(arr: T[], label: (x: T) => string) =>
    !q ? arr : arr.filter(x => `${x.id} ${label(x)}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="editorial-card p-5 space-y-3">
      <SectionTitle hint={chapter ? `${chapter.id} · ${chapter.title}` : ""}>Canonical assembly</SectionTitle>
      <p className="text-xs text-muted-foreground">Attach existing canonical assets by reference. No content is duplicated — every selection is a link back to the source of truth.</p>
      <div className="grid grid-cols-2 gap-3">
        <Select value={chapterId} onValueChange={setChapterId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{draft.chapters.sort((a, b) => a.order - b.order).map(c => <SelectItem key={c.id} value={c.id}>{c.id} · {c.title}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="Search assets…" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {chapter && (
        <div className="grid md:grid-cols-2 gap-3">
          <AssetGroup label="Concept Families" hint={`${chapter.conceptIds.length} linked`}>
            {filterFn(snapshot.concepts, c => c.canonicalName).map(c => (
              <AssetRow key={c.id} checked={chapter.conceptIds.includes(c.id)} onToggle={() => toggle("conceptIds", c.id)} id={c.id} label={c.canonicalName} status={c.status} dupe={chapter.conceptIds.filter(x => x === c.id).length > 1} />
            ))}
          </AssetGroup>
          <AssetGroup label="Frameworks" hint={`${chapter.frameworkIds.length} linked`}>
            {filterFn(snapshot.frameworks, f => f.name).map(f => (
              <AssetRow key={f.id} checked={chapter.frameworkIds.includes(f.id)} onToggle={() => toggle("frameworkIds", f.id)} id={f.id} label={f.name} status={f.status} />
            ))}
          </AssetGroup>
          <AssetGroup label="Knowledge Objects" hint={`${chapter.knowledgeObjectIds.length} linked`}>
            {filterFn(snapshot.knowledgeObjects, k => k.title).slice(0, 200).map(k => (
              <AssetRow key={k.id} checked={chapter.knowledgeObjectIds.includes(k.id)} onToggle={() => toggle("knowledgeObjectIds", k.id)} id={k.id} label={`${k.type} · ${k.title}`} status={k.status} unreviewed={!!k.promptId && !k.humanReviewCompleted} />
            ))}
          </AssetGroup>
          <AssetGroup label="Client Tools" hint={`${chapter.clientToolIds.length} linked`}>
            {filterFn(snapshot.clientTools, t => t.name).map(t => (
              <AssetRow key={t.id} checked={chapter.clientToolIds.includes(t.id)} onToggle={() => toggle("clientToolIds", t.id)} id={t.id} label={`${t.kind} · ${t.name}`} status={t.status} />
            ))}
          </AssetGroup>
        </div>
      )}
    </div>
  );
}

function AssetGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-xs uppercase tracking-wider text-slate-ink font-medium">{label}</div>
        {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
      </div>
      <div className="max-h-52 overflow-y-auto divide-y divide-border border border-border rounded">{children}</div>
    </div>
  );
}

function AssetRow({ checked, onToggle, id, label, status, dupe, unreviewed }: { checked: boolean; onToggle: () => void; id: string; label: string; status?: Status; dupe?: boolean; unreviewed?: boolean }) {
  return (
    <label className="flex items-center gap-2 py-1.5 px-2 cursor-pointer text-sm hover:bg-accent/30">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <span className="font-mono text-[11px] text-heritage w-24 shrink-0">{id}</span>
      <span className="flex-1 truncate">{label}</span>
      {dupe && <span className="text-[9px] uppercase text-destructive tracking-widest">Dup</span>}
      {unreviewed && <span className="text-[9px] uppercase text-gold tracking-widest">AI</span>}
      {status && <StatusBadge status={status} />}
    </label>
  );
}

/* ---------- Coverage Intelligence ---------- */
function CoverageIntelligenceCard({ cov, draft, snapshot }: { cov: ReturnType<typeof publicationCoverage>; draft: PublicationBlueprint; snapshot: ReturnType<typeof useSnapshot> }) {
  if (!snapshot) return null;
  const unused = useMemo(() => {
    // asset-level unused restricted to what this publication ignores from its own governing framework
    const govFramework = draft.frameworkId ? snapshot.frameworks.find(f => f.id === draft.frameworkId) : null;
    if (!govFramework) return { concepts: [], frameworks: [] };
    const usedConcepts = new Set(draft.chapters.flatMap(c => c.conceptIds));
    return {
      concepts: govFramework.governingConceptIds.filter(c => !usedConcepts.has(c)),
      frameworks: govFramework.dependencyIds.filter(f => !draft.chapters.some(ch => ch.frameworkIds.includes(f))),
    };
  }, [draft, snapshot]);

  return (
    <div className="editorial-card p-5 space-y-3">
      <SectionTitle>Coverage intelligence</SectionTitle>
      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <CovGroup title={`Missing Concepts (${cov.missingConcepts.length})`} items={cov.missingConcepts} tone="destructive" />
        <CovGroup title={`Missing Frameworks (${cov.missingFrameworks.length})`} items={cov.missingFrameworks} tone="destructive" />
        <CovGroup title={`Missing Knowledge Objects (${cov.missingKnowledgeObjects.length})`} items={cov.missingKnowledgeObjects} tone="destructive" />
        <CovGroup title={`Missing Client Tools (${cov.missingClientTools.length})`} items={cov.missingClientTools} tone="destructive" />
        <CovGroup title={`Duplicate references (${cov.duplicateReferences.length})`} items={cov.duplicateReferences.map(d => `${d.kind}:${d.id} ×${d.count}`)} tone="gold" />
        <CovGroup title={`Chapters missing objectives (${cov.chaptersWithoutObjectives.length})`} items={cov.chaptersWithoutObjectives} tone="gold" />
        <CovGroup title={`Unused governing Concepts (${unused.concepts.length})`} items={unused.concepts} tone="muted" />
        <CovGroup title={`Unused governing Frameworks (${unused.frameworks.length})`} items={unused.frameworks} tone="muted" />
      </div>
      <div className="pt-3 border-t border-border grid grid-cols-3 gap-3 text-xs">
        <div><div className="text-slate-ink uppercase tracking-wider">Coverage</div><CoverageBar percent={cov.coveragePercent} /></div>
        <div><div className="text-slate-ink uppercase tracking-wider">Readiness</div><CoverageBar percent={cov.readinessScore} /></div>
        <div><div className="text-slate-ink uppercase tracking-wider">Canonical</div><CoverageBar percent={cov.canonicalCompliance} /></div>
      </div>
    </div>
  );
}

function CovGroup({ title, items, tone }: { title: string; items: string[]; tone: "destructive" | "gold" | "muted" }) {
  const toneCls = tone === "destructive" ? "text-destructive" : tone === "gold" ? "text-gold" : "text-muted-foreground";
  return (
    <div className="border border-border rounded p-3">
      <div className={`text-xs font-medium mb-1 ${toneCls}`}>{title}</div>
      {items.length === 0 ? <div className="text-[11px] text-evergreen">Clean.</div> : (
        <ul className="text-[11px] space-y-0.5 max-h-24 overflow-y-auto">{items.slice(0, 20).map((x, i) => <li key={i} className="font-mono">· {x}</li>)}{items.length > 20 && <li className="text-muted-foreground">+{items.length - 20} more</li>}</ul>
      )}
    </div>
  );
}

/* ---------- Manufacturing Pipeline ---------- */
function ManufacturingPipelineCard({ draft, snapshot, promote }: { draft: PublicationBlueprint; snapshot: ReturnType<typeof useSnapshot>; promote: (t: PublicationStage) => void }) {
  if (!snapshot) return null;
  const currentIdx = PUBLICATION_STAGES.indexOf(draft.manufacturingStage);
  const nextStage = PUBLICATION_STAGES[currentIdx + 1] ?? null;
  const validation = nextStage ? validatePublicationPromotion(draft, nextStage, snapshot) : { ok: false, blockers: ["Already at final stage."], nextStage: null };

  return (
    <div className="editorial-card p-5 space-y-3">
      <SectionTitle>Manufacturing pipeline</SectionTitle>
      <div className="mb-2"><PublicationStageBadge stage={draft.manufacturingStage} /></div>
      <div className="flex items-center gap-1 text-[10px]">
        {PUBLICATION_STAGES.map((st, i) => (
          <div key={st} className="flex-1 flex flex-col items-center">
            <div className={`size-2.5 rounded-full ${i <= currentIdx ? "bg-gold" : "bg-muted"}`} />
            <div className={`text-center mt-1 ${i === currentIdx ? "text-heritage font-medium" : "text-muted-foreground"}`} style={{ fontSize: 9 }}>{st}</div>
          </div>
        ))}
      </div>
      <div className="pt-2 space-y-2">
        {nextStage && (
          <Button size="sm" className="w-full" disabled={!validation.ok} onClick={() => promote(nextStage)}>
            Promote to {nextStage}
          </Button>
        )}
        {validation.blockers.length > 0 && (
          <div className="text-[11px] text-destructive space-y-0.5">
            {validation.blockers.slice(0, 4).map((b, i) => <div key={i}>· {b}</div>)}
          </div>
        )}
      </div>
      <div className="pt-2 border-t border-border">
        <Label className="text-xs uppercase tracking-wider text-slate-ink">Force stage (governance override)</Label>
        <Select value={draft.manufacturingStage} onValueChange={v => promote(v as PublicationStage)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{PUBLICATION_STAGES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
        </Select>
        <div className="text-[10px] text-muted-foreground mt-1">Validation still enforced on manual selection.</div>
      </div>
    </div>
  );
}

/* ---------- Stage history ---------- */
function StageHistoryCard({ draft }: { draft: PublicationBlueprint }) {
  return (
    <div className="editorial-card p-5">
      <SectionTitle hint={`${draft.stageHistory.length} events`}>Stage history</SectionTitle>
      <ol className="text-xs space-y-2 max-h-48 overflow-y-auto">
        {[...draft.stageHistory].reverse().map((e, i) => (
          <li key={i} className="border-l-2 border-gold pl-2">
            <div className="font-medium text-heritage">{e.stage}</div>
            <div className="text-muted-foreground">{new Date(e.at).toLocaleString()} · {e.actor}</div>
            {e.note && <div>{e.note}</div>}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------- Metadata ---------- */
function MetadataCard({ draft, set }: { draft: PublicationBlueprint; set: <K extends keyof PublicationBlueprint>(k: K, v: PublicationBlueprint[K]) => void }) {
  return (
    <div className="editorial-card p-5 space-y-3">
      <SectionTitle>Lifecycle</SectionTitle>
      <div className="flex items-center gap-2"><StatusBadge status={draft.status} /><span className="text-xs text-muted-foreground">v{draft.version}</span></div>
      <Select value={draft.status} onValueChange={v => set("status", v as Status)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{["Draft","In Review","Approved","Canonical","Deprecated","Archived"].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
      </Select>
      <div className="flex items-center gap-2 pt-2">
        <Checkbox id="arch" checked={draft.archived} onCheckedChange={v => set("archived", !!v)} />
        <label htmlFor="arch" className="text-xs">Archived (hidden from Registry by default)</label>
      </div>
    </div>
  );
}

/* ---------- Presentations ---------- */
function PresentationsCard({ draft, set }: { draft: PublicationBlueprint; set: <K extends keyof PublicationBlueprint>(k: K, v: PublicationBlueprint[K]) => void }) {
  const add = () => {
    const id = `PRES-${String(draft.presentations.length + 1).padStart(3, "0")}`;
    const next: PresentationLink = { id, kind: "Slide Deck", title: "New presentation", url: "" };
    set("presentations", [...draft.presentations, next]);
  };
  const update = (idx: number, patch: Partial<PresentationLink>) => {
    set("presentations", draft.presentations.map((p, i) => i === idx ? { ...p, ...patch } : p));
  };
  const remove = (idx: number) => set("presentations", draft.presentations.filter((_, i) => i !== idx));

  return (
    <div className="editorial-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <SectionTitle hint={`${draft.presentations.length} linked`}>Presentation links</SectionTitle>
        <Button size="sm" variant="outline" onClick={add}><Plus className="size-4 mr-1" /> Add</Button>
      </div>
      <p className="text-xs text-muted-foreground">Slide decks, workshops, videos, courses, and client deliveries traceable to this publication.</p>
      {draft.presentations.length === 0 ? <div className="text-sm text-muted-foreground">No presentations yet.</div> : (
        <div className="space-y-2">
          {draft.presentations.map((p, i) => (
            <div key={p.id} className="border border-border rounded p-3 grid md:grid-cols-[100px_140px_1fr_1fr_auto] gap-2 items-center">
              <span className="font-mono text-[11px] text-heritage">{p.id}</span>
              <Select value={p.kind} onValueChange={v => update(i, { kind: v as PresentationKind })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRESENTATION_KINDS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Title" value={p.title} onChange={e => update(i, { title: e.target.value })} />
              <Input placeholder="URL or asset id" value={p.url} onChange={e => update(i, { url: e.target.value })} />
              <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="size-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Danger zone ---------- */
function DangerZone({ remove }: { remove: () => void }) {
  return (
    <div className="editorial-card p-5 border-destructive/30">
      <SectionTitle>Danger zone</SectionTitle>
      <Button size="sm" variant="outline" className="text-destructive border-destructive/40" onClick={remove}>
        <Trash2 className="size-4 mr-1" /> Delete publication
      </Button>
    </div>
  );
}

/* ---------- shared ---------- */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-wider text-slate-ink">{label}</Label>
      {children}
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
