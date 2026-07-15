import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, StatusBadge, SectionTitle, ErrorState } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validateConceptId, findDuplicateCanonical, generateDraftKnowledgeObjects } from "@/lib/data/service";
import { toast } from "sonner";
import { KNOWLEDGE_OBJECT_TYPES, MANUFACTURING_STATUSES, type Concept, type KnowledgeObjectType, type ManufacturingStatus, type Status } from "@/lib/data/schema";
import { ManufacturingBadge } from "./concepts.index";

export const Route = createFileRoute("/concepts/$id")({
  head: ({ params }) => ({ meta: [{ title: `${params.id} — Concept Editor` }] }),
  component: ConceptEditorPage,
});

function ConceptEditorPage() {
  const { id } = Route.useParams();
  const s = useSnapshot();
  const original = s?.concepts.find(c => c.id === id);
  const [draft, setDraft] = useState<Concept | null>(null);

  useEffect(() => { if (original && !draft) setDraft(original); }, [original, draft]);

  if (!s) return <LoadingState />;
  if (!original) return <ErrorState message={`Concept ${id} not found.`} />;
  if (!draft) return <LoadingState />;

  const idValid = validateConceptId(draft.id);
  const dupes = findDuplicateCanonical(s.concepts, draft);
  const save = async () => {
    if (!idValid) return toast.error("Permanent ID must match CR-###-### pattern.");
    await Repo.update("concepts", id, draft);
    toast.success("Concept saved.");
  };
  const set = <K extends keyof Concept>(k: K, v: Concept[K]) => setDraft({ ...draft, [k]: v });

  return (
    <>
      <PageHeader eyebrow="Concept Editor" title={draft.canonicalName} description={`Permanent ID ${draft.id}`} actions={
        <>
          <Link to="/repository" className="text-sm underline text-heritage">← Back</Link>
          <Button onClick={save}>Save concept</Button>
        </>
      } />
      <PageBody>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="editorial-card p-5 space-y-4">
              <SectionTitle>Canonical identity</SectionTitle>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Permanent ID" hint={idValid ? "Valid" : "Must match CR-###-###"}>
                  <Input value={draft.id} onChange={e => set("id", e.target.value)} className={!idValid ? "border-destructive" : ""} />
                </Field>
                <Field label="Version"><Input value={draft.version} onChange={e => set("version", e.target.value)} /></Field>
                <Field label="Canonical name"><Input value={draft.canonicalName} onChange={e => set("canonicalName", e.target.value)} /></Field>
                <Field label="Steward"><Input value={draft.steward} onChange={e => set("steward", e.target.value)} /></Field>
              </div>
              {dupes.length > 0 && (
                <div className="text-xs text-destructive border border-destructive/40 rounded px-3 py-2">
                  Possible duplicate canonical concept: {dupes.map(d => d.id).join(", ")}
                </div>
              )}
              <Field label="Canonical definition"><Textarea rows={4} value={draft.canonicalDefinition} onChange={e => set("canonicalDefinition", e.target.value)} /></Field>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Purpose"><Textarea rows={3} value={draft.purpose} onChange={e => set("purpose", e.target.value)} /></Field>
                <Field label="Scope"><Textarea rows={3} value={draft.scope} onChange={e => set("scope", e.target.value)} /></Field>
              </div>
              <Field label="Exclusions"><Textarea rows={2} value={draft.exclusions} onChange={e => set("exclusions", e.target.value)} /></Field>
            </div>

            <div className="editorial-card p-5 space-y-4">
              <SectionTitle>Relationships</SectionTitle>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Domain IDs (comma separated)"><Input value={draft.domainIds.join(", ")} onChange={e => set("domainIds", parseList(e.target.value))} /></Field>
                <Field label="Framework IDs"><Input value={draft.frameworkIds.join(", ")} onChange={e => set("frameworkIds", parseList(e.target.value))} /></Field>
                <Field label="Related concept IDs"><Input value={draft.relatedConceptIds.join(", ")} onChange={e => set("relatedConceptIds", parseList(e.target.value))} /></Field>
                <Field label="Aliases"><Input value={draft.aliases.join(", ")} onChange={e => set("aliases", parseList(e.target.value))} /></Field>
                <Field label="Keywords"><Input value={draft.keywords.join(", ")} onChange={e => set("keywords", parseList(e.target.value))} /></Field>
                <Field label="AI retrieval tags"><Input value={draft.aiRetrievalTags.join(", ")} onChange={e => set("aiRetrievalTags", parseList(e.target.value))} /></Field>
              </div>
            </div>

            <div className="editorial-card p-5 space-y-4">
              <SectionTitle>Editorial</SectionTitle>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Audience"><Input value={draft.audience} onChange={e => set("audience", e.target.value)} /></Field>
                <Field label="Reading level"><Input value={draft.readingLevel} onChange={e => set("readingLevel", e.target.value)} /></Field>
                <Field label="Review cadence (months)"><Input type="number" value={draft.reviewCadenceMonths} onChange={e => set("reviewCadenceMonths", Number(e.target.value))} /></Field>
                <Field label="Last reviewed"><Input type="date" value={(draft.lastReviewedAt ?? "").slice(0, 10)} onChange={e => set("lastReviewedAt", e.target.value ? new Date(e.target.value).toISOString() : null)} /></Field>
              </div>
              <div className="flex items-center gap-3">
                <input id="hr" type="checkbox" checked={draft.humanReviewCompleted} onChange={e => set("humanReviewCompleted", e.target.checked)} />
                <label htmlFor="hr" className="text-sm">Human review completed</label>
              </div>
            </div>

            <FrameworkMappingCard draft={draft} set={set} />
            <KnowledgeObjectFamilyCard conceptId={id} />
            <TraceabilityCard draft={draft} set={set} />
          </div>

          <aside className="space-y-4">
            <div className="editorial-card p-5">
              <SectionTitle>Lifecycle</SectionTitle>
              <div className="flex items-center gap-2 mb-3"><StatusBadge status={draft.status} /><span className="text-xs text-muted-foreground">v{draft.version}</span></div>
              <Select value={draft.status} onValueChange={v => set("status", v as Status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["Draft","In Review","Approved","Canonical","Deprecated","Archived"] as Status[]).map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-3">Promotion to Canonical requires recorded human review under LKS-001.</p>
            </div>

            <div className="editorial-card p-5">
              <SectionTitle>Manufacturing Status</SectionTitle>
              <div className="mb-3"><ManufacturingBadge stage={draft.manufacturingStatus} /></div>
              <Select value={draft.manufacturingStatus} onValueChange={v => set("manufacturingStatus", v as ManufacturingStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MANUFACTURING_STATUSES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="mt-4 flex items-center justify-between text-xs">
                {MANUFACTURING_STATUSES.map((m, i) => (
                  <div key={m} className="flex-1 flex items-center">
                    <div className={`size-2.5 rounded-full ${MANUFACTURING_STATUSES.indexOf(draft.manufacturingStatus) >= i ? "bg-gold" : "bg-muted"}`} />
                    {i < MANUFACTURING_STATUSES.length - 1 && <div className={`h-px flex-1 ${MANUFACTURING_STATUSES.indexOf(draft.manufacturingStatus) > i ? "bg-gold" : "bg-muted"}`} />}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">Draft → Editorial → QA → Canonical. QA gate requires 0 blocking errors.</p>
            </div>

            <div className="editorial-card p-5 text-sm">
              <SectionTitle>Related</SectionTitle>
              <div className="text-xs uppercase text-slate-ink mb-1">Frameworks referencing this</div>
              <ul className="mb-3">
                {s.frameworks.filter(f => f.governingConceptIds.includes(id)).map(f =>
                  <li key={f.id}><Link to="/frameworks/$id" params={{ id: f.id }} className="underline">{f.id} · {f.name}</Link></li>
                )}
              </ul>
            </div>
          </aside>
        </div>
      </PageBody>
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-wider text-slate-ink">{label}</Label>
      {children}
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function parseList(v: string): string[] { return v.split(",").map(s => s.trim()).filter(Boolean); }

// ---------- Framework Mapping ----------
function FrameworkMappingCard({ draft, set }: { draft: Concept; set: <K extends keyof Concept>(k: K, v: Concept[K]) => void }) {
  const s = useSnapshot();
  if (!s) return null;
  const linked = new Set(draft.frameworkIds);
  const toggle = (id: string) => {
    const next = linked.has(id) ? draft.frameworkIds.filter(x => x !== id) : [...draft.frameworkIds, id];
    set("frameworkIds", next);
  };
  const governing = s.frameworks.filter(f => f.governingConceptIds.includes(draft.id));
  return (
    <div className="editorial-card p-5 space-y-3">
      <SectionTitle hint={`${draft.frameworkIds.length} linked · ${governing.length} governing`}>Framework mapping</SectionTitle>
      <p className="text-xs text-muted-foreground">Frameworks this Concept Family maps into. Governing frameworks (that declare this concept in <em>governingConceptIds</em>) are highlighted.</p>
      <div className="max-h-64 overflow-y-auto divide-y divide-border">
        {s.frameworks.map(f => {
          const isGoverning = f.governingConceptIds.includes(draft.id);
          return (
            <label key={f.id} className="flex items-center gap-3 py-2 cursor-pointer">
              <Checkbox checked={linked.has(f.id)} onCheckedChange={() => toggle(f.id)} />
              <span className="font-mono text-xs text-heritage w-16">{f.id}</span>
              <span className="text-sm flex-1 truncate">{f.name}</span>
              {isGoverning && <span className="text-[10px] uppercase tracking-widest text-gold">Governing</span>}
              <StatusBadge status={f.status} />
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Knowledge Object Family (15 standard types) ----------
function KnowledgeObjectFamilyCard({ conceptId }: { conceptId: string }) {
  const s = useSnapshot();
  const byType = useMemo(() => {
    const m: Record<string, { id: string; title: string; status: Status; humanReviewCompleted: boolean }[]> = {};
    if (!s) return m;
    for (const t of KNOWLEDGE_OBJECT_TYPES) m[t] = [];
    for (const k of s.knowledgeObjects) {
      if (!k.sourceConceptIds.includes(conceptId)) continue;
      (m[k.type] ??= []).push({ id: k.id, title: k.title, status: k.status, humanReviewCompleted: k.humanReviewCompleted });
    }
    return m;
  }, [s, conceptId]);

  const generateMissing = async () => {
    const missing = KNOWLEDGE_OBJECT_TYPES.filter(t => (byType[t]?.length ?? 0) === 0) as KnowledgeObjectType[];
    if (missing.length === 0) return toast.info("All 15 object types are represented.");
    const drafts = generateDraftKnowledgeObjects({
      conceptIds: [conceptId],
      frameworkIds: [],
      types: missing,
      promptId: "PR-002",
    });
    for (const d of drafts) await Repo.create("knowledgeObjects", d);
    toast.success(`Generated ${drafts.length} draft KOs across missing types (human review required).`);
  };

  const total = Object.values(byType).reduce((a, b) => a + b.length, 0);
  const filledTypes = KNOWLEDGE_OBJECT_TYPES.filter(t => (byType[t]?.length ?? 0) > 0).length;

  return (
    <div className="editorial-card p-5 space-y-3">
      <SectionTitle hint={`${filledTypes} / 15 types · ${total} KOs`}>Knowledge Object Family</SectionTitle>
      <p className="text-xs text-muted-foreground">Standard 15-object family for this Concept. Gaps indicate manufacturing work remaining.</p>
      <div className="grid md:grid-cols-2 gap-2">
        {KNOWLEDGE_OBJECT_TYPES.map(t => {
          const items = byType[t] ?? [];
          const has = items.length > 0;
          return (
            <div key={t} className={`rounded border p-3 text-sm ${has ? "border-evergreen/40 bg-evergreen/5" : "border-dashed border-muted-foreground/30 bg-muted/30"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-heritage">{t}</span>
                <span className="text-[10px] uppercase tracking-widest text-slate-ink">{items.length || "—"}</span>
              </div>
              {items.length === 0 ? (
                <div className="text-[11px] text-muted-foreground">No object yet.</div>
              ) : (
                <ul className="space-y-0.5">
                  {items.slice(0, 3).map(k => (
                    <li key={k.id} className="text-[11px] flex items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-ink">{k.id}</span>
                      <span className="truncate flex-1">{k.title}</span>
                      <StatusBadge status={k.status} />
                    </li>
                  ))}
                  {items.length > 3 && <li className="text-[10px] text-muted-foreground">+{items.length - 3} more</li>}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <Button size="sm" variant="outline" onClick={generateMissing}>Generate drafts for missing types</Button>
    </div>
  );
}

// ---------- Traceability ----------
function TraceabilityCard({ draft, set }: { draft: Concept; set: <K extends keyof Concept>(k: K, v: Concept[K]) => void }) {
  const s = useSnapshot();
  if (!s) return null;
  const publications = s.publications;
  const tools = s.clientTools;
  const aiAssets = [
    ...s.prompts.map(p => ({ id: p.id, label: `${p.id} · ${p.name}`, kind: "Prompt" })),
    ...s.agents.map(a => ({ id: a.id, label: `${a.id} · ${a.name}`, kind: "Agent" })),
  ];
  const tri = <T extends "publicationLinks" | "clientToolkitLinks" | "aiPackLinks">(key: T, id: string) => {
    const cur = draft[key];
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
    set(key, next);
  };
  return (
    <div className="editorial-card p-5 space-y-4">
      <SectionTitle hint={`${draft.publicationLinks.length + draft.clientToolkitLinks.length + draft.aiPackLinks.length} traced`}>
        Traceability
      </SectionTitle>
      <p className="text-xs text-muted-foreground">Downstream modules that consume this Concept Family. Kept explicit so lifecycle and revisions propagate cleanly.</p>

      <TraceGroup label="Publication modules" hint="PL- blueprints and chapters">
        {publications.map(p => (
          <TraceRow key={p.id} checked={draft.publicationLinks.includes(p.id)} onToggle={() => tri("publicationLinks", p.id)} id={p.id} label={p.title} status={p.status} />
        ))}
      </TraceGroup>

      <TraceGroup label="Client toolkits" hint="Worksheets, Checklists, Decision Aids">
        {tools.map(t => (
          <TraceRow key={t.id} checked={draft.clientToolkitLinks.includes(t.id)} onToggle={() => tri("clientToolkitLinks", t.id)} id={t.id} label={`${t.kind} · ${t.name}`} status={t.status} />
        ))}
      </TraceGroup>

      <TraceGroup label="AI packs" hint="Prompts and Agents">
        {aiAssets.map(a => (
          <TraceRow key={a.id} checked={draft.aiPackLinks.includes(a.id)} onToggle={() => tri("aiPackLinks", a.id)} id={a.id} label={a.label} />
        ))}
      </TraceGroup>
    </div>
  );
}

function TraceGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-xs uppercase tracking-wider text-slate-ink font-medium">{label}</div>
        {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
      </div>
      <div className="max-h-40 overflow-y-auto divide-y divide-border border border-border rounded">
        {children}
      </div>
    </div>
  );
}

function TraceRow({ checked, onToggle, id, label, status }: { checked: boolean; onToggle: () => void; id: string; label: string; status?: Status }) {
  return (
    <label className="flex items-center gap-3 py-1.5 px-2 cursor-pointer text-sm hover:bg-accent/30">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <span className="font-mono text-[11px] text-heritage w-20 shrink-0">{id}</span>
      <span className="flex-1 truncate">{label}</span>
      {status && <StatusBadge status={status} />}
    </label>
  );
}
