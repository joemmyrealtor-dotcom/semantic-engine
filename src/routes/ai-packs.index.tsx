import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, EmptyState, SectionTitle, KpiCard } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PUBLICATION_STAGES, AI_PACK_USE_CASES, type AIPack } from "@/lib/data/schema";
import { nextAIPackId, duplicateAIPack, aiPackCoverage } from "@/lib/data/service";
import { PublicationStageBadge } from "@/components/publication-stage-badge";
import { CoverageBar } from "@/routes/publications.index";
import { Archive, Copy, Plus, Trash2, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/ai-packs/")({
  head: () => ({ meta: [{ title: "AI Packs — Legacy Forge" }] }),
  component: AIPackRegistryPage,
});

const ALL = "__all__";

function AIPackRegistryPage() {
  const s = useSnapshot();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>(ALL);
  const [useCase, setUseCase] = useState<string>(ALL);
  const [showArchived, setShowArchived] = useState(false);

  const rows = useMemo(() => {
    if (!s) return [];
    return s.aiPacks
      .filter(a => showArchived ? true : !a.archived)
      .filter(a => stage === ALL || a.manufacturingStage === stage)
      .filter(a => useCase === ALL || a.useCase === useCase)
      .filter(a => {
        if (!q) return true;
        const hay = `${a.id} ${a.title} ${a.tags.join(" ")}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
      .map(a => ({ a, cov: aiPackCoverage(a, s) }))
      .sort((x, y) => y.a.updatedAt.localeCompare(x.a.updatedAt));
  }, [s, q, stage, useCase, showArchived]);

  if (!s) return <LoadingState />;

  const counts = PUBLICATION_STAGES.reduce<Record<string, number>>((acc, st) => {
    acc[st] = s.aiPacks.filter(a => !a.archived && a.manufacturingStage === st).length;
    return acc;
  }, {});

  const create = async () => {
    const id = nextAIPackId(s);
    const now = new Date().toISOString();
    const ap: AIPack = {
      id, title: "Untitled AI Pack", description: "", purpose: "",
      useCase: "Internal Advisor", targetModel: "",
      owner: "Editorial Board", steward: "Editorial Board",
      tags: [], version: "0.1.0",
      manufacturingStage: "Draft",
      stageHistory: [{ stage: "Draft", at: now, actor: "Editorial Board", note: "Created." }],
      effectiveDate: null, reviewDate: null, archived: false,
      conceptIds: [], frameworkIds: [], knowledgeObjectIds: [], publicationIds: [],
      clientToolkitIds: [], promptIds: [], agentIds: [],
      modules: [],
      systemInstructions: "", usagePolicy: "", boundaryConditions: "",
      prohibitedUses: "", escalationGuidance: "",
      evaluationCases: [],
      provenanceNotes: "", humanReviewCompleted: false, releaseIds: [],
      createdAt: now, updatedAt: now,
    };
    await Repo.create("aiPacks", ap);
    toast.success(`Created ${id}`);
    navigate({ to: "/ai-packs/$id", params: { id } });
  };

  const duplicate = async (a: AIPack) => {
    const id = nextAIPackId(s);
    await Repo.create("aiPacks", duplicateAIPack(a, id, s));
    toast.success(`Duplicated as ${id}`);
  };

  const archive = async (a: AIPack) => {
    await Repo.update("aiPacks", a.id, { archived: !a.archived });
    toast.success(a.archived ? `${a.id} unarchived` : `${a.id} archived`);
  };

  const remove = async (a: AIPack) => {
    if (!confirm(`Delete ${a.id} permanently?`)) return;
    await Repo.remove("aiPacks", a.id);
    toast.success(`${a.id} deleted`);
  };

  return (
    <>
      <PageHeader
        eyebrow="AI Pack Manufacturing"
        title="AI Packs"
        description="Governed, versioned bundles of canonical knowledge, prompts, instructions, and evaluations for downstream AI use."
        actions={<Button onClick={create}><Plus className="size-4 mr-1" />New AI Pack</Button>}
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
          {PUBLICATION_STAGES.map(st => <KpiCard key={st} label={st} value={counts[st] ?? 0} />)}
        </div>

        <div className="editorial-card p-4 mb-4 grid md:grid-cols-4 gap-3">
          <Input placeholder="Search title, tag, ID…" value={q} onChange={e => setQ(e.target.value)} />
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All stages</SelectItem>
              {PUBLICATION_STAGES.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={useCase} onValueChange={setUseCase}>
            <SelectTrigger><SelectValue placeholder="Use case" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All use cases</SelectItem>
              {AI_PACK_USE_CASES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
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

        <SectionTitle>Pack registry</SectionTitle>
        {rows.length === 0 ? (
          <EmptyState title="No packs match" description="Adjust filters or create a new pack." action={<Button onClick={create}>New AI Pack</Button>} />
        ) : (
          <div className="editorial-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-slate-ink">
                <tr>
                  <th className="text-left px-3 py-2 w-24">ID</th>
                  <th className="text-left px-3 py-2">Title</th>
                  <th className="text-left px-3 py-2 w-36">Use case</th>
                  <th className="text-left px-3 py-2 w-28">Stage</th>
                  <th className="text-left px-3 py-2 w-16">Modules</th>
                  <th className="text-left px-3 py-2 w-16">Evals</th>
                  <th className="text-left px-3 py-2 w-28">Coverage</th>
                  <th className="text-left px-3 py-2 w-16">Ready</th>
                  <th className="w-32 px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ a, cov }) => (
                  <tr key={a.id} className={`border-t border-border hover:bg-accent/40 ${a.archived ? "opacity-60" : ""}`}>
                    <td className="px-3 py-2 font-mono text-xs text-heritage"><Link to="/ai-packs/$id" params={{ id: a.id }} className="underline">{a.id}</Link></td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{a.title}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-md">{a.purpose}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">{a.useCase}</td>
                    <td className="px-3 py-2"><PublicationStageBadge stage={a.manufacturingStage} /></td>
                    <td className="px-3 py-2 text-xs tabular-nums">{a.modules.length}</td>
                    <td className="px-3 py-2 text-xs tabular-nums">{a.evaluationCases.length}</td>
                    <td className="px-3 py-2 text-xs"><CoverageBar percent={cov.coveragePercent} /></td>
                    <td className={`px-3 py-2 text-xs font-medium ${cov.readinessScore >= 85 ? "text-evergreen" : cov.readinessScore >= 60 ? "text-gold" : "text-destructive"}`}>{cov.readinessScore}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link to="/ai-packs/$id" params={{ id: a.id }}><Button size="icon" variant="ghost" title="Open"><ExternalLink className="size-4" /></Button></Link>
                        <Button size="icon" variant="ghost" title="Duplicate" onClick={() => duplicate(a)}><Copy className="size-4" /></Button>
                        <Button size="icon" variant="ghost" title={a.archived ? "Unarchive" : "Archive"} onClick={() => archive(a)}><Archive className="size-4" /></Button>
                        <Button size="icon" variant="ghost" title="Delete" onClick={() => remove(a)}><Trash2 className="size-4 text-destructive" /></Button>
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
