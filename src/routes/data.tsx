import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, SectionTitle } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { exportSnapshot, parseImport } from "@/lib/data/service";
import { toast } from "sonner";

export const Route = createFileRoute("/data")({
  head: () => ({ meta: [{ title: "Import / Export — Legacy Platform" }] }),
  component: DataPage,
});

function DataPage() {
  const s = useSnapshot();
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [broken, setBroken] = useState<{ source: string; targetId: string; kind: string }[]>([]);
  if (!s) return <LoadingState />;

  const doExport = () => {
    const json = exportSnapshot(s);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `legacy-platform-v2-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async () => {
    const result = parseImport(text);
    setErrors(result.errors); setBroken(result.brokenReferences);
    if (!result.snapshot) return toast.error("Import failed. See errors below.");
    try {
      await Repo.auditedReplaceAll(result.snapshot,
        { permission: "content.create", action: "data-import", entityType: "dataSnapshot", entityId: "import", reason: "JSON import replace-all" });
      toast.success("Repository replaced from import.");
    } catch (e) { toast.error((e as Error).message); }
  };

  const doReset = async () => {
    await Repo.reset();
    toast.success("Repository reset to seed baseline.");
  };

  return (
    <>
      <PageHeader eyebrow="Data" title="Import / Export" description="JSON backup, restore, and reset for all registries." actions={
        <>
          <Button variant="outline" onClick={doReset}>Reset to seed</Button>
          <Button onClick={doExport}>Export JSON</Button>
        </>
      } />
      <PageBody>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="editorial-card p-5">
            <SectionTitle>Import JSON</SectionTitle>
            <Textarea rows={16} value={text} onChange={e => setText(e.target.value)} placeholder='{ "domains": [...], "concepts": [...], ... }' className="font-mono text-xs" />
            <Button className="mt-3" onClick={doImport}>Import & replace repository</Button>
          </div>
          <div className="editorial-card p-5">
            <SectionTitle hint={`${errors.length} errors · ${broken.length} broken refs`}>Validation</SectionTitle>
            {errors.length === 0 && broken.length === 0 && <p className="text-sm text-evergreen">No issues.</p>}
            {errors.length > 0 && (<>
              <div className="text-xs uppercase text-slate-ink mb-1">Errors</div>
              <ul className="text-sm text-destructive space-y-1">{errors.map(e => <li key={e}>· {e}</li>)}</ul>
            </>)}
            {broken.length > 0 && (<>
              <div className="text-xs uppercase text-slate-ink mt-3 mb-1">Unresolved references</div>
              <ul className="text-sm space-y-1">{broken.map((b, i) => <li key={i}>· {b.source} → {b.targetId} ({b.kind})</li>)}</ul>
            </>)}
          </div>
        </div>
        <div className="mt-6 text-xs text-muted-foreground">
          Local demo persistence via IndexedDB (database <code>legacy-platform-v2</code>). Clearing site data will trigger a fresh seed on next load.
        </div>
      </PageBody>
    </>
  );
}
