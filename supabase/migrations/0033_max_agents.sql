-- Cel mult 1 sau 5 consultanti pe plan (meeting 2026-11-20, Patryk: "nur noch
-- eins oder fünf je nach Plan"). Asistentul (type = 'coach') nu se numara.
-- Numerele sunt duplicate din lib/plans.ts (maxAgents): schimbarea unei limite
-- inseamna schimbarea in AMBELE locuri. Free si Mid au fost ridicate la Max in
-- 0015 (EVERYONE_IS_MAX); randurile de aici urmeaza aceeasi regula, deci intai
-- se pune numarul planului, apoi se aliniaza la Max cat timp flag-ul e pornit.
alter table agxp_plan_limits add column if not exists max_agents integer not null default 5;
update agxp_plan_limits set max_agents = 1 where plan = 'free';
update agxp_plan_limits set max_agents = 5 where plan in ('mid', 'max');
-- Cat timp toti sunt pe Max (lib/plans.ts EVERYONE_IS_MAX), baza tine aceleasi numere ca Max.
-- Se reface la oprirea flag-ului:  update agxp_plan_limits set max_agents = 1 where plan = 'free';
update agxp_plan_limits l set max_agents = m.max_agents
  from agxp_plan_limits m where m.plan = 'max' and l.plan in ('free', 'mid');

create or replace function enforce_agent_limit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan  text;
  v_limit integer;
  v_total integer;
  v_count integer;
begin
  if new.created_by is null then return new; end if;
  if new.archived_at is not null then return new; end if;
  if tg_op = 'UPDATE' and old.archived_at is null then return new; end if;

  select coalesce(e.plan, 'free') into v_plan
    from agxp_entitlements e where e.user_id = new.created_by;
  v_plan := coalesce(v_plan, 'free');

  -- Totalul de consultanti.
  if new.type = 'consultant' then
    select l.max_agents into v_total from agxp_plan_limits l where l.plan = v_plan;
    if v_total is null then
      select l.max_agents into v_total from agxp_plan_limits l where l.plan = 'free';
    end if;
    select count(*) into v_count
      from agents a
     where a.created_by = new.created_by and a.type = 'consultant'
       and a.archived_at is null and a.id <> new.id;
    if v_count >= v_total then
      raise exception
        'Your plan covers % consultants in all. Archive one to free the place.', v_total
        using errcode = 'P0001';
    end if;
  end if;

  -- Cate de acelasi tip (ca in 0014).
  select l.agents_per_type into v_limit from agxp_plan_limits l where l.plan = v_plan;
  if v_limit is null then
    select l.agents_per_type into v_limit from agxp_plan_limits l where l.plan = 'free';
  end if;

  select count(*) into v_count
    from agents a
   where a.created_by = new.created_by
     and a.type = new.type
     and a.archived_at is null
     and a.tagline is not distinct from new.tagline
     and a.id <> new.id;

  if v_count >= v_limit then
    raise exception
      'You already have % of this kind of agent, which is what your plan allows. Archive one to free the place.',
      v_count
      using errcode = 'P0001';
  end if;

  return new;
end $$;
