-- AgxP — abonamente prin Stripe si limita pe conversatie (2026-11-20)
--
-- RUN THIS BEFORE deploying the code that calls it. The chat route then calls
-- the 13-argument begin_ai_call and the 9-argument settle_ai_call; the old
-- signatures from 0021 stay, so code deployed before this file keeps working.
--
-- Two things, both about who may spend what.
--
-- 1. BILLING. Stripe is the only thing that may make an account paid, and it
--    does so only through its signed webhook (app/api/billing/webhook), which
--    writes with the service role. The user may read their own billing row and
--    write nothing: a subscription status the browser can write is a Max plan
--    the browser can grant itself — the same rule as agxp_entitlements (0007).
--    agxp_stripe_events makes the webhook idempotent: Stripe delivers at least
--    once, and a replayed event must not do anything twice.
--
-- 2. A CEILING PER CONVERSATION. The account ceiling (plans.ts costCeilingUsd)
--    stops one person per month; it does not stop ONE conversation from eating
--    the whole month, and cost grows with the square of a conversation's
--    length. So every project now has its own counter, and a call is refused
--    once the project's recorded cost plus what is in flight for it reaches the
--    plan's per-conversation ceiling. The way on is a new project (which counts
--    against the plan's projects) or a bigger plan. The counter lives in its own
--    table, not on agxp_projects, because the owner may UPDATE agxp_projects
--    (renaming) — a counter there would be a counter they can zero.
--
-- Safe to re-run.

-- ── 1. billing ──────────────────────────────────────────────────────────────
create table if not exists agxp_billing (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text,
  -- Stripe's own word: active, trialing, past_due, unpaid, canceled, incomplete…
  status                 text,
  price_id               text,
  -- The plan this subscription pays for, as the webhook mapped the price.
  plan                   text check (plan in ('free','mid','max')),
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  updated_at             timestamptz not null default now()
);

alter table agxp_billing enable row level security;

drop policy if exists agxp_billing_select_own on agxp_billing;
create policy agxp_billing_select_own on agxp_billing
  for select using (auth.uid() = user_id);
-- No insert/update/delete policy: only the service role writes.

create table if not exists agxp_stripe_events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);
alter table agxp_stripe_events enable row level security;
-- No policy: only the service role touches it.

-- ── 2. the per-conversation counter ─────────────────────────────────────────
create table if not exists agxp_project_usage (
  project_id     uuid primary key references agxp_projects(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  cost_micro_usd bigint not null default 0,
  input_tokens   bigint not null default 0,
  output_tokens  bigint not null default 0,
  requests       integer not null default 0,
  updated_at     timestamptz not null default now()
);
create index if not exists agxp_project_usage_user on agxp_project_usage (user_id);

alter table agxp_project_usage enable row level security;

drop policy if exists agxp_project_usage_select_own on agxp_project_usage;
create policy agxp_project_usage_select_own on agxp_project_usage
  for select using (auth.uid() = user_id);

-- Which conversation a call in flight belongs to, so parallel calls on the
-- same project see each other (two panels answer at once).
alter table agxp_ai_leases add column if not exists project_id uuid;
create index if not exists agxp_ai_leases_project on agxp_ai_leases (project_id);

-- ── 3. take a lease, with the conversation ──────────────────────────────────
-- Everything begin_ai_call (0021) does, plus 'conversation' when the project
-- has reached p_project_ceiling. The project must be the caller's own; one
-- that is not reads as 'conversation' too, so nothing is spent on it.
create or replace function begin_ai_call(
  p_user            uuid,
  p_lease           uuid,
  p_kind            text,
  p_period          date,
  p_reserve         bigint,
  p_ceiling         bigint,
  p_max_in_flight   integer,
  p_is_free         boolean,
  p_free_pool       bigint,
  p_month_budget    bigint,
  p_ttl_seconds     integer,
  p_project         uuid,
  p_project_ceiling bigint
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_in_flight integer;
  v_spent     bigint;
  v_project   bigint;
  v_pool      bigint;
  v_month     bigint;
begin
  if coalesce((select paused from agxp_ai_switch where id), false) then
    return 'paused';
  end if;

  perform pg_advisory_xact_lock(hashtext('agxp_ai_budget'));

  delete from agxp_ai_leases where expires_at < now();

  select count(*) into v_in_flight
    from agxp_ai_leases where user_id = p_user and kind = p_kind;
  if v_in_flight >= p_max_in_flight then
    return 'busy';
  end if;

  select coalesce((select cost_micro_usd from agxp_usage
                    where user_id = p_user and period_start = p_period), 0)
       + coalesce((select sum(reserved_micro_usd) from agxp_ai_leases
                    where user_id = p_user), 0)
    into v_spent;
  if v_spent >= p_ceiling then
    return 'account';
  end if;

  if p_project is not null then
    if not exists (select 1 from agxp_projects where id = p_project and owner_id = p_user) then
      return 'conversation';
    end if;
    select coalesce((select cost_micro_usd from agxp_project_usage where project_id = p_project), 0)
         + coalesce((select sum(reserved_micro_usd) from agxp_ai_leases where project_id = p_project), 0)
      into v_project;
    if v_project >= p_project_ceiling then
      return 'conversation';
    end if;
  end if;

  if p_is_free then
    select month_spend_free_micro_usd()
         + coalesce((select sum(reserved_micro_usd) from agxp_ai_leases where is_free), 0)
      into v_pool;
    if v_pool >= p_free_pool then
      return 'free_pool';
    end if;
  end if;

  select month_spend_micro_usd()
       + coalesce((select sum(reserved_micro_usd) from agxp_ai_leases), 0)
    into v_month;
  if v_month >= p_month_budget then
    return 'month';
  end if;

  insert into agxp_ai_leases (id, user_id, kind, is_free, reserved_micro_usd, expires_at, project_id)
  values (p_lease, p_user, p_kind, p_is_free, greatest(p_reserve, 0),
          now() + make_interval(secs => greatest(p_ttl_seconds, 30)), p_project);
  return 'ok';
end $$;

revoke all on function begin_ai_call(uuid, uuid, text, date, bigint, bigint, integer, boolean, bigint, bigint, integer, uuid, bigint)
  from public, anon, authenticated;
grant execute on function begin_ai_call(uuid, uuid, text, date, bigint, bigint, integer, boolean, bigint, bigint, integer, uuid, bigint)
  to service_role;

-- ── 4. settle, with the conversation ────────────────────────────────────────
create or replace function settle_ai_call(
  p_lease       uuid,
  p_user        uuid,
  p_period      date,
  p_in          bigint,
  p_out         bigint,
  p_cache_read  bigint,
  p_cache_write bigint,
  p_cost        bigint,
  p_project     uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from agxp_ai_leases where id = p_lease and user_id = p_user;
  if coalesce(p_in, 0) + coalesce(p_out, 0) + coalesce(p_cache_read, 0)
     + coalesce(p_cache_write, 0) + coalesce(p_cost, 0) > 0 then
    perform add_usage(p_user, p_period, p_in, p_out, p_cache_read, p_cache_write, p_cost);
    -- Only a project that still exists and is the caller's: a project deleted
    -- mid-answer has nothing left to count against.
    if p_project is not null
       and exists (select 1 from agxp_projects where id = p_project and owner_id = p_user) then
      insert into agxp_project_usage as u
        (project_id, user_id, cost_micro_usd, input_tokens, output_tokens, requests)
      values
        (p_project, p_user, greatest(coalesce(p_cost, 0), 0),
         coalesce(p_in, 0) + coalesce(p_cache_read, 0) + coalesce(p_cache_write, 0),
         coalesce(p_out, 0), 1)
      on conflict (project_id) do update set
        cost_micro_usd = u.cost_micro_usd + excluded.cost_micro_usd,
        input_tokens   = u.input_tokens   + excluded.input_tokens,
        output_tokens  = u.output_tokens  + excluded.output_tokens,
        requests       = u.requests       + 1,
        updated_at     = now();
    end if;
  end if;
end $$;

revoke all on function settle_ai_call(uuid, uuid, date, bigint, bigint, bigint, bigint, bigint, uuid)
  from public, anon, authenticated;
grant execute on function settle_ai_call(uuid, uuid, date, bigint, bigint, bigint, bigint, bigint, uuid)
  to service_role;
