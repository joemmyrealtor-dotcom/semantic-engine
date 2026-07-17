
-- RC-1 Blocker #4 — Distributed rate-limit storage for /api/public/v1/*
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key            TEXT PRIMARY KEY,
  current_count  INTEGER NOT NULL DEFAULT 0,
  window_start   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reset_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '60 seconds'),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grants: only the trusted backend service touches these rows. No anon/authenticated grants.
GRANT ALL ON public.rate_limit_buckets TO service_role;

-- RLS enabled with no permissive policies for anon/authenticated — service_role bypasses RLS.
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- Index optimised for lookup by key (PK already covers), plus expiry sweeps.
CREATE INDEX IF NOT EXISTS rate_limit_buckets_reset_at_idx
  ON public.rate_limit_buckets (reset_at);

-- Atomic consume: SELECT ... FOR UPDATE + UPSERT.
-- Returns (allowed, current_count, window_start, reset_at) so callers can build headers.
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key TEXT,
  p_window_seconds INTEGER,
  p_max INTEGER
)
RETURNS TABLE (allowed BOOLEAN, current_count INTEGER, window_start TIMESTAMPTZ, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.rate_limit_buckets%ROWTYPE;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Lock the row (or absence of it) to serialize concurrent consumers.
  SELECT * INTO v_row FROM public.rate_limit_buckets WHERE key = p_key FOR UPDATE;

  IF NOT FOUND OR v_now - v_row.window_start >= (p_window_seconds || ' seconds')::interval THEN
    INSERT INTO public.rate_limit_buckets (key, current_count, window_start, reset_at, updated_at)
    VALUES (p_key, 1, v_now, v_now + (p_window_seconds || ' seconds')::interval, v_now)
    ON CONFLICT (key) DO UPDATE
      SET current_count = 1,
          window_start = EXCLUDED.window_start,
          reset_at = EXCLUDED.reset_at,
          updated_at = EXCLUDED.updated_at
    RETURNING public.rate_limit_buckets.* INTO v_row;
    allowed := TRUE;
    current_count := v_row.current_count;
    window_start := v_row.window_start;
    reset_at := v_row.reset_at;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_row.current_count >= p_max THEN
    allowed := FALSE;
    current_count := v_row.current_count;
    window_start := v_row.window_start;
    reset_at := v_row.reset_at;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.rate_limit_buckets
     SET current_count = v_row.current_count + 1,
         updated_at = v_now
   WHERE key = p_key
   RETURNING public.rate_limit_buckets.* INTO v_row;

  allowed := TRUE;
  current_count := v_row.current_count;
  window_start := v_row.window_start;
  reset_at := v_row.reset_at;
  RETURN NEXT;
END;
$$;

-- Restrict function execution to the trusted backend service.
REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

-- Cleanup helper: sweep expired rows. Callable by service_role only.
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_buckets()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.rate_limit_buckets WHERE reset_at < (now() - interval '1 hour');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_rate_limit_buckets() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_rate_limit_buckets() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limit_buckets() TO service_role;
