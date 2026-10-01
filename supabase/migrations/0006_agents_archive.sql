-- Agents are archived, not deleted (Ana, 2026-10-01).
--
-- An archived agent leaves the picker and frees its slot in the four per
-- type, but keeps its place on the projects it worked on, its documents and
-- what it learned — and can be restored from the Agent Dashboard.
--
-- 0001 made `agents` a read-only catalog and 0005 added INSERT; archiving
-- needs UPDATE, scoped to the agents the user created. Without this policy an
-- update is filtered to zero rows by RLS without an error.
alter table agents add column if not exists archived_at timestamptz;

drop policy if exists "agents_update_own" on agents;
create policy "agents_update_own" on agents
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
