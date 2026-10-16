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
