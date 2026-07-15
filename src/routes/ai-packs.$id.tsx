import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, SectionTitle, EmptyState } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  PUBLICATION_STAGES, AI_PACK_USE_CASES,
  type AIPack, type AIPackModule, type AIPackModuleKind, type AIPackEvaluationCase,
  type ManufacturingStage,
} from "@/lib/data/schema";
import {
  aiPackCoverage, validateAIPackPromotion,
  nextAIPackModuleId, nextEvaluationCaseId,
} from "@/lib/data/service";
import { PublicationStageBadge } from "@/components/publication-stage-badge";
import { CoverageBar } from "@/routes/publications.index";
import { Plus, Trash2, AlertTriangle, CheckCircle2, ArrowUp, ArrowDown } from "lucide-react";
import { useState } from "react";

const MODULE_KINDS: AIPackModuleKind[] = [
  "Concept","Framework","Knowledge Object","Publication","Client Toolkit","Prompt","Agent","Policy","Instruction",
];

export const Route = createFileRoute("/ai-packs/$id")({
  head: () => ({ meta: [{ title: "AI Pack — Legacy Forge" }] }),
  component: AIPackStudioPage,
});

function AIPackStudioPage() {
  const { id } = Route.useParams();
  const s = useSnapshot();
  const navigate = useNavigate();
  const ap = s?.aiPacks.find(a => a.id === id) ?? null;
  const cov = useMemo(() => (s && ap ? aiPackCoverage(ap, s) : null), [s, ap]);

  if (!s) return <LoadingState />;
  if (!ap) return (
    <>
      <PageHeader title="AI Pack not found" description={`No pack with id ${id}.`} />
      <PageBody><Button onClick={() => navigate({ to: "/ai-packs" })}>Back to registry</Button></PageBody>
    </>
  );

  const patch = async (p: Partial<AIPack>) => {
    await Repo.update("aiPacks", ap.id, { ...p, updatedAt: new Date().toISOString() });
  };

  const promote = async (target: ManufacturingStage) => {
    const check = validateAIPackPromotion(ap, target, s);
    if (!check.ok) { toast.error(check.blockers[0]); return; }
    const now = new Date().toISOString();
    await patch({
      manufacturingStage: target,
      stageHistory: [...ap.stageHistory, { stage: target, at: now, actor: ap.steward, note: `Promoted to ${target}.` }],
    });
    toast.success(`Promoted to ${target}`);
  };

  // ---- Modules
  const addModule = async () => {
    const mid = nextAIPackModuleId(s);
    const order = (ap.modules.reduce((m, x) => Math.max(m, x.order), 0) || 0) + 10;
    const m: AIPackModule = {
      id: mid, kind: "Instruction", title: "New module",
      referenceId: null, packInstructions: "",
      order, required: true, humanReviewCompleted: false,
    };
    await patch({ modules: [...ap.modules, m] });
  };
  const patchModule = async (mid: string, p: Partial<AIPackModule>) => {
    await patch({ modules: ap.modules.map(m => m.id === mid ? { ...m, ...p } : m) });
  };
  const removeModule = async (mid: string) => {
    if (!confirm(`Remove ${mid}?`)) return;
    await patch({ modules: ap.modules.filter(m => m.id !== mid) });
  };
  const reorderModule = async (mid: string, dir: -1 | 1) => {
    const sorted = [...ap.modules].sort((a, b) => a.order - b.order);
    const i = sorted.findIndex(m => m.id === mid);
    if (i === -1) return;
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const swap = [...sorted];
    [swap[i], swap[j]] = [swap[j], swap[i]];
    const remapped = swap.map((m, k) => ({ ...m, order: (k + 1) * 10 }));
    await patch({ modules: remapped });
  };

  // ---- Evaluations
  const addEval = async () => {
    const eid = nextEvaluationCaseId(s);
    const ev: AIPackEvaluationCase = {
      id: eid, title: "New evaluation", scenario: "", expectedBehavior: "",
      prohibitedBehavior: "", requiredCitations: [],
      reviewerStatus: "Draft", status: "not-run", notes: "",
      coversConceptIds: [], coversFrameworkIds: [], coversPolicyIds: [],
    };
    await patch({ evaluationCases: [...ap.evaluationCases, ev] });
  };
  const patchEval = async (eid: string, p: Partial<AIPackEvaluationCase>) => {
    await patch({ evaluationCases: ap.evaluationCases.map(e => e.id === eid ? { ...e, ...p } : e) });
  };
  const removeEval = async (eid: string) => {
    if (!confirm(`Remove ${eid}?`)) return;
    await patch({ evaluationCases: ap.evaluationCases.filter(e => e.id !== eid) });
  };

  const knownIds = new Set<string>();
  for (const arr of [s.concepts, s.frameworks, s.knowledgeObjects, s.publications, s.clientToolkits, s.prompts, s.agents]) {
    for (const x of arr as { id: string }[]) knownIds.add(x.id);
  }

  return (
    <>
      <PageHeader
        eyebrow={`${ap.id} · ${ap.useCase}`}
        title={ap.title}
        description={ap.purpose || "Governed AI Pack workspace"}
        actions={
          <div className="flex items-center gap-2">
            <PublicationStageBadge stage={ap.manufacturingStage} />
            <Select value={ap.manufacturingStage} onValueChange={v => promote(v as ManufacturingStage)}>
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
              <SectionTitle>Pack metadata</SectionTitle>
              <Field label="Title"><Input value={ap.title} onChange={e => patch({ title: e.target.value })} /></Field>
              <Field label="Description"><Textarea rows={2} value={ap.description} onChange={e => patch({ description: e.target.value })} /></Field>
              <Field label="Purpose"><Textarea rows={2} value={ap.purpose} onChange={e => patch({ purpose: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Use case">
                  <Select value={ap.useCase} onValueChange={v => patch({ useCase: v as AIPack["useCase"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AI_PACK_USE_CASES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Target model"><Input value={ap.targetModel} onChange={e => patch({ targetModel: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Owner"><Input value={ap.owner} onChange={e => patch({ owner: e.target.value })} /></Field>
                <Field label="Steward"><Input value={ap.steward} onChange={e => patch({ steward: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Version"><Input value={ap.version} onChange={e => patch({ version: e.target.value })} /></Field>
                <Field label="Effective date"><Input type="date" value={ap.effectiveDate ?? ""} onChange={e => patch({ effectiveDate: e.target.value || null })} /></Field>
              </div>
              <Field label="Tags (comma-separated)">
                <Input value={ap.tags.join(", ")} onChange={e => patch({ tags: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })} />
              </Field>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={ap.humanReviewCompleted} onChange={e => patch({ humanReviewCompleted: e.target.checked })} />
                Human review completed (required for Canonical)
              </label>
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
                  <div>Evaluations: <b>{cov.evaluationsPassed}</b> pass / <b>{cov.evaluationsReviewed}</b> reviewed / <b>{cov.evaluationCount}</b> total</div>
                  <div>Editorial score: <b>{cov.editorialScore}</b></div>
                </div>
                {(cov.brokenReferences.length > 0 || cov.brokenModuleReferences.length > 0 ||
                  cov.modulesWithoutInstructions.length > 0 || !cov.hasGovernance || !cov.hasSystemInstructions) && (
                  <div className="mt-2 space-y-1 text-xs">
                    {!cov.hasSystemInstructions && <Warn tone="destructive">System instructions required.</Warn>}
                    {!cov.hasGovernance && <Warn tone="gold">Usage policy + boundaries required.</Warn>}
                    {cov.brokenReferences.length > 0 && <Warn tone="destructive">{cov.brokenReferences.length} top-level broken refs</Warn>}
                    {cov.brokenModuleReferences.length > 0 && <Warn tone="destructive">{cov.brokenModuleReferences.length} module refs unresolved</Warn>}
                    {cov.modulesWithoutInstructions.length > 0 && <Warn tone="gold">Modules missing text: {cov.modulesWithoutInstructions.join(", ")}</Warn>}
                    {cov.unreviewedEvaluations.length > 0 && <Warn tone="gold">Unreviewed evals: {cov.unreviewedEvaluations.join(", ")}</Warn>}
                  </div>
                )}
                <div className="pt-2 border-t border-border"><CoverageBar percent={cov.coveragePercent} /></div>
              </section>
            )}

            <section className="editorial-card p-5 space-y-2">
              <SectionTitle>Governance</SectionTitle>
              <Field label="System instructions (required)"><Textarea rows={4} value={ap.systemInstructions} onChange={e => patch({ systemInstructions: e.target.value })} /></Field>
              <Field label="Usage policy"><Textarea rows={3} value={ap.usagePolicy} onChange={e => patch({ usagePolicy: e.target.value })} /></Field>
              <Field label="Boundary conditions"><Textarea rows={3} value={ap.boundaryConditions} onChange={e => patch({ boundaryConditions: e.target.value })} /></Field>
              <Field label="Prohibited uses"><Textarea rows={2} value={ap.prohibitedUses} onChange={e => patch({ prohibitedUses: e.target.value })} /></Field>
              <Field label="Escalation guidance"><Textarea rows={2} value={ap.escalationGuidance} onChange={e => patch({ escalationGuidance: e.target.value })} /></Field>
              <Field label="Provenance notes"><Textarea rows={2} value={ap.provenanceNotes} onChange={e => patch({ provenanceNotes: e.target.value })} /></Field>
            </section>
          </div>

          {/* MIDDLE — canonical asset references */}
          <div className="space-y-6">
            <section className="editorial-card p-5">
              <SectionTitle>Canonical asset references</SectionTitle>
              <IdListEditor label="Concepts" ids={ap.conceptIds} onChange={ids => patch({ conceptIds: ids })} known={new Set(s.concepts.map(c => c.id))} />
              <IdListEditor label="Frameworks" ids={ap.frameworkIds} onChange={ids => patch({ frameworkIds: ids })} known={new Set(s.frameworks.map(f => f.id))} />
              <IdListEditor label="Knowledge Objects" ids={ap.knowledgeObjectIds} onChange={ids => patch({ knowledgeObjectIds: ids })} known={new Set(s.knowledgeObjects.map(k => k.id))} />
              <IdListEditor label="Publications" ids={ap.publicationIds} onChange={ids => patch({ publicationIds: ids })} known={new Set(s.publications.map(p => p.id))} />
              <IdListEditor label="Client Toolkits" ids={ap.clientToolkitIds} onChange={ids => patch({ clientToolkitIds: ids })} known={new Set(s.clientToolkits.map(t => t.id))} />
              <IdListEditor label="Prompts" ids={ap.promptIds} onChange={ids => patch({ promptIds: ids })} known={new Set(s.prompts.map(p => p.id))} />
              <IdListEditor label="Agents" ids={ap.agentIds} onChange={ids => patch({ agentIds: ids })} known={new Set(s.agents.map(a => a.id))} />
            </section>

            <section className="editorial-card p-5">
              <SectionTitle>Stage history</SectionTitle>
              <ol className="space-y-1 text-xs">
                {ap.stageHistory.map((h, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="size-3 text-evergreen" />
                    <span className="font-mono">{h.at.slice(0, 10)}</span>
                    <PublicationStageBadge stage={h.stage} />
                    <span className="text-muted-foreground truncate">{h.note ?? h.actor}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* RIGHT — modules + evaluations */}
          <div className="space-y-6">
            <section className="editorial-card p-5">
              <div className="flex items-center justify-between mb-3">
                <SectionTitle>Modules</SectionTitle>
                <Button size="sm" onClick={addModule}><Plus className="size-4 mr-1" />Add module</Button>
              </div>
              {ap.modules.length === 0 ? (
                <EmptyState title="No modules yet" description="Add instruction, policy, or reference modules." />
              ) : (
                <ul className="space-y-2">
                  {[...ap.modules].sort((a, b) => a.order - b.order).map(m => {
                    const broken = m.referenceId && !knownIds.has(m.referenceId);
                    return (
                      <li key={m.id} className="rounded border border-border p-3 space-y-2 bg-background">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[10px] text-heritage">{m.id}</span>
                            <Select value={m.kind} onValueChange={v => patchModule(m.id, { kind: v as AIPackModuleKind })}>
                              <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{MODULE_KINDS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="inline-flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => reorderModule(m.id, -1)}><ArrowUp className="size-3" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => reorderModule(m.id, 1)}><ArrowDown className="size-3" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => removeModule(m.id)}><Trash2 className="size-3 text-destructive" /></Button>
                          </div>
                        </div>
                        <Input className="h-8 text-sm" placeholder="Module title" value={m.title} onChange={e => patchModule(m.id, { title: e.target.value })} />
                        <div className="grid grid-cols-2 gap-2">
                          <Input className={`h-8 text-xs font-mono ${broken ? "border-destructive" : ""}`} placeholder="Reference ID (optional)" value={m.referenceId ?? ""} onChange={e => patchModule(m.id, { referenceId: e.target.value.trim() || null })} />
                          <label className="flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={m.required} onChange={e => patchModule(m.id, { required: e.target.checked })} /> Required
                            <input type="checkbox" checked={m.humanReviewCompleted} onChange={e => patchModule(m.id, { humanReviewCompleted: e.target.checked })} className="ml-2" /> Reviewed
                          </label>
                        </div>
                        <Textarea rows={2} placeholder="Pack instructions / overlay text" value={m.packInstructions} onChange={e => patchModule(m.id, { packInstructions: e.target.value })} />
                        {broken && <div className="text-[11px] text-destructive flex items-center gap-1"><AlertTriangle className="size-3" />Reference {m.referenceId} not found</div>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="editorial-card p-5">
              <div className="flex items-center justify-between mb-3">
                <SectionTitle>Evaluation cases</SectionTitle>
                <Button size="sm" onClick={addEval}><Plus className="size-4 mr-1" />Add case</Button>
              </div>
              {ap.evaluationCases.length === 0 ? (
                <EmptyState title="No evaluations" description="Add cases to validate assistant behavior." />
              ) : (
                <ul className="space-y-2">
                  {ap.evaluationCases.map(ev => (
                    <li key={ev.id} className="rounded border border-border p-3 space-y-2 bg-background">
                      <div className="flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-heritage">{ev.id}</span>
                          <Select value={ev.reviewerStatus} onValueChange={v => patchEval(ev.id, { reviewerStatus: v as AIPackEvaluationCase["reviewerStatus"] })}>
                            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{(["Draft","Reviewed","Approved"] as const).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                          </Select>
                          <Select value={ev.status} onValueChange={v => patchEval(ev.id, { status: v as AIPackEvaluationCase["status"] })}>
                            <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{(["not-run","pass","fail"] as const).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => removeEval(ev.id)}><Trash2 className="size-3 text-destructive" /></Button>
                      </div>
                      <Input className="h-8 text-sm" placeholder="Title" value={ev.title} onChange={e => patchEval(ev.id, { title: e.target.value })} />
                      <Textarea rows={2} placeholder="Scenario" value={ev.scenario} onChange={e => patchEval(ev.id, { scenario: e.target.value })} />
                      <Textarea rows={2} placeholder="Expected behavior" value={ev.expectedBehavior} onChange={e => patchEval(ev.id, { expectedBehavior: e.target.value })} />
                      <Textarea rows={2} placeholder="Prohibited behavior" value={ev.prohibitedBehavior} onChange={e => patchEval(ev.id, { prohibitedBehavior: e.target.value })} />
                      <IdListEditor label="Required citations" ids={ev.requiredCitations} onChange={ids => patchEval(ev.id, { requiredCitations: ids })} known={knownIds} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </PageBody>
    </>
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
function Warn({ tone, children }: { tone: "destructive"|"gold"; children: React.ReactNode }) {
  const color = tone === "destructive" ? "text-destructive" : "text-gold";
  return <div className={`flex items-start gap-2 ${color}`}><AlertTriangle className="size-3.5 mt-0.5" /><span>{children}</span></div>;
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
