import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, SectionTitle, StatusBadge, ErrorState, KpiCard } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { evaluateReleaseGate, releasePublicationReports, releaseToolkitReports, releaseAIPackReports, releaseAgentReports } from "@/lib/data/service";
import { releaseIntelligence } from "@/lib/data/intelligence";
import { PublicationStageBadge } from "@/components/publication-stage-badge";
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
  const pubReports = releasePublicationReports(r, s);
  const tkReports = releaseToolkitReports(r, s);
  const apReports = releaseAIPackReports(r, s);
  const agReports = releaseAgentReports(r, s);
  const ineligible = pubReports.filter(p => !p.eligible);
  const tkIneligible = tkReports.filter(t => !t.eligible);
  const apIneligible = apReports.filter(a => !a.eligible);
  const agIneligible = agReports.filter(a => !a.eligible);
  const totalIneligible = ineligible.length + tkIneligible.length + apIneligible.length + agIneligible.length;
  const readinessBlocked = totalIneligible > 0;

  const advance = async (stage: ReleaseStage) => {
    if ((stage === "Canonical" || stage === "Release Candidate") && readinessBlocked) {
      toast.error(`Cannot advance: ${totalIneligible} asset(s) ineligible for Canonical.`);
      return;
    }
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
        <ReleaseIntelligencePanel releaseId={id} />
        <div className="grid lg:grid-cols-3 gap-6 mt-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="editorial-card p-5">
              <SectionTitle hint={`${gate.passed}/${gate.total} gates${readinessBlocked ? ` · ${ineligible.length} publication blocker(s)` : ""}`}>Gate checklist</SectionTitle>
              <ul className="text-sm space-y-2">
                {r.gateChecklist.map(g => (
                  <li key={g.id} className="flex items-center gap-3">
                    <span className={`size-2.5 rounded-full ${g.passed ? "bg-evergreen" : "bg-destructive"}`} />
                    <span className="font-mono text-xs w-24 text-slate-ink">{g.id}</span>
                    <span>{g.label}</span>
                  </li>
                ))}
                {pubReports.length > 0 && (
                  <li className="flex items-start gap-3 pt-2 border-t border-border mt-2">
                    <span className={`mt-1 size-2.5 rounded-full ${ineligible.length > 0 ? "bg-destructive" : "bg-evergreen"}`} />
                    <span className="font-mono text-xs w-24 text-slate-ink">PUB-READY</span>
                    <span>{ineligible.length > 0 ? `${ineligible.length} publication(s) not eligible for Canonical` : "All publications eligible for Canonical"}</span>
                  </li>
                )}
                {tkReports.length > 0 && (
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 size-2.5 rounded-full ${tkIneligible.length > 0 ? "bg-destructive" : "bg-evergreen"}`} />
                    <span className="font-mono text-xs w-24 text-slate-ink">TK-READY</span>
                    <span>{tkIneligible.length > 0 ? `${tkIneligible.length} toolkit(s) not eligible for Canonical` : "All toolkits eligible for Canonical"}</span>
                  </li>
                )}
                {apReports.length > 0 && (
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 size-2.5 rounded-full ${apIneligible.length > 0 ? "bg-destructive" : "bg-evergreen"}`} />
                    <span className="font-mono text-xs w-24 text-slate-ink">AP-READY</span>
                    <span>{apIneligible.length > 0 ? `${apIneligible.length} AI pack(s) not eligible for Canonical` : "All AI packs eligible for Canonical"}</span>
                  </li>
                )}
                {agReports.length > 0 && (
                  <li className="flex items-start gap-3">
                    <span className={`mt-1 size-2.5 rounded-full ${agIneligible.length > 0 ? "bg-destructive" : "bg-evergreen"}`} />
                    <span className="font-mono text-xs w-24 text-slate-ink">AG-READY</span>
                    <span>{agIneligible.length > 0 ? `${agIneligible.length} agent(s) not eligible for Canonical` : "All agents eligible for Canonical"}</span>
                  </li>
                )}
              </ul>
              <div className="mt-3 text-xs text-muted-foreground">Blocking errors: {r.blockingErrors} · Alignment warnings: {r.alignmentWarnings}</div>
            </div>

            {pubReports.length > 0 && (
              <div className="editorial-card p-5">
                <SectionTitle hint={`${pubReports.length} publication(s)`}>Publication readiness</SectionTitle>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-widest text-slate-ink border-b border-border">
                        <th className="py-2 pr-3">Publication</th>
                        <th className="pr-3">Stage</th>
                        <th className="pr-3">Coverage</th>
                        <th className="pr-3">Readiness</th>
                        <th className="pr-3">Broken</th>
                        <th className="pr-3">Missing KO</th>
                        <th className="pr-3">Canonical</th>
                        <th className="pr-3">Review</th>
                        <th className="pr-3">Eligible</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pubReports.map(pr => (
                        <tr key={pr.publicationId} className="border-b border-border/60 align-top">
                          <td className="py-2 pr-3">
                            <Link to="/publications/$id" params={{ id: pr.publicationId }} className="text-heritage hover:underline">
                              <span className="font-mono text-xs text-slate-ink">{pr.publicationId}</span> {pr.title}
                            </Link>
                            {pr.blockers.length > 0 && (
                              <ul className="mt-1 text-xs text-destructive list-disc pl-4">{pr.blockers.map(b => <li key={b}>{b}</li>)}</ul>
                            )}
                          </td>
                          <td className="pr-3"><PublicationStageBadge stage={pr.stage} /></td>
                          <td className="pr-3">{pr.coveragePercent}%</td>
                          <td className="pr-3">{pr.readinessScore}</td>
                          <td className={`pr-3 ${pr.brokenReferences ? "text-destructive" : ""}`}>{pr.brokenReferences}</td>
                          <td className={`pr-3 ${pr.missingKnowledgeObjects ? "text-destructive" : ""}`}>{pr.missingKnowledgeObjects}</td>
                          <td className="pr-3">{pr.canonicalCompliance}%</td>
                          <td className="pr-3">{pr.humanReviewComplete ? "✓" : "—"}</td>
                          <td className={`pr-3 ${pr.eligible ? "text-evergreen" : "text-destructive"}`}>{pr.eligible ? "✓" : "Blocked"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tkReports.length > 0 && (
              <div className="editorial-card p-5">
                <SectionTitle hint={`${tkReports.length} toolkit(s)`}>Client Toolkit readiness</SectionTitle>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-[11px] uppercase tracking-widest text-slate-ink border-b border-border">
                      <th className="py-2 pr-3">Toolkit</th><th className="pr-3">Stage</th><th className="pr-3">Coverage</th>
                      <th className="pr-3">Readiness</th><th className="pr-3">Broken</th><th className="pr-3">Canonical</th>
                      <th className="pr-3">Review</th><th className="pr-3">Eligible</th>
                    </tr></thead>
                    <tbody>
                      {tkReports.map(tr => (
                        <tr key={tr.toolkitId} className="border-b border-border/60 align-top">
                          <td className="py-2 pr-3">
                            <Link to="/client-toolkits/$id" params={{ id: tr.toolkitId }} className="text-heritage hover:underline">
                              <span className="font-mono text-xs text-slate-ink">{tr.toolkitId}</span> {tr.title}
                            </Link>
                            {tr.blockers.length > 0 && <ul className="mt-1 text-xs text-destructive list-disc pl-4">{tr.blockers.map(b => <li key={b}>{b}</li>)}</ul>}
                          </td>
                          <td className="pr-3"><PublicationStageBadge stage={tr.stage} /></td>
                          <td className="pr-3">{tr.coveragePercent}%</td>
                          <td className="pr-3">{tr.readinessScore}</td>
                          <td className={`pr-3 ${tr.brokenReferences ? "text-destructive" : ""}`}>{tr.brokenReferences}</td>
                          <td className="pr-3">{tr.canonicalCompliance}%</td>
                          <td className="pr-3">{tr.humanReviewComplete ? "✓" : "—"}</td>
                          <td className={`pr-3 ${tr.eligible ? "text-evergreen" : "text-destructive"}`}>{tr.eligible ? "✓" : "Blocked"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {apReports.length > 0 && (
              <div className="editorial-card p-5">
                <SectionTitle hint={`${apReports.length} AI pack(s)`}>AI Pack readiness</SectionTitle>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-[11px] uppercase tracking-widest text-slate-ink border-b border-border">
                      <th className="py-2 pr-3">AI Pack</th><th className="pr-3">Stage</th><th className="pr-3">Coverage</th>
                      <th className="pr-3">Readiness</th><th className="pr-3">Broken</th><th className="pr-3">Unreviewed evals</th>
                      <th className="pr-3">Canonical</th><th className="pr-3">Review</th><th className="pr-3">Eligible</th>
                    </tr></thead>
                    <tbody>
                      {apReports.map(ar => (
                        <tr key={ar.packId} className="border-b border-border/60 align-top">
                          <td className="py-2 pr-3">
                            <Link to="/ai-packs/$id" params={{ id: ar.packId }} className="text-heritage hover:underline">
                              <span className="font-mono text-xs text-slate-ink">{ar.packId}</span> {ar.title}
                            </Link>
                            {ar.blockers.length > 0 && <ul className="mt-1 text-xs text-destructive list-disc pl-4">{ar.blockers.map(b => <li key={b}>{b}</li>)}</ul>}
                          </td>
                          <td className="pr-3"><PublicationStageBadge stage={ar.stage} /></td>
                          <td className="pr-3">{ar.coveragePercent}%</td>
                          <td className="pr-3">{ar.readinessScore}</td>
                          <td className={`pr-3 ${ar.brokenReferences ? "text-destructive" : ""}`}>{ar.brokenReferences}</td>
                          <td className={`pr-3 ${ar.unreviewedEvaluations ? "text-destructive" : ""}`}>{ar.unreviewedEvaluations}</td>
                          <td className="pr-3">{ar.canonicalCompliance}%</td>
                          <td className="pr-3">{ar.humanReviewComplete ? "✓" : "—"}</td>
                          <td className={`pr-3 ${ar.eligible ? "text-evergreen" : "text-destructive"}`}>{ar.eligible ? "✓" : "Blocked"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {agReports.length > 0 && (
              <div className="editorial-card p-5">
                <SectionTitle hint={`${agReports.length} agent(s)`}>Agent readiness</SectionTitle>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-[11px] uppercase tracking-widest text-slate-ink border-b border-border">
                      <th className="py-2 pr-3">Agent</th><th className="pr-3">Stage</th><th className="pr-3">Coverage</th>
                      <th className="pr-3">Readiness</th><th className="pr-3">Broken</th><th className="pr-3">Unreviewed</th>
                      <th className="pr-3">Failing</th><th className="pr-3">Canonical</th><th className="pr-3">Review</th><th className="pr-3">Eligible</th>
                    </tr></thead>
                    <tbody>
                      {agReports.map(ar => (
                        <tr key={ar.agentId} className="border-b border-border/60 align-top">
                          <td className="py-2 pr-3">
                            <Link to="/agents/$id" params={{ id: ar.agentId }} className="text-heritage hover:underline">
                              <span className="font-mono text-xs text-slate-ink">{ar.agentId}</span> {ar.name}
                            </Link>
                            {ar.blockers.length > 0 && <ul className="mt-1 text-xs text-destructive list-disc pl-4">{ar.blockers.map(b => <li key={b}>{b}</li>)}</ul>}
                          </td>
                          <td className="pr-3"><PublicationStageBadge stage={ar.stage} /></td>
                          <td className="pr-3">{ar.coveragePercent}%</td>
                          <td className="pr-3">{ar.readinessScore}</td>
                          <td className={`pr-3 ${ar.brokenReferences ? "text-destructive" : ""}`}>{ar.brokenReferences}</td>
                          <td className={`pr-3 ${ar.unreviewedEvaluations ? "text-destructive" : ""}`}>{ar.unreviewedEvaluations}</td>
                          <td className={`pr-3 ${ar.failingEvaluations ? "text-destructive" : ""}`}>{ar.failingEvaluations}</td>
                          <td className="pr-3">{ar.canonicalCompliance}%</td>
                          <td className="pr-3">{ar.humanReviewComplete ? "✓" : "—"}</td>
                          <td className={`pr-3 ${ar.eligible ? "text-evergreen" : "text-destructive"}`}>{ar.eligible ? "✓" : "Blocked"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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
