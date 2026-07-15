import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, KpiCard, SectionTitle, EmptyState } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AUTOMATION_TRIGGER_KINDS } from "@/lib/data/schema";
import type { AutomationState, AutomationTriggerKind } from "@/lib/data/schema";

export const Route = createFileRoute("/automations/")({
  head: () => ({ meta: [{ title: "Automations — Legacy Platform" }] }),
  component: AutomationsIndex,
});

function AutomationsIndex() {
  const s = useSnapshot();
  const [q, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState<AutomationState | "all">("all");
  const [triggerFilter, setTriggerFilter] = useState<AutomationTriggerKind | "all">("all");

  const derived = useMemo(() => {
    const list = s?.automations ?? [];
    const runs = s?.automationRuns ?? [];
    const filtered = list.filter(a => {
      if (stateFilter !== "all" && a.state !== stateFilter) return false;
      if (triggerFilter !== "all" && a.trigger.kind !== triggerFilter) return false;
      if (q && !`${a.id} ${a.name} ${a.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    return {
      list, runs, filtered,
      active: list.filter(a => a.state === "active").length,
      paused: list.filter(a => a.state === "paused").length,
      failed: runs.filter(r => r.status === "failed").length,
      pendingApproval: runs.filter(r => r.status === "waiting-approval").length,
      recentSuccesses: runs.filter(r => r.status === "succeeded").length,
    };
  }, [s, q, stateFilter, triggerFilter]);

  if (!s) return <LoadingState />;

  const togglePause = async (id: string, cur: AutomationState) => {
    const next: AutomationState = cur === "active" ? "paused" : "active";
    await Repo.update("automations", id, { state: next });
    toast.success(`Recipe ${next}.`);
  };
  const archive = async (id: string) => {
    await Repo.update("automations", id, { state: "archived" });
    toast.success("Archived recipe.");
  };
  const duplicate = async (id: string) => {
    const src = derived.list.find(x => x.id === id);
    if (!src) return;
    const nextNum = String(Math.max(0, ...derived.list.map(r => parseInt(r.id.slice(4), 10))) + 1).padStart(3, "0");
    const newId = `AUT-${nextNum}`;
    await Repo.create("automations", { ...src, id: newId, name: `${src.name} (copy)`, state: "paused", successCount: 0, failureCount: 0, lastRunAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    toast.success(`Duplicated as ${newId}.`);
  };

  return (
    <>
      <PageHeader eyebrow="Operations" title="Automation Recipes"
        description="Recurring, governed workflows across concepts, publications, toolkits, packs, agents, and releases."
        actions={<Link to="/automations/new"><Button className="bg-heritage text-heritage-foreground hover:bg-heritage/90">New recipe</Button></Link>} />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <KpiCard label="Active" value={derived.active} />
          <KpiCard label="Paused" value={derived.paused} tone="gold" />
          <KpiCard label="Pending approval" value={derived.pendingApproval} tone="gold" />
          <KpiCard label="Failed runs" value={derived.failed} tone="warn" />
          <KpiCard label="Successful runs" value={derived.recentSuccesses} tone="evergreen" />
        </div>
        <div className="editorial-card p-4 mb-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-52">
            <label className="text-xs text-slate-ink block mb-1">Search</label>
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Name, id, tag…" />
          </div>
          <div>
            <label className="text-xs text-slate-ink block mb-1">State</label>
            <Select value={stateFilter} onValueChange={v => setStateFilter(v as typeof stateFilter)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-slate-ink block mb-1">Trigger</label>
            <Select value={triggerFilter} onValueChange={v => setTriggerFilter(v as typeof triggerFilter)}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All triggers</SelectItem>
                {AUTOMATION_TRIGGER_KINDS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {derived.filtered.length === 0 ? (
          <EmptyState title="No recipes match" description="Adjust filters or create a new automation recipe." />
        ) : (
          <div className="editorial-card p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-slate-ink border-b border-border">
                  <th className="py-3 pl-4 pr-3">Recipe</th>
                  <th className="pr-3">Trigger</th>
                  <th className="pr-3">Scope</th>
                  <th className="pr-3">State</th>
                  <th className="pr-3">Success / Fail</th>
                  <th className="pr-3">Last run</th>
                  <th className="pr-3 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {derived.filtered.map(a => {
                  const rate = (a.successCount + a.failureCount) === 0 ? "—" : `${Math.round(100 * a.successCount / (a.successCount + a.failureCount))}%`;
                  return (
                    <tr key={a.id} className="border-b border-border/60 align-top">
                      <td className="py-3 pl-4 pr-3">
                        <Link to="/automations/$id" params={{ id: a.id }} className="text-heritage font-medium hover:underline">
                          <span className="font-mono text-xs text-slate-ink">{a.id}</span> {a.name}
                        </Link>
                        <div className="text-xs text-muted-foreground max-w-md">{a.description}</div>
                      </td>
                      <td className="pr-3 text-xs">{a.trigger.kind}</td>
                      <td className="pr-3 text-xs">{a.trigger.entityScope}{a.trigger.entityIds.length ? ` · ${a.trigger.entityIds.length} target(s)` : ""}</td>
                      <td className="pr-3 text-xs capitalize">{a.state}</td>
                      <td className="pr-3 text-xs">{a.successCount} / {a.failureCount} <span className="text-slate-ink">({rate})</span></td>
                      <td className="pr-3 text-xs text-muted-foreground">{a.lastRunAt ? new Date(a.lastRunAt).toLocaleString() : "—"}</td>
                      <td className="pr-4 whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => togglePause(a.id, a.state)}>{a.state === "active" ? "Pause" : "Activate"}</Button>
                        <Button size="sm" variant="ghost" onClick={() => duplicate(a.id)}>Duplicate</Button>
                        {a.state !== "archived" && <Button size="sm" variant="ghost" onClick={() => archive(a.id)}>Archive</Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6">
          <SectionTitle hint={`${derived.runs.length} total`}>Recent runs</SectionTitle>
          <div className="editorial-card p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-slate-ink border-b border-border">
                  <th className="py-3 pl-4 pr-3">Run</th><th className="pr-3">Recipe</th>
                  <th className="pr-3">Status</th><th className="pr-3">Targets</th><th className="pr-3">When</th>
                </tr>
              </thead>
              <tbody>
                {derived.runs.slice().reverse().slice(0, 10).map(r => (
                  <tr key={r.id} className="border-b border-border/60 align-top">
                    <td className="py-2 pl-4 pr-3 font-mono text-xs">{r.id}</td>
                    <td className="pr-3 text-xs">{r.recipeId}@{r.recipeVersion}</td>
                    <td className={`pr-3 text-xs ${r.status === "failed" ? "text-destructive" : r.status === "succeeded" ? "text-evergreen" : ""}`}>{r.status}</td>
                    <td className="pr-3 text-xs">{r.entityIds.join(", ") || "—"}</td>
                    <td className="pr-3 text-xs text-muted-foreground">{new Date(r.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </PageBody>
    </>
  );
}
