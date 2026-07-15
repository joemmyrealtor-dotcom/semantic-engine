import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, SectionTitle, EmptyState } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  AUTOMATION_TRIGGER_KINDS, AUTOMATION_ACTION_KINDS, AUTOMATION_ENTITY_SCOPES,
} from "@/lib/data/schema";
import type {
  AutomationRecipe, AutomationStep, AutomationTriggerKind, AutomationActionKind,
  AutomationEntityScope, AutomationApprovalCheckpoint, ManufacturingStage, Role,
} from "@/lib/data/schema";
import { MANUFACTURING_STAGES } from "@/lib/data/schema";
import { executeRecipe, validateRecipe, nextStepId, nextCheckpointId } from "@/lib/data/automation";

export const Route = createFileRoute("/automations/$id")({
  head: () => ({ meta: [{ title: "Automation Studio — Legacy Platform" }] }),
  component: AutomationStudio,
});

function AutomationStudio() {
  const { id } = Route.useParams();
  const s = useSnapshot();
  const navigate = useNavigate();
  const recipe = s?.automations.find(a => a.id === id);
  const runs = useMemo(() => (s?.automationRuns ?? []).filter(r => r.recipeId === id), [s, id]);
  const [dryRun, setDryRun] = useState(true);

  if (!s) return <LoadingState />;
  if (!recipe) return <EmptyState title="Recipe not found" description={`No automation with id ${id}.`} action={<Link to="/automations"><Button variant="outline">Back to registry</Button></Link>} />;

  const validation = validateRecipe(recipe);

  const patch = async (p: Partial<AutomationRecipe>) => { await Repo.update("automations", recipe.id, p); };

  const addStep = async () => {
    const step: AutomationStep = {
      id: nextStepId(recipe.steps),
      name: "New step",
      action: "generate-readiness-report",
      parameters: {},
      conditions: [],
      requiresApproval: false,
      onFailure: "abort",
    };
    await patch({ steps: [...recipe.steps, step] });
  };
  const updateStep = async (sid: string, p: Partial<AutomationStep>) => {
    await patch({ steps: recipe.steps.map(s => s.id === sid ? { ...s, ...p } : s) });
  };
  const removeStep = async (sid: string) => {
    await patch({
      steps: recipe.steps.filter(s => s.id !== sid),
      approvals: recipe.approvals.filter(a => a.afterStepId !== sid),
    });
  };
  const moveStep = async (idx: number, dir: -1 | 1) => {
    const arr = [...recipe.steps];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j]!, arr[idx]!];
    await patch({ steps: arr });
  };
  const addCheckpoint = async () => {
    const cp: AutomationApprovalCheckpoint = {
      id: nextCheckpointId(recipe.approvals),
      afterStepId: recipe.steps[0]?.id ?? "",
      approverRole: "Owner",
      instructions: "",
    };
    await patch({ approvals: [...recipe.approvals, cp] });
  };
  const removeCheckpoint = async (cid: string) => {
    await patch({ approvals: recipe.approvals.filter(a => a.id !== cid) });
  };

  const run = async () => {
    if (!validation.ok) { toast.error(`Cannot run: ${validation.errors[0]}`); return; }
    const { run, nextSnapshot, blocked } = executeRecipe({
      recipe, snapshot: s, entityIds: recipe.trigger.entityIds, actor: "current-user",
      dryRun, triggerEventId: `manual-${Date.now()}`,
    });
    if (blocked) { toast.warning(`Blocked by ${blocked}. See run ${run.id}.`); }
    else if (run.status === "failed") { toast.error(`Run ${run.id} failed.`); }
    else if (run.status === "waiting-approval") { toast.info(`Run ${run.id} awaiting approval.`); }
    else { toast.success(`Run ${run.id} ${run.status}${dryRun ? " (dry-run)" : ""}.`); }
    await Repo.replaceAll(nextSnapshot);
  };

  const archive = async () => { await patch({ state: "archived" }); toast.success("Archived."); navigate({ to: "/automations" }); };

  return (
    <>
      <PageHeader eyebrow={recipe.id} title={recipe.name}
        description={recipe.description}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-ink mr-2">Dry-run <Switch checked={dryRun} onCheckedChange={setDryRun} /></div>
            <Button variant="outline" onClick={run}>Execute</Button>
            <Button variant="ghost" onClick={archive}>Archive</Button>
          </div>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <section className="lg:col-span-2 space-y-5">
            <div className="editorial-card p-5 space-y-3">
              <SectionTitle>Recipe</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block text-xs text-slate-ink">Name
                  <Input value={recipe.name} onChange={e => patch({ name: e.target.value })} />
                </label>
                <label className="block text-xs text-slate-ink">Version
                  <Input value={recipe.version} onChange={e => patch({ version: e.target.value })} />
                </label>
                <label className="block text-xs text-slate-ink md:col-span-2">Description
                  <Textarea value={recipe.description} onChange={e => patch({ description: e.target.value })} rows={2} />
                </label>
                <label className="block text-xs text-slate-ink">Owner
                  <Input value={recipe.owner} onChange={e => patch({ owner: e.target.value })} />
                </label>
                <label className="block text-xs text-slate-ink">Steward
                  <Input value={recipe.steward} onChange={e => patch({ steward: e.target.value })} />
                </label>
                <label className="block text-xs text-slate-ink">State
                  <Select value={recipe.state} onValueChange={v => patch({ state: v as typeof recipe.state })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-xs text-slate-ink">Concurrency
                  <Select value={recipe.concurrencyKey} onValueChange={v => patch({ concurrencyKey: v as typeof recipe.concurrencyKey })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recipe">Recipe-wide</SelectItem>
                      <SelectItem value="recipe+entity">Per recipe + entity</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-xs text-slate-ink">Idempotency window (min)
                  <Input type="number" value={recipe.idempotencyWindowMinutes} onChange={e => patch({ idempotencyWindowMinutes: Number(e.target.value) })} />
                </label>
                <label className="block text-xs text-slate-ink">Change notes
                  <Input value={recipe.changeNotes ?? ""} onChange={e => patch({ changeNotes: e.target.value })} />
                </label>
              </div>
            </div>

            <div className="editorial-card p-5 space-y-3">
              <SectionTitle>Trigger</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="block text-xs text-slate-ink">Kind
                  <Select value={recipe.trigger.kind} onValueChange={v => patch({ trigger: { ...recipe.trigger, kind: v as AutomationTriggerKind } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AUTOMATION_TRIGGER_KINDS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-xs text-slate-ink">Scope
                  <Select value={recipe.trigger.entityScope} onValueChange={v => patch({ trigger: { ...recipe.trigger, entityScope: v as AutomationEntityScope } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AUTOMATION_ENTITY_SCOPES.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-xs text-slate-ink">Target IDs (comma-separated)
                  <Input value={recipe.trigger.entityIds.join(", ")} onChange={e => patch({ trigger: { ...recipe.trigger, entityIds: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } })} />
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="block text-xs text-slate-ink">Readiness threshold
                  <Input type="number" value={recipe.trigger.readinessThreshold ?? ""} onChange={e => patch({ trigger: { ...recipe.trigger, readinessThreshold: e.target.value ? Number(e.target.value) : undefined } })} />
                </label>
                <label className="block text-xs text-slate-ink">Stage transition
                  <Select value={recipe.trigger.stage ?? "none"} onValueChange={v => patch({ trigger: { ...recipe.trigger, stage: v === "none" ? undefined : v as ManufacturingStage } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {MANUFACTURING_STAGES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-xs text-slate-ink">Review due within (days)
                  <Input type="number" value={recipe.trigger.reviewDueWithinDays ?? ""} onChange={e => patch({ trigger: { ...recipe.trigger, reviewDueWithinDays: e.target.value ? Number(e.target.value) : undefined } })} />
                </label>
              </div>
            </div>

            <div className="editorial-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <SectionTitle hint={`${recipe.steps.length} step(s)`}>Steps</SectionTitle>
                <Button size="sm" variant="outline" onClick={addStep}>Add step</Button>
              </div>
              {recipe.steps.length === 0 ? (
                <div className="text-xs text-muted-foreground">No steps configured.</div>
              ) : recipe.steps.map((st, i) => (
                <div key={st.id} className="border border-border rounded-md p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-ink">{st.id}</span>
                    <Input className="flex-1" value={st.name} onChange={e => updateStep(st.id, { name: e.target.value })} />
                    <Button size="sm" variant="ghost" onClick={() => moveStep(i, -1)} disabled={i === 0}>↑</Button>
                    <Button size="sm" variant="ghost" onClick={() => moveStep(i, 1)} disabled={i === recipe.steps.length - 1}>↓</Button>
                    <Button size="sm" variant="ghost" onClick={() => removeStep(st.id)}>Remove</Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <label className="block text-xs text-slate-ink">Action
                      <Select value={st.action} onValueChange={v => updateStep(st.id, { action: v as AutomationActionKind })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AUTOMATION_ACTION_KINDS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="block text-xs text-slate-ink">On failure
                      <Select value={st.onFailure} onValueChange={v => updateStep(st.id, { onFailure: v as AutomationStep["onFailure"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="abort">Abort run</SelectItem>
                          <SelectItem value="continue">Continue</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="block text-xs text-slate-ink flex items-center gap-2 pt-4">
                      <Switch checked={st.requiresApproval} onCheckedChange={c => updateStep(st.id, { requiresApproval: c })} />
                      <span>Requires approval</span>
                    </label>
                  </div>
                  <label className="block text-xs text-slate-ink">Parameters (JSON)
                    <Textarea rows={2} value={JSON.stringify(st.parameters)}
                      onChange={e => {
                        try { const parsed = JSON.parse(e.target.value || "{}"); updateStep(st.id, { parameters: parsed }); }
                        catch { /* ignore parse until valid */ }
                      }} />
                  </label>
                </div>
              ))}
            </div>

            <div className="editorial-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <SectionTitle hint={`${recipe.approvals.length} checkpoint(s)`}>Approval checkpoints</SectionTitle>
                <Button size="sm" variant="outline" onClick={addCheckpoint} disabled={recipe.steps.length === 0}>Add checkpoint</Button>
              </div>
              {recipe.approvals.length === 0 ? (
                <div className="text-xs text-muted-foreground">No governance checkpoints configured.</div>
              ) : recipe.approvals.map(cp => (
                <div key={cp.id} className="border border-border rounded-md p-3 grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                  <span className="font-mono text-xs text-slate-ink">{cp.id}</span>
                  <label className="block text-xs text-slate-ink">After step
                    <Select value={cp.afterStepId} onValueChange={v => patch({ approvals: recipe.approvals.map(a => a.id === cp.id ? { ...a, afterStepId: v } : a) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {recipe.steps.map(s => <SelectItem key={s.id} value={s.id}>{s.id} — {s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="block text-xs text-slate-ink">Approver role
                    <Input value={cp.approverRole} onChange={e => patch({ approvals: recipe.approvals.map(a => a.id === cp.id ? { ...a, approverRole: e.target.value } : a) })} />
                  </label>
                  <Button size="sm" variant="ghost" onClick={() => removeCheckpoint(cp.id)}>Remove</Button>
                  <label className="block text-xs text-slate-ink md:col-span-4">Instructions
                    <Textarea rows={2} value={cp.instructions} onChange={e => patch({ approvals: recipe.approvals.map(a => a.id === cp.id ? { ...a, instructions: e.target.value } : a) })} />
                  </label>
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-5">
            <div className="editorial-card p-5">
              <SectionTitle>Validation</SectionTitle>
              <div className={`text-xs ${validation.ok ? "text-evergreen" : "text-destructive"}`}>
                {validation.ok ? "Recipe is valid." : `${validation.errors.length} error(s)`}
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {validation.errors.map((e, i) => <li key={`e${i}`} className="text-destructive">• {e}</li>)}
                {validation.warnings.map((w, i) => <li key={`w${i}`} className="text-champagne-foreground">• {w}</li>)}
              </ul>
            </div>
            <div className="editorial-card p-5">
              <SectionTitle hint={`${runs.length} total`}>Run history</SectionTitle>
              {runs.length === 0 ? <div className="text-xs text-muted-foreground">No runs yet.</div> : (
                <ul className="space-y-2 text-xs">
                  {runs.slice().reverse().slice(0, 12).map(r => (
                    <li key={r.id} className="border border-border rounded p-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono">{r.id}</span>
                        <span className={r.status === "failed" ? "text-destructive" : r.status === "succeeded" ? "text-evergreen" : "text-champagne-foreground"}>{r.status}</span>
                      </div>
                      <div className="text-muted-foreground">{new Date(r.updatedAt).toLocaleString()} · {r.entityIds.join(", ") || "—"}</div>
                      {r.errorSummary && <div className="text-destructive mt-1">{r.errorSummary}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="editorial-card p-5">
              <SectionTitle>Reliability</SectionTitle>
              <div className="text-xs text-slate-ink">Success: {recipe.successCount} · Failure: {recipe.failureCount}</div>
              <div className="text-xs text-muted-foreground">Last run: {recipe.lastRunAt ? new Date(recipe.lastRunAt).toLocaleString() : "—"}</div>
            </div>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
