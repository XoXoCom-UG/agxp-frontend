-- 0001 only granted SELECT on agents/agent_methods (they started as a
-- seeded, read-only catalog). The UI now lets a signed-in user create their
-- own custom agent ("Create new agent" in the setup flow), which needs
-- INSERT — without it, the insert is silently denied by RLS and the button
-- appears to do nothing.
create policy "agents_insert_authenticated" on agents for insert to authenticated
  with check (created_by = auth.uid());

create policy "agent_methods_insert_authenticated" on agent_methods for insert to authenticated
  with check (exists (select 1 from agents a where a.id = agent_id and a.created_by = auth.uid()));
