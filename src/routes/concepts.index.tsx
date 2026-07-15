import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, StatusBadge, EmptyState, SectionTitle } from "@/components/ui-kit";
import { useSnapshot } from "@/lib/use-snapshot";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MANUFACTURING_STATUSES, type ManufacturingStatus, type Status } from "@/lib/data/schema";

export const Route = createFileRoute("/concepts/")({
  head: () => ({ meta: [{ title: "Concept Registry — Legacy Platform" }] }),
  component: ConceptRegistryPage,
});

const ALL = "__all__";

function ConceptRegistryPage() {
  const s = useSnapshot();
  const [q, setQ] = useState("");
  const [domain, setDomain] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [mfg, setMfg] = useState<string>(ALL);

  const rows = useMemo(() => {
    if (!s) return [];
    return s.concepts.filter(c => {
      if (domain !== ALL && !c.domainIds.includes(domain)) return false;
      if (status !== ALL && c.status !== status) return false;
      if (mfg !== ALL && c.manufacturingStatus !== mfg) return false;
      if (q) {
        const hay = `${c.id} ${c.canonicalName} ${c.aliases.join(" ")} ${c.keywords.join(" ")}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [s, q, domain, status, mfg]);

  if (!s) return <LoadingState />;

  const counts = MANUFACTURING_STATUSES.reduce<Record<string, number>>((acc, m) => {
    acc[m] = s.concepts.filter(c => c.manufacturingStatus === m).length;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        eyebrow="Canonical Knowledge Core"
        title="Concept Registry"
        description="Every Concept Family with its manufacturing stage and downstream traceability."
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {MANUFACTURING_STATUSES.map(m => (
            <div key={m} className="editorial-card p-4">
              <div className="text-[11px] uppercase tracking-widest text-slate-ink">{m}</div>
              <div className="font-serif text-2xl text-heritage">{counts[m] ?? 0}</div>
            </div>
          ))}
        </div>

        <div className="editorial-card p-4 mb-4 grid md:grid-cols-4 gap-3">
          <Input placeholder="Search concepts…" value={q} onChange={e => setQ(e.target.value)} />
          <Select value={domain} onValueChange={setDomain}>
            <SelectTrigger><SelectValue placeholder="Domain" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All domains</SelectItem>
              {s.domains.map(d => <SelectItem key={d.id} value={d.id}>{d.id} · {d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Lifecycle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All lifecycle</SelectItem>
              {(["Draft","In Review","Approved","Canonical","Deprecated","Archived"] as Status[]).map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={mfg} onValueChange={setMfg}>
            <SelectTrigger><SelectValue placeholder="Manufacturing" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All stages</SelectItem>
              {MANUFACTURING_STATUSES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <SectionTitle hint={`${rows.length} of ${s.concepts.length}`}>Concept Families</SectionTitle>
        {rows.length === 0 ? <EmptyState title="No concepts match" description="Adjust filters or search terms." /> : (
          <div className="editorial-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-slate-ink">
                <tr>
                  <th className="text-left px-4 py-2 w-28">ID</th>
                  <th className="text-left px-4 py-2">Concept</th>
                  <th className="text-left px-4 py-2 w-32">Lifecycle</th>
                  <th className="text-left px-4 py-2 w-32">Manufacturing</th>
                  <th className="text-left px-4 py-2 w-20">KOs</th>
                  <th className="text-left px-4 py-2 w-24">Traceability</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(c => {
                  const koCount = s.knowledgeObjects.filter(k => k.sourceConceptIds.includes(c.id)).length;
                  const trace = c.publicationLinks.length + c.clientToolkitLinks.length + c.aiPackLinks.length;
                  return (
                    <tr key={c.id} className="border-t border-border hover:bg-accent/40">
                      <td className="px-4 py-2 font-mono text-xs text-heritage">
                        <Link to="/concepts/$id" params={{ id: c.id }} className="underline">{c.id}</Link>
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-medium">{c.canonicalName}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-xl">{c.canonicalDefinition}</div>
                      </td>
                      <td className="px-4 py-2"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-2"><ManufacturingBadge stage={c.manufacturingStatus} /></td>
                      <td className="px-4 py-2 text-xs text-slate-ink">{koCount}</td>
                      <td className="px-4 py-2 text-xs text-slate-ink">{trace}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PageBody>
    </>
  );
}

export function ManufacturingBadge({ stage }: { stage: ManufacturingStatus }) {
  const map: Record<ManufacturingStatus, string> = {
    Draft: "bg-muted text-muted-foreground",
    Editorial: "bg-gold/15 text-heritage border border-gold/40",
    QA: "bg-accent text-accent-foreground border border-border",
    Canonical: "bg-heritage text-heritage-foreground",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium tracking-wide ${map[stage]}`}>{stage}</span>;
}
