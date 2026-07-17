import type { ReactNode } from "react";
import { Search, Menu, LogOut, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "./app-sidebar";
import { CommandPalette, useCommandPalette } from "./command-palette";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Library, Network, BookOpen, Wrench, ScrollText, Bot, Package, ShieldCheck, Database, PenTool } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSessionBridge } from "@/lib/data/session-bridge";
import { installE2EBridge } from "@/lib/data/e2e-bootstrap";
import { toast } from "sonner";
import { useEffect } from "react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/repository", label: "Repository", icon: Library },
  { to: "/graph", label: "Relationships", icon: Network },
  { to: "/knowledge-objects/new", label: "KO Factory", icon: PenTool },
  { to: "/client-tools/new", label: "Client Tools", icon: Wrench },
  { to: "/publications", label: "Publications", icon: BookOpen },
  { to: "/prompts", label: "Prompts", icon: ScrollText },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/releases/$id", params: { id: "LKR-1.0.001" }, label: "Releases", icon: Package },
  { to: "/governance", label: "Governance", icon: ShieldCheck },
  { to: "/data", label: "Import / Export", icon: Database },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const cp = useCommandPalette();
  const pathname = useRouterState({ select: s => s.location.pathname });
  useEffect(() => { installE2EBridge(); }, []);
  const actor = useAuthSessionBridge();
  const nav = useNavigate();
  const signedIn = actor.source === "session" || actor.source === "test";
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    nav({ to: "/auth" });
  };
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30 flex items-center px-3 md:px-6 gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar text-sidebar-foreground border-sidebar-border">
              <div className="px-5 py-5 border-b border-sidebar-border">
                <div className="text-[11px] tracking-[0.2em] uppercase text-sidebar-primary font-medium">JM Advisory Press</div>
                <div className="font-serif text-lg mt-1">Legacy Platform</div>
                <div className="text-xs text-sidebar-foreground/80">v2.0 · Local Demo</div>
              </div>
              <nav className="p-2 space-y-0.5">
                {navItems.map(it => {
                  const active = it.to === "/" ? pathname === "/" : pathname.startsWith(it.to.split("/").slice(0, 2).join("/"));
                  const Icon = it.icon;
                  return (
                    <Link key={it.to} to={it.to as string} params={"params" in it ? (it as { params: Record<string, string> }).params : undefined} className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm",
                      active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                    )}>
                      <Icon className="size-4" />
                      <span>{it.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
          <button
            type="button"
            onClick={() => cp.setOpen(true)}
            aria-label="Open command palette"
            aria-keyshortcuts="Control+K Meta+K"
            className="flex-1 max-w-md flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background hover:bg-accent transition-colors text-sm text-muted-foreground"
          >
            <Search className="size-4" aria-hidden="true" />
            <span className="flex-1 text-left">Search or jump to…</span>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted font-mono" aria-hidden="true">⌘K</kbd>
          </button>
          <div className="ml-auto hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-block size-2 rounded-full bg-evergreen" />
            {signedIn ? (
              <>
                <span className="max-w-[16ch] truncate" title={actor.displayLabel}>{actor.displayLabel}</span>
                <Button variant="ghost" size="sm" onClick={handleSignOut} aria-label="Sign out">
                  <LogOut className="size-3.5" /> Sign out
                </Button>
              </>
            ) : (
              <Link to="/auth" className="inline-flex items-center gap-1 hover:text-foreground">
                <LogIn className="size-3.5" /> Sign in
              </Link>
            )}
          </div>
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <CommandPalette open={cp.open} onOpenChange={cp.setOpen} />
    </div>
  );
}
