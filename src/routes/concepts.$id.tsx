import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, StatusBadge, SectionTitle, ErrorState } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validateConceptId, findDuplicateCanonical } from "@/lib/data/service";
import { toast } from "sonner";
import type { Concept, Status } from "@/lib/data/schema";

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
            <div className="editorial-card p-5 text-sm">
              <SectionTitle>Related</SectionTitle>
              <div className="text-xs uppercase text-slate-ink mb-1">Frameworks referencing this</div>
              <ul className="mb-3">
                {s.frameworks.filter(f => f.governingConceptIds.includes(id)).map(f =>
                  <li key={f.id}><Link to="/frameworks/$id" params={{ id: f.id }} className="underline">{f.id} · {f.name}</Link></li>
                )}
              </ul>
              <div className="text-xs uppercase text-slate-ink mb-1">Knowledge Objects</div>
              <ul>
                {s.knowledgeObjects.filter(k => k.sourceConceptIds.includes(id)).slice(0, 8).map(k =>
                  <li key={k.id} className="text-sm truncate">{k.id} · {k.title}</li>
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
