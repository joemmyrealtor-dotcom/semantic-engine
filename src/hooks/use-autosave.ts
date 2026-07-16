// Shared autosave hook.
// - Debounces persistence and preserves dirty state on failure so edits are never silently lost.
// - Detects stale-editor conflicts (record changed elsewhere) and surfaces retry state.
// Extracted during Architecture Stabilization Pass (Workstream 7.5).
import { useEffect, useRef, useState } from "react";

export type AutosaveState = {
  saving: boolean;
  dirty: boolean;
  error: string | null;
  lastSavedAt: number | null;
  retry: () => void;
};

export type AutosaveOptions<T> = {
  draft: T | null | undefined;
  dirty: boolean;
  onSaved: () => void;
  save: (value: T) => Promise<void>;
  delayMs?: number;
  onError?: (err: unknown) => void;
};

export function useAutosave<T>(opts: AutosaveOptions<T>): AutosaveState {
  const { draft, dirty, onSaved, save, delayMs = 800, onError } = opts;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!draft || !dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (inFlight.current) return; // concurrency guard
      inFlight.current = true;
      setSaving(true);
      try {
        await save(draft);
        setError(null);
        setLastSavedAt(Date.now());
        onSaved();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        onError?.(e);
      } finally {
        inFlight.current = false;
        setSaving(false);
      }
    }, delayMs);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, dirty, nonce]);

  return { saving, dirty, error, lastSavedAt, retry: () => setNonce(n => n + 1) };
}

// Pure helper — testable in the validation suite.
export function isStaleConflict(originalUpdatedAt?: string, draftUpdatedAt?: string, dirty?: boolean): boolean {
  if (!dirty || !originalUpdatedAt || !draftUpdatedAt) return false;
  return originalUpdatedAt > draftUpdatedAt;
}
