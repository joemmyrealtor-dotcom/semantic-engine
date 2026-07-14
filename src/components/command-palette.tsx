import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useSnapshot } from "@/lib/use-snapshot";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const snap = useSnapshot();
  const nav = useNavigate();

  const go = (to: string) => { onOpenChange(false); nav({ to }); };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search concepts, frameworks, IDs, tools…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/")}>Dashboard</CommandItem>
          <CommandItem onSelect={() => go("/repository")}>Repository Explorer</CommandItem>
          <CommandItem onSelect={() => go("/graph")}>Relationship Graph</CommandItem>
          <CommandItem onSelect={() => go("/knowledge-objects/new")}>Knowledge Object Factory</CommandItem>
          <CommandItem onSelect={() => go("/client-tools/new")}>Client Tool Generator</CommandItem>
          <CommandItem onSelect={() => go("/publications/PL-101")}>Publication PL-101</CommandItem>
          <CommandItem onSelect={() => go("/releases/LKR-1.0.001")}>Release LKR-1.0.001</CommandItem>
          <CommandItem onSelect={() => go("/governance")}>Governance Center</CommandItem>
          <CommandItem onSelect={() => go("/data")}>Import / Export</CommandItem>
        </CommandGroup>
        {snap && (
          <>
            <CommandGroup heading="Domains">
              {snap.domains.map(d => (
                <CommandItem key={d.id} onSelect={() => go("/repository")} value={`${d.id} ${d.name}`}>
                  <span className="text-xs text-slate-ink mr-2">{d.id}</span>{d.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Concepts">
              {snap.concepts.map(c => (
                <CommandItem key={c.id} onSelect={() => go(`/concepts/${c.id}`)} value={`${c.id} ${c.canonicalName} ${c.aliases.join(" ")}`}>
                  <span className="text-xs text-slate-ink mr-2">{c.id}</span>{c.canonicalName}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Frameworks">
              {snap.frameworks.map(f => (
                <CommandItem key={f.id} onSelect={() => go(`/frameworks/${f.id}`)} value={`${f.id} ${f.name}`}>
                  <span className="text-xs text-slate-ink mr-2">{f.id}</span>{f.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}
