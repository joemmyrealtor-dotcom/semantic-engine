import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, EmptyState, SectionTitle, KpiCard } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  PUBLICATION_STAGES, AGENT_USE_CASES,
  type Agent, type AgentSpecification, type AgentEvaluationCase, type ManufacturingStage,
} from "@/lib/data/schema";
import {
  agentCoverage, validateAgentPromotion, runAgentEvaluation,
  nextAgentSpecId, nextAgentEvaluationId,
} from "@/lib/data/service";
import { PublicationStageBadge } from "@/components/publication-stage-badge";
import { CoverageBar } from "@/routes/publications.index";
import { CheckCircle2, XCircle, AlertTriangle, ArrowRight, Play, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/agents/$id")({
  head: () => ({ meta: [{ title: "Agent Studio — Legacy Platform" }] }),
  component: AgentStudio,
});

function AgentStudio() {
  const { id } = Route.useParams();
  const s = useSnapshot();
  const navigate = useNavigate();
  const stored = s?.agents.find(a => a.id === id);
  const [draft, setDraft] = useState<Agent | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (stored && !draft) setDraft(stored);
  }, [stored, draft]);

  useEffect(() => {
    if (!draft || !dirty) return;
    const t = setTimeout(async () => {
      try {
        setSaving(true);
        await Repo.update("agents", draft.id, draft);
        setDirty(false);
        setLastSaveError(null);
      } catch (e) {
        setLastSaveError(e instanceof Error ? e.message : String(e));
      } finally { setSaving(false); }
    }, 700);
    return () => clearTimeout(t);
  }, [draft, dirty]);

  if (!s) return <LoadingState />;
  if (!stored || !draft) {
    return (
      <PageBody>
        <EmptyState title="Agent not found" description={`No agent with id ${id}.`} action={<Link to="/agents"><Button>Back to registry</Button></Link>} />
      </PageBody>
    );
  }

  const cov = agentCoverage(draft, s);
  const update = <K extends keyof Agent>(k: K, v: Agent[K]) => { setDraft({ ...draft, [k]: v }); setDirty(true); };

  const promote = async (target: ManufacturingStage) => {
    const result = validateAgentPromotion(draft, target, s);
    if (!result.ok) { toast.error("Cannot promote", { description: result.blockers.slice(0, 3).join(" · ") }); return; }
    const stageHistory = [...draft.stageHistory, { stage: target, at: new Date().toISOString(), actor: draft.owner, note: `Promoted from ${draft.manufacturingStage}` }];
    const status: Agent["status"] = target === "Canonical" || target === "Released" ? "Canonical" : target === "QA" || target === "SME Review" || target === "Editorial" ? "In Review" : "Draft";
    const next: Agent = { ...draft, manufacturingStage: target, stageHistory, status };
    setDraft(next); setDirty(true);
    toast.success(`Promoted to ${target}`);
  };

  const deleteAgent = async () => {
    if (!confirm(`Delete ${draft.id}?`)) return;
    await Repo.remove("agents", draft.id);
    toast.success(`${draft.id} deleted`);
    navigate({ to: "/agents" });
  };

  return (
    <>
      <PageHeader
        eyebrow={`Agent · ${draft.id}`}
        title={<span className="flex items-center gap-3">{draft.name || "Untitled"} <PublicationStageBadge stage={draft.manufacturingStage} /></span>}
        description={draft.description || draft.role}
        actions={
          <div className="flex items-center gap-2 text-xs">
            {lastSaveError ? <span className="text-destructive">Save failed — retrying</span>
              : saving ? <span className="text-muted-foreground">Saving…</span>
              : dirty ? <span className="text-gold">Unsaved…</span>
              : <span className="text-evergreen">Saved</span>}
            <Link to="/agents"><Button variant="outline" size="sm">Registry</Button></Link>
          </div>
        }
      />
      <PageBody>
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div>
            <Tabs defaultValue="overview">
              <TabsList className="mb-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="specs">Specs ({draft.specifications.length})</TabsTrigger>
                <TabsTrigger value="evals">Evaluations ({draft.evaluationCases.length})</TabsTrigger>
                <TabsTrigger value="relationships">Relationships</TabsTrigger>
                <TabsTrigger value="governance">Governance</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="editorial-card p-5 grid md:grid-cols-2 gap-4">
                  <Field label="Name"><Input value={draft.name} onChange={e => update("name", e.target.value)} /></Field>
                  <Field label="Version"><Input value={draft.version} onChange={e => update("version", e.target.value)} /></Field>
                  <Field label="Use case">
                    <Select value={draft.useCase} onValueChange={v => update("useCase", v as Agent["useCase"])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{AGENT_USE_CASES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Target model"><Input value={draft.targetModel} onChange={e => update("targetModel", e.target.value)} placeholder="e.g. gpt-5.1-class" /></Field>
                  <Field label="Owner"><Input value={draft.owner} onChange={e => update("owner", e.target.value)} /></Field>
                  <Field label="Steward"><Input value={draft.steward} onChange={e => update("steward", e.target.value)} /></Field>
                  <Field label="Role" className="md:col-span-2"><Input value={draft.role} onChange={e => update("role", e.target.value)} /></Field>
                  <Field label="Description" className="md:col-span-2"><Textarea rows={2} value={draft.description} onChange={e => update("description", e.target.value)} /></Field>
                  <Field label="Purpose" className="md:col-span-2"><Textarea rows={2} value={draft.purpose} onChange={e => update("purpose", e.target.value)} /></Field>
                  <Field label="Responsibilities (one per line)" className="md:col-span-2">
                    <Textarea rows={4} value={draft.responsibilities.join("\n")}
                      onChange={e => update("responsibilities", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))} />
                  </Field>
                  <Field label="Tags (comma separated)" className="md:col-span-2">
                    <Input value={draft.tags.join(", ")} onChange={e => update("tags", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} />
                  </Field>
                  <Field label="Effective date">
                    <Input type="date" value={(draft.effectiveDate ?? "").slice(0, 10)} onChange={e => update("effectiveDate", e.target.value ? new Date(e.target.value).toISOString() : null)} />
                  </Field>
                  <Field label="Review date">
                    <Input type="date" value={(draft.reviewDate ?? "").slice(0, 10)} onChange={e => update("reviewDate", e.target.value ? new Date(e.target.value).toISOString() : null)} />
                  </Field>
                </div>
              </TabsContent>

              <TabsContent value="specs">
                <SpecsPanel draft={draft} setDraft={d => { setDraft(d); setDirty(true); }} s={s} />
              </TabsContent>

              <TabsContent value="evals">
                <EvaluationsPanel draft={draft} setDraft={d => { setDraft(d); setDirty(true); }} s={s} />
              </TabsContent>

              <TabsContent value="relationships">
                <RelationshipsPanel draft={draft} setDraft={d => { setDraft(d); setDirty(true); }} s={s} />
              </TabsContent>

              <TabsContent value="governance" className="space-y-4">
                <div className="editorial-card p-5 grid gap-4">
                  <Field label="Usage policy"><Textarea rows={3} value={draft.usagePolicy} onChange={e => update("usagePolicy", e.target.value)} /></Field>
                  <Field label="Boundary conditions"><Textarea rows={3} value={draft.boundaryConditions} onChange={e => update("boundaryConditions", e.target.value)} /></Field>
                  <Field label="Prohibited uses"><Textarea rows={3} value={draft.prohibitedUses} onChange={e => update("prohibitedUses", e.target.value)} /></Field>
                  <Field label="Escalation guidance"><Textarea rows={3} value={draft.escalationGuidance} onChange={e => update("escalationGuidance", e.target.value)} /></Field>
                  <Field label="Provenance notes"><Textarea rows={3} value={draft.provenanceNotes} onChange={e => update("provenanceNotes", e.target.value)} /></Field>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <Checkbox checked={draft.humanReviewCompleted} onCheckedChange={v => update("humanReviewCompleted", !!v)} />
                    Human review completed
                  </label>
                </div>
              </TabsContent>

              <TabsContent value="history">
                <div className="editorial-card p-5">
                  <SectionTitle>Stage history</SectionTitle>
                  <ol className="space-y-2 text-sm">
                    {draft.stageHistory.map((h, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <PublicationStageBadge stage={h.stage} />
                        <span className="text-muted-foreground">{new Date(h.at).toLocaleString()}</span>
                        <span className="text-slate-ink">· {h.actor}</span>
                        {h.note && <span className="italic text-muted-foreground">— {h.note}</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-4">
            <div className="editorial-card p-5">
              <SectionTitle>Readiness</SectionTitle>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <KpiCard label="Readiness" value={cov.readinessScore} tone={cov.readinessScore >= 85 ? "evergreen" : cov.readinessScore >= 60 ? "gold" : "warn"} />
                <KpiCard label="Editorial" value={cov.editorialScore} tone={cov.editorialScore >= 85 ? "evergreen" : cov.editorialScore >= 60 ? "gold" : "warn"} />
                <KpiCard label="Coverage" value={`${cov.coveragePercent}%`} />
                <KpiCard label="Canonical" value={`${cov.canonicalCompliance}%`} />
              </div>
              <CoverageBar percent={cov.readinessScore} />
              <ul className="text-xs mt-3 space-y-1">
                <ChecklistItem ok={cov.hasActiveSpecification} label="Active specification" />
                <ChecklistItem ok={cov.hasSystemPrompt} label="System prompt defined" />
                <ChecklistItem ok={cov.hasResponsibilities} label="Responsibilities listed" />
                <ChecklistItem ok={cov.hasGovernance} label="Usage policy + boundaries" />
                <ChecklistItem ok={cov.provenanceComplete} label="Provenance notes" />
                <ChecklistItem ok={cov.brokenReferences.length === 0} label={`References resolve (${cov.brokenReferences.length} broken)`} />
                <ChecklistItem ok={cov.evaluationCount > 0} label={`Evaluations exist (${cov.evaluationsPassed}/${cov.evaluationCount} passed)`} />
                <ChecklistItem ok={cov.unreviewedEvaluations.length === 0} label={`All evaluations reviewed (${cov.unreviewedEvaluations.length} pending)`} />
                <ChecklistItem ok={draft.humanReviewCompleted} label="Human review completed" />
              </ul>
            </div>

            <div className="editorial-card p-5">
              <SectionTitle>Promote</SectionTitle>
              <div className="space-y-2">
                {PUBLICATION_STAGES.map(st => {
                  const cur = draft.manufacturingStage === st;
                  const promo = validateAgentPromotion(draft, st, s);
                  return (
                    <div key={st} className="text-xs">
                      <Button variant={cur ? "secondary" : "outline"} size="sm" className="w-full justify-between"
                        disabled={cur || !promo.ok} onClick={() => promote(st)}>
                        <span>{st}</span>
                        {cur ? <span className="text-[10px]">current</span> : promo.ok ? <ArrowRight className="size-3" /> : <AlertTriangle className="size-3 text-destructive" />}
                      </Button>
                      {!cur && !promo.ok && promo.blockers.length > 0 && (
                        <div className="text-[10px] text-destructive mt-1 pl-2">
                          {promo.blockers.slice(0, 2).join(" · ")}{promo.blockers.length > 2 ? ` · +${promo.blockers.length - 2}` : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="editorial-card p-5 space-y-2">
              <SectionTitle>Danger zone</SectionTitle>
              <Button variant="outline" size="sm" className="w-full" onClick={() => update("archived", !draft.archived)}>
                {draft.archived ? "Unarchive" : "Archive"}
              </Button>
              <Button variant="destructive" size="sm" className="w-full" onClick={deleteAgent}>Delete agent</Button>
            </div>
          </aside>
        </div>
      </PageBody>
    </>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs uppercase tracking-widest text-slate-ink">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="size-3.5 text-evergreen shrink-0" /> : <XCircle className="size-3.5 text-destructive shrink-0" />}
      <span className={ok ? "text-slate-ink" : "text-destructive"}>{label}</span>
    </li>
  );
}

// ------------ Specifications ------------
function SpecsPanel({ draft, setDraft, s }: { draft: Agent; setDraft: (d: Agent) => void; s: ReturnType<typeof useSnapshot> }) {
  const addSpec = () => {
    if (!s) return;
    const spec: AgentSpecification = {
      id: nextAgentSpecId(s),
      version: `0.${(draft.specifications.length + 1)}.0`,
      isActive: draft.specifications.length === 0,
      systemPrompt: "", capabilities: [], tools: [],
      boundaries: "", safetyPolicy: "", changelog: "Initial draft.",
      author: draft.owner, createdAt: new Date().toISOString(),
    };
    setDraft({ ...draft, specifications: [...draft.specifications, spec] });
  };
  const updateSpec = (idx: number, patch: Partial<AgentSpecification>) => {
    const next = draft.specifications.map((sp, i) => i === idx ? { ...sp, ...patch } : sp);
    setDraft({ ...draft, specifications: next });
  };
  const activate = (idx: number) => setDraft({ ...draft, specifications: draft.specifications.map((sp, i) => ({ ...sp, isActive: i === idx })) });
  const remove = (idx: number) => setDraft({ ...draft, specifications: draft.specifications.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <SectionTitle>Versioned specifications</SectionTitle>
        <Button size="sm" onClick={addSpec}><Plus className="size-4 mr-1" />New spec</Button>
      </div>
      {draft.specifications.length === 0 && <EmptyState title="No specifications" description="Add a specification to define the agent's system prompt, capabilities, and boundaries." />}
      {draft.specifications.map((sp, i) => (
        <div key={sp.id} className="editorial-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="font-mono text-xs text-heritage">{sp.id}</span>
            <Input className="max-w-[140px] h-8" value={sp.version} onChange={e => updateSpec(i, { version: e.target.value })} />
            {sp.isActive
              ? <span className="text-[10px] uppercase tracking-widest text-evergreen font-medium">Active</span>
              : <Button size="sm" variant="outline" onClick={() => activate(i)}>Make active</Button>}
            <div className="flex-1" />
            <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="size-4 text-destructive" /></Button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="System prompt" className="md:col-span-2">
              <Textarea rows={5} value={sp.systemPrompt} onChange={e => updateSpec(i, { systemPrompt: e.target.value })} />
            </Field>
            <Field label="Capabilities (one per line)">
              <Textarea rows={3} value={sp.capabilities.join("\n")} onChange={e => updateSpec(i, { capabilities: e.target.value.split("\n").map(x => x.trim()).filter(Boolean) })} />
            </Field>
            <Field label="Tools (one per line)">
              <Textarea rows={3} value={sp.tools.join("\n")} onChange={e => updateSpec(i, { tools: e.target.value.split("\n").map(x => x.trim()).filter(Boolean) })} />
            </Field>
            <Field label="Boundaries"><Textarea rows={2} value={sp.boundaries} onChange={e => updateSpec(i, { boundaries: e.target.value })} /></Field>
            <Field label="Safety policy"><Textarea rows={2} value={sp.safetyPolicy} onChange={e => updateSpec(i, { safetyPolicy: e.target.value })} /></Field>
            <Field label="Changelog" className="md:col-span-2"><Textarea rows={2} value={sp.changelog} onChange={e => updateSpec(i, { changelog: e.target.value })} /></Field>
          </div>
        </div>
      ))}
    </div>
  );
}

// ------------ Evaluations ------------
function EvaluationsPanel({ draft, setDraft, s }: { draft: Agent; setDraft: (d: Agent) => void; s: ReturnType<typeof useSnapshot> }) {
  const [runFor, setRunFor] = useState<AgentEvaluationCase | null>(null);
  const [actual, setActual] = useState("");

  const addEval = () => {
    if (!s) return;
    const ev: AgentEvaluationCase = {
      id: nextAgentEvaluationId(s), title: "New evaluation case",
      scenario: "", expectedBehavior: "", prohibitedBehavior: "",
      requiredCitations: [], reviewerStatus: "Draft", status: "not-run",
      notes: "", coversConceptIds: [], coversFrameworkIds: [],
    };
    setDraft({ ...draft, evaluationCases: [...draft.evaluationCases, ev] });
  };
  const updateEv = (idx: number, patch: Partial<AgentEvaluationCase>) => {
    setDraft({ ...draft, evaluationCases: draft.evaluationCases.map((e, i) => i === idx ? { ...e, ...patch } : e) });
  };
  const remove = (idx: number) => setDraft({ ...draft, evaluationCases: draft.evaluationCases.filter((_, i) => i !== idx) });

  const runNow = () => {
    if (!runFor) return;
    const idx = draft.evaluationCases.findIndex(e => e.id === runFor.id);
    if (idx < 0) return;
    const updated = runAgentEvaluation(runFor, actual);
    updateEv(idx, updated);
    toast[updated.status === "pass" ? "success" : "error"](`${updated.id}: ${updated.status.toUpperCase()}`);
    setRunFor(null); setActual("");
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <SectionTitle>Evaluation cases</SectionTitle>
        <Button size="sm" onClick={addEval}><Plus className="size-4 mr-1" />New evaluation</Button>
      </div>
      {draft.evaluationCases.length === 0 && <EmptyState title="No evaluation cases" description="Add scenarios to test that the agent meets expected behaviour before promotion." />}
      {draft.evaluationCases.map((ev, i) => (
        <div key={ev.id} className="editorial-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-xs text-heritage">{ev.id}</span>
            <Input className="h-8" value={ev.title} onChange={e => updateEv(i, { title: e.target.value })} />
            <StatusPill status={ev.status} />
            <Select value={ev.reviewerStatus} onValueChange={v => updateEv(i, { reviewerStatus: v as AgentEvaluationCase["reviewerStatus"] })}>
              <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Draft">Draft</SelectItem><SelectItem value="Reviewed">Reviewed</SelectItem><SelectItem value="Approved">Approved</SelectItem></SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => { setRunFor(ev); setActual(""); }}><Play className="size-3.5 mr-1" />Run</Button>
            <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="size-4 text-destructive" /></Button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Scenario" className="md:col-span-2"><Textarea rows={2} value={ev.scenario} onChange={e => updateEv(i, { scenario: e.target.value })} /></Field>
            <Field label="Expected behavior"><Textarea rows={3} value={ev.expectedBehavior} onChange={e => updateEv(i, { expectedBehavior: e.target.value })} /></Field>
            <Field label="Prohibited behavior"><Textarea rows={3} value={ev.prohibitedBehavior} onChange={e => updateEv(i, { prohibitedBehavior: e.target.value })} /></Field>
            <Field label="Required citations (comma separated)">
              <Input value={ev.requiredCitations.join(", ")} onChange={e => updateEv(i, { requiredCitations: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })} />
            </Field>
            <Field label="Covers concept / framework IDs (comma separated)">
              <Input
                value={[...ev.coversConceptIds, ...ev.coversFrameworkIds].join(", ")}
                onChange={e => {
                  const ids = e.target.value.split(",").map(x => x.trim()).filter(Boolean);
                  updateEv(i, {
                    coversConceptIds: ids.filter(x => x.startsWith("CR-") || x.startsWith("C-")),
                    coversFrameworkIds: ids.filter(x => x.startsWith("F-")),
                  });
                }}
              />
            </Field>
            <Field label="Notes" className="md:col-span-2"><Textarea rows={2} value={ev.notes} onChange={e => updateEv(i, { notes: e.target.value })} /></Field>
          </div>
        </div>
      ))}

      <Dialog open={!!runFor} onOpenChange={o => !o && setRunFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Run {runFor?.id} — {runFor?.title}</DialogTitle></DialogHeader>
          <div className="text-xs text-muted-foreground mb-2">
            Paste the agent's actual response. It must include required citations ({runFor?.requiredCitations.join(", ") || "none"}),
            match expected behaviour, and avoid prohibited behaviour.
          </div>
          <Textarea rows={10} value={actual} onChange={e => setActual(e.target.value)} placeholder="Paste actual agent response here…" />
          <DialogFooter><Button onClick={runNow}>Evaluate</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusPill({ status }: { status: "not-run" | "pass" | "fail" }) {
  const map = { "not-run": "bg-muted text-slate-ink", pass: "bg-evergreen/10 text-evergreen", fail: "bg-destructive/10 text-destructive" };
  return <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${map[status]}`}>{status}</span>;
}

// ------------ Relationships ------------
function RelationshipsPanel({ draft, setDraft, s }: { draft: Agent; setDraft: (d: Agent) => void; s: ReturnType<typeof useSnapshot> }) {
  if (!s) return null;
  const rels: { key: keyof Agent; label: string; source: { id: string; label: string }[] }[] = [
    { key: "governingPromptIds", label: "Governing prompts", source: s.prompts.map(p => ({ id: p.id, label: p.name })) },
    { key: "conceptIds", label: "Concepts", source: s.concepts.map(c => ({ id: c.id, label: c.canonicalName })) },
    { key: "frameworkIds", label: "Frameworks", source: s.frameworks.map(f => ({ id: f.id, label: f.name })) },
    { key: "knowledgeObjectIds", label: "Knowledge objects", source: s.knowledgeObjects.map(k => ({ id: k.id, label: k.title })) },
    { key: "publicationIds", label: "Publications", source: s.publications.map(p => ({ id: p.id, label: p.title })) },
    { key: "clientToolkitIds", label: "Client toolkits", source: s.clientToolkits.map(t => ({ id: t.id, label: t.title })) },
    { key: "aiPackIds", label: "AI packs", source: s.aiPacks.map(a => ({ id: a.id, label: a.title })) },
    { key: "clientToolIds", label: "Client tools", source: s.clientTools.map(t => ({ id: t.id, label: t.name })) },
  ];
  const toggle = (key: keyof Agent, id: string) => {
    const cur = (draft[key] as string[]) ?? [];
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
    setDraft({ ...draft, [key]: next } as Agent);
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {rels.map(r => {
        const selected = new Set((draft[r.key] as string[]) ?? []);
        return (
          <div key={r.key as string} className="editorial-card p-4">
            <SectionTitle hint={`${selected.size} selected`}>{r.label}</SectionTitle>
            {r.source.length === 0 ? <div className="text-xs text-muted-foreground">No entries.</div> : (
              <ul className="max-h-56 overflow-y-auto text-sm space-y-1">
                {r.source.map(x => (
                  <li key={x.id}>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={selected.has(x.id)} onCheckedChange={() => toggle(r.key, x.id)} />
                      <span className="font-mono text-[11px] text-heritage w-24 shrink-0">{x.id}</span>
                      <span className="truncate">{x.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
