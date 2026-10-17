-- AgxP — bugetul comun al conturilor free (2026-10-18)
--
-- RUN THIS BEFORE deploying the code that reads it (lib/entitlement-server.ts).
--
-- Every free account has its own small ceiling ($3 a month, lib/plans.ts).
-- That stops one person; it does not stop ten thousand scripted sign-ups,
-- each with its own $3. MONTHLY_BUDGET_USD would still stop the total — but by
-- pausing the app for everyone, paying and invited users included. So the
-- free accounts together get a pool of their own (FREE_POOL_BUDGET_USD): when
-- it is spent, free accounts stop until the 1st and everybody else carries on.
--
-- "Free" here is the STORED plan: no row in agxp_entitlements, or a row that
-- says 'free'. Invited testers have a row with the plan their key granted.

create or replace function month_spend_free_micro_usd()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(u.cost_micro_usd), 0)::bigint
    from agxp_usage u
    left join agxp_entitlements e on e.user_id = u.user_id
   where u.period_start >= (date_trunc('month', (now() at time zone 'utc')))::date
     and coalesce(e.plan, 'free') = 'free';
$$;

revoke all on function month_spend_free_micro_usd() from public, anon, authenticated;
grant execute on function month_spend_free_micro_usd() to service_role;
