import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, SectionTitle, StatusBadge } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Prompt, PromptFamily } from "@/lib/data/schema";
import { toast } from "sonner";

const FAMILIES: PromptFamily[] = ["Knowledge Engineering","Editorial","Publishing","Learning","QA","Transformation","Marketing"];

export const Route = createFileRoute("/prompts")({
  head: () => ({ meta: [{ title: "Prompt Registry — Legacy Platform" }] }),
  component: PromptRegistry,
});

function PromptRegistry() {
  const s = useSnapshot();
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [open, setOpen] = useState(false);

  if (!s) return <LoadingState />;

  const save = async () => {
    if (!editing) return;
    if (s.prompts.some(p => p.id === editing.id)) await Repo.update("prompts", editing.id, editing);
    else await Repo.create("prompts", { ...editing, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    toast.success(`${editing.id} saved.`);
    setOpen(false);
  };

  const blank = (): Prompt => {
    const nums = s.prompts.map(p => Number(p.id.replace("PR-",""))).filter(x => !Number.isNaN(x));
    const n = (nums.length ? Math.max(...nums) : 0) + 1;
    const now = new Date().toISOString();
    return { id: `PR-${String(n).padStart(3, "0")}`, name: "", family: "Editorial", purpose: "", template: "", inputs: [], outputs: [], version: "0.1.0", status: "Draft", steward: "Editorial Board", createdAt: now, updatedAt: now };
  };

  return (
    <>
      <PageHeader eyebrow="Registry" title="Prompt Registry"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={() => setEditing(blank())}>New prompt</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editing?.id}</DialogTitle></DialogHeader>
              {editing && (
                <div className="space-y-3">
                  <Input placeholder="Name" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
                  <Select value={editing.family} onValueChange={v => setEditing({ ...editing, family: v as PromptFamily })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FAMILIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                  <Textarea placeholder="Purpose" rows={2} value={editing.purpose} onChange={e => setEditing({ ...editing, purpose: e.target.value })} />
                  <Textarea placeholder="Template" rows={6} value={editing.template} onChange={e => setEditing({ ...editing, template: e.target.value })} />
                </div>
              )}
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <PageBody>
        <div className="editorial-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-slate-ink">
              <tr><th className="text-left px-4 py-2 w-24">ID</th><th className="text-left px-4 py-2">Name</th><th className="text-left px-4 py-2 w-40">Family</th><th className="text-left px-4 py-2 w-28">Status</th><th className="text-left px-4 py-2 w-20">Version</th></tr>
            </thead>
            <tbody>
              {s.prompts.map(p => (
                <tr key={p.id} className="border-t border-border hover:bg-accent/40 cursor-pointer" onClick={() => { setEditing(p); setOpen(true); }}>
                  <td className="px-4 py-2 font-mono text-xs">{p.id}</td>
                  <td className="px-4 py-2"><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground truncate max-w-xl">{p.purpose}</div></td>
                  <td className="px-4 py-2 text-xs">{p.family}</td>
                  <td className="px-4 py-2"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-2 text-xs">{p.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-xs text-muted-foreground"><SectionTitle>Prompt families</SectionTitle>{FAMILIES.join(" · ")}</div>
      </PageBody>
    </>
  );
}
