-- RC-2 medium finding indexes.
-- audit_events: predicate actor = ? ORDER BY created_at DESC LIMIT n.
--   Composite (actor, created_at DESC) serves equality on actor and satisfies
--   the ordering without an extra Sort node, and works for any actor.
-- knowledge_objects: predicate steward = ? (equality). Single-column btree.
-- Regular CREATE INDEX (not CONCURRENTLY) is used because the Supabase migration
-- runner executes migrations inside a single transaction, which forbids
-- CONCURRENTLY. Both tables are small in this project; the resulting
-- ACCESS EXCLUSIVE lock is brief. Deployment mitigation: run during a low-write
-- window; the operations are idempotent (IF NOT EXISTS) and fully reversible
-- via DROP INDEX.
CREATE INDEX IF NOT EXISTS audit_events_actor_created_at_idx
  ON public.audit_events (actor, created_at DESC);

CREATE INDEX IF NOT EXISTS knowledge_objects_steward_idx
  ON public.knowledge_objects (steward);