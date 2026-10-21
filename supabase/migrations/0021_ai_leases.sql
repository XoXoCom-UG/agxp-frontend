-- AgxP — costul se rezervă înainte de apel, plus oprire de urgență (2026-10-21)
--
-- RUN THIS BEFORE deploying the code that calls it (lib/entitlement-server.ts
-- beginAiCall / settleAiCall). Without it production refuses every model call,
-- the same fail-closed rule as a missing usage table.
--
-- The hole this closes. The routes read what an account has spent, call the
-- model, and only write the cost once the stream has closed. Twenty requests
-- sent in the same second all read the same "spent so far", all pass, and the
-- account — or the free pool, or the whole month — ends up well past its cap.
-- One account doing that is a few dollars; a thousand scripted accounts doing
-- it at once is the free pool several times over.
--
-- So every model call now takes a LEASE first, in one transaction:
--   * at most N calls in flight per account and kind (two chats — one per
--     panel — and one title);
--   * what is in flight counts as spent: account, free pool and month are
--     compared against "recorded + reserved", so parallel requests see each
--     other;
--   * the lease is released when the cost is recorded (settle_ai_call), in the
--     same transaction, so there is no moment where a call counts as neither.
-- A lease whose server died mid-stream expires on its own (p_ttl_seconds).
--
-- And agxp_ai_switch: one row, one flag, read by every lease. Setting it stops
-- every new model call at once, without a deploy:
--   update agxp_ai_switch set paused = true,  reason = '...', updated_at = now();
--   update agxp_ai_switch set paused = false, reason = null,  updated_at = now();
--
-- Safe to re-run.

-- ── 1. the kill switch ──────────────────────────────────────────────────────
create table if not exists agxp_ai_switch (
  id         boolean primary key default true check (id),
  paused     boolean not null default false,
  reason     text,
  updated_at timestamptz not null default now()
);
insert into agxp_ai_switch (id) values (true) on conflict (id) do nothing;

alter table agxp_ai_switch enable row level security;
-- No policy: only the service role and the SQL editor touch it.

-- ── 2. calls in flight ──────────────────────────────────────────────────────
create table if not exists agxp_ai_leases (
  id                 uuid primary key,
  user_id            uuid not null references auth.users(id) on delete cascade,
  kind               text not null check (kind in ('chat', 'title')),
  is_free            boolean not null,
  reserved_micro_usd bigint not null check (reserved_micro_usd >= 0),
  expires_at         timestamptz not null
);
create index if not exists agxp_ai_leases_user on agxp_ai_leases (user_id);

alter table agxp_ai_leases enable row level security;
-- No policy: only the service role reads or writes it.

-- ── 3. take a lease ─────────────────────────────────────────────────────────
-- Returns 'ok' or why not: 'paused', 'busy', 'account', 'free_pool', 'month'.
--
-- The caps compare with >=, exactly like blocked() in the app: a request is
-- refused once what is recorded PLUS what is in flight has reached the cap. A
-- single request can still finish past it, as before — what changes is that
-- twenty parallel ones no longer all start from the same number.
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
  p_ttl_seconds     integer
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_in_flight integer;
  v_spent     bigint;
  v_pool      bigint;
  v_month     bigint;
begin
  if coalesce((select paused from agxp_ai_switch where id), false) then
    return 'paused';
  end if;

  -- Every caller queues on the same lock until this transaction ends. The
  -- month and the free pool are sums over everyone, so without it two
  -- accounts could still both read "just under" and both start. Held for one
  -- short transaction, not for the model call.
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

  insert into agxp_ai_leases (id, user_id, kind, is_free, reserved_micro_usd, expires_at)
  values (p_lease, p_user, p_kind, p_is_free, greatest(p_reserve, 0),
          now() + make_interval(secs => greatest(p_ttl_seconds, 30)));
  return 'ok';
end $$;

revoke all on function begin_ai_call(uuid, uuid, text, date, bigint, bigint, integer, boolean, bigint, bigint, integer)
  from public, anon, authenticated;
grant execute on function begin_ai_call(uuid, uuid, text, date, bigint, bigint, integer, boolean, bigint, bigint, integer)
  to service_role;

-- ── 4. record the real cost and release the lease, together ─────────────────
create or replace function settle_ai_call(
  p_lease       uuid,
  p_user        uuid,
  p_period      date,
  p_in          bigint,
  p_out         bigint,
  p_cache_read  bigint,
  p_cache_write bigint,
  p_cost        bigint
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from agxp_ai_leases where id = p_lease and user_id = p_user;
  -- A call that never reached the model (it failed before sending) has
  -- nothing to record; it only gives its lease back.
  if coalesce(p_in, 0) + coalesce(p_out, 0) + coalesce(p_cache_read, 0)
     + coalesce(p_cache_write, 0) + coalesce(p_cost, 0) > 0 then
    perform add_usage(p_user, p_period, p_in, p_out, p_cache_read, p_cache_write, p_cost);
  end if;
end $$;

revoke all on function settle_ai_call(uuid, uuid, date, bigint, bigint, bigint, bigint, bigint)
  from public, anon, authenticated;
grant execute on function settle_ai_call(uuid, uuid, date, bigint, bigint, bigint, bigint, bigint)
  to service_role;
