-- Workstream 9 Blocker #1 — identity, memberships, and workspace-scoped RBAC schema
-- ============================================================================
-- Adds:
--   1. public.workspaces — real workspace records (id, name, slug)
--   2. public.workspace_memberships — links auth.users to a workspace with a role
--   3. Extends the existing public.profiles table with display metadata
--   4. Security-definer helpers for membership + workspace-role checks
--   5. RLS on all three so users can read only their own profile / memberships
--      and only administrators can manage memberships/workspaces.
-- The application-side Role type is normalized to the legacy Supabase app_role
-- enum ('owner','editor','reviewer','contributor','viewer') that already
-- backs the user_roles table shipped in Workstream 2.

-- 1. Workspaces --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.workspaces TO authenticated;
GRANT ALL    ON public.workspaces TO service_role;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- 2. Workspace memberships ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_memberships (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  role          public.app_role NOT NULL DEFAULT 'viewer',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_memberships TO authenticated;
GRANT ALL ON public.workspace_memberships TO service_role;

ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS workspace_memberships_user_idx
  ON public.workspace_memberships(user_id);

-- 3. Profile display metadata -----------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS active_workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- 4. Security-definer helpers -----------------------------------------------
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id uuid, _workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_memberships
    WHERE user_id = _user_id AND workspace_id = _workspace_id
  );
$$;

CREATE OR REPLACE FUNCTION public.workspace_role(_user_id uuid, _workspace_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.workspace_memberships
  WHERE user_id = _user_id AND workspace_id = _workspace_id
  LIMIT 1;
$$;

-- 5. RLS policies ------------------------------------------------------------
-- Workspaces: readable when the caller is a member; managed by admins.
DROP POLICY IF EXISTS "Members can read their workspaces" ON public.workspaces;
CREATE POLICY "Members can read their workspaces"
  ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), id));

DROP POLICY IF EXISTS "Owners can manage workspaces" ON public.workspaces;
CREATE POLICY "Owners can manage workspaces"
  ON public.workspaces FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Memberships: users see their own; owners/admins manage.
DROP POLICY IF EXISTS "Users can read their memberships" ON public.workspace_memberships;
CREATE POLICY "Users can read their memberships"
  ON public.workspace_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "Owners manage memberships" ON public.workspace_memberships;
CREATE POLICY "Owners manage memberships"
  ON public.workspace_memberships FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_workspace_memberships_updated_at ON public.workspace_memberships;
CREATE TRIGGER trg_workspace_memberships_updated_at
  BEFORE UPDATE ON public.workspace_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();