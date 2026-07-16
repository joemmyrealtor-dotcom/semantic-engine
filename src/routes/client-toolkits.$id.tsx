import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, SectionTitle, EmptyState } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  PUBLICATION_STAGES, CLIENT_TOOLKIT_TYPES, CLIENT_SEGMENTS,
  type ClientToolkit, type ClientToolkitSection, type ManufacturingStage,
} from "@/lib/data/schema";
import {
  toolkitCoverage, validateToolkitPromotion, nextToolkitSectionId,
  sectionTree, moveSection, sectionDescendantIds, findToolkitsReferencing,
} from "@/lib/data/service";
import { PublicationStageBadge } from "@/components/publication-stage-badge";
import { CoverageBar } from "@/routes/publications.index";
import { usePatchSave } from "@/hooks/use-patch-save";
import { SaveIndicator } from "@/components/save-indicator";
import {
  Plus, Trash2, ArrowUp, ArrowDown, ChevronRight, ChevronDown,
  AlertTriangle, CheckCircle2, ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/client-toolkits/$id")({
  head: () => ({ meta: [{ title: "Client Toolkit — Legacy Forge" }] }),
  component: ClientToolkitStudioPage,
});

function ClientToolkitStudioPage() {
  const { id } = Route.useParams();
  const s = useSnapshot();
  const navigate = useNavigate();
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const tk = s?.clientToolkits.find(t => t.id === id) ?? null;
  const cov = useMemo(() => (s && tk ? toolkitCoverage(tk, s) : null), [s, tk]);
  const tree = useMemo(() => (tk ? sectionTree(tk.sections) : []), [tk]);

  if (!s) return <LoadingState />;
  if (!tk) return (
    <>
      <PageHeader title="Toolkit not found" description={`No toolkit with id ${id}.`} />
      <PageBody><Button onClick={() => navigate({ to: "/client-toolkits" })}>Back to registry</Button></PageBody>
    </>
  );

  const { patch: patchToolkit, state: saveState } = usePatchSave<ClientToolkit>({
    save: async (p) => { await Repo.update("clientToolkits", tk.id, { ...p, updatedAt: new Date().toISOString() }); },
  });

  const patchSection = async (sid: string, p: Partial<ClientToolkitSection>) => {
    const next = tk.sections.map(sec => sec.id === sid ? { ...sec, ...p } : sec);
    await patchToolkit({ sections: next });
  };

  const addSection = async (parentId: string | null = null) => {
    const sid = nextToolkitSectionId(s);
    const siblings = tk.sections.filter(x => x.parentSectionId === parentId);
    const order = (siblings.reduce((m, x) => Math.max(m, x.order), 0) || 0) + 10;
    const newSec: ClientToolkitSection = {
      id: sid, title: "Untitled Section", description: "",
      order, parentSectionId: parentId, objective: "",
      conceptIds: [], frameworkIds: [], knowledgeObjectIds: [], clientToolIds: [], publicationIds: [],
      presentations: [], estimatedDurationMinutes: 0,
      facilitatorNotes: "", clientNotes: "",
      manufacturingStage: "Draft", humanReviewCompleted: false,
    };
    await patchToolkit({ sections: [...tk.sections, newSec] });
    setSelectedSection(sid);
    toast.success(`Section ${sid} added`);
  };

  const removeSection = async (sid: string) => {
    const descendants = sectionDescendantIds(tk.sections, sid);
    const toDelete = new Set([sid, ...descendants]);
    if (descendants.length > 0 && !confirm(`Delete ${sid} and ${descendants.length} nested section(s)?`)) return;
    await patchToolkit({ sections: tk.sections.filter(x => !toDelete.has(x.id)) });
    if (selectedSection === sid) setSelectedSection(null);
  };

  const moveUp = async (sec: ClientToolkitSection) => {
    const siblings = tk.sections.filter(x => x.parentSectionId === sec.parentSectionId).sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex(x => x.id === sec.id);
    if (idx <= 0) return;
    await patchToolkit({ sections: moveSection(tk.sections, sec.id, sec.parentSectionId, idx - 1) });
  };
  const moveDown = async (sec: ClientToolkitSection) => {
    const siblings = tk.sections.filter(x => x.parentSectionId === sec.parentSectionId).sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex(x => x.id === sec.id);
    if (idx === -1 || idx >= siblings.length - 1) return;
    await patchToolkit({ sections: moveSection(tk.sections, sec.id, sec.parentSectionId, idx + 1) });
  };

  const promote = async (target: ManufacturingStage) => {
    const check = validateToolkitPromotion(tk, target, s);
    if (!check.ok) { toast.error(check.blockers[0]); return; }
    const now = new Date().toISOString();
    await patchToolkit({
      manufacturingStage: target,
      stageHistory: [...tk.stageHistory, { stage: target, at: now, actor: tk.steward, note: `Promoted to ${target}.` }],
    });
    toast.success(`Promoted to ${target}`);
  };

  const selected = tk.sections.find(x => x.id === selectedSection) ?? null;
  const toggleCollapse = (sid: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  };

  const visibleTree = tree.filter(({ section }) => {
    let cur = section.parentSectionId;
    while (cur) {
      if (collapsed.has(cur)) return false;
      cur = tk.sections.find(x => x.id === cur)?.parentSectionId ?? null;
    }
    return true;
  });

  return (
    <>
      <PageHeader
        eyebrow={`${tk.id} · ${tk.toolkitType}`}
        title={tk.title}
        description={tk.description || "Toolkit workspace"}
        actions={
          <div className="flex items-center gap-2">
            <PublicationStageBadge stage={tk.manufacturingStage} />
            <Select value={tk.manufacturingStage} onValueChange={v => promote(v as ManufacturingStage)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PUBLICATION_STAGES.map(st => <SelectItem key={st} value={st}>Promote → {st}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      />
      <PageBody>
        <div className="grid lg:grid-cols-3 gap-6">
          {/* LEFT — metadata + coverage */}
          <div className="space-y-6">
            <section className="editorial-card p-5 space-y-3">
              <SectionTitle>Toolkit metadata</SectionTitle>
              <Field label="Title"><Input value={tk.title} onChange={e => patchToolkit({ title: e.target.value })} /></Field>
              <Field label="Description"><Textarea rows={3} value={tk.description} onChange={e => patchToolkit({ description: e.target.value })} /></Field>
              <Field label="Purpose"><Textarea rows={2} value={tk.purpose} onChange={e => patchToolkit({ purpose: e.target.value })} /></Field>
              <Field label="Audience"><Input value={tk.audience} onChange={e => patchToolkit({ audience: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Type">
                  <Select value={tk.toolkitType} onValueChange={v => patchToolkit({ toolkitType: v as ClientToolkit["toolkitType"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CLIENT_TOOLKIT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Segment">
                  <Select value={tk.clientSegment} onValueChange={v => patchToolkit({ clientSegment: v as ClientToolkit["clientSegment"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CLIENT_SEGMENTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Owner"><Input value={tk.owner} onChange={e => patchToolkit({ owner: e.target.value })} /></Field>
                <Field label="Steward"><Input value={tk.steward} onChange={e => patchToolkit({ steward: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Version"><Input value={tk.version} onChange={e => patchToolkit({ version: e.target.value })} /></Field>
                <Field label="Effective date"><Input type="date" value={tk.effectiveDate ?? ""} onChange={e => patchToolkit({ effectiveDate: e.target.value || null })} /></Field>
              </div>
              <Field label="Tags (comma-separated)">
                <Input value={tk.tags.join(", ")} onChange={e => patchToolkit({ tags: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })} />
              </Field>
            </section>

            {cov && (
              <section className="editorial-card p-5 space-y-3">
                <SectionTitle>Coverage & readiness</SectionTitle>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <ScoreTile label="Coverage" value={cov.coveragePercent} suffix="%" />
                  <ScoreTile label="Readiness" value={cov.readinessScore} />
                  <ScoreTile label="Canonical" value={cov.canonicalCompliance} suffix="%" />
                </div>
                <div className="text-xs text-slate-ink space-y-1">
                  <div>Governing concepts: <b>{cov.governingConceptCount}</b></div>
                  <div>Governing frameworks: <b>{cov.governingFrameworkCount}</b></div>
                  <div>Editorial score: <b>{cov.editorialScore}</b></div>
                </div>
                {(cov.brokenReferences.length > 0 || cov.sectionsWithoutObjectives.length > 0 || cov.sectionsWithoutAssets.length > 0) && (
                  <div className="mt-2 space-y-1 text-xs">
                    {cov.brokenReferences.length > 0 && (
                      <div className="flex items-start gap-2 text-destructive"><AlertTriangle className="size-3.5 mt-0.5" /><span>{cov.brokenReferences.length} broken references</span></div>
                    )}
                    {cov.sectionsWithoutObjectives.length > 0 && (
                      <div className="flex items-start gap-2 text-gold"><AlertTriangle className="size-3.5 mt-0.5" /><span>Objectives missing: {cov.sectionsWithoutObjectives.join(", ")}</span></div>
                    )}
                    {cov.sectionsWithoutAssets.length > 0 && (
                      <div className="flex items-start gap-2 text-gold"><AlertTriangle className="size-3.5 mt-0.5" /><span>No assets: {cov.sectionsWithoutAssets.join(", ")}</span></div>
                    )}
                  </div>
                )}
                <div className="pt-2 border-t border-border">
                  <CoverageBar percent={cov.coveragePercent} />
                </div>
              </section>
            )}
          </div>

          {/* MIDDLE — sections tree */}
          <div className="space-y-6">
            <section className="editorial-card p-5">
              <div className="flex items-center justify-between mb-3">
                <SectionTitle>Sections</SectionTitle>
                <Button size="sm" onClick={() => addSection(null)}><Plus className="size-4 mr-1" />Add root</Button>
              </div>
              {visibleTree.length === 0 ? (
                <EmptyState title="No sections yet" description="Add a section to begin assembling this toolkit." action={<Button size="sm" onClick={() => addSection(null)}>Add section</Button>} />
              ) : (
                <ul className="space-y-1">
                  {visibleTree.map(({ section, depth }) => {
                    const hasChildren = tk.sections.some(x => x.parentSectionId === section.id);
                    const isSel = section.id === selectedSection;
                    return (
                      <li key={section.id}>
                        <div className={`flex items-center gap-1 rounded px-2 py-1.5 text-sm ${isSel ? "bg-accent" : "hover:bg-accent/50"}`} style={{ paddingLeft: `${depth * 16 + 8}px` }}>
                          {hasChildren ? (
                            <button onClick={() => toggleCollapse(section.id)} className="shrink-0 text-muted-foreground hover:text-heritage">
                              {collapsed.has(section.id) ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                            </button>
                          ) : <span className="w-3.5" />}
                          <button onClick={() => setSelectedSection(section.id)} className="flex-1 text-left min-w-0">
                            <span className="font-mono text-[10px] text-heritage mr-2">{section.id}</span>
                            <span className="truncate">{section.title}</span>
                          </button>
                          <PublicationStageBadge stage={section.manufacturingStage} />
                          <div className="inline-flex ml-1">
                            <Button size="icon" variant="ghost" title="Move up" onClick={() => moveUp(section)}><ArrowUp className="size-3" /></Button>
                            <Button size="icon" variant="ghost" title="Move down" onClick={() => moveDown(section)}><ArrowDown className="size-3" /></Button>
                            <Button size="icon" variant="ghost" title="Add child" onClick={() => addSection(section.id)}><Plus className="size-3" /></Button>
                            <Button size="icon" variant="ghost" title="Delete" onClick={() => removeSection(section.id)}><Trash2 className="size-3 text-destructive" /></Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="editorial-card p-5">
              <SectionTitle>Top-level canonical references</SectionTitle>
              <IdListEditor label="Concepts" ids={tk.conceptIds} onChange={ids => patchToolkit({ conceptIds: ids })} known={new Set(s.concepts.map(c => c.id))} />
              <IdListEditor label="Frameworks" ids={tk.frameworkIds} onChange={ids => patchToolkit({ frameworkIds: ids })} known={new Set(s.frameworks.map(f => f.id))} />
              <IdListEditor label="Knowledge Objects" ids={tk.knowledgeObjectIds} onChange={ids => patchToolkit({ knowledgeObjectIds: ids })} known={new Set(s.knowledgeObjects.map(k => k.id))} />
              <IdListEditor label="Client Tools" ids={tk.clientToolIds} onChange={ids => patchToolkit({ clientToolIds: ids })} known={new Set(s.clientTools.map(t => t.id))} />
              <IdListEditor label="Publications" ids={tk.publicationIds} onChange={ids => patchToolkit({ publicationIds: ids })} known={new Set(s.publications.map(p => p.id))} />
            </section>
          </div>

          {/* RIGHT — selected section editor */}
          <div className="space-y-6">
            {selected ? (
              <section className="editorial-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-mono text-heritage">{selected.id}</div>
                    <SectionTitle>Section editor</SectionTitle>
                  </div>
                  <PublicationStageBadge stage={selected.manufacturingStage} />
                </div>
                <Field label="Title"><Input value={selected.title} onChange={e => patchSection(selected.id, { title: e.target.value })} /></Field>
                <Field label="Description"><Textarea rows={2} value={selected.description} onChange={e => patchSection(selected.id, { description: e.target.value })} /></Field>
                <Field label="Objective (required for QA+)"><Textarea rows={2} value={selected.objective} onChange={e => patchSection(selected.id, { objective: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Duration (min)"><Input type="number" value={selected.estimatedDurationMinutes} onChange={e => patchSection(selected.id, { estimatedDurationMinutes: Number(e.target.value) || 0 })} /></Field>
                  <Field label="Stage">
                    <Select value={selected.manufacturingStage} onValueChange={v => patchSection(selected.id, { manufacturingStage: v as ManufacturingStage })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PUBLICATION_STAGES.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={selected.humanReviewCompleted} onChange={e => patchSection(selected.id, { humanReviewCompleted: e.target.checked })} />
                  Human review completed
                </label>
                <IdListEditor label="Concepts" ids={selected.conceptIds} onChange={ids => patchSection(selected.id, { conceptIds: ids })} known={new Set(s.concepts.map(c => c.id))} />
                <IdListEditor label="Frameworks" ids={selected.frameworkIds} onChange={ids => patchSection(selected.id, { frameworkIds: ids })} known={new Set(s.frameworks.map(f => f.id))} />
                <IdListEditor label="Knowledge Objects" ids={selected.knowledgeObjectIds} onChange={ids => patchSection(selected.id, { knowledgeObjectIds: ids })} known={new Set(s.knowledgeObjects.map(k => k.id))} />
                <IdListEditor label="Client Tools" ids={selected.clientToolIds} onChange={ids => patchSection(selected.id, { clientToolIds: ids })} known={new Set(s.clientTools.map(t => t.id))} />
                <IdListEditor label="Publications" ids={selected.publicationIds} onChange={ids => patchSection(selected.id, { publicationIds: ids })} known={new Set(s.publications.map(p => p.id))} />
                <Field label="Facilitator notes"><Textarea rows={2} value={selected.facilitatorNotes} onChange={e => patchSection(selected.id, { facilitatorNotes: e.target.value })} /></Field>
                <Field label="Client notes"><Textarea rows={2} value={selected.clientNotes} onChange={e => patchSection(selected.id, { clientNotes: e.target.value })} /></Field>
              </section>
            ) : (
              <section className="editorial-card p-5 text-sm text-muted-foreground">
                Select a section from the tree to edit its content and asset references.
              </section>
            )}

            <section className="editorial-card p-5 space-y-2">
              <SectionTitle>Delivery & governance</SectionTitle>
              <Field label="Delivery context"><Textarea rows={2} value={tk.deliveryContext} onChange={e => patchToolkit({ deliveryContext: e.target.value })} /></Field>
              <Field label="Usage guidance"><Textarea rows={2} value={tk.usageGuidance} onChange={e => patchToolkit({ usageGuidance: e.target.value })} /></Field>
              <Field label="Provenance notes"><Textarea rows={2} value={tk.provenanceNotes} onChange={e => patchToolkit({ provenanceNotes: e.target.value })} /></Field>
            </section>

            <section className="editorial-card p-5">
              <SectionTitle>Stage history</SectionTitle>
              <ol className="space-y-1 text-xs">
                {tk.stageHistory.map((h, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="size-3 text-evergreen" />
                    <span className="font-mono">{h.at.slice(0, 10)}</span>
                    <PublicationStageBadge stage={h.stage} />
                    <span className="text-muted-foreground truncate">{h.note ?? h.actor}</span>
                  </li>
                ))}
              </ol>
            </section>

            <ReferencedByCard toolkitId={tk.id} />
          </div>
        </div>
      </PageBody>
    </>
  );
}

function ReferencedByCard({ toolkitId }: { toolkitId: string }) {
  const s = useSnapshot();
  if (!s) return null;
  const packs = s.aiPacks.filter(ap => ap.clientToolkitIds.includes(toolkitId));
  if (packs.length === 0) return null;
  return (
    <section className="editorial-card p-5">
      <SectionTitle>Referenced by AI Packs</SectionTitle>
      <ul className="text-xs space-y-1">
        {packs.map(ap => (
          <li key={ap.id}>
            <Link to="/ai-packs/$id" params={{ id: ap.id }} className="inline-flex items-center gap-1 hover:underline">
              <ExternalLink className="size-3" /><span className="font-mono">{ap.id}</span><span>{ap.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider text-slate-ink mb-1">{label}</div>
      {children}
    </label>
  );
}

function ScoreTile({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  const tone = value >= 85 ? "text-evergreen" : value >= 60 ? "text-gold" : "text-destructive";
  return (
    <div className="rounded-md border border-border p-2">
      <div className={`text-2xl font-serif ${tone}`}>{value}{suffix}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-ink">{label}</div>
    </div>
  );
}

function IdListEditor({ label, ids, onChange, known }: { label: string; ids: string[]; onChange: (ids: string[]) => void; known: Set<string> }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || ids.includes(v)) return;
    onChange([...ids, v]);
    setDraft("");
  };
  return (
    <div className="mt-2">
      <div className="text-[11px] uppercase tracking-wider text-slate-ink mb-1">{label}</div>
      <div className="flex flex-wrap gap-1 mb-1">
        {ids.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
        {ids.map(id => {
          const missing = !known.has(id);
          return (
            <span key={id} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono ${missing ? "bg-destructive/15 text-destructive" : "bg-muted"}`}>
              {id}
              <button onClick={() => onChange(ids.filter(x => x !== id))} className="opacity-60 hover:opacity-100">×</button>
            </span>
          );
        })}
      </div>
      <div className="flex gap-1">
        <Input className="h-7 text-xs" placeholder="Add ID…" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <Button size="sm" variant="outline" onClick={add}>Add</Button>
      </div>
    </div>
  );
}

void findToolkitsReferencing;
