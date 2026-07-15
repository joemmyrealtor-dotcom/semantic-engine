import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Library, Network, BookOpen, Wrench, ScrollText, Bot, Package, ShieldCheck, Database, PenTool, BookMarked } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/repository", label: "Repository", icon: Library },
  { to: "/concepts", label: "Concept Registry", icon: BookMarked },
  { to: "/graph", label: "Relationships", icon: Network },
  { to: "/knowledge-objects/new", label: "KO Factory", icon: PenTool },
  { to: "/client-tools/new", label: "Client Tools", icon: Wrench },
  { to: "/publications", label: "Publications", icon: BookOpen },
  { to: "/prompts", label: "Prompts", icon: ScrollText },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/releases/LKR-1.0.001", label: "Releases", icon: Package },
  { to: "/governance", label: "Governance", icon: ShieldCheck },
  { to: "/data", label: "Import / Export", icon: Database },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="text-[11px] tracking-[0.2em] uppercase text-sidebar-primary font-medium">JM Advisory Press</div>
        <div className="font-serif text-lg leading-tight mt-1">Legacy Platform</div>
        <div className="text-xs text-sidebar-foreground/60">v2.0 · Local Demo</div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {items.map(it => {
          const active = it.to === "/" ? pathname === "/" : pathname.startsWith(it.to.split("/").slice(0, 2).join("/"));
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{it.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-3 text-[11px] text-sidebar-foreground/50 border-t border-sidebar-border">
        Local demo · IndexedDB persistence
      </div>
    </aside>
  );
}
