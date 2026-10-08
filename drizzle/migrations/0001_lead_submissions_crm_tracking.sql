ALTER TABLE public.lead_submissions
  ADD COLUMN crm_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN crm_last_error text,
  ADD COLUMN fub_person_id text;
REVOKE ALL ON public.lead_submissions FROM anon;
COMMENT ON TABLE public.lead_submissions IS 'Private lead records. Written only by the server lead endpoint; anon has no access; owners read.';