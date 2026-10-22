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
  ('function', 'list_beta_keys',        null,              '0010'),
  ('column',   'agxp_projects',         'category',        '0013'),
  ('function', 'discard_empty_projects', null,             '0013'),
  ('function', 'discard_empty_project',  null,              '0013'),
  ('column',   'agxp_plan_limits',      'agents_per_type', '0014'),
  ('function', 'enforce_agent_limit',   null,              '0014'),
  ('trigger',  'agents_limit',          'agents',          '0014'),
  ('function', 'enforce_project_agent_owner', null,        '0014'),
  ('trigger',  'agxp_projects_agent_owner', 'agxp_projects', '0014'),
  ('column',   'agxp_usage',            'cost_micro_usd',  '0017'),
  ('function', 'month_spend_micro_usd', null,              '0017'),
  ('function', 'take_rate_slot',        null,              '0017'),
  ('function', 'month_spend_free_micro_usd', null,         '0018'),
  ('table',    'agxp_ai_switch',        null,              '0021'),
  ('table',    'agxp_ai_leases',        null,              '0021'),
  ('function', 'begin_ai_call',         null,              '0021'),
  ('function', 'settle_ai_call',        null,              '0021'),
  ('function', 'team_usage',            null,              '0022'),
  ('table',    'agxp_ip_rate_limits',   null,              '0023'),
  ('function', 'take_ip_slot',          null,              '0023')
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
                     'agxp_usage','agxp_plan_limits','agxp_beta_keys',
                     'agxp_rate_limits','agxp_ai_switch','agxp_ai_leases')
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

-- Is the kill switch on, and what is in flight right now? A lease older than
-- a few minutes belongs to a server that died mid-answer; it expires by itself.
select paused, reason, updated_at from agxp_ai_switch;
select kind, count(*) as in_flight, sum(reserved_micro_usd) / 1e6 as reserved_usd
  from agxp_ai_leases where expires_at > now() group by kind;
