-- check_0021.sql — does the lease gate from 0021 actually hold? Writes nothing.
--
-- Run it in the Supabase SQL editor after applying 0021. Everything happens in
-- one transaction that is rolled back at the end, so no lease, usage row or
-- switch change survives. Uses the first account in auth.users.
--
-- Expected output, in order:
--   ok, ok, busy        — two chats in flight, the third waits
--   ok                  — a title is counted separately
--   account             — once recorded + reserved reaches the ceiling
--   paused              — the kill switch stops everything
--   leases_left = 0     — settling gives every lease back

begin;

do $$
declare
  u      uuid := (select id from auth.users order by created_at limit 1);
  p      date := date_trunc('month', now() at time zone 'utc')::date;
  l1     uuid := gen_random_uuid();
  l2     uuid := gen_random_uuid();
  l3     uuid := gen_random_uuid();
  lt     uuid := gen_random_uuid();
  big    bigint := 1000000000000;   -- caps that cannot be hit
  r      text;
begin
  if u is null then raise exception 'no account in auth.users to test with'; end if;
  delete from agxp_ai_leases where user_id = u;

  r := begin_ai_call(u, l1, 'chat', p, 1000, big, 2, false, big, big, 600); raise notice 'chat 1: %', r;
  r := begin_ai_call(u, l2, 'chat', p, 1000, big, 2, false, big, big, 600); raise notice 'chat 2: %', r;
  r := begin_ai_call(u, l3, 'chat', p, 1000, big, 2, false, big, big, 600); raise notice 'chat 3: %', r;
  r := begin_ai_call(u, lt, 'title', p, 1000, big, 1, false, big, big, 600); raise notice 'title: %', r;

  perform settle_ai_call(l1, u, p, 0, 0, 0, 0, 0);
  perform settle_ai_call(lt, u, p, 0, 0, 0, 0, 0);

  -- A ceiling exactly at what is already recorded plus the one lease left.
  r := begin_ai_call(u, gen_random_uuid(), 'chat', p, 1000,
         coalesce((select cost_micro_usd from agxp_usage where user_id = u and period_start = p), 0) + 1000,
         2, false, big, big, 600);
  raise notice 'over ceiling: %', r;

  perform settle_ai_call(l2, u, p, 0, 0, 0, 0, 0);

  update agxp_ai_switch set paused = true;
  r := begin_ai_call(u, gen_random_uuid(), 'chat', p, 1000, big, 2, false, big, big, 600);
  raise notice 'switch on: %', r;

  raise notice 'leases_left = %', (select count(*) from agxp_ai_leases where user_id = u);
end $$;

rollback;
