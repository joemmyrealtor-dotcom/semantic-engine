import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Status, ReleaseStage } from "@/lib/data/schema";

export function KpiCard({ label, value, hint, tone = "default" }: {
  label: string; value: ReactNode; hint?: string; tone?: "default" | "gold" | "evergreen" | "warn";
}) {
  const toneCls = {
    default: "border-border",
    gold: "border-gold/50",
    evergreen: "border-evergreen/40",
    warn: "border-destructive/40",
  }[tone];
  return (
    <div className={cn("editorial-card p-4 md:p-5 flex flex-col gap-1", toneCls)}>
      <div className="text-[11px] tracking-widest uppercase text-slate-ink">{label}</div>
      <div className="font-serif text-2xl md:text-3xl text-heritage leading-tight">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: Status | ReleaseStage }) {
  const map: Record<string, string> = {
    Draft: "bg-muted text-muted-foreground",
    "In Review": "bg-gold/15 text-heritage border border-gold/40",
    Approved: "bg-evergreen/15 text-evergreen border border-evergreen/40",
    Canonical: "bg-heritage text-heritage-foreground",
    Deprecated: "bg-destructive/10 text-destructive border border-destructive/30",
    Archived: "bg-muted text-muted-foreground",
    Planned: "bg-muted text-muted-foreground",
    Build: "bg-accent text-accent-foreground",
    Review: "bg-gold/15 text-heritage border border-gold/40",
    QA: "bg-accent text-accent-foreground",
    "Release Candidate": "bg-gold text-gold-foreground",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium tracking-wide", map[status] ?? "bg-muted")}>
      {status}
    </span>
  );
}

export function CanonicalMarker({ canonical }: { canonical: boolean }) {
  if (!canonical) return null;
  return <span className="inline-flex items-center gap-1 text-[10px] tracking-widest uppercase text-gold">◆ Canonical</span>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="editorial-card p-10 text-center">
      <div className="font-serif text-lg text-heritage">{title}</div>
      {description && <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="p-10 text-center text-sm text-muted-foreground">
      <div className="inline-block size-4 rounded-full border-2 border-gold border-t-transparent animate-spin mr-2 align-[-2px]" />
      {label}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return <div className="editorial-card p-6 border-destructive/40"><div className="text-destructive font-medium text-sm">{message}</div></div>;
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="font-serif text-lg text-heritage">{children}</h2>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
