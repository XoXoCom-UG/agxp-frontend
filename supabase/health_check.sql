-- health_check.sql — what is actually applied in THIS database.
--
-- Run it in the Supabase SQL editor. It writes nothing. Every row is one thing
-- the running app assumes exists; a row that says MISSING names the migration
-- that creates it, and that migration has not been applied here.
--
-- This exists because a missing migration does not look like an error. The app
-- keeps serving: a missing quota trigger just means the project limit is only
-- the browser's polite message, and a missing entitlements column means the
-- team panel disappears. Both look like "working" until someone counts.

with expected(kind, name, detail, migration) as (values
  ('table',    'agxp_projects',         null,              '0003'),
  ('table',    'agxp_project_messages', null,              '0003'),
  ('table',    'agxp_entitlements',     null,              '0007'),
  ('column',   'agxp_entitlements',     'can_switch_plan', '0010'),
  ('table',    'agxp_usage',            null,              '0007'),
  ('function', 'add_usage',             null,              '0007'),
  ('table',    'agxp_plan_limits',      null,              '0008'),
  ('function', 'enforce_project_quota', null,              '0008'),
  ('trigger',  'agxp_projects_quota',   'agxp_projects',   '0008'),
  ('table',    'agxp_beta_keys',        null,              '0009'),
  ('function', 'redeem_beta_key',       null,              '0009'),
  ('function', 'set_own_plan',          null,              '0010'),
  ('function', 'mint_beta_key',         null,              '0010'),
  ('function', 'list_beta_keys',        null,              '0010')
)
select
  e.kind,
  e.name || case when e.kind = 'column' then '.' || e.detail else '' end as object,
  case when exists (
    select 1 from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = e.name and c.relkind in ('r','p')
      and e.kind = 'table'
    union all
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = e.name and column_name = e.detail
      and e.kind = 'column'
    union all
    select 1 from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = e.name
      and e.kind = 'function'
    union all
    select 1 from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
    where not t.tgisinternal and t.tgname = e.name and c.relname = e.detail
      and e.kind = 'trigger'
  ) then 'ok' else 'MISSING — run migration ' || e.migration end as status
from expected e;

-- Row level security, separately: a table with RLS off is readable by every
-- signed-in user, which is the failure these policies exist to prevent.
select c.relname as table_name,
       case when c.relrowsecurity then 'on' else 'RLS IS OFF' end as rls,
       (select count(*) from pg_policy p where p.polrelid = c.oid) as policies
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('agxp_projects','agxp_project_messages','agxp_entitlements',
                     'agxp_usage','agxp_plan_limits','agxp_beta_keys')
 order by c.relname;

-- Is anything actually being metered? If the app has been used and this is
-- empty, SUPABASE_SERVICE_ROLE_KEY is missing from the server environment:
-- every account then reads as free and nothing is written. See CLAUDE.md.
select count(*) as usage_rows,
       count(*) filter (where cache_read_tokens > 0) as rows_with_cache_hits,
       max(period_start) as newest_period
  from agxp_usage;

-- Who on the team can switch their own plan and mint invitations.
select u.email, e.plan, e.can_switch_plan
  from agxp_entitlements e
  join auth.users u on u.id = e.user_id
 where e.can_switch_plan;
