import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, SectionTitle, StatusBadge, ErrorState } from "@/components/ui-kit";
import { useSnapshot } from "@/lib/use-snapshot";
import { chapterCoverageGaps } from "@/lib/data/service";

export const Route = createFileRoute("/publications/$id")({
  head: ({ params }) => ({ meta: [{ title: `${params.id} — Publication Builder` }] }),
  component: PublicationPage,
});

function PublicationPage() {
  const { id } = Route.useParams();
  const s = useSnapshot();
  if (!s) return <LoadingState />;
  const p = s.publications.find(x => x.id === id);
  if (!p) return <ErrorState message={`Publication ${id} not found.`} />;

  return (
    <>
      <PageHeader eyebrow="Publication Builder" title={p.title} description={p.purpose}
        actions={<StatusBadge status={p.status} />} />
      <PageBody>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {p.chapters.sort((a, b) => a.order - b.order).map(ch => {
              const gaps = chapterCoverageGaps(ch, s);
              return (
                <div key={ch.id} className="editorial-card p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-xs text-slate-ink">{ch.id}</span>
                    <span className="text-[10px] uppercase tracking-widest text-gold">Chapter {ch.order}</span>
                    <StatusBadge status={ch.reviewStatus} />
                  </div>
                  <h3 className="font-serif text-xl text-heritage">{ch.title}</h3>
                  <div className="grid md:grid-cols-2 gap-4 mt-3 text-sm">
                    <div>
                      <div className="text-xs uppercase text-slate-ink mb-1">Learning objectives</div>
                      <ul className="list-disc pl-5 space-y-1">{ch.learningObjectives.map(o => <li key={o}>{o}</li>)}</ul>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-slate-ink mb-1">Coverage gaps</div>
                      {gaps.length === 0 ? <div className="text-evergreen text-sm">None detected.</div> : (
                        <ul className="text-destructive text-sm space-y-1">{gaps.map(g => <li key={g}>· {g}</li>)}</ul>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground grid md:grid-cols-2 gap-3">
                    <div><strong className="text-slate-ink">Concepts:</strong> {ch.conceptIds.join(", ") || "—"}</div>
                    <div><strong className="text-slate-ink">Frameworks:</strong> {ch.frameworkIds.join(", ") || "—"}</div>
                    <div><strong className="text-slate-ink">Client Tools:</strong> {ch.clientToolIds.join(", ") || "—"}</div>
                    <div><strong className="text-slate-ink">Domains:</strong> {ch.domainIds.join(", ") || "—"}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <aside className="space-y-4">
            <div className="editorial-card p-5">
              <SectionTitle>Assembly sequence</SectionTitle>
              <ol className="text-sm list-decimal pl-5 space-y-1">
                {p.chapters.sort((a, b) => a.order - b.order).map(ch => <li key={ch.id}>{ch.id} — {ch.title}</li>)}
              </ol>
            </div>
            <div className="editorial-card p-5">
              <SectionTitle>Source manifest</SectionTitle>
              <div className="text-sm space-y-1">
                <div>Concepts: {new Set(p.chapters.flatMap(c => c.conceptIds)).size}</div>
                <div>Frameworks: {new Set(p.chapters.flatMap(c => c.frameworkIds)).size}</div>
                <div>Client Tools: {new Set(p.chapters.flatMap(c => c.clientToolIds)).size}</div>
                <div>Domains: {new Set(p.chapters.flatMap(c => c.domainIds)).size}</div>
              </div>
            </div>
            <div className="editorial-card p-5 text-sm">
              <SectionTitle>Metadata</SectionTitle>
              <div>Audience: {p.audience}</div>
              <div>Version: {p.version}</div>
              <div>Steward: {p.steward}</div>
              <div className="mt-3"><Link to="/releases/$id" params={{ id: "LKR-1.0.001" }} className="underline">View next release →</Link></div>
            </div>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
