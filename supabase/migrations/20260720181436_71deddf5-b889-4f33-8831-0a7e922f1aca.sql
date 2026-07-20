
CREATE TABLE IF NOT EXISTS public.api_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  environment TEXT NOT NULL DEFAULT 'production',
  owner TEXT NOT NULL DEFAULT '',
  scopes TEXT[] NOT NULL DEFAULT '{}',
  key_reference_name TEXT,
  key_prefix TEXT NOT NULL DEFAULT '',
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60 CHECK (rate_limit_per_minute >= 0),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  last_used_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT api_clients_workspace_slug_unique UNIQUE (workspace_id, slug),
  CONSTRAINT api_clients_env_check CHECK (environment IN ('production','staging','local-demo'))
);

GRANT SELECT ON public.api_clients TO authenticated;
GRANT ALL ON public.api_clients TO service_role;

ALTER TABLE public.api_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view api clients" ON public.api_clients;
CREATE POLICY "members can view api clients"
ON public.api_clients
FOR SELECT
TO authenticated
USING (public.is_workspace_member(auth.uid(), workspace_id));

-- No INSERT/UPDATE/DELETE policies for authenticated: server writes via service_role only.

CREATE INDEX IF NOT EXISTS idx_api_clients_workspace_enabled
  ON public.api_clients (workspace_id, enabled);
CREATE INDEX IF NOT EXISTS idx_api_clients_workspace_demo
  ON public.api_clients (workspace_id, is_demo);
CREATE INDEX IF NOT EXISTS idx_api_clients_workspace_slug
  ON public.api_clients (workspace_id, slug);

CREATE TRIGGER update_api_clients_updated_at
  BEFORE UPDATE ON public.api_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
