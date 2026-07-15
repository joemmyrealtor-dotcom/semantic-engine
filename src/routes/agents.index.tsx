import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, EmptyState, SectionTitle, KpiCard } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PUBLICATION_STAGES, AGENT_USE_CASES, type Agent } from "@/lib/data/schema";
import { nextAgentId, duplicateAgent, agentCoverage } from "@/lib/data/service";
import { PublicationStageBadge } from "@/components/publication-stage-badge";
import { CoverageBar } from "@/routes/publications.index";
import { Archive, Copy, Plus, Trash2, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/agents/")({
  head: () => ({ meta: [{ title: "Agents — Legacy Platform" }] }),
  component: AgentRegistryPage,
});

const ALL = "__all__";

function AgentRegistryPage() {
  const s = useSnapshot();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>(ALL);
  const [useCase, setUseCase] = useState<string>(ALL);
  const [showArchived, setShowArchived] = useState(false);

  const rows = useMemo(() => {
    if (!s) return [];
    return s.agents
      .filter(a => showArchived ? true : !a.archived)
      .filter(a => stage === ALL || a.manufacturingStage === stage)
      .filter(a => useCase === ALL || a.useCase === useCase)
      .filter(a => {
        if (!q) return true;
        const hay = `${a.id} ${a.name} ${a.role} ${(a.tags ?? []).join(" ")}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
      .map(a => ({ a, cov: agentCoverage(a, s) }))
      .sort((x, y) => y.a.updatedAt.localeCompare(x.a.updatedAt));
  }, [s, q, stage, useCase, showArchived]);

  if (!s) return <LoadingState />;

  const counts = PUBLICATION_STAGES.reduce<Record<string, number>>((acc, st) => {
    acc[st] = s.agents.filter(a => !a.archived && a.manufacturingStage === st).length;
    return acc;
  }, {});

  const create = async () => {
    const id = nextAgentId(s);
    const now = new Date().toISOString();
    const a: Agent = {
      id, name: "Untitled Agent", role: "", responsibilities: [],
      governingPromptIds: [],
      status: "Draft", version: "0.1.0", steward: "Editorial Board",
      description: "", purpose: "", useCase: "Editorial Assistant",
      targetModel: "", owner: "Editorial Board", tags: [], archived: false,
      manufacturingStage: "Draft",
      stageHistory: [{ stage: "Draft", at: now, actor: "Editorial Board", note: "Created." }],
      effectiveDate: null, reviewDate: null,
      conceptIds: [], frameworkIds: [], knowledgeObjectIds: [],
      publicationIds: [], clientToolkitIds: [], aiPackIds: [], clientToolIds: [],
      specifications: [], evaluationCases: [],
      usagePolicy: "", boundaryConditions: "", prohibitedUses: "",
      escalationGuidance: "", provenanceNotes: "",
      humanReviewCompleted: false, releaseIds: [],
      createdAt: now, updatedAt: now,
    };
    await Repo.create("agents", a);
    toast.success(`Created ${id}`);
    navigate({ to: "/agents/$id", params: { id } });
  };

  const duplicate = async (a: Agent) => {
    const id = nextAgentId(s);
    await Repo.create("agents", duplicateAgent(a, id, s));
    toast.success(`Duplicated as ${id}`);
  };

  const archive = async (a: Agent) => {
    await Repo.update("agents", a.id, { archived: !a.archived });
    toast.success(a.archived ? `${a.id} unarchived` : `${a.id} archived`);
  };

  const remove = async (a: Agent) => {
    if (!confirm(`Delete ${a.id} permanently?`)) return;
    await Repo.remove("agents", a.id);
    toast.success(`${a.id} deleted`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Agent Manufacturing"
        title="Agents"
        description="Versioned, governed AI agent specifications with evaluation gates and release readiness scoring."
        actions={<Button onClick={create}><Plus className="size-4 mr-1" />New agent</Button>}
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
          {PUBLICATION_STAGES.map(st => <KpiCard key={st} label={st} value={counts[st] ?? 0} />)}
        </div>

        <div className="editorial-card p-4 mb-4 grid md:grid-cols-4 gap-3">
          <Input placeholder="Search name, role, tag, ID…" value={q} onChange={e => setQ(e.target.value)} />
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
              {AGENT_USE_CASES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
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

        <SectionTitle>Agent registry</SectionTitle>
        {rows.length === 0 ? (
          <EmptyState title="No agents match" description="Adjust filters or create a new agent." action={<Button onClick={create}>New agent</Button>} />
        ) : (
          <div className="editorial-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-slate-ink">
                <tr>
                  <th className="text-left px-3 py-2 w-24">ID</th>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2 w-36">Use case</th>
                  <th className="text-left px-3 py-2 w-28">Stage</th>
                  <th className="text-left px-3 py-2 w-16">Specs</th>
                  <th className="text-left px-3 py-2 w-16">Evals</th>
                  <th className="text-left px-3 py-2 w-28">Coverage</th>
                  <th className="text-left px-3 py-2 w-16">Ready</th>
                  <th className="w-32 px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ a, cov }) => (
                  <tr key={a.id} className={`border-t border-border hover:bg-accent/40 ${a.archived ? "opacity-60" : ""}`}>
                    <td className="px-3 py-2 font-mono text-xs text-heritage"><Link to="/agents/$id" params={{ id: a.id }} className="underline">{a.id}</Link></td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-md">{a.role || a.description}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">{a.useCase}</td>
                    <td className="px-3 py-2"><PublicationStageBadge stage={a.manufacturingStage} /></td>
                    <td className="px-3 py-2 text-xs tabular-nums">{a.specifications.length}</td>
                    <td className="px-3 py-2 text-xs tabular-nums">
                      {cov.evaluationsPassed}<span className="text-muted-foreground">/{cov.evaluationCount}</span>
                    </td>
                    <td className="px-3 py-2 text-xs"><CoverageBar percent={cov.coveragePercent} /></td>
                    <td className={`px-3 py-2 text-xs font-medium ${cov.readinessScore >= 85 ? "text-evergreen" : cov.readinessScore >= 60 ? "text-gold" : "text-destructive"}`}>{cov.readinessScore}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link to="/agents/$id" params={{ id: a.id }}><Button size="icon" variant="ghost" title="Open"><ExternalLink className="size-4" /></Button></Link>
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
