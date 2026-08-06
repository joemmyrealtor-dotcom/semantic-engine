// User-facing migration notice (Task 12).
// Shown once per session after a controlled snapshot upgrade or reseed.

import { useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { getLastMigration, subscribeMigration, migrationMessage } from "@/lib/data/db";

export function MigrationNotice() {
  const entry = useSyncExternalStore(subscribeMigration, getLastMigration, () => null);
  const [dismissed, setDismissed] = useState(false);
  if (!entry || dismissed) return null;
  const msg = migrationMessage();
  if (!msg) return null;
  const tone = entry.outcome === "migrated"
    ? "border-evergreen/50 bg-evergreen/10"
    : "border-gold/60 bg-gold/10";
  return (
    <div
      role="status"
      data-testid="migration-notice"
      data-outcome={entry.outcome}
      className={`mx-3 md:mx-6 mt-3 flex items-start gap-3 rounded border p-3 text-xs text-heritage ${tone}`}
    >
      <div className="flex-1">
        <div className="font-semibold uppercase tracking-widest text-[10px]">
          Data updated — v{entry.fromVersion} → v{entry.toVersion}
        </div>
        <p className="mt-1 text-muted-foreground">{msg}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss data update notice"
        className="text-muted-foreground hover:text-heritage"
        onClick={() => setDismissed(true)}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
