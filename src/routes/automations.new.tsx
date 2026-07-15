import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, SectionTitle } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AUTOMATION_TRIGGER_KINDS, AUTOMATION_ENTITY_SCOPES } from "@/lib/data/schema";
import type { AutomationRecipe, AutomationTriggerKind, AutomationEntityScope } from "@/lib/data/schema";
import { nextRecipeId } from "@/lib/data/automation";

export const Route = createFileRoute("/automations/new")({
  head: () => ({ meta: [{ title: "New Automation — Legacy Platform" }] }),
  component: NewAutomation,
});

function NewAutomation() {
  const s = useSnapshot();
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: "", description: "",
    owner: "Editorial Board", steward: "Publishing Ops",
    trigger: "manual" as AutomationTriggerKind,
    scope: "publication" as AutomationEntityScope,
    entityIds: "",
    tags: "",
  });

  if (!s) return <LoadingState />;

  const create = async () => {
    if (!form.name.trim()) { toast.error("Name required."); return; }
    const now = new Date().toISOString();
    const id = nextRecipeId(s);
    const recipe: AutomationRecipe = {
      id, name: form.name.trim(), description: form.description.trim(),
      owner: form.owner, steward: form.steward,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      state: "paused", version: "0.1.0",
      trigger: {
        kind: form.trigger, entityScope: form.scope,
        entityIds: form.entityIds.split(",").map(t => t.trim()).filter(Boolean),
      },
      steps: [{
        id: "AST-001", name: "Generate readiness report",
        action: "generate-readiness-report", parameters: {}, conditions: [],
        requiresApproval: false, onFailure: "abort",
      }],
      approvals: [],
      retryPolicy: { maxAttempts: 1, backoffSeconds: 0 },
      concurrencyKey: "recipe+entity", idempotencyWindowMinutes: 60,
      lastRunAt: null, nextEligibleAt: null,
      successCount: 0, failureCount: 0, changeNotes: "Draft.",
      createdAt: now, updatedAt: now,
    };
    await Repo.create("automations", recipe);
    toast.success(`Created ${id}.`);
    nav({ to: "/automations/$id", params: { id } });
  };

  return (
    <>
      <PageHeader eyebrow="Operations" title="New Automation Recipe"
        description="Recipes start paused. Add steps and validation in the studio, then activate." />
      <PageBody>
        <div className="editorial-card p-6 max-w-2xl space-y-4">
          <SectionTitle>Basics</SectionTitle>
          <label className="block text-xs text-slate-ink">Name
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="block text-xs text-slate-ink">Description
            <Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-slate-ink">Owner
              <Input value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} />
            </label>
            <label className="block text-xs text-slate-ink">Steward
              <Input value={form.steward} onChange={e => setForm({ ...form, steward: e.target.value })} />
            </label>
          </div>
          <label className="block text-xs text-slate-ink">Tags (comma-separated)
            <Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
          </label>
          <SectionTitle>Trigger</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-slate-ink">Trigger kind
              <Select value={form.trigger} onValueChange={v => setForm({ ...form, trigger: v as AutomationTriggerKind })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AUTOMATION_TRIGGER_KINDS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="block text-xs text-slate-ink">Entity scope
              <Select value={form.scope} onValueChange={v => setForm({ ...form, scope: v as AutomationEntityScope })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AUTOMATION_ENTITY_SCOPES.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
              </Select>
            </label>
          </div>
          <label className="block text-xs text-slate-ink">Target IDs (comma-separated)
            <Input value={form.entityIds} onChange={e => setForm({ ...form, entityIds: e.target.value })} placeholder="PL-101, PL-102" />
          </label>
          <div className="flex gap-2 pt-2">
            <Button className="bg-heritage text-heritage-foreground hover:bg-heritage/90" onClick={create}>Create draft recipe</Button>
            <Button variant="ghost" onClick={() => nav({ to: "/automations" })}>Cancel</Button>
          </div>
        </div>
      </PageBody>
    </>
  );
}
