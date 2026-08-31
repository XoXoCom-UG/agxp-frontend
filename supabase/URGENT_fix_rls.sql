-- URGENT: undo the accidental RLS-enable on the OLD app's `projects` table.
-- Our 0003 migration collided with a pre-existing `projects` table from the
-- old bi-agent-frontend schema (same Supabase project, reused DB) and this
-- statement succeeded before the migration failed on the next one:
alter table projects disable row level security;

-- Sanity check: confirm no policies are lingering on it either.
select policyname from pg_policies where tablename = 'projects';
