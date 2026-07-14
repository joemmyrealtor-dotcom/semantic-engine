import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, SectionTitle, EmptyState } from "@/components/ui-kit";
import { useSnapshot } from "@/lib/use-snapshot";
import { buildGraph, detectBrokenReferences } from "@/lib/data/service";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/graph")({
  head: () => ({ meta: [{ title: "Relationship Graph — Legacy Platform" }] }),
  component: GraphPage,
});

function GraphPage() {
  const s = useSnapshot();
  const [focus, setFocus] = useState<string>("");
  const [q, setQ] = useState("");
  const graph = useMemo(() => (s ? buildGraph(s) : { nodes: [], edges: [] }), [s]);
  const broken = useMemo(() => (s ? detectBrokenReferences(s) : []), [s]);
  if (!s) return <LoadingState />;

  const filtered = graph.nodes.filter(n => !q || n.id.toLowerCase().includes(q.toLowerCase()) || n.label.toLowerCase().includes(q.toLowerCase()));

  const focusNode = focus ? graph.nodes.find(n => n.id === focus) : null;
  const upstream = focus ? graph.edges.filter(e => e.from === focus) : [];
  const downstream = focus ? graph.edges.filter(e => e.to === focus) : [];

  return (
    <>
      <PageHeader eyebrow="Relationships" title="Relationship Graph" description="Upstream dependencies, downstream impact, and broken references across the repository."
        actions={<Input placeholder="Focus on ID…" value={q} onChange={e => setQ(e.target.value)} className="w-56" />} />
      <PageBody>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 editorial-card p-5">
            <SectionTitle hint={`${filtered.length} nodes`}>Nodes</SectionTitle>
            <div className="max-h-[520px] overflow-y-auto divide-y divide-border">
              {filtered.map(n => (
                <button key={n.id} onClick={() => setFocus(n.id)}
                  className={`w-full text-left py-2 px-2 rounded flex items-center gap-3 text-sm hover:bg-accent ${focus === n.id ? "bg-accent" : ""}`}>
                  <span className="font-mono text-xs text-slate-ink w-28 shrink-0">{n.id}</span>
                  <span className="text-[10px] uppercase tracking-widest text-gold w-24 shrink-0">{n.kind}</span>
                  <span className="truncate">{n.label}</span>
                </button>
              ))}
            </div>
          </div>
          <aside className="space-y-4">
            <div className="editorial-card p-5">
              <SectionTitle>Focus</SectionTitle>
              {!focusNode ? <div className="text-sm text-muted-foreground">Select a node to see upstream and downstream relations.</div> : (
                <>
                  <div className="mb-3">
                    <div className="font-mono text-xs text-slate-ink">{focusNode.id}</div>
                    <div className="font-serif text-lg text-heritage">{focusNode.label}</div>
                    <div className="text-[10px] uppercase tracking-widest text-gold">{focusNode.kind}</div>
                  </div>
                  <div className="text-xs uppercase text-slate-ink mb-1">Outbound ({upstream.length})</div>
                  <ul className="text-sm mb-3">{upstream.map((e, i) => <li key={i}>· {e.kind} → <button className="underline" onClick={() => setFocus(e.to)}>{e.to}</button></li>)}</ul>
                  <div className="text-xs uppercase text-slate-ink mb-1">Inbound ({downstream.length})</div>
                  <ul className="text-sm">{downstream.map((e, i) => <li key={i}>· <button className="underline" onClick={() => setFocus(e.from)}>{e.from}</button> ({e.kind})</li>)}</ul>
                </>
              )}
            </div>
            <div className="editorial-card p-5">
              <SectionTitle hint={`${broken.length} broken`}>Broken references</SectionTitle>
              {broken.length === 0 ? <div className="text-sm text-evergreen">All references resolve.</div> : (
                <ul className="text-sm space-y-1">
                  {broken.map((b, i) => <li key={i} className="text-destructive">· {b.source} → {b.targetId} <span className="text-muted-foreground">({b.kind})</span></li>)}
                </ul>
              )}
            </div>
            <div className="editorial-card p-5 text-sm">
              <SectionTitle>Legend</SectionTitle>
              <ul className="text-xs space-y-1">
                <li>· Domain, Concept, Framework, Knowledge, Client Tool, Publication</li>
                <li>· Focus a node to trace <em>governs, from-concept, used-in,</em> and other edges.</li>
              </ul>
              <div className="mt-3 text-xs"><Link to="/repository" className="underline">Open repository →</Link></div>
            </div>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
