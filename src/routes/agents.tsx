import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, StatusBadge } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Agent } from "@/lib/data/schema";
import { toast } from "sonner";

export const Route = createFileRoute("/agents")({
  head: () => ({ meta: [{ title: "Agent Registry — Legacy Platform" }] }),
  component: AgentRegistry,
});

function AgentRegistry() {
  const s = useSnapshot();
  const [editing, setEditing] = useState<Agent | null>(null);
  const [open, setOpen] = useState(false);
  if (!s) return <LoadingState />;

  const save = async () => {
    if (!editing) return;
    if (s.agents.some(a => a.id === editing.id)) await Repo.update("agents", editing.id, editing);
    else await Repo.create("agents", { ...editing });
    toast.success(`${editing.id} saved.`);
    setOpen(false);
  };
  const blank = (): Agent => {
    const nums = s.agents.map(a => Number(a.id.replace("AG-",""))).filter(x => !Number.isNaN(x));
    const n = (nums.length ? Math.max(...nums) : 0) + 1;
    const now = new Date().toISOString();
    return { id: `AG-${String(n).padStart(3, "0")}`, name: "", role: "", responsibilities: [], governingPromptIds: [], status: "Draft", version: "0.1.0", steward: "Editorial Board", createdAt: now, updatedAt: now };
  };

  return (
    <>
      <PageHeader eyebrow="Registry" title="Agent Registry"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={() => setEditing(blank())}>New agent</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing?.id}</DialogTitle></DialogHeader>
              {editing && (
                <div className="space-y-3">
                  <Input placeholder="Name" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
                  <Input placeholder="Role" value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value })} />
                  <Textarea placeholder="Responsibilities (comma separated)" rows={3} value={editing.responsibilities.join(", ")} onChange={e => setEditing({ ...editing, responsibilities: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })} />
                  <Input placeholder="Governing prompt IDs (comma separated)" value={editing.governingPromptIds.join(", ")} onChange={e => setEditing({ ...editing, governingPromptIds: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })} />
                </div>
              )}
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <PageBody>
        <div className="grid md:grid-cols-2 gap-4">
          {s.agents.map(a => (
            <div key={a.id} className="editorial-card p-5">
              <div className="flex items-center gap-3 mb-1"><span className="font-mono text-xs text-slate-ink">{a.id}</span><StatusBadge status={a.status} /></div>
              <div className="font-serif text-lg text-heritage">{a.name}</div>
              <div className="text-sm text-slate-ink">{a.role}</div>
              <div className="text-xs text-muted-foreground mt-2">Governing prompts: {a.governingPromptIds.join(", ") || "—"}</div>
              <Button variant="ghost" size="sm" className="mt-2 -ml-3" onClick={() => { setEditing(a); setOpen(true); }}>Edit</Button>
            </div>
          ))}
        </div>
      </PageBody>
    </>
  );
}
