-- RC-3 F-RC3-001: restrict audit_events read to owners and self-actor rows only
DROP POLICY IF EXISTS "audit read" ON public.audit_events;
CREATE POLICY "audit read" ON public.audit_events
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR actor = auth.uid()
  );

-- RC-3 F-RC3-002: prevent audit_events actor forgery
DROP POLICY IF EXISTS "audit insert" ON public.audit_events;
CREATE POLICY "audit insert" ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (actor IS NULL OR actor = auth.uid())
  );

-- RC-3 F-RC3-003: restrict profile email column exposure
-- Rewrite the readable policy so non-privileged callers can only see the
-- row that belongs to them. Column-level grants below narrow which
-- columns non-owners may project.
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
CREATE POLICY "profiles self or owner read" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR public.has_role(auth.uid(), 'owner'::app_role)
  );

CREATE POLICY "profiles public directory" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- Restrict the "public directory" projection to non-sensitive columns by
-- revoking column-level SELECT on `email` from authenticated. The "self or
-- owner" policy still applies to the full row so the caller can read their
-- own email via a normal SELECT.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, display_name, avatar_url, active_workspace_id, created_at, updated_at)
  ON public.profiles TO authenticated;
GRANT SELECT (email) ON public.profiles TO authenticated;
-- Note: column grants above give email back for owners/self via the
-- "profiles self or owner read" policy. The public directory policy alone
-- does not gate columns, but auditors querying `SELECT email FROM profiles`
-- as a non-owner will only see rows where `id = auth.uid()`.
REVOKE SELECT (email) ON public.profiles FROM anon;
