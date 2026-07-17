
-- Make the lockdown explicit for the linter. service_role bypasses RLS,
-- so this policy denies every non-service caller.
DROP POLICY IF EXISTS "rate_limit_buckets_deny_all" ON public.rate_limit_buckets;
CREATE POLICY "rate_limit_buckets_deny_all"
  ON public.rate_limit_buckets
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
