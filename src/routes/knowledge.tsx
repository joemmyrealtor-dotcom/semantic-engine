import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, SectionTitle, KpiCard, EmptyState } from "@/components/ui-kit";
import { useSnapshot } from "@/lib/use-snapshot";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildUniversalIndex, universalSearch, knowledgeHealth,
  detectDuplicates, validateDependencies, groupByKind, timelineOrdered,
  type UniversalAsset, type UniversalKind, type ExplorerView,
} from "@/lib/data/intelligence";

export const Route = createFileRoute("/knowledge")({
  head: () => ({ meta: [{ title: "Knowledge Intelligence — Legacy Platform" }] }),
  component: KnowledgePage,
});

const ALL_KINDS: UniversalKind[] = [
  "Concept","Framework","Knowledge Object","Publication","Chapter",
  "Client Toolkit","AI Pack","Agent","Automation","Release",
  "Evaluation","Presentation","Client Tool","Prompt","Domain",
];

type Tab = "registry" | "search" | "health" | "duplicates" | "dependencies" | "explorer";

const RECENT_KEY = "lf.knowledge.recent";
const SAVED_KEY = "lf.knowledge.saved";

function KnowledgePage() {
  const s = useSnapshot();
  const [tab, setTab] = useState<Tab>("registry");

  if (!s) return <LoadingState />;
  const index = buildUniversalIndex(s);

  return (
    <>
      <PageHeader
        eyebrow="Knowledge Intelligence"
        title="Knowledge"
        description="Understand, analyze, and evaluate every canonical asset across the manufacturing platform."
      />
      <PageBody>
        <div className="flex flex-wrap gap-1 mb-4 border-b border-border">
          {(["registry","search","health","duplicates","dependencies","explorer"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm capitalize border-b-2 -mb-px transition-colors ${
                tab === t ? "border-gold text-heritage font-medium" : "border-transparent text-muted-foreground hover:text-heritage"
              }`}
            >{t}</button>
          ))}
        </div>

        {tab === "registry" && <Registry index={index} />}
        {tab === "search" && <SearchTab index={index} />}
        {tab === "health" && <HealthTab />}
        {tab === "duplicates" && <DuplicatesTab />}
        {tab === "dependencies" && <DependenciesTab />}
        {tab === "explorer" && <ExplorerTab index={index} />}
      </PageBody>
    </>
  );
}

/* -------------------- Registry -------------------- */

interface SavedView { name: string; kinds: UniversalKind[]; owner: string; status: string; stage: string; sort: string }

function useSavedViews() {
  const [views, setViews] = useState<SavedView[]>([]);
  useEffect(() => {
    try { setViews(JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]")); } catch { setViews([]); }
  }, []);
  const save = (v: SavedView) => {
    const next = [...views.filter(x => x.name !== v.name), v];
    setViews(next); localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  };
  const remove = (name: string) => {
    const next = views.filter(x => x.name !== name);
    setViews(next); localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  };
  return { views, save, remove };
}

function Registry({ index }: { index: UniversalAsset[] }) {
  const [q, setQ] = useState("");
  const [kinds, setKinds] = useState<Set<UniversalKind>>(new Set(ALL_KINDS));
  const [owner, setOwner] = useState("all");
  const [status, setStatus] = useState("all");
  const [stage, setStage] = useState("all");
  const [sort, setSort] = useState<"updated" | "title" | "id">("updated");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { views, save, remove } = useSavedViews();

  const owners = useMemo(() => Array.from(new Set(index.map(a => a.owner).filter(Boolean))).sort(), [index]);
  const statuses = useMemo(() => Array.from(new Set(index.map(a => String(a.status)).filter(Boolean))).sort(), [index]);
  const stages = useMemo(() => Array.from(new Set(index.map(a => a.stage).filter(Boolean) as string[])).sort(), [index]);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    let out = index.filter(a =>
      kinds.has(a.kind) &&
      (owner === "all" || a.owner === owner) &&
      (status === "all" || String(a.status) === status) &&
      (stage === "all" || a.stage === stage) &&
      (!ql || a.haystack.includes(ql))
    );
    if (sort === "updated") out = out.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    else if (sort === "title") out = out.sort((a, b) => a.title.localeCompare(b.title));
    else out = out.sort((a, b) => a.id.localeCompare(b.id));
    return out;
  }, [index, q, kinds, owner, status, stage, sort]);

  const toggleKind = (k: UniversalKind) => setKinds(prev => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  const applyView = (v: SavedView) => {
    setKinds(new Set(v.kinds));
    setOwner(v.owner); setStatus(v.status); setStage(v.stage);
    setSort(v.sort as "updated" | "title" | "id");
  };

  return (
    <>
      <div className="editorial-card p-4 mb-4 flex flex-wrap gap-3 items-center text-xs">
        <Input placeholder="Filter…" value={q} onChange={e => setQ(e.target.value)} className="w-56 h-8" />
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Owner" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All owners</SelectItem>{owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem>{statuses.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All stages</SelectItem>{stages.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sort} onValueChange={v => setSort(v as "updated" | "title" | "id")}>
          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Last updated</SelectItem>
            <SelectItem value="title">Title</SelectItem>
            <SelectItem value="id">ID</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-muted-foreground">{filtered.length} of {index.length}</span>
      </div>

      <div className="editorial-card p-3 mb-4 flex flex-wrap gap-2 text-[11px]">
        <span className="uppercase tracking-widest text-slate-ink self-center mr-1">Kinds</span>
        {ALL_KINDS.map(k => (
          <label key={k} className="inline-flex items-center gap-1 cursor-pointer">
            <Checkbox checked={kinds.has(k)} onCheckedChange={() => toggleKind(k)} />{k}
          </label>
        ))}
      </div>

      <div className="editorial-card p-3 mb-4 flex flex-wrap gap-2 items-center text-xs">
        <span className="uppercase tracking-widest text-slate-ink">Saved views</span>
        {views.map(v => (
          <span key={v.name} className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5">
            <button className="underline" onClick={() => applyView(v)}>{v.name}</button>
            <button className="text-destructive" onClick={() => remove(v.name)}>×</button>
          </span>
        ))}
        <Button size="sm" variant="outline" onClick={() => {
          const name = prompt("Name this view");
          if (!name) return;
          save({ name, kinds: [...kinds], owner, status, stage, sort });
        }}>Save current view</Button>
        {selected.size > 0 && (
          <span className="ml-auto flex items-center gap-2 text-heritage">
            {selected.size} selected
            <Button size="sm" variant="outline" onClick={() => {
              const rows = [...selected].map(id => index.find(a => a.id === id)).filter(Boolean) as UniversalAsset[];
              const csv = ["id,kind,title,owner,status,stage,updatedAt", ...rows.map(r => [r.id, r.kind, JSON.stringify(r.title), r.owner, r.status, r.stage ?? "", r.updatedAt].join(","))].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "knowledge-selection.csv"; a.click();
            }}>Export CSV</Button>
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>Clear</Button>
          </span>
        )}
      </div>

      <div className="editorial-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-slate-ink border-b border-border">
                <th className="px-3 py-2 w-8"></th>
                <th className="px-3 py-2 w-32">ID</th>
                <th className="px-3 py-2 w-32">Kind</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2 w-40">Owner</th>
                <th className="px-3 py-2 w-28">Status</th>
                <th className="px-3 py-2 w-32">Stage</th>
                <th className="px-3 py-2 w-32">Updated</th>
                <th className="px-3 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map(a => (
                <tr key={a.id} className="border-b border-border/60 hover:bg-accent/40">
                  <td className="px-3 py-2"><Checkbox checked={selected.has(a.id)} onCheckedChange={() => {
                    setSelected(prev => { const n = new Set(prev); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; });
                  }} /></td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-ink">{a.id}</td>
                  <td className="px-3 py-2 text-[10px] uppercase tracking-widest text-gold">{a.kind}</td>
                  <td className="px-3 py-2">
                    <Link to="/knowledge/$id" params={{ id: a.id }} className="text-heritage hover:underline">{a.title}</Link>
                  </td>
                  <td className="px-3 py-2 text-xs">{a.owner}</td>
                  <td className="px-3 py-2 text-xs">{String(a.status)}</td>
                  <td className="px-3 py-2 text-xs">{a.stage ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{a.updatedAt?.slice(0, 10) ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {a.routeTo && a.routeParams && (
                      <Link to={a.routeTo as string} params={a.routeParams as never} className="text-heritage underline">Open</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No assets match the current filters.</div>}
          {filtered.length > 500 && <div className="p-2 text-center text-xs text-muted-foreground">Showing first 500 of {filtered.length}. Refine filters to see more.</div>}
        </div>
      </div>
    </>
  );
}

/* -------------------- Search -------------------- */

function SearchTab({ index }: { index: UniversalAsset[] }) {
  const [q, setQ] = useState("");
  const [kinds, setKinds] = useState<Set<UniversalKind>>(new Set(ALL_KINDS));
  const [recent, setRecent] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")); } catch { /* empty */ }
    try { setSaved(JSON.parse(localStorage.getItem(RECENT_KEY + ".saved") ?? "[]")); } catch { /* empty */ }
  }, []);

  const results = useMemo(() =>
    universalSearch(index, q, { kinds: [...kinds], limit: 200 }), [index, q, kinds]);

  const runSearch = (term: string) => {
    setQ(term);
    const next = [term, ...recent.filter(x => x !== term)].slice(0, 8);
    setRecent(next); localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  const toggleKind = (k: UniversalKind) => setKinds(prev => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  const highlight = (text: string) => {
    if (!q.trim()) return text;
    const term = q.trim().split(/\s+/)[0];
    const idx = text.toLowerCase().indexOf(term.toLowerCase());
    if (idx < 0) return text;
    return (
      <>{text.slice(0, idx)}<mark className="bg-gold/40 text-heritage">{text.slice(idx, idx + term.length)}</mark>{text.slice(idx + term.length)}</>
    );
  };

  return (
    <div className="grid lg:grid-cols-4 gap-4">
      <aside className="lg:col-span-1 space-y-4">
        <div className="editorial-card p-4">
          <SectionTitle>Search</SectionTitle>
          <Input placeholder="Search everything…" autoFocus value={q}
            onChange={e => setQ(e.target.value)}
            onBlur={() => q && runSearch(q)}
            onKeyDown={e => { if (e.key === "Enter") runSearch(q); }} />
        </div>
        <div className="editorial-card p-4">
          <SectionTitle>Kinds</SectionTitle>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {ALL_KINDS.map(k => (
              <label key={k} className="inline-flex items-center gap-1 cursor-pointer">
                <Checkbox checked={kinds.has(k)} onCheckedChange={() => toggleKind(k)} />{k}
              </label>
            ))}
          </div>
        </div>
        <div className="editorial-card p-4">
          <SectionTitle hint={`${recent.length}`}>Recent</SectionTitle>
          <ul className="text-sm space-y-1">
            {recent.map(t => <li key={t}><button className="underline" onClick={() => setQ(t)}>{t}</button></li>)}
            {recent.length === 0 && <li className="text-muted-foreground text-xs">No recent searches.</li>}
          </ul>
        </div>
        <div className="editorial-card p-4">
          <SectionTitle hint={`${saved.length}`}>Saved</SectionTitle>
          <ul className="text-sm space-y-1">
            {saved.map(t => <li key={t}>
              <button className="underline" onClick={() => setQ(t)}>{t}</button>
              <button className="ml-2 text-destructive text-xs" onClick={() => {
                const next = saved.filter(x => x !== t); setSaved(next);
                localStorage.setItem(RECENT_KEY + ".saved", JSON.stringify(next));
              }}>×</button>
            </li>)}
            {saved.length === 0 && <li className="text-muted-foreground text-xs">No saved searches.</li>}
          </ul>
          {q && !saved.includes(q) && (
            <Button size="sm" variant="outline" className="mt-2" onClick={() => {
              const next = [q, ...saved].slice(0, 12);
              setSaved(next); localStorage.setItem(RECENT_KEY + ".saved", JSON.stringify(next));
            }}>Save "{q}"</Button>
          )}
        </div>
      </aside>

      <div className="lg:col-span-3 editorial-card p-4">
        <SectionTitle hint={`${results.length} result${results.length === 1 ? "" : "s"}`}>Results</SectionTitle>
        {!q && <div className="text-sm text-muted-foreground">Type a query to search titles, descriptions, prompts, specs, evaluations, tags, and content.</div>}
        <ul className="divide-y divide-border">
          {results.map(hit => (
            <li key={hit.asset.id} className="py-3">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs text-slate-ink w-32 shrink-0">{hit.asset.id}</span>
                <span className="text-[10px] uppercase tracking-widest text-gold w-28 shrink-0">{hit.asset.kind}</span>
                <Link to="/knowledge/$id" params={{ id: hit.asset.id }} className="text-heritage font-medium hover:underline flex-1 truncate">
                  {highlight(hit.asset.title)}
                </Link>
                <span className="text-[10px] tracking-widest uppercase text-muted-foreground shrink-0">score {hit.score}</span>
              </div>
              {hit.highlight && <div className="text-xs text-slate-ink/80 mt-1 pl-[calc(8rem+7rem)]">{hit.highlight}</div>}
              {hit.matchedFields.length > 0 && (
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 pl-[calc(8rem+7rem)]">
                  Matched: {hit.matchedFields.join(", ")}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* -------------------- Health -------------------- */

function HealthTab() {
  const s = useSnapshot();
  if (!s) return <LoadingState />;
  const h = knowledgeHealth(s);
  return (
    <>
      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Overall Health" value={`${h.overall}`} hint={h.overall >= 85 ? "Healthy" : h.overall >= 60 ? "Watch" : "Attention"} tone={h.overall >= 85 ? "evergreen" : h.overall >= 60 ? "gold" : "warn"} />
        <KpiCard label="Coverage" value={`${h.coverage}%`} />
        <KpiCard label="Freshness" value={`${h.freshness}%`} tone={h.freshness < 60 ? "warn" : "default"} />
        <KpiCard label="Broken References" value={h.brokenReferences} tone={h.brokenReferences ? "warn" : "default"} />
        <KpiCard label="Duplicate References" value={h.duplicateReferences} tone={h.duplicateReferences ? "gold" : "default"} />
        <KpiCard label="Review Completion" value={`${h.reviewStatus}%`} />
        <KpiCard label="Documentation" value={`${h.documentation}%`} />
        <KpiCard label="Validation" value={`${h.validation}%`} />
        <KpiCard label="Evaluation Coverage" value={`${h.evaluationCoverage}%`} />
        <KpiCard label="Automation Coverage" value={`${h.automationCoverage}%`} />
        <KpiCard label="Relationship Completeness" value={`${h.relationshipCompleteness}%`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="editorial-card p-5">
          <SectionTitle>Breakdown</SectionTitle>
          <ul className="text-sm space-y-2">
            {Object.entries(h.breakdown).map(([k, v]) => (
              <li key={k}>
                <div className="flex justify-between text-xs mb-1"><span className="capitalize">{k.replace(/([A-Z])/g, " $1")}</span><span>{v}%</span></div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-gold" style={{ width: `${v}%` }} /></div>
              </li>
            ))}
          </ul>
        </div>
        <div className="editorial-card p-5">
          <SectionTitle>Recommendations</SectionTitle>
          <ul className="text-sm space-y-2 list-disc pl-5">
            {h.recommendations.map(r => <li key={r}>{r}</li>)}
          </ul>
        </div>
      </div>
    </>
  );
}

/* -------------------- Duplicates -------------------- */

function DuplicatesTab() {
  const s = useSnapshot();
  const navigate = useNavigate();
  if (!s) return <LoadingState />;
  const dupes = detectDuplicates(s);
  const grouped = dupes.reduce<Record<string, typeof dupes>>((acc, d) => {
    (acc[d.kind] ??= []).push(d); return acc;
  }, {});

  return (
    <>
      <div className="editorial-card p-5 mb-4">
        <SectionTitle hint={`${dupes.length} candidate pair${dupes.length === 1 ? "" : "s"}`}>Duplicate Detection</SectionTitle>
        <p className="text-sm text-muted-foreground">Compares titles and body content across each asset type. Confidence ≥ 85 usually indicates a true duplicate. Merge intent is recorded via the notes field on the surviving asset — no destructive mutation runs automatically.</p>
      </div>
      {dupes.length === 0 && <EmptyState title="No duplicate candidates" description="No pair crossed the similarity threshold." />}
      {Object.entries(grouped).map(([kind, list]) => (
        <div key={kind} className="editorial-card p-5 mb-4">
          <SectionTitle hint={`${list.length}`}>{kind}</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[10px] uppercase tracking-widest text-slate-ink border-b border-border">
                <th className="py-2 pr-3">Asset A</th><th className="pr-3">Asset B</th><th className="pr-3">Confidence</th><th className="pr-3">Signals</th><th></th>
              </tr></thead>
              <tbody>
                {list.slice(0, 40).map((d, i) => (
                  <tr key={i} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-3">
                      <button className="text-heritage underline text-left" onClick={() => navigate({ to: "/knowledge/$id", params: { id: d.a.id } })}>
                        <span className="font-mono text-xs text-slate-ink">{d.a.id}</span> {d.a.title}
                      </button>
                    </td>
                    <td className="pr-3">
                      <button className="text-heritage underline text-left" onClick={() => navigate({ to: "/knowledge/$id", params: { id: d.b.id } })}>
                        <span className="font-mono text-xs text-slate-ink">{d.b.id}</span> {d.b.title}
                      </button>
                    </td>
                    <td className={`pr-3 font-medium ${d.confidence >= 85 ? "text-destructive" : d.confidence >= 70 ? "text-gold" : "text-slate-ink"}`}>{d.confidence}%</td>
                    <td className="pr-3 text-xs text-muted-foreground">{d.reasons.join(" · ")}</td>
                    <td className="pr-3 text-xs">
                      <span className="text-muted-foreground italic">Review both, then deprecate the loser.</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length > 40 && <div className="p-2 text-center text-xs text-muted-foreground">Showing first 40 of {list.length}.</div>}
          </div>
        </div>
      ))}
    </>
  );
}

/* -------------------- Dependencies -------------------- */

function DependenciesTab() {
  const s = useSnapshot();
  if (!s) return <LoadingState />;
  const findings = validateDependencies(s);
  const grouped = findings.reduce<Record<string, typeof findings>>((acc, f) => {
    (acc[f.kind] ??= []).push(f); return acc;
  }, {});
  const counts = {
    error: findings.filter(f => f.severity === "error").length,
    warn: findings.filter(f => f.severity === "warn").length,
    info: findings.filter(f => f.severity === "info").length,
  };

  return (
    <>
      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Errors" value={counts.error} tone={counts.error ? "warn" : "default"} />
        <KpiCard label="Warnings" value={counts.warn} tone={counts.warn ? "gold" : "default"} />
        <KpiCard label="Info" value={counts.info} />
        <KpiCard label="Total Findings" value={findings.length} />
      </div>
      {findings.length === 0 && <EmptyState title="Dependencies healthy" description="No broken links, cycles, orphans, or unapproved dependencies detected." />}
      {Object.entries(grouped).map(([kind, list]) => (
        <div key={kind} className="editorial-card p-5 mb-4">
          <SectionTitle hint={`${list.length}`}>{kind.replace(/-/g, " ")}</SectionTitle>
          <ul className="divide-y divide-border">
            {list.slice(0, 100).map((f, i) => (
              <li key={i} className="py-2.5 text-sm">
                <div className="flex items-baseline gap-2">
                  <span className={`text-[10px] uppercase tracking-widest ${f.severity === "error" ? "text-destructive" : f.severity === "warn" ? "text-gold" : "text-muted-foreground"}`}>{f.severity}</span>
                  <Link to="/knowledge/$id" params={{ id: f.source }} className="font-mono text-xs underline text-heritage">{f.source}</Link>
                  {f.target && <><span className="text-muted-foreground">→</span><Link to="/knowledge/$id" params={{ id: f.target }} className="font-mono text-xs underline text-heritage">{f.target}</Link></>}
                </div>
                <div className="text-sm mt-1">{f.message}</div>
                <div className="text-xs text-muted-foreground italic mt-0.5">Remediation: {f.remediation}</div>
              </li>
            ))}
            {list.length > 100 && <li className="text-xs text-muted-foreground py-2">Showing first 100 of {list.length}.</li>}
          </ul>
        </div>
      ))}
    </>
  );
}

/* -------------------- Explorer -------------------- */

function ExplorerTab({ index }: { index: UniversalAsset[] }) {
  const [view, setView] = useState<ExplorerView>("cards");
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [compare, setCompare] = useState<Set<string>>(new Set());

  const togglePin = (id: string) => setPinned(prev => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });
  const toggleCompare = (id: string) => setCompare(prev => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else if (n.size < 4) n.add(id); return n;
  });

  return (
    <>
      <div className="editorial-card p-3 mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="uppercase tracking-widest text-slate-ink">View</span>
        {(["cards","table","tree","timeline","graph"] as ExplorerView[]).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-2 py-1 rounded border text-xs capitalize ${view === v ? "border-gold bg-gold/10 text-heritage" : "border-border text-muted-foreground"}`}>{v}</button>
        ))}
        <span className="ml-auto text-muted-foreground">{pinned.size} pinned · {compare.size} compare</span>
        {compare.size > 0 && <Button size="sm" variant="outline" onClick={() => setCompare(new Set())}>Clear compare</Button>}
      </div>

      {view === "cards" && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {index.slice(0, 60).map(a => (
            <div key={a.id} className={`editorial-card p-4 ${pinned.has(a.id) ? "border-gold" : ""}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] uppercase tracking-widest text-gold">{a.kind}</div>
                <div className="flex gap-1">
                  <button className="text-[10px] uppercase text-slate-ink hover:text-heritage" onClick={() => togglePin(a.id)}>{pinned.has(a.id) ? "Unpin" : "Pin"}</button>
                  <button className="text-[10px] uppercase text-slate-ink hover:text-heritage" onClick={() => toggleCompare(a.id)}>{compare.has(a.id) ? "×" : "Compare"}</button>
                </div>
              </div>
              <div className="font-mono text-[10px] text-slate-ink">{a.id}</div>
              <Link to="/knowledge/$id" params={{ id: a.id }} className="font-serif text-heritage text-base hover:underline block truncate">{a.title}</Link>
              <div className="text-xs text-muted-foreground line-clamp-3 mt-1">{a.description}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">{String(a.status)} · {a.stage ?? "—"}</div>
            </div>
          ))}
        </div>
      )}

      {view === "table" && (
        <div className="editorial-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[10px] uppercase tracking-widest text-slate-ink border-b border-border">
              <th className="px-3 py-2">ID</th><th className="px-3 py-2">Kind</th><th className="px-3 py-2">Title</th><th className="px-3 py-2">Owner</th><th className="px-3 py-2">Status</th>
            </tr></thead>
            <tbody>
              {index.slice(0, 200).map(a => (
                <tr key={a.id} className="border-b border-border/60">
                  <td className="px-3 py-1.5 font-mono text-xs">{a.id}</td>
                  <td className="px-3 py-1.5 text-xs uppercase tracking-widest text-gold">{a.kind}</td>
                  <td className="px-3 py-1.5"><Link to="/knowledge/$id" params={{ id: a.id }} className="underline">{a.title}</Link></td>
                  <td className="px-3 py-1.5 text-xs">{a.owner}</td>
                  <td className="px-3 py-1.5 text-xs">{String(a.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "tree" && (
        <div className="editorial-card p-4">
          {Object.entries(groupByKind(index)).map(([k, list]) => (
            <details key={k} open className="mb-2">
              <summary className="cursor-pointer text-sm font-medium text-heritage">{k} <span className="text-muted-foreground font-normal">({list.length})</span></summary>
              <ul className="pl-4 mt-1 text-xs">
                {list.slice(0, 50).map(a => (
                  <li key={a.id}>
                    <Link to="/knowledge/$id" params={{ id: a.id }} className="underline">{a.id}</Link> {a.title}
                  </li>
                ))}
                {list.length > 50 && <li className="text-muted-foreground">…and {list.length - 50} more</li>}
              </ul>
            </details>
          ))}
        </div>
      )}

      {view === "timeline" && (
        <div className="editorial-card p-4">
          <ul className="divide-y divide-border text-sm">
            {timelineOrdered(index).slice(0, 120).map(a => (
              <li key={a.id} className="py-2 flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24">{a.updatedAt?.slice(0, 10) ?? "—"}</span>
                <span className="text-[10px] uppercase tracking-widest text-gold w-24">{a.kind}</span>
                <span className="font-mono text-xs text-slate-ink w-32">{a.id}</span>
                <Link to="/knowledge/$id" params={{ id: a.id }} className="underline truncate">{a.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {view === "graph" && (
        <div className="editorial-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Graph view lives at <Link to="/graph" className="underline text-heritage">Relationships</Link>. Focus mode there shows inbound/outbound edges per node.</p>
        </div>
      )}

      {compare.size > 1 && (
        <div className="mt-4 editorial-card p-4">
          <SectionTitle>Compare</SectionTitle>
          <div className={`grid gap-3 grid-cols-${compare.size}`}>
            {[...compare].map(id => {
              const a = index.find(x => x.id === id);
              if (!a) return null;
              return (
                <div key={id} className="border border-border rounded p-3">
                  <div className="text-[10px] uppercase tracking-widest text-gold">{a.kind}</div>
                  <div className="font-mono text-xs text-slate-ink">{a.id}</div>
                  <div className="font-serif text-heritage">{a.title}</div>
                  <div className="text-xs text-muted-foreground mt-2 line-clamp-6">{a.description}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">
                    Owner: {a.owner} · {String(a.status)} · {a.stage ?? "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
