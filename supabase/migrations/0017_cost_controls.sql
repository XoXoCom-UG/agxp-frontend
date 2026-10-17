-- AgxP — controlul costurilor (2026-10-17)
--
-- From the meeting of 2026-10-16: the app may cost 3,000–5,000 € a month at
-- the start, and that has to be watertight — Patryk is personally liable as
-- managing director. Three things here, all written only by the service role:
--
--   1. agxp_usage.cost_micro_usd — what each request cost in money (lib/cost.ts).
--      The old ceiling counted input + output tokens and missed cache reads and
--      writes, which is most of the input once prompt caching is on.
--   2. month_spend_micro_usd() — the whole app's spend this calendar month, so
--      the routes can stop at MONTHLY_BUDGET_USD (lib/plans.ts).
--   3. take_rate_slot() — a rate limit that holds across serverless instances.
--      The in-memory one in each route only saw its own instance.
--
-- And the free plan goes from 3 projects a WEEK to 3 a MONTH (same meeting).
--
-- Safe to re-run.

-- ── 1. cost per row ─────────────────────────────────────────────────────────
alter table agxp_usage add column if not exists cost_micro_usd bigint not null default 0;

-- Rows written before this column existed, priced the way lib/cost.ts prices
-- them now (Sonnet 5: $2 in, $10 out, $2.50 cache write, $0.20 cache read per
-- MTok). Only rows still at zero, so a re-run does not double them.
update agxp_usage
   set cost_micro_usd = ceil(input_tokens * 2.0 + output_tokens * 10.0
                           + cache_write_tokens * 2.5 + cache_read_tokens * 0.2)::bigint
 where cost_micro_usd = 0
   and (input_tokens + output_tokens + cache_write_tokens + cache_read_tokens) > 0;

-- The old signature has no cost argument. Dropped rather than overloaded: two
-- functions with the same name and defaulted trailing arguments make a call
-- with six arguments ambiguous.
drop function if exists add_usage(uuid, date, bigint, bigint, bigint, bigint);

create or replace function add_usage(
  p_user uuid,
  p_period date,
  p_in bigint,
  p_out bigint,
  p_cache_read bigint default 0,
  p_cache_write bigint default 0,
  p_cost bigint default 0
) returns void
language sql
security definer
set search_path = public
as $$
  insert into agxp_usage as u
    (user_id, period_start, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_micro_usd, requests)
  values
    (p_user, p_period, p_in, p_out, p_cache_read, p_cache_write, greatest(p_cost, 0), 1)
  on conflict (user_id, period_start) do update set
    input_tokens       = u.input_tokens       + excluded.input_tokens,
    output_tokens      = u.output_tokens      + excluded.output_tokens,
    cache_read_tokens  = u.cache_read_tokens  + excluded.cache_read_tokens,
    cache_write_tokens = u.cache_write_tokens + excluded.cache_write_tokens,
    cost_micro_usd     = u.cost_micro_usd     + excluded.cost_micro_usd,
    requests           = u.requests           + 1,
    updated_at         = now();
$$;

revoke all on function add_usage(uuid, date, bigint, bigint, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function add_usage(uuid, date, bigint, bigint, bigint, bigint, bigint) to service_role;

-- ── 2. the month, across everyone ───────────────────────────────────────────
-- Every plan is monthly now, so every row of this month has period_start on
-- the 1st. `>=` rather than `=` also catches the last weekly free rows from
-- before this migration that started inside the month.
create or replace function month_spend_micro_usd()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(cost_micro_usd), 0)::bigint
    from agxp_usage
   where period_start >= (date_trunc('month', (now() at time zone 'utc')))::date;
$$;

revoke all on function month_spend_micro_usd() from public, anon, authenticated;
grant execute on function month_spend_micro_usd() to service_role;

-- ── 3. a rate limit every instance shares ───────────────────────────────────
-- Fixed window, one row per user and bucket. The upsert is one statement, so
-- two instances counting the same user at the same moment both see the other.
create table if not exists agxp_rate_limits (
  user_id      uuid not null references auth.users(id) on delete cascade,
  bucket       text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (user_id, bucket)
);

alter table agxp_rate_limits enable row level security;
-- No policy: only the service role reads or writes it.

create or replace function take_rate_slot(
  p_user uuid,
  p_bucket text,
  p_window_seconds integer,
  p_max integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into agxp_rate_limits as r (user_id, bucket, window_start, hits)
  values (p_user, p_bucket, v_window, 1)
  on conflict (user_id, bucket) do update set
    hits = case when r.window_start = excluded.window_start then r.hits + 1 else 1 end,
    window_start = excluded.window_start
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;

revoke all on function take_rate_slot(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function take_rate_slot(uuid, text, integer, integer) to service_role;

-- ── 4. free is 3 projects a month ───────────────────────────────────────────
-- While 0015 holds every plan at Max's numbers, the free row already says
-- 'month'. This is what 0015's way back now reads:
--   update agxp_plan_limits set projects = 3,  period = 'month', agents_per_type = 1 where plan = 'free';
update agxp_plan_limits set period = 'month' where plan = 'free';

-- ── 5. beta keys from a real random source ──────────────────────────────────
-- random() is not a cryptographic generator; gen_random_bytes() is. A key is
-- the only thing between a stranger and the model budget while we are invite
-- only, so it should not be predictable from earlier keys.
create extension if not exists pgcrypto with schema extensions;

create or replace function mint_beta_key(p_user uuid, p_plan text, p_uses integer, p_note text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_allowed boolean;
  v_code text;
  -- No I, O, 0 or 1: these get read off a screen and typed by someone else.
  -- 32 symbols, so one random byte mod 32 is unbiased.
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  i integer;
begin
  -- The same rule as every other privileged function (0012): the grant AND a
  -- confirmed address on the company domain.
  if not is_team_member(p_user) then
    raise exception 'This account cannot create invitations.' using errcode = 'P0001';
  end if;
  if p_plan not in ('free','mid','max') then
    raise exception 'Unknown plan.' using errcode = 'P0001';
  end if;

  loop
    v_bytes := gen_random_bytes(8);
    v_code := 'AGXP-';
    for i in 0..7 loop
      v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes, i) % 32), 1);
    end loop;
    exit when not exists (select 1 from agxp_beta_keys where code = v_code);
  end loop;

  insert into agxp_beta_keys (code, plan, max_uses, note)
  values (v_code, p_plan, greatest(1, least(coalesce(p_uses, 1), 50)), p_note);

  return v_code;
end $$;

revoke all on function mint_beta_key(uuid, text, integer, text) from public, anon, authenticated;
grant execute on function mint_beta_key(uuid, text, integer, text) to service_role;
