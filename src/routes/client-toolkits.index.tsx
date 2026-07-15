import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, StatusBadge, EmptyState, SectionTitle, KpiCard } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  PUBLICATION_STAGES, CLIENT_TOOLKIT_TYPES, CLIENT_SEGMENTS,
  type ClientToolkit,
} from "@/lib/data/schema";
import { nextClientToolkitId, duplicateClientToolkit, toolkitCoverage } from "@/lib/data/service";
import { PublicationStageBadge } from "@/components/publication-stage-badge";
import { CoverageBar } from "@/routes/publications.index";
import { Archive, Copy, Plus, Trash2, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/client-toolkits/")({
  head: () => ({ meta: [{ title: "Client Toolkits — Legacy Forge" }] }),
  component: ClientToolkitRegistryPage,
});

const ALL = "__all__";

function ClientToolkitRegistryPage() {
  const s = useSnapshot();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>(ALL);
  const [segment, setSegment] = useState<string>(ALL);
  const [showArchived, setShowArchived] = useState(false);

  const rows = useMemo(() => {
    if (!s) return [];
    return s.clientToolkits
      .filter(t => showArchived ? true : !t.archived)
      .filter(t => stage === ALL || t.manufacturingStage === stage)
      .filter(t => segment === ALL || t.clientSegment === segment)
      .filter(t => {
        if (!q) return true;
        const hay = `${t.id} ${t.title} ${t.audience} ${t.tags.join(" ")}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
      .map(t => ({ t, cov: toolkitCoverage(t, s) }))
      .sort((a, b) => b.t.updatedAt.localeCompare(a.t.updatedAt));
  }, [s, q, stage, segment, showArchived]);

  if (!s) return <LoadingState />;

  const counts = PUBLICATION_STAGES.reduce<Record<string, number>>((acc, st) => {
    acc[st] = s.clientToolkits.filter(t => !t.archived && t.manufacturingStage === st).length;
    return acc;
  }, {});

  const create = async () => {
    const id = nextClientToolkitId(s);
    const now = new Date().toISOString();
    const tk: ClientToolkit = {
      id, title: "Untitled Client Toolkit",
      description: "", purpose: "", audience: "",
      toolkitType: "Advisor Toolkit", clientSegment: "Advisor",
      owner: "Editorial Board", steward: "Editorial Board",
      tags: [], version: "0.1.0", status: "Draft",
      manufacturingStage: "Draft",
      stageHistory: [{ stage: "Draft", at: now, actor: "Editorial Board", note: "Created." }],
      effectiveDate: null, reviewDate: null, archived: false,
      sections: [],
      conceptIds: [], frameworkIds: [], knowledgeObjectIds: [], clientToolIds: [], publicationIds: [],
      presentations: [],
      deliveryContext: "", usageGuidance: "", facilitatorNotes: "", customizationNotes: "",
      releaseIds: [], provenanceNotes: "",
      createdAt: now, updatedAt: now,
    };
    await Repo.create("clientToolkits", tk);
    toast.success(`Created ${id}`);
    navigate({ to: "/client-toolkits/$id", params: { id } });
  };

  const duplicate = async (t: ClientToolkit) => {
    const id = nextClientToolkitId(s);
    await Repo.create("clientToolkits", duplicateClientToolkit(t, id, s));
    toast.success(`Duplicated as ${id}`);
  };

  const archive = async (t: ClientToolkit) => {
    await Repo.update("clientToolkits", t.id, { archived: !t.archived });
    toast.success(t.archived ? `${t.id} unarchived` : `${t.id} archived`);
  };

  const remove = async (t: ClientToolkit) => {
    if (!confirm(`Delete ${t.id} permanently?`)) return;
    await Repo.remove("clientToolkits", t.id);
    toast.success(`${t.id} deleted`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Client Toolkit Manufacturing"
        title="Client Toolkits"
        description="Curated advisor and client-facing collections assembled from canonical assets."
        actions={<Button onClick={create}><Plus className="size-4 mr-1" />New Toolkit</Button>}
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
          {PUBLICATION_STAGES.map(st => (
            <KpiCard key={st} label={st} value={counts[st] ?? 0} />
          ))}
        </div>

        <div className="editorial-card p-4 mb-4 grid md:grid-cols-4 gap-3">
          <Input placeholder="Search title, audience, tag, ID…" value={q} onChange={e => setQ(e.target.value)} />
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All stages</SelectItem>
              {PUBLICATION_STAGES.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={segment} onValueChange={setSegment}>
            <SelectTrigger><SelectValue placeholder="Segment" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All segments</SelectItem>
              {CLIENT_SEGMENTS.map(seg => <SelectItem key={seg} value={seg}>{seg}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(showArchived)} onValueChange={v => setShowArchived(v === "true")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="false">Hide archived</SelectItem>
              <SelectItem value="true">Show archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <SectionTitle>Toolkit registry</SectionTitle>
        {rows.length === 0 ? (
          <EmptyState title="No toolkits match" description="Adjust filters or create a new toolkit." action={<Button onClick={create}>New Toolkit</Button>} />
        ) : (
          <div className="editorial-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-slate-ink">
                <tr>
                  <th className="text-left px-3 py-2 w-24">ID</th>
                  <th className="text-left px-3 py-2">Title</th>
                  <th className="text-left px-3 py-2 w-32">Type</th>
                  <th className="text-left px-3 py-2 w-28">Segment</th>
                  <th className="text-left px-3 py-2 w-24">Status</th>
                  <th className="text-left px-3 py-2 w-28">Stage</th>
                  <th className="text-left px-3 py-2 w-16">Sections</th>
                  <th className="text-left px-3 py-2 w-28">Coverage</th>
                  <th className="text-left px-3 py-2 w-16">Ready</th>
                  <th className="w-32 px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ t, cov }) => (
                  <tr key={t.id} className={`border-t border-border hover:bg-accent/40 ${t.archived ? "opacity-60" : ""}`}>
                    <td className="px-3 py-2 font-mono text-xs text-heritage"><Link to="/client-toolkits/$id" params={{ id: t.id }} className="underline">{t.id}</Link></td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-md">{t.audience}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">{t.toolkitType}</td>
                    <td className="px-3 py-2 text-xs">{t.clientSegment}</td>
                    <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
                    <td className="px-3 py-2"><PublicationStageBadge stage={t.manufacturingStage} /></td>
                    <td className="px-3 py-2 text-xs tabular-nums">{t.sections.length}</td>
                    <td className="px-3 py-2 text-xs"><CoverageBar percent={cov.coveragePercent} /></td>
                    <td className={`px-3 py-2 text-xs font-medium ${cov.readinessScore >= 85 ? "text-evergreen" : cov.readinessScore >= 60 ? "text-gold" : "text-destructive"}`}>{cov.readinessScore}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link to="/client-toolkits/$id" params={{ id: t.id }}><Button size="icon" variant="ghost" title="Open"><ExternalLink className="size-4" /></Button></Link>
                        <Button size="icon" variant="ghost" title="Duplicate" onClick={() => duplicate(t)}><Copy className="size-4" /></Button>
                        <Button size="icon" variant="ghost" title={t.archived ? "Unarchive" : "Archive"} onClick={() => archive(t)}><Archive className="size-4" /></Button>
                        <Button size="icon" variant="ghost" title="Delete" onClick={() => remove(t)}><Trash2 className="size-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageBody>
    </>
  );
}

void CLIENT_TOOLKIT_TYPES;
