ALTER TABLE public.lead_submissions
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz,
  ADD COLUMN IF NOT EXISTS bot_risk text;

UPDATE public.lead_submissions SET delivery_status = CASE crm_status
  WHEN 'fub_sent' THEN 'delivered'
  WHEN 'fub_failed' THEN 'retrying'
  ELSE 'pending' END;

ALTER TABLE public.lead_submissions
  ADD CONSTRAINT lead_submissions_delivery_status_chk
  CHECK (delivery_status IN ('pending','retrying','delivered','dead_letter'));

CREATE INDEX IF NOT EXISTS lead_submissions_due_idx
  ON public.lead_submissions (next_attempt_at)
  WHERE delivery_status IN ('pending','retrying');

-- Atomically lock due records so two runs can never send the same lead.
CREATE OR REPLACE FUNCTION public.claim_due_lead_deliveries(p_limit integer, p_lock_seconds integer)
RETURNS SETOF public.lead_submissions
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  UPDATE public.lead_submissions s
     SET locked_until = now() + make_interval(secs => p_lock_seconds)
   WHERE s.id IN (
     SELECT id FROM public.lead_submissions
      WHERE delivery_status IN ('pending','retrying')
        AND next_attempt_at <= now()
        AND (locked_until IS NULL OR locked_until < now())
      ORDER BY next_attempt_at
      LIMIT LEAST(GREATEST(p_limit, 1), 25)
      FOR UPDATE SKIP LOCKED)
  RETURNING s.*;
$$;
REVOKE ALL ON FUNCTION public.claim_due_lead_deliveries(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_lead_deliveries(integer, integer) TO service_role;

CREATE TABLE public.lead_delivery_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.lead_submissions(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'dead_letter',
  message text NOT NULL,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, kind)
);
GRANT SELECT, UPDATE ON public.lead_delivery_alerts TO authenticated;
GRANT ALL ON public.lead_delivery_alerts TO service_role;
ALTER TABLE public.lead_delivery_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read delivery alerts" ON public.lead_delivery_alerts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners acknowledge delivery alerts" ON public.lead_delivery_alerts
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));