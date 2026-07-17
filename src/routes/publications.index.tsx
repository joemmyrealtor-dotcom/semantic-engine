import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, StatusBadge, EmptyState, SectionTitle, KpiCard } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PUBLICATION_STAGES, PUBLICATION_TYPES, type PublicationStage, type PublicationBlueprint } from "@/lib/data/schema";
import { publicationCoverage, nextPublicationId, duplicatePublication } from "@/lib/data/service";
import { PublicationStageBadge } from "@/components/publication-stage-badge";
import { Archive, Copy, Plus, Trash2, ExternalLink, ArrowUpDown } from "lucide-react";

export const Route = createFileRoute("/publications/")({
  head: () => ({ meta: [{ title: "Publications — Manufacturing Studio" }] }),
  component: PublicationRegistryPage,
});

const ALL = "__all__";
type SortKey = "id" | "title" | "stage" | "coverage" | "updated";

function PublicationRegistryPage() {
  const s = useSnapshot();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [showArchived, setShowArchived] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const perPage = 10;

  const rows = useMemo(() => {
    if (!s) return [];
    const decorated = s.publications
      .filter(p => showArchived ? true : !p.archived)
      .filter(p => stage === ALL || p.manufacturingStage === stage)
      .filter(p => status === ALL || p.status === status)
      .filter(p => {
        if (!q) return true;
        const hay = `${p.id} ${p.title} ${p.audience} ${p.tags.join(" ")}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
      .map(p => ({ p, cov: publicationCoverage(p, s) }));

    return decorated.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "id": return dir * a.p.id.localeCompare(b.p.id);
        case "title": return dir * a.p.title.localeCompare(b.p.title);
        case "stage": return dir * PUBLICATION_STAGES.indexOf(a.p.manufacturingStage) - dir * PUBLICATION_STAGES.indexOf(b.p.manufacturingStage);
        case "coverage": return dir * (a.cov.coveragePercent - b.cov.coveragePercent);
        case "updated": return dir * a.p.updatedAt.localeCompare(b.p.updatedAt);
      }
    });
  }, [s, q, stage, status, showArchived, sortKey, sortDir]);

  if (!s) return <LoadingState />;

  const paged = rows.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));

  const counts = PUBLICATION_STAGES.reduce<Record<string, number>>((acc, st) => {
    acc[st] = s.publications.filter(p => !p.archived && p.manufacturingStage === st).length;
    return acc;
  }, {});

  const create = async () => {
    if (!s) return;
    const id = nextPublicationId(s);
    const now = new Date().toISOString();
    const p: PublicationBlueprint = {
      id, title: "Untitled Publication", audience: "", purpose: "",
      chapters: [], status: "Draft", version: "0.1.0", steward: "Editorial Board",
      description: "", frameworkId: null, tags: [], owner: "Editorial Board",
      publicationType: "Guide", effectiveDate: null, reviewDate: null,
      editorialNotes: "", reviewNotes: "",
      manufacturingStage: "Draft",
      stageHistory: [{ stage: "Draft", at: now, actor: "Editorial Board", note: "Created." }],
      archived: false, presentations: [],
      createdAt: now, updatedAt: now,
    };
    await Repo.create("publications", p);
    toast.success(`Created ${id}`);
    navigate({ to: "/publications/$id", params: { id } });
  };

  const duplicate = async (p: PublicationBlueprint) => {
    if (!s) return;
    const id = nextPublicationId(s);
    const cloned = duplicatePublication(p, id, s);
    await Repo.create("publications", cloned);
    toast.success(`Duplicated as ${id}`);
  };

  const archive = async (p: PublicationBlueprint) => {
    await Repo.update("publications", p.id, { archived: !p.archived });
    toast.success(p.archived ? `${p.id} unarchived` : `${p.id} archived`);
  };

  const remove = async (p: PublicationBlueprint) => {
    if (!confirm(`Delete ${p.id} permanently? This cannot be undone.`)) return;
    await Repo.remove("publications", p.id);
    toast.success(`${p.id} deleted`);
  };

  const setSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  return (
    <>
      <PageHeader
        eyebrow="Publication Manufacturing Studio"
        title="Publications"
        description="Every publication blueprint, its manufacturing stage, coverage health, and QA readiness."
        actions={<div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/publications/new" })}>Assemble from Concepts…</Button>
          <Button onClick={create}><Plus className="size-4 mr-1" /> Create Publication</Button>
        </div>}
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
          {PUBLICATION_STAGES.map(st => (
            <KpiCard key={st} label={st} value={counts[st] ?? 0} />
          ))}
        </div>

        <div className="editorial-card p-4 mb-4 grid md:grid-cols-5 gap-3">
          <Input placeholder="Search title, audience, tag, ID…" value={q} onChange={e => { setQ(e.target.value); setPage(0); }} />
          <Select value={stage} onValueChange={v => { setStage(v); setPage(0); }}>
            <SelectTrigger aria-label="Filter by manufacturing stage"><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All stages</SelectItem>
              {PUBLICATION_STAGES.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={v => { setStatus(v); setPage(0); }}>
            <SelectTrigger aria-label="Filter by lifecycle status"><SelectValue placeholder="Lifecycle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All lifecycle</SelectItem>
              {["Draft","In Review","Approved","Canonical","Deprecated","Archived"].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(showArchived)} onValueChange={v => setShowArchived(v === "true")}>
            <SelectTrigger aria-label="Toggle archived visibility"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="false">Hide archived</SelectItem>
              <SelectItem value="true">Show archived</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground self-center">{rows.length} of {s.publications.length}</div>
        </div>

        <SectionTitle>Blueprint registry</SectionTitle>
        {rows.length === 0 ? <EmptyState title="No publications match" description="Adjust filters or create a new blueprint." action={<Button onClick={create}>Create Publication</Button>} /> : (
          <>
            <div className="editorial-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wider text-slate-ink">
                  <tr>
                    <SortableTh label="ID" k="id" sortKey={sortKey} sortDir={sortDir} onSort={setSort} className="w-24" />
                    <SortableTh label="Title" k="title" sortKey={sortKey} sortDir={sortDir} onSort={setSort} />
                    <th className="text-left px-3 py-2 w-24">Status</th>
                    <SortableTh label="Stage" k="stage" sortKey={sortKey} sortDir={sortDir} onSort={setSort} className="w-28" />
                    <th className="text-left px-3 py-2 w-24">Framework</th>
                    <th className="text-left px-3 py-2 w-20">Version</th>
                    <SortableTh label="Coverage" k="coverage" sortKey={sortKey} sortDir={sortDir} onSort={setSort} className="w-24" />
                    <th className="text-left px-3 py-2 w-20">QA</th>
                    <SortableTh label="Updated" k="updated" sortKey={sortKey} sortDir={sortDir} onSort={setSort} className="w-28" />
                    <th className="w-32 px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(({ p, cov }) => {
                    const qaTone = cov.readinessScore >= 85 ? "text-evergreen" : cov.readinessScore >= 60 ? "text-gold" : "text-destructive";
                    return (
                      <tr key={p.id} className={`border-t border-border hover:bg-accent/40 ${p.archived ? "opacity-60" : ""}`}>
                        <td className="px-3 py-2 font-mono text-xs text-heritage"><Link to="/publications/$id" params={{ id: p.id }} className="underline">{p.id}</Link></td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{p.title}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-md">{p.audience}</div>
                        </td>
                        <td className="px-3 py-2"><StatusBadge status={p.status} /></td>
                        <td className="px-3 py-2"><PublicationStageBadge stage={p.manufacturingStage} /></td>
                        <td className="px-3 py-2 text-xs font-mono text-slate-ink">{p.frameworkId ?? "—"}</td>
                        <td className="px-3 py-2 text-xs">{p.version}</td>
                        <td className="px-3 py-2 text-xs"><CoverageBar percent={cov.coveragePercent} /></td>
                        <td className={`px-3 py-2 text-xs font-medium ${qaTone}`}>{cov.readinessScore}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{p.updatedAt.slice(0, 10)}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Link to="/publications/$id" params={{ id: p.id }}><Button size="icon" variant="ghost" title="Open"><ExternalLink className="size-4" /></Button></Link>
                            <Button size="icon" variant="ghost" title="Duplicate" onClick={() => duplicate(p)}><Copy className="size-4" /></Button>
                            <Button size="icon" variant="ghost" title={p.archived ? "Unarchive" : "Archive"} onClick={() => archive(p)}><Archive className="size-4" /></Button>
                            <Button size="icon" variant="ghost" title="Delete" onClick={() => remove(p)}><Trash2 className="size-4 text-destructive" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <div>Page {page + 1} of {totalPages}</div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
                <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>Next</Button>
              </div>
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}

function SortableTh({ label, k, sortKey, sortDir, onSort, className }: { label: string; k: SortKey; sortKey: SortKey; sortDir: "asc"|"desc"; onSort: (k: SortKey) => void; className?: string }) {
  const active = k === sortKey;
  return (
    <th className={`text-left px-3 py-2 ${className ?? ""}`}>
      <button className={`inline-flex items-center gap-1 hover:text-heritage ${active ? "text-heritage" : ""}`} onClick={() => onSort(k)}>
        {label}<ArrowUpDown className="size-3 opacity-50" />{active && <span className="text-[9px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}

export function CoverageBar({ percent }: { percent: number }) {
  const tone = percent >= 85 ? "bg-evergreen" : percent >= 60 ? "bg-gold" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden"><div className={`h-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} /></div>
      <span className="text-[11px] tabular-nums">{percent}%</span>
    </div>
  );
}

// PUBLICATION_TYPES referenced from schema to keep tree-shaking honest.
void PUBLICATION_TYPES;
// PublicationStage type kept for callers importing this module.
void ({} as PublicationStage);
