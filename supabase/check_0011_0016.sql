-- AgxP — ce lipseste din 0011 … 0016 (read-only, nu schimba nimic)
--
-- health_check.sql acopera 0003 … 0014 dar are o gaura: 0011 (fisierele),
-- 0012 (panourile de echipa), 0015 si 0016 (tipurile de consultant). Asta e
-- bucata lipsa. Lipeste tot in SQL Editor si citeste coloana `stare`.

with asteptat(migrare, fel, obiect, gasit) as (values
  -- ── 0011: atasamentele ────────────────────────────────────────────────
  ('0011', 'bucket',   'project-files',
     exists (select 1 from storage.buckets where id = 'project-files')),
  ('0011', 'functie',  'delete_project_files',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'delete_project_files')),
  ('0011', 'trigger',  'agxp_projects_files_cleanup',
     exists (select 1 from pg_trigger where tgname = 'agxp_projects_files_cleanup' and not tgisinternal)),
  ('0011', 'politici', 'project_files_own_* pe storage.objects (3)',
     (select count(*) = 3 from pg_policies
       where schemaname = 'storage' and tablename = 'objects' and policyname like 'project_files_own_%')),

  -- ── 0012: cine e "echipa" ─────────────────────────────────────────────
  ('0012', 'functie',  'is_team_member',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'is_team_member')),
  ('0012', 'functie',  'am_i_team',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'am_i_team')),

  -- ── 0015: toti pe Max cat timp EVERYONE_IS_MAX e true ─────────────────
  ('0015', 'date',     'free si mid ridicate la valorile lui max',
     (select count(*) = 0 from agxp_plan_limits l join agxp_plan_limits m on m.plan = 'max'
       where l.plan in ('free','mid')
         and (l.projects is distinct from m.projects
           or l.period   is distinct from m.period
           or l.agents_per_type is distinct from m.agents_per_type))),

  -- ── 0016: metodele celor trei tipuri de consultant ────────────────
  ('0016', 'date',     'skill-ul AI Transformation Roadmap',
     exists (select 1 from skills where name = 'AI Transformation Roadmap')),
  ('0016', 'date',     'toate cele 21 de metode ale tipurilor',
     (select count(distinct name) = 21 from methods where name in (
         'ADKAR Assessment',
         'Adoption KPIs',
         'Architecture Overview',
         'At a Glance',
         'Build / Buy / Partner Matrix',
         'Cost Model (TCO)',
         'Data & ML Pipeline',
         'Gap Analysis + Action Plan',
         'Infrastructure Plan',
         'Knowledge Check',
         'Lexicon',
         'Market / Opportunity Gaps',
         'Non-Functional Requirements',
         'Risk Register',
         'Role Matrix',
         'SMART Goals',
         'SWOT',
         'Skill-Gap Analysis',
         'Stakeholder Map',
         'Tech Stack Decisions (ADR)',
         'Training & Communication Plan')))
)
select migrare,
       case when gasit then 'OK' else '>>> LIPSESTE' end as stare,
       fel, obiect
  from asteptat
 order by migrare, (case when gasit then 1 else 0 end), obiect;
