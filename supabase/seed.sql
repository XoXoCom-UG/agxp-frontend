-- AgxP — seed data for local/dev: skills, methods, agents (3 Consultant + 2 Coach)
-- with their known methods and a couple of fictive past projects each.
--
-- Run after 0001_agxp_schema.sql. Safe to re-run: it wipes and re-inserts.

delete from agent_projects;
delete from agent_methods;
delete from methods;
delete from agents;
delete from skills;

-- ── Skill ───────────────────────────────────────────────────────────────────
with skill as (
  insert into skills (name, description)
  values ('AI Transformation Roadmap', 'Kernmethoden für Analyse, Planung und Umsetzung einer AI-Transformation.')
  returning id
),

-- ── Methods ─────────────────────────────────────────────────────────────────
inserted_methods as (
  insert into methods (skill_id, name, is_primary, description, output_schema)
  select skill.id, m.name, m.is_primary, m.description, m.output_schema::jsonb
  from skill, (values
    ('As-Is/To-Be',               true,  'Erfasst den aktuellen und den angestrebten Zustand.',                '{"fields": ["as_is", "to_be", "gap"]}'),
    ('Gap-Analyse',                true,  'Identifiziert Lücken zwischen Ist- und Soll-Zustand.',               '{"fields": ["gap", "impact", "priority"]}'),
    ('Requirements Engineering',   false, 'Erhebt und strukturiert funktionale und nicht-funktionale Anforderungen.', '{"fields": ["requirement", "type", "priority"]}'),
    ('Process Mapping',            false, 'Visualisiert bestehende Geschäftsprozesse als Flussdiagramm.',        '{"fields": ["step", "owner", "system"]}'),
    ('Impact Mapping',             false, 'Verbindet Geschäftsziele mit Maßnahmen und erwarteter Wirkung.',      '{"fields": ["goal", "actor", "impact", "deliverable"]}')
  ) as m(name, is_primary, description, output_schema)
  returning id, name
),

-- ── Agents ──────────────────────────────────────────────────────────────────
inserted_agents as (
  insert into agents (type, name, avatar_placeholder)
  values
    ('consultant', 'AI Strategy Consultant', 'ASC'),
    ('consultant', 'Business Analyst',       'BA'),
    ('consultant', 'Solution Architect',     'SA'),
    ('coach',      'Change Management Coach','CMC'),
    ('coach',      'IT-Coaching Coach',      'ITC')
  returning id, name
),

-- ── agent -> methods mapping ────────────────────────────────────────────────
agent_method_pairs as (
  select a.id as agent_id, m.id as method_id
  from inserted_agents a
  join inserted_methods m on
    (a.name = 'AI Strategy Consultant' and m.name in ('As-Is/To-Be', 'Gap-Analyse')) or
    (a.name = 'Business Analyst'       and m.name in ('Requirements Engineering', 'Process Mapping')) or
    (a.name = 'Solution Architect'     and m.name in ('Gap-Analyse', 'Impact Mapping', 'Process Mapping')) or
    (a.name = 'Change Management Coach' and m.name in ('Impact Mapping', 'As-Is/To-Be')) or
    (a.name = 'IT-Coaching Coach'      and m.name in ('Requirements Engineering', 'Gap-Analyse'))
),
inserted_agent_methods as (
  insert into agent_methods (agent_id, method_id)
  select agent_id, method_id from agent_method_pairs
  returning agent_id
)

-- ── Last projects (fictive) ─────────────────────────────────────────────────
insert into agent_projects (agent_id, name, summary, created_at)
select a.id, p.name, p.summary, p.created_at::timestamptz
from inserted_agents a
join (values
  ('AI Strategy Consultant', 'AI-Readiness Assessment — Meier Logistik GmbH', 'Ist-Analyse der Datenlandschaft und Priorisierung von drei AI-Anwendungsfällen.', now() - interval '18 days'),
  ('AI Strategy Consultant', 'AI-Roadmap 2026 — Nordwind Versicherung',       'Dreijahres-Roadmap mit Quick Wins und Governance-Rahmen.',                      now() - interval '52 days'),
  ('Business Analyst',       'Anforderungsaufnahme CRM-Migration — Stahl AG', 'Requirements-Katalog für die Ablösung des Altsystems.',                        now() - interval '9 days'),
  ('Solution Architect',     'Zielarchitektur Dokumentenmanagement — HausPlus', 'Soll-Architektur inkl. Schnittstellenkonzept.',                              now() - interval '30 days'),
  ('Solution Architect',     'Cloud-Migrationskonzept — Reise & Co.',         'Bewertung von drei Cloud-Zielarchitekturen und Migrationsreihenfolge.',        now() - interval '75 days'),
  ('Change Management Coach','Change-Begleitung ERP-Einführung — Bäckerei Fromm', 'Stakeholder-Mapping und Kommunikationsplan für den Rollout.',              now() - interval '14 days'),
  ('IT-Coaching Coach',      'IT-Coaching Fachbereich Einkauf — Lang GmbH',   'Coaching-Reihe zur Einführung von KI-gestützten Beschaffungstools.',           now() - interval '21 days')
) as p(agent_name, name, summary, created_at) on p.agent_name = a.name;
