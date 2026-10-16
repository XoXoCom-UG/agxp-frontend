-- AgxP — fiecare user are agentii lui (2026-10-15)
--
-- Pana acum `agents` era un catalog comun: politica agents_select_authenticated
-- avea `using (true)`, deci orice user vedea agentii seedati SI pe cei creati de
-- altii (nume, descrieri). Decis cu Ana pe 2026-10-15:
--
--   * un user vede doar agentii creati de el; niciun agent nu e comun;
--   * un user nou porneste fara agenti: vede tipurile si isi creeaza agenti
--     din ele;
--   * Free: un singur tip pe rol, cate un agent pe tip. Mid si Max: toate
--     tipurile, pana la 4 agenti pe tip. (lib/plans.ts: agentTypes si
--     agentsPerType; aici e doar copia de aplicare a numarului pe tip.)
--
-- Ce exista deja ramane la proprietar. Un proiect care foloseste un agent care
-- nu e al proprietarului lui (un agent din catalog, sau unul creat de alt user)
-- primeste o COPIE a agentului, a proprietarului, si e mutat pe ea — istoricul
-- ramane intreg. Agentii din catalog ramasi fara proiecte devin invizibili
-- pentru toti; randurile lor nu se sterg.
--
-- Mascota (nivelul) unui agent traieste in browser si se leaga de id-ul lui, deci
-- pentru o copie porneste de la capat; memoria agentului se reconstruieste din
-- proiectele userului, deci ramane.

-- Trigger-ul de la pasul 3 foloseste archived_at (0006). Coloana se adauga aici,
-- ca 0014 sa mearga si pe o baza unde 0006 nu a rulat inca; 0006 ramane valabila.
alter table agents add column if not exists archived_at timestamptz;

-- ── 1. copii pentru proiectele care folosesc agentul altcuiva ───────────────
drop table if exists _agent_copies;
create temp table _agent_copies as
select x.owner_id, x.old_id, gen_random_uuid() as new_id
from (
  select p.owner_id, p.consultant_agent_id as old_id from agxp_projects p where p.consultant_agent_id is not null
  union
  select p.owner_id, p.coach_agent_id from agxp_projects p where p.coach_agent_id is not null
) x
join agents a on a.id = x.old_id
where a.created_by is distinct from x.owner_id;

insert into agents (id, type, name, avatar_placeholder, tagline, description, expertise, knowledge_level, created_by)
select c.new_id, a.type, a.name, a.avatar_placeholder, a.tagline, a.description, a.expertise, a.knowledge_level, c.owner_id
from _agent_copies c
join agents a on a.id = c.old_id;

insert into agent_methods (agent_id, method_id)
select c.new_id, am.method_id
from _agent_copies c
join agent_methods am on am.agent_id = c.old_id;

update agxp_projects p
   set consultant_agent_id = c.new_id
  from _agent_copies c
 where p.owner_id = c.owner_id and p.consultant_agent_id = c.old_id;

update agxp_projects p
   set coach_agent_id = c.new_id
  from _agent_copies c
 where p.owner_id = c.owner_id and p.coach_agent_id = c.old_id;

drop table if exists _agent_copies;

-- ── 2. fiecare vede doar ce e al lui ────────────────────────────────────────
-- Aceleasi nume de politici ca in 0001, ca ensure_policies.sql si
-- fix_create_agent.sql (care le recreeaza dupa nume) sa nu readuca `using (true)`.
drop policy if exists "agents_select_authenticated" on agents;
create policy "agents_select_authenticated" on agents
  for select to authenticated using (created_by = auth.uid());

drop policy if exists "agent_methods_select_authenticated" on agent_methods;
create policy "agent_methods_select_authenticated" on agent_methods
  for select to authenticated
  using (exists (select 1 from agents a where a.id = agent_id and a.created_by = auth.uid()));

drop policy if exists "agent_projects_select_authenticated" on agent_projects;
create policy "agent_projects_select_authenticated" on agent_projects
  for select to authenticated
  using (exists (select 1 from agents a where a.id = agent_id and a.created_by = auth.uid()));

-- ── 3. limita pe tip, aplicata in baza ──────────────────────────────────────
-- Aceeasi idee ca la proiecte (0008): browserul da mesajul clar, baza tine
-- limita. Numerele sunt duplicate din lib/plans.ts (agentsPerType) si schimbarea
-- unei limite inseamna schimbarea in AMBELE locuri.
alter table agxp_plan_limits add column if not exists agents_per_type integer not null default 4;
update agxp_plan_limits set agents_per_type = 1 where plan = 'free';
update agxp_plan_limits set agents_per_type = 4 where plan in ('mid', 'max');

-- Tipul unui agent e (rol, tagline): tagline-ul e sub-titlul sablonului din
-- lib/agent-types.ts, singura legatura inapoi spre tip. Numarul de TIPURI vizibile
-- pe plan (free: unul pe rol) ramane doar in aplicatie: agentii nu costa tokeni, deci
-- nu e limita care apara bani.
create or replace function enforce_agent_limit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan  text;
  v_limit integer;
  v_count integer;
begin
  -- Randurile fara proprietar (seed, SQL editor) nu apartin nimanui.
  if new.created_by is null then return new; end if;
  -- Arhivarea elibereaza un loc; doar crearea si restaurarea il ocupa.
  if new.archived_at is not null then return new; end if;
  if tg_op = 'UPDATE' and old.archived_at is null then return new; end if;

  select coalesce(e.plan, 'free') into v_plan
    from agxp_entitlements e where e.user_id = new.created_by;
  v_plan := coalesce(v_plan, 'free');

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

drop trigger if exists agents_limit on agents;
create trigger agents_limit
  before insert or update of archived_at on agents
  for each row execute function enforce_agent_limit();

-- ── 4. un proiect foloseste doar agentii proprietarului ─────────────────────
-- Ascunderea din liste nu e securitate: fara asta un id de agent ghicit sau
-- aflat ar putea fi pus pe proiectul altcuiva. Dupa pasul 1 nimic existent nu
-- incalca regula.
create or replace function enforce_project_agent_owner() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.consultant_agent_id is not null and not exists (
    select 1 from agents a where a.id = new.consultant_agent_id and a.created_by = new.owner_id
  ) then
    raise exception 'That agent does not belong to you.' using errcode = 'P0001';
  end if;
  if new.coach_agent_id is not null and not exists (
    select 1 from agents a where a.id = new.coach_agent_id and a.created_by = new.owner_id
  ) then
    raise exception 'That agent does not belong to you.' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists agxp_projects_agent_owner on agxp_projects;
create trigger agxp_projects_agent_owner
  before insert or update of consultant_agent_id, coach_agent_id on agxp_projects
  for each row execute function enforce_project_agent_owner();
