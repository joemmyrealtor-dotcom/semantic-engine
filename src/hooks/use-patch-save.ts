/**
 * Shared patch-style autosave (Workstream 8 follow-up).
 *
 * Studios like Client Toolkit, AI Pack, and Automation persist per-keystroke
 * via `Repo.update(kind, id, partial)`. This hook wraps that pattern so every
 * studio surfaces the same {saving, dirty, error, retry} state through
 * <SaveIndicator />, and so failed writes are retained (never silently lost).
 *
 * Behavior:
 *  - Serialises concurrent patches with an in-flight lock and pending queue,
 *    replaying the last-known payload on retry.
 *  - Reports `dirty` while a save is queued or in-flight; clears on success.
 *  - Retains the last failed payload; `retry()` replays it.
 *  - Optional `expectedUpdatedAt` guards against stale-editor conflicts.
 */
import { useCallback, useRef, useState } from "react";

export type PatchState = {
  saving: boolean;
  dirty: boolean;
  error: string | null;
  lastSavedAt: number | null;
  retry: () => void;
  conflict: boolean;
};

export type PatchOptions<T> = {
  save: (partial: Partial<T>) => Promise<void>;
  /** If provided, blocks the write when the record has changed elsewhere. */
  expectedUpdatedAt?: () => string | undefined;
  currentUpdatedAt?: () => string | undefined;
};

export function usePatchSave<T>(opts: PatchOptions<T>): {
  patch: (partial: Partial<T>) => Promise<void>;
  state: PatchState;
} {
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [conflict, setConflict] = useState(false);
  const inFlight = useRef(false);
  const lastFailed = useRef<Partial<T> | null>(null);
  const pending = useRef<Partial<T> | null>(null);

  const run = useCallback(async (partial: Partial<T>) => {
    if (isStalePatchConflict(opts.expectedUpdatedAt?.(), opts.currentUpdatedAt?.())) {
      setConflict(true);
      setError("Record changed elsewhere — refresh before editing.");
      lastFailed.current = partial;
      return;
    }
    inFlight.current = true;
    setSaving(true);
    try {
      await opts.save(partial);
      setError(null);
      setConflict(false);
      lastFailed.current = null;
      setLastSavedAt(Date.now());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      lastFailed.current = mergePendingPatch(lastFailed.current, partial);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
    const queued = pending.current;
    if (lastFailed.current) {
      // This attempt failed: fold anything typed meanwhile into the retained
      // payload instead of replaying it separately, so the failed keys are
      // never erased by a subsequent successful write.
      if (queued) {
        pending.current = null;
        lastFailed.current = mergePendingPatch(lastFailed.current, queued);
      }
      setDirty(true);
      return;
    }
    // Replay anything typed while this write was in flight so keystrokes
    // are never dropped.
    if (queued) {
      pending.current = null;
      await run(queued);
      return;
    }
    setDirty(false);
  }, [opts]);


  const patch = useCallback(async (partial: Partial<T>) => {
    setDirty(true);
    if (inFlight.current) {
      pending.current = mergePendingPatch(pending.current, partial);
      return;
    }
    await run(partial);
  }, [run]);

  const retry = useCallback(() => {
    const payload = mergePendingPatch(lastFailed.current, pending.current ?? {});
    if (Object.keys(payload).length) {
      pending.current = null;
      void run(payload);
    }
  }, [run]);


  return { patch, state: { saving, dirty, error, lastSavedAt, retry, conflict } };
}

// Pure helper — testable in the validation suite.
export function isStalePatchConflict(expected?: string, current?: string): boolean {
  if (!expected || !current) return false;
  return current > expected;
}

// Pure helper — testable in the validation suite.
export function mergePendingPatch<T>(
  prior: Partial<T> | null,
  next: Partial<T>,
): Partial<T> {
  return { ...(prior ?? {}), ...next };
}
