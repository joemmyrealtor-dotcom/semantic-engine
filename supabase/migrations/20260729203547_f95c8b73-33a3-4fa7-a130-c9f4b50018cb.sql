-- Internal-only routines: not part of the public API surface.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_ko_governance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_release_gate() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_gate_evidence_append_only() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limit_buckets() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_ko_governance() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_release_gate() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_gate_evidence_append_only() TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limit_buckets() TO service_role;

-- Authorization helpers: needed by signed-in users (RLS policies + app RPC),
-- never by anonymous callers.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.workspace_role(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.workspace_role(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated, service_role;