CREATE TABLE public.lead_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  form_id text NOT NULL,
  pipeline text NOT NULL,
  email text NOT NULL,
  payload jsonb NOT NULL,
  crm_status text NOT NULL DEFAULT 'stored',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lead_submissions TO authenticated;
GRANT ALL ON public.lead_submissions TO service_role;
ALTER TABLE public.lead_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can read lead submissions"
ON public.lead_submissions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner'));