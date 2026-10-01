-- ============================================================================
-- CLEANUP — pastreaza pe echipa doar agentii care au facut ceva (Ana, 2026-10-01).
--
--   * ARHIVEAZA (nu sterge) orice agent fara niciun document terminat: niciun
--     Transformation Concept (consultant) si niciun Change Plan (coach). Un
--     agent arhivat apare in tab-ul "Archived" din dashboard si poate fi
--     readus cu "Restore". Cere migrarea 0006_agents_archive.sql rulata inainte.
--   * Pe cei ramasi ii ORDONEAZA: un agent fara tip (apare la "Other" in
--     dashboard, facut inainte sa existe tipurile) e mutat la tipul principal
--     al rolului — AI Strategy Consultant / AI Business Analyst — cat timp
--     acolo mai e loc (maxim 4). Cei cu cele mai multe documente primii.
--     Daca nu mai e loc, raman la "Other".
--
-- Un "document" e recunoscut exact ca in aplicatie (lib/message-markers.ts):
-- un raspuns al agentului cu marcajul [[DOC:]], SAU unul lung (> 1200 de
-- caractere) construit din cel putin 3 sectiuni "##".
-- Se numara pe toti userii — SQL Editor vede tot, fara RLS.
--
-- Rulează-l in SQL Editor, in DOI PASI:
--   1. PASUL 1 (preview): nu schimba nimic. Coloana "action" spune ce se
--      intampla cu fiecare agent. Uita-te peste ea.
--   2. PASUL 2: scoate "--" din fata lui si ruleaza-l. Face exact ce a
--      aratat preview-ul si afiseaza ce a arhivat / mutat.
--
-- Nimic nu se sterge: agentul, proiectele, mesajele si documentele raman.
-- Agentii deja arhivati nu sunt atinsi.
-- ============================================================================

-- ── PASUL 1: preview, nu schimba nimic ──────────────────────────────────────
with docs as (
  select a.id, a.type, a.name, a.tagline,
    (select count(*) from agxp_project_messages m
       join agxp_projects p on p.id = m.project_id
       where (p.coach_agent_id = a.id or p.consultant_agent_id = a.id)
         and m.column_type = a.type and m.role = 'assistant'
         and (m.content ~* '\[\[DOC:'
              or (length(m.content) > 1200
                  and (select count(*) from regexp_matches(m.content, '^##\s+\S', 'gn')) >= 3))
    ) as documents
  from agents a
  where a.archived_at is null
),
-- The type catalog, as lib/agent-types.ts has it: an agent's type is its tagline.
types (role, sub, type_name, main) as (values
  ('consultant'::agent_type, 'Strategy & AI transformation', 'AI Strategy Consultant',         true),
  ('consultant'::agent_type, 'Systems & integration',        'Solution Architect',             false),
  ('consultant'::agent_type, 'Roadmap & adoption',           'Digital Transformation Manager', false),
  ('coach'::agent_type,      'Process & requirements',       'AI Business Analyst',            true),
  ('coach'::agent_type,      'Delivery & team flow',         'Agile Coach / Scrum Master',     false),
  ('coach'::agent_type,      'Change & adoption',            'Change Manager',                 false)
),
kept as (
  select d.*, t.type_name from docs d
  left join types t on t.role = d.type and t.sub = d.tagline
  where d.documents > 0
),
room as (
  select t.role, t.sub, t.type_name,
         4 - (select count(*) from kept k where k.type = t.role and k.tagline = t.sub) as free
  from types t where t.main
),
moves as (
  select k.id, r.sub as new_tagline, r.type_name as new_type
  from (select k.*, row_number() over (partition by k.type order by k.documents desc, k.name) as rn
        from kept k where k.type_name is null) k
  join room r on r.role = k.type and k.rn <= r.free
)
select
  case when d.documents = 0     then 'ARCHIVE'
       when mv.id is not null   then 'keep, move to ' || mv.new_type
       when t.type_name is null then 'keep, stays in Other (type full)'
       else                          'keep' end as action,
  d.name, d.type, coalesce(t.type_name, 'Other') as current_type, d.documents, d.id
from docs d
left join types t  on t.role = d.type and t.sub = d.tagline
left join moves mv on mv.id = d.id
order by (d.documents = 0) desc, d.type, d.documents desc, d.name;


-- ── PASUL 2: arhiveaza si muta (doar dupa ce ai verificat pasul 1) ─────────
-- with docs as (
--   select a.id, a.type, a.name, a.tagline,
--     (select count(*) from agxp_project_messages m
--        join agxp_projects p on p.id = m.project_id
--        where (p.coach_agent_id = a.id or p.consultant_agent_id = a.id)
--          and m.column_type = a.type and m.role = 'assistant'
--          and (m.content ~* '\[\[DOC:'
--               or (length(m.content) > 1200
--                   and (select count(*) from regexp_matches(m.content, '^##\s+\S', 'gn')) >= 3))
--     ) as documents
--   from agents a
--   where a.archived_at is null
-- ),
-- types (role, sub, type_name, main) as (values
--   ('consultant'::agent_type, 'Strategy & AI transformation', 'AI Strategy Consultant',         true),
--   ('consultant'::agent_type, 'Systems & integration',        'Solution Architect',             false),
--   ('consultant'::agent_type, 'Roadmap & adoption',           'Digital Transformation Manager', false),
--   ('coach'::agent_type,      'Process & requirements',       'AI Business Analyst',            true),
--   ('coach'::agent_type,      'Delivery & team flow',         'Agile Coach / Scrum Master',     false),
--   ('coach'::agent_type,      'Change & adoption',            'Change Manager',                 false)
-- ),
-- kept as (
--   select d.*, t.type_name from docs d
--   left join types t on t.role = d.type and t.sub = d.tagline
--   where d.documents > 0
-- ),
-- room as (
--   select t.role, t.sub, t.type_name,
--          4 - (select count(*) from kept k where k.type = t.role and k.tagline = t.sub) as free
--   from types t where t.main
-- ),
-- moves as (
--   select k.id, r.sub as new_tagline, r.type_name as new_type
--   from (select k.*, row_number() over (partition by k.type order by k.documents desc, k.name) as rn
--         from kept k where k.type_name is null) k
--   join room r on r.role = k.type and k.rn <= r.free
-- ),
-- moved as (
--   update agents a set tagline = mv.new_tagline
--   from moves mv where a.id = mv.id
--   returning a.id, a.name, 'moved to ' || mv.new_type as what
-- ),
-- archived as (
--   update agents a set archived_at = now()
--   from docs d where a.id = d.id and d.documents = 0
--   returning a.id, a.name, 'archived' as what
-- )
-- select what, name, id from moved
-- union all
-- select what, name, id from archived
-- order by what, name;
