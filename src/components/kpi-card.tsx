// Shared KPI card used across Executive, Knowledge Intelligence, and Registry summaries.
// Domain-agnostic — pass in your own label/value/hint; do not embed feature logic here.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label, value, hint, trend, className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trend?: "up" | "down" | "flat";
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-2xl font-serif">{value}</div>
        {trend && (
          <span
            className={cn(
              "text-xs",
              trend === "up" && "text-evergreen",
              trend === "down" && "text-destructive",
              trend === "flat" && "text-muted-foreground",
            )}
            aria-label={`trend ${trend}`}
          >
            {trend === "up" ? "▲" : trend === "down" ? "▼" : "■"}
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
