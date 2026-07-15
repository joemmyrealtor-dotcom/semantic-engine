import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, SectionTitle, ErrorState, KpiCard } from "@/components/ui-kit";
import { useSnapshot } from "@/lib/use-snapshot";
import {
  buildUniversalIndex, impactAnalysis, inspectRelationships,
} from "@/lib/data/intelligence";

export const Route = createFileRoute("/knowledge/$id")({
  head: ({ params }) => ({ meta: [{ title: `${params.id} — Knowledge Detail` }] }),
  component: KnowledgeDetail,
});

function KnowledgeDetail() {
  const { id } = Route.useParams();
  const s = useSnapshot();
  if (!s) return <LoadingState />;
  const index = buildUniversalIndex(s);
  const asset = index.find(a => a.id === id);
  if (!asset) return <ErrorState message={`Asset ${id} not found in the intelligence index.`} />;

  const insp = inspectRelationships(id, s);
  const impact = impactAnalysis(id, s);

  const nodeMap = new Map(index.map(a => [a.id, a] as const));
  const labelFor = (nid: string) => nodeMap.get(nid)?.title ?? nid;
  const kindFor = (nid: string) => nodeMap.get(nid)?.kind ?? "?";

  const riskTone = impact.risk === "Critical" ? "warn" : impact.risk === "High" ? "warn" : impact.risk === "Medium" ? "gold" : "evergreen";

  return (
    <>
      <PageHeader
        eyebrow={asset.kind}
        title={asset.title}
        description={asset.description || "—"}
        actions={
          asset.routeTo && asset.routeParams ? (
            <Link to={asset.routeTo as string} params={asset.routeParams as never}
              className="text-sm underline text-heritage">Open in Studio →</Link>
          ) : null
        }
      />
      <PageBody>
        <div className="grid md:grid-cols-4 gap-3 mb-4">
          <KpiCard label="Risk Level" value={impact.risk} tone={riskTone as "warn" | "gold" | "evergreen" | "default"} hint={`Score ${impact.riskScore}`} />
          <KpiCard label="Depended On By" value={impact.dependedOnBy.length} />
          <KpiCard label="Depends On" value={impact.dependsOn.length} />
          <KpiCard label="Affected Releases" value={impact.affectedReleases.length} tone={impact.affectedReleases.length ? "warn" : "default"} />
          <KpiCard label="Affected Publications" value={impact.affectedPublications.length} />
          <KpiCard label="Affected Toolkits" value={impact.affectedToolkits.length} />
          <KpiCard label="Affected AI Packs" value={impact.affectedAIPacks.length} />
          <KpiCard label="Affected Agents" value={impact.affectedAgents.length} />
          <KpiCard label="Affected Automations" value={impact.affectedAutomations.length} />
          <KpiCard label="Affected Chapters" value={impact.affectedChapters.length} />
          <KpiCard label="Incoming Links" value={insp.incoming.length} />
          <KpiCard label="Outgoing Links" value={insp.outgoing.length} />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="editorial-card p-5">
              <SectionTitle hint={`${insp.outgoing.length} outgoing`}>Outgoing Links</SectionTitle>
              <RelationList list={insp.outgoing} kindFor={kindFor} labelFor={labelFor} otherKey="to" />
            </div>
            <div className="editorial-card p-5">
              <SectionTitle hint={`${insp.incoming.length} incoming`}>Incoming Links</SectionTitle>
              <RelationList list={insp.incoming} kindFor={kindFor} labelFor={labelFor} otherKey="from" />
            </div>

            <div className="editorial-card p-5">
              <SectionTitle>Impact Buckets</SectionTitle>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <ImpactBucket title="Releases" ids={impact.affectedReleases} kindFor={kindFor} labelFor={labelFor} />
                <ImpactBucket title="Publications" ids={impact.affectedPublications} kindFor={kindFor} labelFor={labelFor} />
                <ImpactBucket title="Client Toolkits" ids={impact.affectedToolkits} kindFor={kindFor} labelFor={labelFor} />
                <ImpactBucket title="AI Packs" ids={impact.affectedAIPacks} kindFor={kindFor} labelFor={labelFor} />
                <ImpactBucket title="Agents" ids={impact.affectedAgents} kindFor={kindFor} labelFor={labelFor} />
                <ImpactBucket title="Automations" ids={impact.affectedAutomations} kindFor={kindFor} labelFor={labelFor} />
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="editorial-card p-5">
              <SectionTitle>Risk reasoning</SectionTitle>
              <ul className="text-sm list-disc pl-5 space-y-1">
                {impact.reasons.map(r => <li key={r}>{r}</li>)}
              </ul>
            </div>
            <div className="editorial-card p-5">
              <SectionTitle>Relationship types</SectionTitle>
              <ul className="text-xs space-y-1">
                {Object.entries(insp.edgeKinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                  <li key={k} className="flex justify-between border-b border-border/40 py-0.5"><span>{k}</span><span className="text-muted-foreground">{n}</span></li>
                ))}
                {Object.keys(insp.edgeKinds).length === 0 && <li className="text-muted-foreground">No relationships.</li>}
              </ul>
            </div>
            <div className="editorial-card p-5">
              <SectionTitle>Neighbor kinds</SectionTitle>
              <ul className="text-xs space-y-1">
                {Object.entries(insp.neighborKinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                  <li key={k} className="flex justify-between border-b border-border/40 py-0.5"><span>{k}</span><span className="text-muted-foreground">{n}</span></li>
                ))}
              </ul>
            </div>
            <div className="editorial-card p-5 text-xs">
              <SectionTitle>Asset facts</SectionTitle>
              <dl className="grid grid-cols-2 gap-y-1">
                <dt className="text-muted-foreground">ID</dt><dd className="font-mono">{asset.id}</dd>
                <dt className="text-muted-foreground">Owner</dt><dd>{asset.owner || "—"}</dd>
                <dt className="text-muted-foreground">Status</dt><dd>{String(asset.status)}</dd>
                <dt className="text-muted-foreground">Stage</dt><dd>{asset.stage ?? "—"}</dd>
                <dt className="text-muted-foreground">Updated</dt><dd>{asset.updatedAt?.slice(0, 10) ?? "—"}</dd>
              </dl>
              <div className="mt-3"><Link to="/knowledge" className="underline">← Back to Knowledge</Link></div>
            </div>
          </aside>
        </div>
      </PageBody>
    </>
  );
}

function RelationList({
  list, kindFor, labelFor, otherKey,
}: {
  list: { from: string; to: string; kind: string }[];
  kindFor: (id: string) => string;
  labelFor: (id: string) => string;
  otherKey: "from" | "to";
}) {
  if (list.length === 0) return <div className="text-sm text-muted-foreground">None.</div>;
  return (
    <ul className="text-sm divide-y divide-border max-h-96 overflow-y-auto">
      {list.map((e, i) => {
        const other = e[otherKey];
        return (
          <li key={i} className="py-1.5 flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-widest text-gold w-24 shrink-0">{e.kind}</span>
            <span className="text-[10px] uppercase text-muted-foreground w-20 shrink-0">{kindFor(other)}</span>
            <Link to="/knowledge/$id" params={{ id: other }} className="font-mono text-xs text-slate-ink hover:underline w-32 shrink-0">{other}</Link>
            <span className="truncate">{labelFor(other)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function ImpactBucket({
  title, ids, kindFor, labelFor,
}: {
  title: string; ids: string[]; kindFor: (id: string) => string; labelFor: (id: string) => string;
}) {
  return (
    <div className="border border-border rounded p-3">
      <div className="text-[10px] uppercase tracking-widest text-gold">{title}</div>
      <div className="font-serif text-xl text-heritage">{ids.length}</div>
      {ids.length > 0 && (
        <ul className="mt-1 text-xs space-y-0.5 max-h-40 overflow-y-auto">
          {ids.slice(0, 20).map(id => (
            <li key={id}>
              <Link to="/knowledge/$id" params={{ id }} className="underline text-heritage">{id}</Link>
              <span className="text-muted-foreground ml-1">· {kindFor(id)} · {labelFor(id).slice(0, 40)}</span>
            </li>
          ))}
          {ids.length > 20 && <li className="text-muted-foreground">…and {ids.length - 20} more</li>}
        </ul>
      )}
    </div>
  );
}
