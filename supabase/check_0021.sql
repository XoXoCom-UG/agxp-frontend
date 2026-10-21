-- check_0021.sql — does the lease gate from 0021 actually hold? Writes nothing.
--
-- Run it in the Supabase SQL editor after applying 0021. It ENDS IN AN ERROR
-- ON PURPOSE: the editor does not show `raise notice`, so the result is the
-- error message — and raising it rolls back every lease, usage row and switch
-- change the test made. Uses the first account in auth.users.
--
-- Expected error message:
--   CHECK 0021: chat1=ok chat2=ok chat3=busy title=ok over_ceiling=account switch=paused leases_left=0
-- Anything else in those slots means the gate does not hold as designed.

do $$
declare
  u      uuid := (select id from auth.users order by created_at limit 1);
  p      date := date_trunc('month', now() at time zone 'utc')::date;
  l1     uuid := gen_random_uuid();
  l2     uuid := gen_random_uuid();
  l3     uuid := gen_random_uuid();
  lt     uuid := gen_random_uuid();
  big    bigint := 1000000000000;   -- caps that cannot be hit
  v_out  text := 'CHECK 0021:';
begin
  if u is null then raise exception 'no account in auth.users to test with'; end if;
  delete from agxp_ai_leases where user_id = u;

  v_out := v_out || ' chat1=' || begin_ai_call(u, l1, 'chat', p, 1000, big, 2, false, big, big, 600);
  v_out := v_out || ' chat2=' || begin_ai_call(u, l2, 'chat', p, 1000, big, 2, false, big, big, 600);
  v_out := v_out || ' chat3=' || begin_ai_call(u, l3, 'chat', p, 1000, big, 2, false, big, big, 600);
  v_out := v_out || ' title=' || begin_ai_call(u, lt, 'title', p, 1000, big, 1, false, big, big, 600);

  perform settle_ai_call(l1, u, p, 0, 0, 0, 0, 0);
  perform settle_ai_call(lt, u, p, 0, 0, 0, 0, 0);

  -- A ceiling exactly at what is already recorded plus the one lease left.
  v_out := v_out || ' over_ceiling=' || begin_ai_call(u, gen_random_uuid(), 'chat', p, 1000,
         coalesce((select cost_micro_usd from agxp_usage where user_id = u and period_start = p), 0) + 1000,
         2, false, big, big, 600);

  perform settle_ai_call(l2, u, p, 0, 0, 0, 0, 0);

  update agxp_ai_switch set paused = true;
  v_out := v_out || ' switch=' || begin_ai_call(u, gen_random_uuid(), 'chat', p, 1000, big, 2, false, big, big, 600);

  v_out := v_out || ' leases_left=' || (select count(*) from agxp_ai_leases where user_id = u);

  -- The result, and the rollback of everything above.
  raise exception '%', v_out;
end $$;
