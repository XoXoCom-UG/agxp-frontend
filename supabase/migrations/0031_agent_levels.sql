-- 0031_agent_levels.sql — the agent's level, earned from real work (Ana, 2026-11-03).
--
-- The mascot's 1-5 look used to be a counter in the browser (one level per
-- answer), and the "Experience" label a separate count of projects. They are
-- now one number, decided by lib/agent-level.ts from what the agent has done
-- for its owner, and the highest level reached is kept here so it never goes
-- down when a project is deleted or a conversation starts over.
--
--   agents.level_reached  1-5, only ever raised (trigger below)
--   agent_work(agent)     what the level is counted from: answers given, and
--                         projects in which it produced a finished document
--
-- agents is per user since 0014 and the owner may update it since 0006, so
-- the browser raises level_reached itself. It is cosmetic — nothing is
-- unlocked by it — so a hand-written value gains the user nothing; the
-- trigger only keeps it inside 1-5 and stops it falling.
--
-- agent_work is security INVOKER: it reads agxp_projects and
-- agxp_project_messages under the caller's own row level security, so it can
-- only ever count the caller's work, whatever agent id is passed in. A
-- finished document is an assistant message carrying a [[DOC: ...]] marker,
-- the same test lib/agent-documents.ts starts from.
--
-- Safe to re-run.

alter table agents add column if not exists level_reached smallint not null default 1;

create or replace function agents_keep_level()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.level_reached := greatest(coalesce(old.level_reached, 1), coalesce(new.level_reached, 1));
  end if;
  new.level_reached := least(5, greatest(1, coalesce(new.level_reached, 1)));
  return new;
end;
$$;

drop trigger if exists agents_keep_level on agents;
create trigger agents_keep_level
  before insert or update on agents
  for each row execute function agents_keep_level();

create or replace function agent_work(p_agent_id uuid)
returns table (replies integer, doc_projects integer)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (count(*) filter (where m.role = 'assistant'))::integer,
    (count(distinct m.project_id) filter (where m.role = 'assistant' and m.content like '%[[DOC:%'))::integer
  from agxp_projects p
  join agxp_project_messages m
    on m.project_id = p.id
   and m.column_type = (case when p.coach_agent_id = p_agent_id then 'coach' else 'consultant' end)::agent_type
  where p.coach_agent_id = p_agent_id or p.consultant_agent_id = p_agent_id;
$$;

revoke all on function agent_work(uuid) from public, anon;
grant execute on function agent_work(uuid) to authenticated, service_role;

-- Agents that already did the work start where that work puts them, not at 1.
-- Runs as the SQL editor's role, so it sees every user's rows; the owner column
-- is the project's, and each agent belongs to one user.
update agents a
set level_reached = greatest(a.level_reached, w.lvl)
from (
  select ag.id,
         case
           when d.docs >= 3 then 5
           when d.docs = 2 then 4
           when d.docs = 1 then 3
           when d.replies >= 5 then 2
           else 1
         end as lvl
  from agents ag
  left join lateral (
    select
      (count(*) filter (where m.role = 'assistant'))::int as replies,
      (count(distinct m.project_id) filter (where m.role = 'assistant' and m.content like '%[[DOC:%'))::int as docs
    from agxp_projects p
    join agxp_project_messages m
      on m.project_id = p.id
     and m.column_type = (case when p.coach_agent_id = ag.id then 'coach' else 'consultant' end)::agent_type
    where p.coach_agent_id = ag.id or p.consultant_agent_id = ag.id
  ) d on true
  where ag.created_by is not null
) w
where a.id = w.id and w.lvl is not null;
