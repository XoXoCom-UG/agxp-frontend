-- Idempotent safety net: makes sure every RLS policy the app needs exists.
-- Safe to run as many times as you like (each policy is dropped first).
--
-- Run this if you see errors like:
--   "new row violates row-level security policy for table \"agents\""
-- which means the INSERT policy from migration 0005 never got applied.

-- ── agents: shared catalog, readable by everyone signed in, writable by the
--    user who creates the agent (lib/agents.ts sets created_by = auth.uid()).
drop policy if exists "agents_select_authenticated" on agents;
create policy "agents_select_authenticated" on agents
  for select to authenticated using (true);

drop policy if exists "agents_insert_authenticated" on agents;
create policy "agents_insert_authenticated" on agents
  for insert to authenticated with check (created_by = auth.uid());

-- ── agent_methods: link rows for an agent the current user created
drop policy if exists "agent_methods_select_authenticated" on agent_methods;
create policy "agent_methods_select_authenticated" on agent_methods
  for select to authenticated using (true);

drop policy if exists "agent_methods_insert_authenticated" on agent_methods;
create policy "agent_methods_insert_authenticated" on agent_methods
  for insert to authenticated
  with check (exists (select 1 from agents a where a.id = agent_id and a.created_by = auth.uid()));

-- ── skills / methods / agent_projects: read-only catalog
drop policy if exists "skills_select_authenticated" on skills;
create policy "skills_select_authenticated" on skills for select to authenticated using (true);

drop policy if exists "methods_select_authenticated" on methods;
create policy "methods_select_authenticated" on methods for select to authenticated using (true);

drop policy if exists "agent_projects_select_authenticated" on agent_projects;
create policy "agent_projects_select_authenticated" on agent_projects for select to authenticated using (true);

-- ── agxp_projects: private to the owner
drop policy if exists "agxp_projects_owner_select" on agxp_projects;
create policy "agxp_projects_owner_select" on agxp_projects for select to authenticated using (owner_id = auth.uid());

drop policy if exists "agxp_projects_owner_insert" on agxp_projects;
create policy "agxp_projects_owner_insert" on agxp_projects for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "agxp_projects_owner_update" on agxp_projects;
create policy "agxp_projects_owner_update" on agxp_projects for update to authenticated using (owner_id = auth.uid());

drop policy if exists "agxp_projects_owner_delete" on agxp_projects;
create policy "agxp_projects_owner_delete" on agxp_projects for delete to authenticated using (owner_id = auth.uid());

-- ── agxp_project_messages: private via the parent project
drop policy if exists "agxp_project_messages_owner_select" on agxp_project_messages;
create policy "agxp_project_messages_owner_select" on agxp_project_messages for select to authenticated
  using (exists (select 1 from agxp_projects p where p.id = project_id and p.owner_id = auth.uid()));

drop policy if exists "agxp_project_messages_owner_insert" on agxp_project_messages;
create policy "agxp_project_messages_owner_insert" on agxp_project_messages for insert to authenticated
  with check (exists (select 1 from agxp_projects p where p.id = project_id and p.owner_id = auth.uid()));

drop policy if exists "agxp_project_messages_owner_delete" on agxp_project_messages;
create policy "agxp_project_messages_owner_delete" on agxp_project_messages for delete to authenticated
  using (exists (select 1 from agxp_projects p where p.id = project_id and p.owner_id = auth.uid()));

-- ── Verify: paste this result back if anything still fails
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('agents','agent_methods','skills','methods','agent_projects','agxp_projects','agxp_project_messages')
order by tablename, cmd, policyname;
