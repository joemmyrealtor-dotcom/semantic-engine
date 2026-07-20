
-- Enums
DO $$ BEGIN
  CREATE TYPE public.launch_gate_id AS ENUM ('H1','H2','H3','H4');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.launch_gate_status AS ENUM ('PASS','BLOCKED-OPERATOR','FAIL','STALE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.launch_gate_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gate_id public.launch_gate_id NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  status public.launch_gate_status NOT NULL,
  attested_by UUID NOT NULL,
  attested_by_role public.app_role NOT NULL,
  attested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL CHECK (char_length(reason) >= 12),
  verifier TEXT NOT NULL,
  verifier_passed BOOLEAN NOT NULL,
  verifier_detail TEXT NOT NULL,
  build_fingerprint TEXT NOT NULL,
  superseded_by UUID NULL REFERENCES public.launch_gate_evidence(id),
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT launch_gate_evidence_pass_requires_verifier
    CHECK (status <> 'PASS' OR verifier_passed = TRUE),
  CONSTRAINT launch_gate_evidence_wsp_gate_ver_unique
    UNIQUE (workspace_id, gate_id, version)
);

-- Grants (no anon; no direct writes for authenticated — server-authoritative only)
GRANT SELECT ON public.launch_gate_evidence TO authenticated;
GRANT ALL ON public.launch_gate_evidence TO service_role;

-- RLS
ALTER TABLE public.launch_gate_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view gate evidence" ON public.launch_gate_evidence;
CREATE POLICY "members can view gate evidence"
ON public.launch_gate_evidence
FOR SELECT
TO authenticated
USING (public.is_workspace_member(auth.uid(), workspace_id));

-- No INSERT/UPDATE/DELETE policies for authenticated: server writes via service_role only.

-- Append-only trigger: block DELETE always; block UPDATE except when only superseded_by transitions NULL -> uuid
CREATE OR REPLACE FUNCTION public.enforce_gate_evidence_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'launch_gate_evidence is append-only; delete is forbidden';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id <> OLD.id
       OR NEW.gate_id <> OLD.gate_id
       OR NEW.workspace_id <> OLD.workspace_id
       OR NEW.version <> OLD.version
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.attested_by IS DISTINCT FROM OLD.attested_by
       OR NEW.attested_by_role IS DISTINCT FROM OLD.attested_by_role
       OR NEW.attested_at IS DISTINCT FROM OLD.attested_at
       OR NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW.verifier IS DISTINCT FROM OLD.verifier
       OR NEW.verifier_passed IS DISTINCT FROM OLD.verifier_passed
       OR NEW.verifier_detail IS DISTINCT FROM OLD.verifier_detail
       OR NEW.build_fingerprint IS DISTINCT FROM OLD.build_fingerprint
       OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'launch_gate_evidence is append-only; only superseded_by may be updated';
    END IF;
    IF OLD.superseded_by IS NOT NULL AND NEW.superseded_by IS DISTINCT FROM OLD.superseded_by THEN
      RAISE EXCEPTION 'launch_gate_evidence.superseded_by is write-once';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS launch_gate_evidence_append_only ON public.launch_gate_evidence;
CREATE TRIGGER launch_gate_evidence_append_only
  BEFORE UPDATE OR DELETE ON public.launch_gate_evidence
  FOR EACH ROW EXECUTE FUNCTION public.enforce_gate_evidence_append_only();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lge_workspace_gate_version
  ON public.launch_gate_evidence (workspace_id, gate_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_lge_workspace_active
  ON public.launch_gate_evidence (workspace_id, gate_id)
  WHERE superseded_by IS NULL;
CREATE INDEX IF NOT EXISTS idx_lge_build_fingerprint
  ON public.launch_gate_evidence (build_fingerprint);
