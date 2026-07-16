// Shared save-state indicator for autosaving editors.
// Consistent labels across Publications, Agents, Toolkits, AI Packs, Automations.
import { Save } from "lucide-react";

export function SaveIndicator({
  saving, dirty, error, lastSavedAt, onRetry,
}: {
  saving: boolean;
  dirty: boolean;
  error?: string | null;
  lastSavedAt?: number | null;
  onRetry?: () => void;
}) {
  if (error) {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-destructive">
        Save failed{onRetry && (
          <button onClick={onRetry} className="underline underline-offset-2">retry</button>
        )}
      </span>
    );
  }
  if (saving) return <span className="text-xs text-muted-foreground">Saving…</span>;
  if (dirty) return <span className="text-xs text-gold">Unsaved…</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-evergreen">
      <Save className="size-3" aria-hidden="true" />
      Saved{lastSavedAt ? ` · ${new Date(lastSavedAt).toLocaleTimeString()}` : ""}
    </span>
  );
}
