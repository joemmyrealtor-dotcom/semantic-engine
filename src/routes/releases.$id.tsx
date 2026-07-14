import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, SectionTitle, StatusBadge, ErrorState } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { evaluateReleaseGate } from "@/lib/data/service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { ReleaseStage } from "@/lib/data/schema";

const STAGES: ReleaseStage[] = ["Planned","Build","Review","QA","Release Candidate","Canonical","Archived"];

export const Route = createFileRoute("/releases/$id")({
  head: ({ params }) => ({ meta: [{ title: `${params.id} — Release Manager` }] }),
  component: ReleasePage,
});

function ReleasePage() {
  const { id } = Route.useParams();
  const s = useSnapshot();
  if (!s) return <LoadingState />;
  const r = s.releases.find(x => x.id === id);
  if (!r) return <ErrorState message={`Release ${id} not found.`} />;
  const gate = evaluateReleaseGate(r);

  const advance = async (stage: ReleaseStage) => {
    if (stage === "Canonical" && !gate.readyForCanonical) { toast.error("Gate incomplete or blocking errors present."); return; }
    await Repo.update("releases", id, { stage });
    toast.success(`Advanced to ${stage}.`);
  };

  return (
    <>
      <PageHeader eyebrow="Release Manager" title={r.name} description={r.releaseNotes}
        actions={<>
          <StatusBadge status={r.stage} />
          <Select value={r.stage} onValueChange={v => advance(v as ReleaseStage)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </>} />
      <PageBody>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="editorial-card p-5">
              <SectionTitle hint={`${gate.passed}/${gate.total} gates`}>Gate checklist</SectionTitle>
              <ul className="text-sm space-y-2">
                {r.gateChecklist.map(g => (
                  <li key={g.id} className="flex items-center gap-3">
                    <span className={`size-2.5 rounded-full ${g.passed ? "bg-evergreen" : "bg-destructive"}`} />
                    <span className="font-mono text-xs w-24 text-slate-ink">{g.id}</span>
                    <span>{g.label}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-xs text-muted-foreground">Blocking errors: {r.blockingErrors} · Alignment warnings: {r.alignmentWarnings}</div>
            </div>
            <div className="editorial-card p-5">
              <SectionTitle>Manifest</SectionTitle>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                {r.manifest.map(m => (
                  <div key={m.entityType} className="border border-border rounded p-3">
                    <div className="text-[11px] uppercase tracking-widest text-gold">{m.entityType}</div>
                    <div className="font-serif text-xl text-heritage">{m.ids.length}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.ids.slice(0, 6).join(", ")}{m.ids.length > 6 ? "…" : ""}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="editorial-card p-5">
              <SectionTitle>Changelog</SectionTitle>
              <ul className="text-sm list-disc pl-5 space-y-1">{r.changelog.map(c => <li key={c}>{c}</li>)}</ul>
            </div>
            <div className="editorial-card p-5">
              <SectionTitle>Known issues</SectionTitle>
              <ul className="text-sm list-disc pl-5 space-y-1">{r.knownIssues.map(c => <li key={c}>{c}</li>)}</ul>
            </div>
          </div>
          <aside className="space-y-4 text-sm">
            <div className="editorial-card p-5"><SectionTitle>Validation summary</SectionTitle><p>{r.validationSummary}</p></div>
            <div className="editorial-card p-5"><SectionTitle>Editorial review</SectionTitle><p>{r.editorialReview}</p></div>
            <div className="editorial-card p-5"><SectionTitle>QA evidence</SectionTitle><p>{r.qaEvidence}</p></div>
            <div className="editorial-card p-5"><SectionTitle>Traceability</SectionTitle><p>{r.traceability}</p></div>
            <div className="editorial-card p-5"><SectionTitle>Migration notes</SectionTitle><p>{r.migrationNotes}</p></div>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
