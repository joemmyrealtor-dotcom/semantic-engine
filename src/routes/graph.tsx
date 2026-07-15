import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, SectionTitle } from "@/components/ui-kit";
import { useSnapshot } from "@/lib/use-snapshot";
import { buildGraph, detectBrokenReferences } from "@/lib/data/service";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/graph")({
  head: () => ({ meta: [{ title: "Relationship Graph — Legacy Platform" }] }),
  component: GraphPage,
});

const NODE_KINDS = ["Domain", "Concept", "Framework", "Knowledge", "Client Tool", "Publication", "Chapter", "Release"] as const;

// Map node kind to route.
function routeForNode(kind: string, id: string): { to: string; params?: Record<string, string> } | null {
  switch (kind) {
    case "Concept": return { to: "/concepts/$id", params: { id } };
    case "Framework": return { to: "/frameworks/$id", params: { id } };
    case "Publication": return { to: "/publications/$id", params: { id } };
    case "Release": return { to: "/releases/$id", params: { id } };
    case "Chapter": {
      // Chapter routes live inside their publication — link back to Publications registry with search.
      return { to: "/publications" };
    }
    default: return null;
  }
}

function GraphPage() {
  const s = useSnapshot();
  const navigate = useNavigate();
  const [focus, setFocus] = useState<string>("");
  const [q, setQ] = useState("");
  const [kinds, setKinds] = useState<Set<string>>(new Set(NODE_KINDS));
  const [edgeQ, setEdgeQ] = useState("");
  const [onlyBroken, setOnlyBroken] = useState(false);
  const [onlyOrphans, setOnlyOrphans] = useState(false);

  const graph = useMemo(() => (s ? buildGraph(s) : { nodes: [], edges: [] }), [s]);
  const broken = useMemo(() => (s ? detectBrokenReferences(s) : []), [s]);
  const brokenSourceIds = useMemo(() => new Set(broken.map(b => b.source)), [broken]);
  const brokenTargetIds = useMemo(() => new Set(broken.map(b => b.targetId)), [broken]);
  const connected = useMemo(() => {
    const ids = new Set<string>();
    for (const e of graph.edges) { ids.add(e.from); ids.add(e.to); }
    return ids;
  }, [graph.edges]);

  if (!s) return <LoadingState />;

  const filtered = graph.nodes.filter(n => {
    if (!kinds.has(n.kind)) return false;
    if (q && !`${n.id} ${n.label}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (onlyBroken && !brokenSourceIds.has(n.id) && !brokenTargetIds.has(n.id)) return false;
    if (onlyOrphans && connected.has(n.id)) return false;
    return true;
  });

  const focusNode = focus ? graph.nodes.find(n => n.id === focus) : null;
  const outbound = focus ? graph.edges.filter(e => e.from === focus && (!edgeQ || e.kind.includes(edgeQ))) : [];
  const inbound = focus ? graph.edges.filter(e => e.to === focus && (!edgeQ || e.kind.includes(edgeQ))) : [];

  const toggleKind = (k: string) => setKinds(prev => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });

  const openNode = (id: string, kind: string) => {
    const r = routeForNode(kind, id);
    if (r?.params) navigate({ to: r.to as string, params: r.params as never });
    else if (r) navigate({ to: r.to as string });
    else setFocus(id);
  };

  return (
    <>
      <PageHeader eyebrow="Relationships" title="Relationship Graph"
        description="Publications, chapters, concepts, frameworks, knowledge objects, client tools, and releases. Filter by kind and follow inbound / outbound edges."
        actions={<Input placeholder="Search node id or label…" value={q} onChange={e => setQ(e.target.value)} className="w-64" />} />
      <PageBody>
        <div className="editorial-card p-4 mb-4 flex flex-wrap gap-3 items-center text-xs">
          <span className="uppercase tracking-widest text-slate-ink">Node kinds</span>
          {NODE_KINDS.map(k => (
            <label key={k} className="inline-flex items-center gap-1 cursor-pointer">
              <Checkbox checked={kinds.has(k)} onCheckedChange={() => toggleKind(k)} />{k}
            </label>
          ))}
          <span className="mx-2 h-4 border-l border-border" />
          <label className="inline-flex items-center gap-1 cursor-pointer"><Checkbox checked={onlyBroken} onCheckedChange={v => setOnlyBroken(!!v)} />Only broken references</label>
          <label className="inline-flex items-center gap-1 cursor-pointer"><Checkbox checked={onlyOrphans} onCheckedChange={v => setOnlyOrphans(!!v)} />Only orphaned nodes</label>
          <span className="mx-2 h-4 border-l border-border" />
          <span className="uppercase tracking-widest text-slate-ink">Edge kind</span>
          <Input placeholder="e.g. governs, publishes-ko" value={edgeQ} onChange={e => setEdgeQ(e.target.value)} className="w-52 h-7 text-xs" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 editorial-card p-5">
            <SectionTitle hint={`${filtered.length} of ${graph.nodes.length} nodes`}>Nodes</SectionTitle>
            <div className="max-h-[560px] overflow-y-auto divide-y divide-border">
              {filtered.map(n => {
                const isBroken = brokenSourceIds.has(n.id) || brokenTargetIds.has(n.id);
                const isOrphan = !connected.has(n.id);
                const nav = routeForNode(n.kind, n.id);
                return (
                  <div key={n.id} className={`flex items-center gap-2 py-1 px-2 text-sm ${focus === n.id ? "bg-accent" : "hover:bg-accent/40"}`}>
                    <button onClick={() => setFocus(n.id)} className="flex-1 flex items-center gap-3 text-left">
                      <span className="font-mono text-xs text-slate-ink w-28 shrink-0">{n.id}</span>
                      <span className="text-[10px] uppercase tracking-widest text-gold w-24 shrink-0">{n.kind}</span>
                      <span className="truncate">{n.label}</span>
                    </button>
                    {isBroken && <span className="text-[9px] uppercase tracking-widest text-destructive">Broken</span>}
                    {isOrphan && <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Orphan</span>}
                    {nav && <button onClick={() => openNode(n.id, n.kind)} className="text-[10px] underline text-heritage">Open →</button>}
                  </div>
                );
              })}
              {filtered.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">No nodes match the current filters.</div>}
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
                    {routeForNode(focusNode.kind, focusNode.id) && (
                      <button onClick={() => openNode(focusNode.id, focusNode.kind)} className="mt-2 text-xs underline text-heritage">Open detail page →</button>
                    )}
                  </div>
                  <div className="text-xs uppercase text-slate-ink mb-1">Outbound ({outbound.length})</div>
                  <ul className="text-sm mb-3 max-h-40 overflow-y-auto">{outbound.map((e, i) => <li key={i}>· {e.kind} → <button className="underline" onClick={() => setFocus(e.to)}>{e.to}</button></li>)}</ul>
                  <div className="text-xs uppercase text-slate-ink mb-1">Inbound ({inbound.length})</div>
                  <ul className="text-sm max-h-40 overflow-y-auto">{inbound.map((e, i) => <li key={i}>· <button className="underline" onClick={() => setFocus(e.from)}>{e.from}</button> ({e.kind})</li>)}</ul>
                </>
              )}
            </div>
            <div className="editorial-card p-5">
              <SectionTitle hint={`${broken.length} broken`}>Broken references</SectionTitle>
              {broken.length === 0 ? <div className="text-sm text-evergreen">All references resolve.</div> : (
                <ul className="text-sm space-y-1 max-h-48 overflow-y-auto">
                  {broken.map((b, i) => (
                    <li key={i} className="text-destructive">· <button className="underline" onClick={() => setFocus(b.source)}>{b.source}</button> → {b.targetId} <span className="text-muted-foreground">({b.kind})</span></li>
                  ))}
                </ul>
              )}
            </div>
            <div className="editorial-card p-5 text-sm">
              <SectionTitle>Legend</SectionTitle>
              <ul className="text-xs space-y-1">
                <li>· Filter by node kind above; toggle broken or orphan views.</li>
                <li>· <span className="text-destructive">Broken</span> = node participates in an unresolved reference.</li>
                <li>· <span className="text-muted-foreground">Orphan</span> = no inbound or outbound edges.</li>
                <li>· Click <em>Open →</em> to jump to a node's detail route.</li>
              </ul>
              <div className="mt-3 text-xs"><Link to="/repository" className="underline">Open repository →</Link></div>
            </div>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
