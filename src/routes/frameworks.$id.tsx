import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, StatusBadge, SectionTitle, ErrorState } from "@/components/ui-kit";
import { useSnapshot } from "@/lib/use-snapshot";
import { frameworkCoverage } from "@/lib/data/service";

export const Route = createFileRoute("/frameworks/$id")({
  head: ({ params }) => ({ meta: [{ title: `${params.id} — Framework Workspace` }] }),
  component: FrameworkPage,
});

function FrameworkPage() {
  const { id } = Route.useParams();
  const s = useSnapshot();
  if (!s) return <LoadingState />;
  const f = s.frameworks.find(x => x.id === id);
  if (!f) return <ErrorState message={`Framework ${id} not found.`} />;
  const cov = frameworkCoverage(f, s.concepts);
  const warnings: string[] = [];
  for (const cid of f.governingConceptIds) {
    const c = s.concepts.find(x => x.id === cid);
    if (!c) warnings.push(`Broken governing concept reference ${cid}`);
    else if (c.status !== "Canonical") warnings.push(`Governing concept ${cid} is ${c.status}`);
  }

  return (
    <>
      <PageHeader eyebrow="Framework Workspace" title={f.name} description={f.mission} actions={<StatusBadge status={f.status} />} />
      <PageBody>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="editorial-card p-5">
              <SectionTitle>Decision solved</SectionTitle>
              <p className="text-slate-ink">{f.decisionSolved}</p>
            </div>
            <div className="editorial-card p-5 grid md:grid-cols-2 gap-6">
              <div>
                <SectionTitle>Inputs</SectionTitle>
                <ul className="text-sm list-disc pl-5 space-y-1">{f.inputs.map(x => <li key={x}>{x}</li>)}</ul>
              </div>
              <div>
                <SectionTitle>Outputs</SectionTitle>
                <ul className="text-sm list-disc pl-5 space-y-1">{f.outputs.map(x => <li key={x}>{x}</li>)}</ul>
              </div>
            </div>
            <div className="editorial-card p-5">
              <SectionTitle>Decision flow</SectionTitle>
              <ol className="text-sm list-decimal pl-5 space-y-1">{f.decisionFlow.map(x => <li key={x}>{x}</li>)}</ol>
            </div>
            <div className="editorial-card p-5">
              <SectionTitle hint={`${cov.approved}/${cov.total} governing concepts approved`}>Concept coverage</SectionTitle>
              <div className="h-2 rounded-full bg-muted mb-3 overflow-hidden">
                <div className="h-full bg-gold" style={{ width: `${cov.ratio * 100}%` }} />
              </div>
              <ul className="text-sm divide-y divide-border">
                {f.governingConceptIds.map(cid => {
                  const c = s.concepts.find(x => x.id === cid);
                  return (
                    <li key={cid} className="py-2 flex items-center gap-3">
                      <span className="font-mono text-xs text-slate-ink w-24">{cid}</span>
                      <Link to="/concepts/$id" params={{ id: cid }} className="flex-1 underline">{c?.canonicalName ?? "Missing concept"}</Link>
                      {c && <StatusBadge status={c.status} />}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          <aside className="space-y-4">
            <div className="editorial-card p-5">
              <SectionTitle>Maturity</SectionTitle>
              <div className="font-serif text-2xl text-heritage">{f.maturity}</div>
              <div className="text-xs text-muted-foreground mt-1">Version {f.version} · Steward {f.steward}</div>
            </div>
            <div className="editorial-card p-5">
              <SectionTitle>Alignment warnings</SectionTitle>
              {warnings.length === 0 ? <div className="text-sm text-evergreen">No warnings detected.</div> : (
                <ul className="text-sm space-y-1">
                  {warnings.map(w => <li key={w} className="text-destructive">· {w}</li>)}
                </ul>
              )}
            </div>
            <div className="editorial-card p-5">
              <SectionTitle>Derived client tools</SectionTitle>
              {f.clientToolIds.length === 0 ? <div className="text-sm text-muted-foreground">None yet.</div> : (
                <ul className="text-sm">{f.clientToolIds.map(tid => <li key={tid}>{tid}</li>)}</ul>
              )}
            </div>
            <div className="editorial-card p-5">
              <SectionTitle>Publication usage</SectionTitle>
              <ul className="text-sm">
                {f.publicationIds.map(pid => (
                  <li key={pid}><Link to="/publications/$id" params={{ id: pid }} className="underline">{pid}</Link></li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
