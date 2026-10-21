-- ===========================================================================
-- AgxP — migrarile 0013, 0014, 0015, 0016 intr-un singur fisier
--
-- Generat din supabase/migrations/. Continutul e copiat din fisierele
-- originale, in ordine, cu O SINGURA modificare, marcata la locul ei in 0014:
-- blocul cu tabela temporara e invelit intr-un `do $copies$ ... $copies$;`,
-- fiindca SQL Editor-ul Supabase nu tine o tabela temporara vie de la o
-- instructiune la alta. SQL-ul dinauntru e neatins.
--
-- CUM SE RULEAZA
--   Supabase Studio -> SQL Editor -> lipesti tot -> Run. O singura data,
--   dintr-o bucata: totul e intr-o tranzactie, deci ori intra tot, ori nimic.
--   Daca pica, nu ramane nimic pe jumatate aplicat — trimite-mi eroarea.
--
--   Se poate rula de mai multe ori fara pagube: tabelele si coloanele sunt
--   `if not exists`, functiile `create or replace`, triggerele si politicile
--   se sterg inainte sa fie recreate, iar insert-urile au `on conflict` sau
--   `where not exists`. Copierea agentilor din 0014 se face o singura data:
--   la a doua rulare multimea de copiat e goala.
--
-- CE PRESUPUNE CA EXISTA DEJA
--   0001 (agents, skills, methods, agent_methods, agent_projects),
--   0003 (agxp_projects, agxp_project_messages) si 0008 (agxp_plan_limits).
--   Nu depinde de 0011 si 0012 — acelea raman de verificat separat.
--
-- CE NU E AICI, DELIBERAT
--   seed.sql — incepe cu `delete from agents/methods/skills` si ar sterge
--   metodele puse de 0016 si, prin cascada, agentii creati de useri.
--   URGENT_fix_rls.sql, ensure_policies.sql, fix_create_agent.sql — reparatii
--   de dinainte de 0014; unele slabesc chiar politicile pe care 0014 le strange.
--
-- DUPA RULARE
--   Verifica cu supabase/health_check.sql, care acopera 0013 si 0014.
-- ===========================================================================

begin;


-- ---------------------------------------------------------------------------
-- 0013_project_category_and_cleanup.sql
-- ---------------------------------------------------------------------------

-- AgxP — categorie per proiect si curatarea proiectelor goale (2026-10-13)
--
-- Doua lucruri din sedinta cu Patryk din 9 oct.:
--
--  1. Istoricul proiectelor se sorteaza si se coloreaza dupa categorie. Pana
--     acum industria nu era stocata nicaieri: se citea din markerele
--     [[INDUSTRY:]] ale mesajelor, scanand pana la 4000 de mesaje la fiecare
--     deschidere a istoricului. Acum agentul o scrie pe rand, odata.
--
--  2. Un chat deschis fara niciun mesaj nu trebuie sa ramana. Randul se
--     creeaza cand alegi un agent (assignAgent are nevoie de un proiect), deci
--     un start abandonat lasa un proiect gol — si, cum trigger-ul din 0008
--     numara randurile, il lasa si scazut din limita saptamanala.

alter table agxp_projects add column if not exists category text;

-- Fara index: se filtreaza si se sorteaza pe lista proprie a utilizatorului,
-- care are zeci de randuri, nu milioane.

-- ── proiectele goale ────────────────────────────────────────────────────────
-- security INVOKER, deliberat: stergerea trece prin politica
-- agxp_projects_owner_delete (0003), deci apelantul nu poate atinge proiectele
-- altcuiva chiar daca ar da alt `keep`. Cascada spre mesaje si
-- delete_project_files() din 0011 curata restul.
--
-- Doua conditii pe langa "fara mesaje":
--   * `keep` — proiectul deschis acum pe ecran, care e gol exact cat timp
--     utilizatorul inca scrie primul mesaj;
--   * mai vechi de 2 minute — o a doua fila sau un alt dispozitiv care tocmai
--     a ales un agent nu trebuie sa-si piarda proiectul pe sub picioare.
create or replace function discard_empty_projects(keep uuid default null)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  removed integer;
begin
  with gone as (
    delete from agxp_projects p
     where p.owner_id = auth.uid()
       and (keep is null or p.id <> keep)
       and p.created_at < now() - interval '2 minutes'
       and not exists (select 1 from agxp_project_messages m where m.project_id = p.id)
    returning 1
  )
  select count(*) into removed from gone;
  return removed;
end;
$$;

revoke all on function discard_empty_projects(uuid) from public;
grant execute on function discard_empty_projects(uuid) to authenticated;

-- ── un singur proiect, la parasirea ecranului ───────────────────────────────
-- discard_empty_projects de mai sus asteapta 2 minute, deci un start parasit
-- imediat (alegi un agent, apesi "New task") ar ramane pana la urmatoarea
-- curatare. Ecranul de lucru il sterge pe al sau, la iesire, daca nu a primit
-- niciun mesaj. Tot security invoker: nu poate atinge proiectul altcuiva.
create or replace function discard_empty_project(target uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  removed integer;
begin
  with gone as (
    delete from agxp_projects p
     where p.id = target
       and p.owner_id = auth.uid()
       and not exists (select 1 from agxp_project_messages m where m.project_id = p.id)
    returning 1
  )
  select count(*) into removed from gone;
  return removed > 0;
end;
$$;

revoke all on function discard_empty_project(uuid) from public;
grant execute on function discard_empty_project(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 0014_agents_per_user.sql
-- ---------------------------------------------------------------------------

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
-- NOTA (fisierul combinat): blocul de mai jos e invelit intr-un DO.
-- In SQL Editor-ul Supabase instructiunile nu impart aceeasi sesiune,
-- deci tabela temporara disparea dupa prima ('relation _agent_copies
-- does not exist'). Un DO e o SINGURA instructiune, deci nu se poate
-- rupe. SQL-ul dinauntru e neschimbat, doar indentat.
do $copies$
begin
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
end
$copies$;

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


-- ---------------------------------------------------------------------------
-- 0015_everyone_max_for_now.sql
-- ---------------------------------------------------------------------------

-- AgxP — toti userii pe Max, pana sunt gata planurile (2026-10-15)
--
-- Aplicatia ii tine pe toti pe planul Max cat timp EVERYONE_IS_MAX din
-- lib/plans.ts e true. Baza are insa propria copie a doua limite, in
-- agxp_plan_limits: proiectele pe perioada (0008) si agentii pe tip (0014).
-- Fara randul de mai jos, un cont "free" ar fi vazut Max in aplicatie si ar fi
-- fost oprit de trigger la al treilea proiect pe saptamana sau la al doilea agent
-- de acelasi tip.
--
-- Se ridica randurile free si mid la valorile lui max. Randurile din
-- agxp_entitlements nu se ating, deci fiecare cont isi pastreaza planul real.
--
-- CA SA REVII (cand EVERYONE_IS_MAX devine false), ruleaza:
--   update agxp_plan_limits set projects = 3,  period = 'week',  agents_per_type = 1 where plan = 'free';
--   update agxp_plan_limits set projects = 15, period = 'month', agents_per_type = 4 where plan = 'mid';

update agxp_plan_limits l
   set projects        = m.projects,
       period          = m.period,
       agents_per_type = m.agents_per_type
  from agxp_plan_limits m
 where m.plan = 'max' and l.plan in ('free', 'mid');


-- ---------------------------------------------------------------------------
-- 0016_consultant_methods.sql
-- ---------------------------------------------------------------------------

-- AgxP — metodele celor trei tipuri de consultant (2026-10-16)
--
-- Tipurile de consultant sunt acum Strategy Consultant, Solution Architect si
-- Change Manager (lib/agent-types.ts), fiecare cu metodele din foaia de metode.
-- Pickerul creeaza un agent legandu-l de randurile din `methods` dupa NUME
-- (agent-picker-panel.tsx, ConfigureView): daca numele nu exista aici, tipul
-- nu se poate crea ("None of this type's methods are in the database yet").
-- Fara aceasta migrare noile tipuri nu merg.
--
-- Numele de mai jos trebuie sa fie IDENTICE cu cele din TYPE_CATALOG.
--
-- is_primary e o proprietate a metodei, nu a agentului: o metoda primary apare
-- in chipurile din cardul agentului si in dashboard. Cele trei metode cu care
-- incepe orice tip (Knowledge Check, Lexicon, At a Glance) sunt secundare, ca
-- sa nu faca cele trei tipuri sa arate la fel.
--
-- Metodele vechi (As-Is/To-Be, Gap-Analyse, ...) raman: coach-ii le folosesc.

insert into skills (name, description)
values ('AI Transformation Roadmap', 'From the current state to a plan that can be carried out.')
on conflict (name) do nothing;

with wanted(name, is_primary, description) as (values
  -- core: every consultant type starts with these three
  ('Knowledge Check',               false, 'Three quick questions that set the level of everything that follows.'),
  ('Lexicon',                       false, 'Every foreign term in the document, clustered by topic and explained.'),
  ('At a Glance',                   false, 'The whole case in one table: core problem, description, required knowledge, recommended direction.'),
  -- Strategy Consultant
  ('Gap Analysis + Action Plan',    true,  'Current against desired state per dimension, with the gap and a prioritised action plan.'),
  ('Build / Buy / Partner Matrix',  true,  'Per capability: build it, buy it or partner — scored on cost, time and control.'),
  ('SWOT',                          true,  'Strengths, weaknesses, opportunities and threats of the plan.'),
  ('Market / Opportunity Gaps',     false, 'Market situation against its potential: demand the user does not serve yet.'),
  ('SMART Goals',                   false, 'Goals rewritten until each can be answered with yes or no.'),
  -- Solution Architect
  ('Architecture Overview',         true,  'Components, their responsibility, technology and who they talk to.'),
  ('Tech Stack Decisions (ADR)',    true,  'Architecture decision records: what was decided, the alternatives, why, the consequence.'),
  ('Non-Functional Requirements',   true,  'Performance, scalability, security and availability as measurable requirements.'),
  ('Data & ML Pipeline',            false, 'Stages from data ingest to model serving and monitoring, with tool, frequency and owner.'),
  ('Infrastructure Plan',           false, 'Cloud, on-premises or hybrid per layer, with the technology and the reason.'),
  ('Cost Model (TCO)',              false, 'One-time and monthly costs with assumptions, people time included.'),
  ('Risk Register',                 false, 'Risks with impact, likelihood and mitigation, in the architect''s domain.'),
  -- Change Manager
  ('Stakeholder Map',               true,  'Groups by interest and influence, with stance and how to involve them.'),
  ('Skill-Gap Analysis',            true,  'Skills per group: current against target level and how to close the gap.'),
  ('ADKAR Assessment',              true,  'Awareness, Desire, Knowledge, Ability, Reinforcement per group; finds where the change gets stuck.'),
  ('Role Matrix',                   false, 'How each role changes: today, after the change, and what stays.'),
  ('Training & Communication Plan', false, 'When which group gets which message or training, through which channel, by whom.'),
  ('Adoption KPIs',                 false, 'Usage measures with target, source and deadline.')
)
insert into methods (skill_id, name, is_primary, description)
select s.id, w.name, w.is_primary, w.description
  from wanted w
  cross join (select id from skills where name = 'AI Transformation Roadmap' limit 1) s
 where not exists (select 1 from methods m where m.name = w.name);

-- Consultants that already exist keep working, as the type their tagline names.
-- Their old method links are replaced by the type's own, so the card and the
-- chips show what the agent now actually does. Agents of other types, and every
-- coach, are not touched.
with kinds(sub, method) as (values
  ('strategy & ai transformation', 'Knowledge Check'),
  ('strategy & ai transformation', 'Lexicon'),
  ('strategy & ai transformation', 'At a Glance'),
  ('strategy & ai transformation', 'Gap Analysis + Action Plan'),
  ('strategy & ai transformation', 'Build / Buy / Partner Matrix'),
  ('strategy & ai transformation', 'SWOT'),
  ('strategy & ai transformation', 'Market / Opportunity Gaps'),
  ('strategy & ai transformation', 'SMART Goals'),
  ('systems & integration', 'Knowledge Check'),
  ('systems & integration', 'Lexicon'),
  ('systems & integration', 'At a Glance'),
  ('systems & integration', 'Architecture Overview'),
  ('systems & integration', 'Tech Stack Decisions (ADR)'),
  ('systems & integration', 'Non-Functional Requirements'),
  ('systems & integration', 'Data & ML Pipeline'),
  ('systems & integration', 'Infrastructure Plan'),
  ('systems & integration', 'Cost Model (TCO)'),
  ('systems & integration', 'Risk Register')
),
mine as (
  select a.id as agent_id, lower(trim(a.tagline)) as sub
    from agents a
   where a.type::text = 'consultant'
     and lower(trim(a.tagline)) in ('strategy & ai transformation', 'systems & integration')
),
gone as (
  delete from agent_methods am using mine where am.agent_id = mine.agent_id
  returning am.agent_id
)
insert into agent_methods (agent_id, method_id)
select distinct mine.agent_id, m.id
  from mine
  join kinds k on k.sub = mine.sub
  join methods m on m.name = k.method
on conflict do nothing;

commit;
