-- 0022_usage_for_the_team.sql — what each account has spent, for the team panel.
--
-- agxp_usage holds the real numbers from the API (add_usage, 0007), including
-- what each request cost in money (cost_micro_usd, 0017_cost_controls), but each
-- user may only read their own row and nothing reads them together. Asked for on
-- 2026-10-16 (Tudor, 00:23:38): a view of use per user, to watch the cost of the
-- beta testers — team_usage(), for the team panel in Settings.
--
-- A function over agxp_usage, not a table, so there is no second copy of the
-- numbers to drift. It takes no argument and asks is_team_member about the
-- CALLER, the same shape as am_i_team (0012): hiding the panel is a courtesy,
-- this refusal is the security. The plan is read from agxp_entitlements; an
-- account without a row has none yet.
--
-- Safe to re-run. It replaces an earlier team_usage() that did not return the
-- stored cost, which is why it is dropped first: a function cannot change what
-- it returns in place.

drop function if exists team_usage();

create function team_usage()
returns table (
  user_id            uuid,
  email              text,
  plan               text,
  period_start       date,
  input_tokens       bigint,
  output_tokens      bigint,
  cache_read_tokens  bigint,
  cache_write_tokens bigint,
  cost_micro_usd     bigint,
  requests           integer
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not coalesce(is_team_member(auth.uid()), false) then
    raise exception 'This account cannot see usage.' using errcode = 'P0001';
  end if;

  return query
    select u.user_id, usr.email::text, e.plan, u.period_start,
           u.input_tokens, u.output_tokens, u.cache_read_tokens, u.cache_write_tokens,
           u.cost_micro_usd, u.requests
      from agxp_usage u
      join auth.users usr on usr.id = u.user_id
      left join agxp_entitlements e on e.user_id = u.user_id
     where u.period_start >= (date_trunc('month', now() at time zone 'utc') - interval '1 month')::date
     order by u.period_start desc, u.cost_micro_usd desc;
end $$;

revoke all on function team_usage() from public, anon;
grant execute on function team_usage() to authenticated, service_role;
