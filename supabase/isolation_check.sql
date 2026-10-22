-- ============================================================================
-- isolation_check.sql — can one user reach another user's data?
--
-- READ-ONLY. Run in the Supabase SQL editor, PART 1 and PART 2 separately
-- (the editor shows only the last statement's result). Nothing is changed:
-- part 2 ends in an error ON PURPOSE so that everything it tries is rolled
-- back, and the error text is the report.
--
-- Why this exists: the app's isolation is row level security, and a missing
-- migration or one table that was never switched on looks exactly like a
-- working one. This database was also shared with an older app (see
-- migrations/0002), whose tables the AgxP migrations never touched.
-- ============================================================================


-- ── PART 1 — the shape of the database ──────────────────────────────────────
-- One row per finding. status FAIL is a leak; REVIEW is something to look at
-- and decide; nothing is listed for what is fine.
with
rls_off as (
  select 'RLS off' as check_name, c.relname::text as object, 'FAIL' as status,
         'Any role with a grant can read and write every row. The anon key is in every browser bundle.' as detail
    from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity
),
views as (
  select 'view' , c.relname::text,
         case when coalesce(c.reloptions::text, '') like '%security_invoker=true%' then 'ok' else 'REVIEW' end,
         'A view runs with its owner''s rights and skips the RLS of the tables under it, unless security_invoker is on.'
    from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm')
),
anon_grants as (
  select 'anon has table grants', g.table_name::text,
         case when c.relrowsecurity then 'REVIEW' else 'FAIL' end,
         'anon may ' || string_agg(lower(g.privilege_type), ', ' order by g.privilege_type)
           || case when c.relrowsecurity then ' (RLS is on, so rows are still filtered)' else ' and RLS is OFF' end
    from information_schema.role_table_grants g
    join pg_class c on c.relname = g.table_name and c.relnamespace = 'public'::regnamespace
   where g.grantee = 'anon' and g.table_schema = 'public'
   group by g.table_name, c.relrowsecurity
),
open_policies as (
  select 'policy open to all rows', tablename::text || '.' || policyname::text, 'REVIEW',
         cmd || ' for ' || array_to_string(roles, ',') || ' with no row condition'
    from pg_policies
   where schemaname = 'public' and cmd in ('SELECT', 'ALL') and (qual is null or qual = 'true')
),
anon_functions as (
  select 'function callable by anon', p.proname::text,
         case when p.prosecdef then 'REVIEW' else 'info' end,
         case when p.prosecdef then 'SECURITY DEFINER: runs with its owner''s rights' else 'runs with the caller''s rights' end
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute')
),
public_buckets as (
  select 'public storage bucket', id::text, 'FAIL', 'Anyone with the link can download every file in it.'
    from storage.buckets where public
)
select * from rls_off
union all select * from views
union all select * from anon_grants
union all select * from open_policies
union all select * from anon_functions
union all select * from public_buckets
order by 3, 1, 2;


-- ── PART 2 — act as one user and try to reach another's data ────────────────
-- Needs two accounts that each have a project. It signs in, inside the
-- transaction, as the first one (the role and the token claims a real request
-- carries) and tries everything. Read the line the error prints:
--   every "visible" number must be 0, every write must say "blocked".
-- Everything is rolled back by the error at the end.
do $$
declare
  a uuid; b uuid; b_project uuid;
  n_proj int; n_msg int; n_agents int; n_usage int; n_ent int; n_files int; n_keys text;
  w_proj text; w_msg text; w_update int; w_delete int; w_owner text;
begin
  select owner_id into a from agxp_projects order by created_at limit 1;
  select owner_id, id into b, b_project from agxp_projects where owner_id <> a order by created_at limit 1;
  if a is null or b is null then
    raise exception 'Cannot run: two different accounts that each own a project are needed.';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n_proj   from agxp_projects         where owner_id <> a;
  select count(*) into n_msg    from agxp_project_messages where project_id = b_project;
  select count(*) into n_agents from agents                where created_by is distinct from a;
  select count(*) into n_usage  from agxp_usage            where user_id <> a;
  select count(*) into n_ent    from agxp_entitlements     where user_id <> a;
  select count(*) into n_files  from storage.objects
    where bucket_id = 'project-files' and (storage.foldername(name))[1] <> a::text;
  begin
    execute 'select count(*)::text from agxp_beta_keys' into n_keys;
  exception when others then n_keys := 'denied';
  end;

  begin
    insert into agxp_projects (owner_id, name) values (b, 'intruder');
    w_proj := 'ALLOWED (LEAK)';
  exception when others then w_proj := 'blocked';
  end;
  begin
    insert into agxp_project_messages (project_id, column_type, role, content) values (b_project, 'coach', 'user', 'intruder');
    w_msg := 'ALLOWED (LEAK)';
  exception when others then w_msg := 'blocked';
  end;
  begin
    update agxp_projects set owner_id = a where id = b_project;
    get diagnostics w_update = row_count;
  exception when others then w_update := 0;
  end;
  begin
    delete from agxp_projects where id = b_project;
    get diagnostics w_delete = row_count;
  exception when others then w_delete := 0;
  end;
  begin
    update agxp_projects set owner_id = b where owner_id = a;
    w_owner := 'ALLOWED (LEAK)';
  exception when others then w_owner := 'blocked';
  end;

  raise exception E'ISOLATION REPORT, acting as user % against user %\n'
    'visible (all must be 0): projects=%, messages of the other''s project=%, agents=%, usage rows=%, entitlements=%, files=%\n'
    'beta keys: %  (must be denied or 0)\n'
    'writes: create a project for the other=%, post into the other''s project=%, take over the other''s project=% rows, delete it=% rows, hand own project to the other=%\n'
    '(this error is the report; nothing was changed)',
    a, b, n_proj, n_msg, n_agents, n_usage, n_ent, n_files, n_keys, w_proj, w_msg, w_update, w_delete, w_owner;
end $$;
