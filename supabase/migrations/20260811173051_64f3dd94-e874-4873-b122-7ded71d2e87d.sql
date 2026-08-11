DO $$
DECLARE
  t record; p record; st timestamptz; en timestamptz; ddl text;
BEGIN
  st := clock_timestamp();
  DROP SCHEMA IF EXISTS dr_verify CASCADE;
  CREATE SCHEMA dr_verify;
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1 LOOP
    EXECUTE format('CREATE TABLE dr_verify.%I (LIKE public.%I INCLUDING ALL)', t.tablename, t.tablename);
    EXECUTE format('INSERT INTO dr_verify.%I SELECT * FROM public.%I', t.tablename, t.tablename);
    EXECUTE format('ALTER TABLE dr_verify.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
  FOR p IN SELECT * FROM pg_policies WHERE schemaname='public' LOOP
    ddl := format('CREATE POLICY %I ON dr_verify.%I AS %s FOR %s TO %s',
      p.policyname, p.tablename,
      CASE WHEN p.permissive='PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      p.cmd, array_to_string(p.roles, ','));
    IF p.qual IS NOT NULL THEN ddl := ddl || ' USING (' || p.qual || ')'; END IF;
    IF p.with_check IS NOT NULL THEN ddl := ddl || ' WITH CHECK (' || p.with_check || ')'; END IF;
    EXECUTE ddl;
  END LOOP;
  en := clock_timestamp();
  CREATE TABLE dr_verify._drill_log (drill_id text, started_at timestamptz, finished_at timestamptz, rto_seconds numeric);
  INSERT INTO dr_verify._drill_log VALUES ('DR-I2-'||to_char(st at time zone 'utc','YYYYMMDD"T"HH24MISS"Z"'), st, en, round(extract(epoch from (en-st))::numeric,3));
  REVOKE ALL ON SCHEMA dr_verify FROM PUBLIC, anon, authenticated;
END $$;