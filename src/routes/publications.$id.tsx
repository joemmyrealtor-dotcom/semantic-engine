import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2, ChevronRight, ExternalLink } from "lucide-react";
import { useAutosave, isStaleConflict } from "@/hooks/use-autosave";
import { SaveIndicator } from "@/components/save-indicator";
import { DistressDecisionTree } from "@/components/distress-decision-tree";
import { TitleRenovationCrossRef } from "@/components/title-renovation-crossref";


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

  useEffect(() => { if (original && !draft) setDraft(original); }, [original, draft]);

  const autosave = useAutosave<PublicationBlueprint>({
    draft, dirty, delayMs: 800,
    save: async v => { await Repo.update("publications", id, v); },
    onSaved: () => setDirty(false),
    onError: err => toast.error(`Autosave failed: ${(err as Error).message}. Changes kept locally — will retry.`),
  });

  // Warn if the underlying record changed elsewhere while we hold unsaved edits.
  useEffect(() => {
    if (isStaleConflict(original?.updatedAt, draft?.updatedAt, dirty)) {
      toast.warning("Publication changed elsewhere. Your local edits are still active — save will overwrite.");
    }
  }, [original?.updatedAt, dirty, draft?.updatedAt]);

  if (!s) return <LoadingState />;
  if (!original) return <ErrorState message={`Publication ${id} not found.`} />;
  if (!draft) return <LoadingState />;

  const set = <K extends keyof PublicationBlueprint>(k: K, v: PublicationBlueprint[K]) => {
    setDraft({ ...draft, [k]: v }); setDirty(true);
  };
  const setChapters = (chs: ChapterBlueprint[]) => set("chapters", chs);

  const cov = publicationCoverage(draft, s);

  const promote = async (target: PublicationStage, opts?: { override?: boolean; note?: string }) => {
    const isBackwards = PUBLICATION_STAGES.indexOf(target) < PUBLICATION_STAGES.indexOf(draft.manufacturingStage);
    const nonAdjacent = !isAdjacentStageTransition(draft.manufacturingStage, target);
    if ((isBackwards || nonAdjacent) && !opts?.override) {
      toast.error("Non-adjacent or backwards moves require a governance override with note.");
      return;
    }
    const result = validatePublicationPromotion(draft, target, s);
    if (!result.ok && !opts?.override) {
      toast.error(`Cannot promote to ${target}: ${result.blockers[0]}`);
      return;
    }
    const notePrefix = opts?.override ? "OVERRIDE" : "Promoted";
    const note = `${notePrefix}: ${target}${opts?.note ? " — " + opts.note : ""}${!result.ok ? ` (blockers: ${result.blockers.length})` : ""}`;
    const next: PublicationBlueprint = {
      ...draft,
      manufacturingStage: target,
      stageHistory: appendStageHistory(draft, target, draft.owner || draft.steward, note),
    };
    setDraft(next); setDirty(true);
    toast.success(`${opts?.override ? "Override applied" : "Promoted"} → ${target}.`);
  };

  const removePub = async () => {
    if (!confirm(`Delete ${draft.id}? This cannot be undone.`)) return;
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
            <SaveIndicator saving={autosave.saving} dirty={dirty} error={autosave.error} lastSavedAt={autosave.lastSavedAt} onRetry={autosave.retry} />
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
          <div className="lg:col-span-2 min-w-0 space-y-6">
            <GeneralInfoCard draft={draft} set={set} />
            {draft.id === "PL-210" && <DistressDecisionTree />}
            {(draft.id === "PL-211" || draft.id === "PL-206") && (
              <TitleRenovationCrossRef from={draft.id as "PL-206" | "PL-211"} />
            )}

            <ChaptersCard draft={draft} snapshot={s} onChapters={setChapters} />
            <CanonicalAssemblyCard draft={draft} snapshot={s} onChapters={setChapters} />
            <CoverageIntelligenceCard cov={cov} draft={draft} snapshot={s} onChapters={setChapters} />
            <PresentationsCard draft={draft} set={set} />
          </div>

          <aside className="min-w-0 space-y-4">
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

  // Keyboard-accessible reorder: moves within the current parent scope.
  const move = (chapterId: string, dir: -1 | 1) => {
    const ch = draft.chapters.find(c => c.id === chapterId); if (!ch) return;
    const siblings = draft.chapters.filter(c => (c.parentChapterId ?? null) === (ch.parentChapterId ?? null))
      .sort((a, b) => a.order - b.order);
    const curIdx = siblings.findIndex(c => c.id === chapterId);
    const to = curIdx + dir;
    if (to < 0 || to >= siblings.length) return;
    onChapters(moveChapter(draft.chapters, chapterId, ch.parentChapterId ?? null, to));
  };

  // Drag-and-drop reorder: drop onto another chapter's row (same or different parent).
  const [dragId, setDragId] = useState<string | null>(null);
  const handleDrop = (targetId: string, mode: "before" | "after" | "child") => {
    if (!dragId || dragId === targetId) return;
    if (mode === "child") {
      if (wouldCreateChapterCycle(draft.chapters, dragId, targetId)) {
        toast.error("Cannot nest a chapter inside itself or its descendant.");
        return;
      }
      const kids = draft.chapters.filter(c => c.parentChapterId === targetId);
      onChapters(moveChapter(draft.chapters, dragId, targetId, kids.length));
      return;
    }
    const target = draft.chapters.find(c => c.id === targetId); if (!target) return;
    const newParent = target.parentChapterId ?? null;
    if (wouldCreateChapterCycle(draft.chapters, dragId, newParent)) {
      toast.error("Cannot move — would create a chapter cycle.");
      return;
    }
    const siblings = draft.chapters.filter(c => (c.parentChapterId ?? null) === newParent && c.id !== dragId).sort((a, b) => a.order - b.order);
    const tIdx = siblings.findIndex(c => c.id === targetId);
    const idx = mode === "before" ? tIdx : tIdx + 1;
    onChapters(moveChapter(draft.chapters, dragId, newParent, idx));
  };

  const remove = (id: string) => {
    if (!confirm(`Delete chapter ${id}? Any children will re-parent to top level.`)) return;
    const kept = draft.chapters.filter(c => c.id !== id).map(c => ({ ...c, parentChapterId: c.parentChapterId === id ? null : c.parentChapterId }));
    onChapters(kept);
    if (selectedId === id) setSelectedId(null);
  };

  const updateChapter = (patch: Partial<ChapterBlueprint>) => {
    if (!selected) return;
    // Parent cycle guard.
    if (patch.parentChapterId !== undefined && wouldCreateChapterCycle(draft.chapters, selected.id, patch.parentChapterId)) {
      toast.error("Cannot set parent — would create a cycle.");
      return;
    }
    onChapters(draft.chapters.map(c => c.id === selected.id ? { ...c, ...patch } : c));
  };

  const sortedFlat = [...draft.chapters].sort((a, b) => a.order - b.order);
  const invalidParentIds = selected ? new Set([selected.id, ...chapterDescendantIds(draft.chapters, selected.id)]) : new Set<string>();

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
              const siblings = draft.chapters.filter(c => (c.parentChapterId ?? null) === (chapter.parentChapterId ?? null)).sort((a,b) => a.order - b.order);
              const sibIdx = siblings.findIndex(c => c.id === chapter.id);
              const active = chapter.id === selectedId;
              const isDragging = dragId === chapter.id;
              return (
                <div
                  key={chapter.id}
                  draggable
                  onDragStart={e => { setDragId(chapter.id); e.dataTransfer.effectAllowed = "move"; }}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                  onDrop={e => {
                    e.preventDefault();
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const mode: "before" | "after" | "child" =
                      y < rect.height * 0.25 ? "before" : y > rect.height * 0.75 ? "after" : "child";
                    handleDrop(chapter.id, mode);
                  }}
                  className={`px-2 py-2 flex items-center gap-2 text-sm ${active ? "bg-accent/60" : "hover:bg-accent/30"} ${isDragging ? "opacity-40" : ""}`}
                  style={{ paddingLeft: 8 + depth * 16 }}
                  aria-grabbed={isDragging}
                >
                  <GripVertical className="size-3 text-muted-foreground shrink-0 cursor-grab" aria-hidden />
                  {depth > 0 && <ChevronRight className="size-3 text-muted-foreground shrink-0" />}
                  <button className="flex-1 text-left min-w-0" onClick={() => setSelectedId(chapter.id)}>
                    <div className="font-mono text-[10px] text-slate-ink">{chapter.id} · #{chapter.order}</div>
                    <div className="truncate">{chapter.title}</div>
                  </button>
                  <PublicationStageBadge stage={chapter.manufacturingStage} className="text-[9px]" />
                  <button aria-label={`Move ${chapter.id} up`} className="p-1 text-muted-foreground hover:text-heritage disabled:opacity-30" disabled={sibIdx === 0} onClick={() => move(chapter.id, -1)}><ArrowUp className="size-3" /></button>
                  <button aria-label={`Move ${chapter.id} down`} className="p-1 text-muted-foreground hover:text-heritage disabled:opacity-30" disabled={sibIdx === siblings.length - 1} onClick={() => move(chapter.id, 1)}><ArrowDown className="size-3" /></button>
                  <button aria-label={`Delete ${chapter.id}`} className="p-1 text-destructive/70 hover:text-destructive" onClick={() => remove(chapter.id)}><Trash2 className="size-3" /></button>
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
                        {draft.chapters.filter(c => !invalidParentIds.has(c.id)).map(c => <SelectItem key={c.id} value={c.id}>{c.id} · {c.title}</SelectItem>)}
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
                <ChapterPresentationsEditor chapter={selected} onChange={presentations => updateChapter({ presentations })} />
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
    <div className="min-w-0">
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

/* ---------- Coverage Intelligence with gap remediation ---------- */
function CoverageIntelligenceCard({ cov, draft, snapshot, onChapters }: { cov: ReturnType<typeof publicationCoverage>; draft: PublicationBlueprint; snapshot: ReturnType<typeof useSnapshot>; onChapters: (chs: ChapterBlueprint[]) => void }) {
  if (!snapshot) return null;
  const unused = useMemo(() => {
    const govFramework = draft.frameworkId ? snapshot.frameworks.find(f => f.id === draft.frameworkId) : null;
    if (!govFramework) return { concepts: [] as string[], frameworks: [] as string[] };
    const usedConcepts = new Set(draft.chapters.flatMap(c => c.conceptIds));
    return {
      concepts: govFramework.governingConceptIds.filter(c => !usedConcepts.has(c)),
      frameworks: govFramework.dependencyIds.filter(f => !draft.chapters.some(ch => ch.frameworkIds.includes(f))),
    };
  }, [draft, snapshot]);

  // Remediation helpers
  const removeBrokenRef = (kind: string, id: string) => {
    const keyMap: Record<string, keyof ChapterBlueprint> = { concept: "conceptIds", framework: "frameworkIds", "knowledge-object": "knowledgeObjectIds", "client-tool": "clientToolIds" };
    const key = keyMap[kind]; if (!key) return;
    onChapters(draft.chapters.map(ch => ({ ...ch, [key]: (ch[key] as string[]).filter(x => x !== id) })));
    toast.success(`Removed broken ${kind} reference ${id}.`);
  };
  const dedupeChapterRef = (kind: string, id: string) => {
    const keyMap: Record<string, keyof ChapterBlueprint> = { concept: "conceptIds", framework: "frameworkIds", ko: "knowledgeObjectIds", tool: "clientToolIds" };
    const key = keyMap[kind]; if (!key) return;
    onChapters(draft.chapters.map(ch => {
      const arr = ch[key] as string[];
      const first = arr.indexOf(id);
      if (first === -1) return ch;
      const cleaned = arr.filter((x, i) => x !== id || i === first);
      return { ...ch, [key]: cleaned };
    }));
    toast.success(`Deduped ${kind} ${id}.`);
  };
  const linkUnusedConcept = (conceptId: string) => {
    const first = [...draft.chapters].sort((a, b) => a.order - b.order)[0];
    if (!first) return;
    if (first.conceptIds.includes(conceptId)) { toast.info("Already linked."); return; }
    onChapters(draft.chapters.map(c => c.id === first.id ? { ...c, conceptIds: [...c.conceptIds, conceptId] } : c));
    toast.success(`Linked ${conceptId} into ${first.id}.`);
  };
  const linkUnusedFramework = (frameworkId: string) => {
    const first = [...draft.chapters].sort((a, b) => a.order - b.order)[0];
    if (!first) return;
    if (first.frameworkIds.includes(frameworkId)) { toast.info("Already linked."); return; }
    onChapters(draft.chapters.map(c => c.id === first.id ? { ...c, frameworkIds: [...c.frameworkIds, frameworkId] } : c));
    toast.success(`Linked ${frameworkId} into ${first.id}.`);
  };
  const koFactoryFor = (conceptId: string) => `/knowledge-objects/new?concept=${encodeURIComponent(conceptId)}${draft.frameworkId ? `&framework=${encodeURIComponent(draft.frameworkId)}` : ""}&pub=${encodeURIComponent(draft.id)}`;

  return (
    <div className="editorial-card p-5 space-y-3">
      <SectionTitle>Coverage intelligence</SectionTitle>
      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <ActionableGroup title={`Missing Concepts (${cov.missingConcepts.length})`} tone="destructive"
          rows={cov.missingConcepts.map(id => ({ id, actions: [
            { label: "Remove", onClick: () => removeBrokenRef("concept", id) },
            { label: "Open Concept", to: `/concepts/${id}` },
          ] }))} />
        <ActionableGroup title={`Missing Frameworks (${cov.missingFrameworks.length})`} tone="destructive"
          rows={cov.missingFrameworks.map(id => ({ id, actions: [
            { label: "Remove", onClick: () => removeBrokenRef("framework", id) },
          ] }))} />
        <ActionableGroup title={`Missing Knowledge Objects (${cov.missingKnowledgeObjects.length})`} tone="destructive"
          rows={cov.missingKnowledgeObjects.map(id => ({ id, actions: [
            { label: "Remove", onClick: () => removeBrokenRef("knowledge-object", id) },
          ] }))} />
        <ActionableGroup title={`Missing Client Tools (${cov.missingClientTools.length})`} tone="destructive"
          rows={cov.missingClientTools.map(id => ({ id, actions: [
            { label: "Remove", onClick: () => removeBrokenRef("client-tool", id) },
          ] }))} />
        <ActionableGroup title={`Duplicate references (${cov.duplicateReferences.length})`} tone="gold"
          rows={cov.duplicateReferences.map(d => ({ id: `${d.kind}:${d.id} ×${d.count}`, actions: [
            { label: "Dedupe", onClick: () => dedupeChapterRef(d.kind, d.id) },
          ] }))} />
        <ActionableGroup title={`Chapters missing objectives (${cov.chaptersWithoutObjectives.length})`} tone="gold"
          rows={cov.chaptersWithoutObjectives.map(id => ({ id, actions: [] }))} />
        <ActionableGroup title={`Unused governing Concepts (${unused.concepts.length})`} tone="muted"
          rows={unused.concepts.map(id => ({ id, actions: [
            { label: "Link → first chapter", onClick: () => linkUnusedConcept(id) },
            { label: "Draft KO", to: koFactoryFor(id) },
          ] }))} />
        <ActionableGroup title={`Unused governing Frameworks (${unused.frameworks.length})`} tone="muted"
          rows={unused.frameworks.map(id => ({ id, actions: [
            { label: "Link → first chapter", onClick: () => linkUnusedFramework(id) },
          ] }))} />
      </div>
      <div className="pt-3 border-t border-border grid grid-cols-3 gap-3 text-xs">
        <div><div className="text-slate-ink uppercase tracking-wider">Coverage</div><CoverageBar percent={cov.coveragePercent} /></div>
        <div><div className="text-slate-ink uppercase tracking-wider">Readiness</div><CoverageBar percent={cov.readinessScore} /></div>
        <div><div className="text-slate-ink uppercase tracking-wider">Canonical</div><CoverageBar percent={cov.canonicalCompliance} /></div>
      </div>
    </div>
  );
}

type ActionRow = { label: string; onClick?: () => void; to?: string };
function ActionableGroup({ title, rows, tone }: { title: string; rows: { id: string; actions: ActionRow[] }[]; tone: "destructive" | "gold" | "muted" }) {
  const toneCls = tone === "destructive" ? "text-destructive" : tone === "gold" ? "text-gold" : "text-muted-foreground";
  return (
    <div className="border border-border rounded p-3">
      <div className={`text-xs font-medium mb-1 ${toneCls}`}>{title}</div>
      {rows.length === 0 ? <div className="text-[11px] text-evergreen">Clean.</div> : (
        <ul className="text-[11px] space-y-1 max-h-32 overflow-y-auto">
          {rows.slice(0, 20).map((r, i) => (
            <li key={i} className="flex items-center gap-1 flex-wrap">
              <span className="font-mono flex-1 truncate">· {r.id}</span>
              {r.actions.map((a, ai) => a.to
                ? <Link key={ai} to={a.to} className="text-[10px] underline text-heritage inline-flex items-center gap-0.5">{a.label}<ExternalLink className="size-2.5" /></Link>
                : <button key={ai} onClick={a.onClick} className="text-[10px] underline text-heritage">{a.label}</button>)}
            </li>
          ))}
          {rows.length > 20 && <li className="text-muted-foreground">+{rows.length - 20} more</li>}
        </ul>
      )}
    </div>
  );
}

/* ---------- Manufacturing Pipeline ---------- */
function ManufacturingPipelineCard({ draft, snapshot, promote }: { draft: PublicationBlueprint; snapshot: ReturnType<typeof useSnapshot>; promote: (t: PublicationStage, opts?: { override?: boolean; note?: string }) => void }) {
  const [overrideStage, setOverrideStage] = useState<PublicationStage | null>(null);
  const [overrideNote, setOverrideNote] = useState("");
  if (!snapshot) return null;
  const currentIdx = PUBLICATION_STAGES.indexOf(draft.manufacturingStage);
  const nextStage = PUBLICATION_STAGES[currentIdx + 1] ?? null;
  const prevStage = PUBLICATION_STAGES[currentIdx - 1] ?? null;
  const validation = nextStage ? validatePublicationPromotion(draft, nextStage, snapshot) : { ok: false, blockers: ["Already at final stage."], nextStage: null };

  const applyOverride = () => {
    if (!overrideStage) return;
    if (!overrideNote.trim()) { toast.error("Override requires an audit note."); return; }
    promote(overrideStage, { override: true, note: overrideNote.trim() });
    setOverrideStage(null); setOverrideNote("");
  };

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
        {prevStage && (
          <Button size="sm" variant="outline" className="w-full" onClick={() => setOverrideStage(prevStage)}>
            Step back to {prevStage} (audited)
          </Button>
        )}
        {validation.blockers.length > 0 && (
          <div className="text-[11px] text-destructive space-y-0.5" role="status">
            {validation.blockers.slice(0, 4).map((b, i) => <div key={i}>· {b}</div>)}
          </div>
        )}
      </div>
      <div className="pt-2 border-t border-border">
        <Label className="text-xs uppercase tracking-wider text-slate-ink">Governance override</Label>
        <Select value={overrideStage ?? ""} onValueChange={v => setOverrideStage(v as PublicationStage)}>
          <SelectTrigger><SelectValue placeholder="Select target stage" /></SelectTrigger>
          <SelectContent>{PUBLICATION_STAGES.filter(s => s !== draft.manufacturingStage).map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
        </Select>
        {overrideStage && (
          <div className="space-y-2 mt-2">
            <Textarea rows={2} placeholder="Override reason (required, recorded in stage history)" value={overrideNote} onChange={e => setOverrideNote(e.target.value)} />
            <Button size="sm" variant="destructive" className="w-full" onClick={applyOverride}>Apply override → {overrideStage}</Button>
          </div>
        )}
        <div className="text-[10px] text-muted-foreground mt-2">Overrides bypass validation and are stamped OVERRIDE in stage history.</div>
      </div>
    </div>
  );
}

/* ---------- Chapter presentations editor ---------- */
function ChapterPresentationsEditor({ chapter, onChange }: { chapter: ChapterBlueprint; onChange: (p: PresentationLink[]) => void }) {
  const add = () => {
    const id = `PRES-${chapter.id}-${String(chapter.presentations.length + 1).padStart(2, "0")}`;
    onChange([...chapter.presentations, { id, kind: "Slide Deck", title: "New chapter presentation", url: "" }]);
  };
  const update = (idx: number, patch: Partial<PresentationLink>) =>
    onChange(chapter.presentations.map((p, i) => i === idx ? { ...p, ...patch } : p));
  const remove = (idx: number) => onChange(chapter.presentations.filter((_, i) => i !== idx));
  return (
    <div className="border border-border rounded p-2 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wider text-slate-ink">Chapter presentations</Label>
        <Button size="sm" variant="outline" onClick={add}><Plus className="size-3 mr-1" /> Add</Button>
      </div>
      {chapter.presentations.length === 0 ? (
        <div className="text-[11px] text-muted-foreground">No presentations at this chapter level.</div>
      ) : (
        <div className="space-y-1">
          {chapter.presentations.map((p, i) => (
            <div key={p.id} className="grid grid-cols-[110px_1fr_1fr_auto] gap-1 items-center">
              <Select value={p.kind} onValueChange={v => update(i, { kind: v as PresentationKind })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{PRESENTATION_KINDS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
              </Select>
              <Input className="h-8 text-xs" placeholder="Title" value={p.title} onChange={e => update(i, { title: e.target.value })} />
              <Input className="h-8 text-xs" placeholder="URL" value={p.url} onChange={e => update(i, { url: e.target.value })} />
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Remove ${p.id}`} onClick={() => remove(i)}><Trash2 className="size-3 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}
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
