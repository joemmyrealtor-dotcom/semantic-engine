import type { PublicationStage } from "@/lib/data/schema";
import { cn } from "@/lib/utils";

const map: Record<PublicationStage, string> = {
  Draft: "bg-muted text-muted-foreground",
  Editorial: "bg-gold/15 text-heritage border border-gold/40",
  "SME Review": "bg-accent text-accent-foreground border border-border",
  QA: "bg-gold/25 text-heritage border border-gold/50",
  Canonical: "bg-heritage text-heritage-foreground",
  Released: "bg-evergreen text-white",
};

export function PublicationStageBadge({ stage, className }: { stage: PublicationStage; className?: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium tracking-wide", map[stage], className)}>
      {stage}
    </span>
  );
}
