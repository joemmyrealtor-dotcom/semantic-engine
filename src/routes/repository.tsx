import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, StatusBadge, EmptyState, SectionTitle } from "@/components/ui-kit";
import { useSnapshot } from "@/lib/use-snapshot";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { DataSnapshot } from "@/lib/data/schema";

export const Route = createFileRoute("/repository")({
  head: () => ({ meta: [{ title: "Repository Explorer — Legacy Platform" }] }),
  component: RepositoryPage,
});

type Row = { id: string; primary: string; secondary?: string; status?: string; canonical?: boolean; relations?: number; steward?: string; version?: string; detailKind: string };

function toRows(s: DataSnapshot): Record<string, Row[]> {
  return {
    domains: s.domains.map(d => ({ id: d.id, primary: d.name, secondary: d.summary, status: d.status, canonical: d.status === "Canonical", relations: s.concepts.filter(c => c.domainIds.includes(d.id)).length, steward: d.steward, version: d.version, detailKind: "domain" })),
    concepts: s.concepts.map(c => ({ id: c.id, primary: c.canonicalName, secondary: c.canonicalDefinition, status: c.status, canonical: c.status === "Canonical", relations: c.relatedConceptIds.length + c.frameworkIds.length, steward: c.steward, version: c.version, detailKind: "concept" })),
    frameworks: s.frameworks.map(f => ({ id: f.id, primary: f.name, secondary: f.mission, status: f.status, canonical: f.status === "Canonical", relations: f.governingConceptIds.length, steward: f.steward, version: f.version, detailKind: "framework" })),
    knowledgeObjects: s.knowledgeObjects.map(k => ({ id: k.id, primary: k.title, secondary: k.type, status: k.status, canonical: k.status === "Canonical", relations: k.sourceConceptIds.length + k.sourceFrameworkIds.length, steward: k.steward, version: k.version, detailKind: "ko" })),
    clientTools: s.clientTools.map(t => ({ id: t.id, primary: t.name, secondary: `${t.kind} · ${t.purpose}`, status: t.status, canonical: t.status === "Canonical", relations: t.sourceConceptIds.length + t.sourceFrameworkIds.length, steward: t.steward, version: t.version, detailKind: "tool" })),
    publications: s.publications.map(p => ({ id: p.id, primary: p.title, secondary: `${p.chapters.length} chapters · ${p.audience}`, status: p.status, canonical: p.status === "Canonical", relations: p.chapters.length, steward: p.steward, version: p.version, detailKind: "publication" })),
    prompts: s.prompts.map(p => ({ id: p.id, primary: p.name, secondary: `${p.family} · ${p.purpose}`, status: p.status, canonical: p.status === "Canonical", steward: p.steward, version: p.version, detailKind: "prompt" })),
    agents: s.agents.map(a => ({ id: a.id, primary: a.name, secondary: a.role, status: a.status, canonical: a.status === "Canonical", steward: a.steward, version: a.version, detailKind: "agent" })),
    releases: s.releases.map(r => ({ id: r.id, primary: r.name, secondary: r.releaseNotes, status: r.stage, canonical: r.stage === "Canonical", steward: r.steward, version: r.version, detailKind: "release" })),
  };
}

const TABS: { key: string; label: string }[] = [
  { key: "domains", label: "Domains" },
  { key: "concepts", label: "Concepts" },
  { key: "frameworks", label: "Frameworks" },
  { key: "knowledgeObjects", label: "Knowledge" },
  { key: "clientTools", label: "Client Tools" },
  { key: "publications", label: "Publications" },
  { key: "prompts", label: "Prompts" },
  { key: "agents", label: "Agents" },
  { key: "releases", label: "Releases" },
];

function RepositoryPage() {
  const s = useSnapshot();
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<Row | null>(null);
  const rowsByTab = useMemo(() => (s ? toRows(s) : {}), [s]);

  if (!s) return <LoadingState label="Loading repository…" />;

  return (
    <>
      <PageHeader eyebrow="Registries" title="Repository Explorer" description="Every asset has a purpose, a place, a lifecycle, and relationships." actions={
        <Input placeholder="Filter…" value={q} onChange={e => setQ(e.target.value)} className="w-56" />
      } />
      <PageBody>
        <Tabs defaultValue="concepts">
          <TabsList className="mb-4 flex flex-wrap h-auto">
            {TABS.map(t => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
          </TabsList>
          {TABS.map(t => {
            const rows = (rowsByTab[t.key] ?? []).filter(r =>
              !q || r.id.toLowerCase().includes(q.toLowerCase()) || r.primary.toLowerCase().includes(q.toLowerCase()) || (r.secondary ?? "").toLowerCase().includes(q.toLowerCase())
            );
            return (
              <TabsContent key={t.key} value={t.key} className="mt-0">
                {rows.length === 0 ? <EmptyState title="Nothing here yet" description="No matching entries. Adjust the filter or add a new asset." /> : (
                  <div className="editorial-card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/60 text-xs uppercase tracking-wider text-slate-ink">
                        <tr>
                          <th className="text-left px-4 py-2 w-32">ID</th>
                          <th className="text-left px-4 py-2">Name</th>
                          <th className="text-left px-4 py-2 w-32">Status</th>
                          <th className="text-left px-4 py-2 w-24">Version</th>
                          <th className="text-left px-4 py-2 w-24">Relations</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(r => (
                          <tr key={r.id} className="border-t border-border hover:bg-accent/50 cursor-pointer" onClick={() => setDetail(r)}>
                            <td className="px-4 py-2 font-mono text-xs text-heritage">{r.id}</td>
                            <td className="px-4 py-2">
                              <div className="font-medium">{r.primary}</div>
                              {r.secondary && <div className="text-xs text-muted-foreground truncate max-w-xl">{r.secondary}</div>}
                            </td>
                            <td className="px-4 py-2">{r.status && <StatusBadge status={r.status as never} />}</td>
                            <td className="px-4 py-2 text-xs text-slate-ink">{r.version}</td>
                            <td className="px-4 py-2 text-xs text-slate-ink">{r.relations ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </PageBody>

      <Sheet open={!!detail} onOpenChange={o => !o && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <div className="text-[10px] uppercase tracking-widest text-gold">{detail.detailKind}</div>
                <SheetTitle className="font-serif text-heritage">{detail.primary}</SheetTitle>
                <div className="font-mono text-xs text-slate-ink">{detail.id}</div>
              </SheetHeader>
              <div className="mt-4 space-y-3 text-sm">
                {detail.secondary && <p className="text-slate-ink">{detail.secondary}</p>}
                <div className="flex flex-wrap gap-2">
                  {detail.status && <StatusBadge status={detail.status as never} />}
                  <span className="text-xs text-muted-foreground">v{detail.version}</span>
                  <span className="text-xs text-muted-foreground">Steward: {detail.steward}</span>
                </div>
                <SectionTitle>Actions</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  {detail.detailKind === "concept" && <Link to="/concepts/$id" params={{ id: detail.id }} className="text-sm underline text-heritage">Open editor →</Link>}
                  {detail.detailKind === "framework" && <Link to="/frameworks/$id" params={{ id: detail.id }} className="text-sm underline text-heritage">Open workspace →</Link>}
                  {detail.detailKind === "publication" && <Link to="/publications/$id" params={{ id: detail.id }} className="text-sm underline text-heritage">Open publication →</Link>}
                  {detail.detailKind === "release" && <Link to="/releases/$id" params={{ id: detail.id }} className="text-sm underline text-heritage">Open release →</Link>}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
