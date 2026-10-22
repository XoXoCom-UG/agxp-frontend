-- ============================================================================
-- lock_down_public.sql — close the doors that were never part of AgxP.
--
-- Run AFTER reading isolation_check.sql part 1. Not a numbered migration on
-- purpose: it touches tables that belong to the OLDER app this database is
-- shared with (migrations/0002 says AgxP reuses the old project), and whether
-- that app is still in use is a decision, not a schema change.
--
-- What it does:
--
--  1. Switches row level security ON for every table in `public` that has it
--     off. With RLS on and no policy, a table answers every user with zero
--     rows and refuses every write. Nothing is deleted. The service role (the
--     server) is unaffected. This is what protects tables like the legacy
--     `projects`, whose RLS was switched off by supabase/URGENT_fix_rls.sql.
--
--  2. Takes every table and sequence privilege in `public` away from `anon`.
--     Nothing in AgxP reads or writes the database without a signed-in user
--     (the landing page does not touch it), so the key that sits in every
--     browser bundle has no use for them. This is the second lock: if a policy
--     is ever dropped by accident, a stranger still gets nothing.
--     Functions are NOT touched here: they are executable by PUBLIC by default,
--     and anon inherits that, so revoking from anon alone would change nothing,
--     while revoking from PUBLIC could break functions the older app calls.
--     isolation_check.sql part 1 lists the ones anon can call; review those.
--
--  3. Makes that the default for objects created later.
--
-- If the OLD app is still live and reads one of its tables with the browser
-- key, step 1 will take that table away from it. That table was readable by
-- every visitor on the internet; give the old app its own policy
-- (owner-scoped, like migrations/0003) rather than leaving it open.
-- ============================================================================

do $$
declare r record;
begin
  for r in
    select c.relname
      from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', r.relname);
    raise notice 'row level security switched on: %', r.relname;
  end loop;
end $$;

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;

alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- Then run isolation_check.sql again: part 1 must list no FAIL.
