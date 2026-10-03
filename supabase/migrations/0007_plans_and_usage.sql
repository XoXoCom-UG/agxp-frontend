-- AgxP — planuri si consum (2026-10-04)
--
-- Two tables, and the whole design rests on who is allowed to write them.
--
-- SECURITY, the part that matters:
--
--   The plan must NOT live in auth.users.raw_user_meta_data. The app already
--   writes that field from the browser (lib/auth-context.tsx calls
--   supabase.auth.updateUser({ data: { full_name } })), which means a user can
--   write their own metadata — and a plan stored there is a plan the user can
--   set to 'max' themselves from the console.
--
--   Same reasoning for usage. If RLS let a user update their own usage row,
--   they could set it back to zero. So: the user may SELECT both tables and
--   write NEITHER. Every write goes through the service role from the API
--   route, which the browser never sees.
--
-- There is deliberately no INSERT/UPDATE/DELETE policy below for the
-- `authenticated` role. That is not an omission — with RLS enabled and no
-- policy, those statements are denied. The service role bypasses RLS.

-- ── agxp_entitlements ───────────────────────────────────────────────────────
-- One row per user. Absent row means the default plan, so signing up needs no
-- extra write and a failed insert can never lock someone out of the product.
create table if not exists agxp_entitlements (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  plan         text not null default 'free' check (plan in ('free','mid','max')),
  -- Set when a subscription starts, for a future billing integration. The app
  -- does not read it yet; the allowance window is computed from the calendar
  -- (lib/plans.ts periodStart) so that every user's week starts on the same
  -- Monday and a period can be aggregated across users.
  started_at   timestamptz,
  note         text,
  updated_at   timestamptz not null default now()
);

alter table agxp_entitlements enable row level security;

drop policy if exists agxp_entitlements_select_own on agxp_entitlements;
create policy agxp_entitlements_select_own on agxp_entitlements
  for select using (auth.uid() = user_id);

-- ── agxp_usage ──────────────────────────────────────────────────────────────
-- One row per user per allowance window. `period_start` is a date so the
-- primary key does the deduplication and a window is one upsert target.
create table if not exists agxp_usage (
  user_id            uuid not null references auth.users(id) on delete cascade,
  period_start       date not null,
  input_tokens       bigint not null default 0,
  output_tokens      bigint not null default 0,
  -- Kept separate because cached input is a tenth of the price. Without it
  -- the totals say nothing about what prompt caching is actually saving.
  cache_read_tokens  bigint not null default 0,
  cache_write_tokens bigint not null default 0,
  requests           integer not null default 0,
  updated_at         timestamptz not null default now(),
  primary key (user_id, period_start)
);

alter table agxp_usage enable row level security;

drop policy if exists agxp_usage_select_own on agxp_usage;
create policy agxp_usage_select_own on agxp_usage
  for select using (auth.uid() = user_id);

create index if not exists agxp_usage_period_idx on agxp_usage(period_start);

-- ── add_usage ───────────────────────────────────────────────────────────────
-- Accumulating with a read-modify-write from the route would drop counts
-- whenever two of a user's requests land together — both panels answer at
-- once in this app, so that is the normal case, not the rare one. An upsert
-- with `excluded` adds inside a single statement instead.
--
-- SECURITY DEFINER with a pinned search_path: the function runs as its owner
-- so the route can call it, and the pinned path stops a schema earlier in the
-- caller's search_path from shadowing the table.
create or replace function add_usage(
  p_user uuid,
  p_period date,
  p_in bigint,
  p_out bigint,
  p_cache_read bigint default 0,
  p_cache_write bigint default 0
) returns void
language sql
security definer
set search_path = public
as $$
  insert into agxp_usage as u
    (user_id, period_start, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, requests)
  values
    (p_user, p_period, p_in, p_out, p_cache_read, p_cache_write, 1)
  on conflict (user_id, period_start) do update set
    input_tokens       = u.input_tokens       + excluded.input_tokens,
    output_tokens      = u.output_tokens      + excluded.output_tokens,
    cache_read_tokens  = u.cache_read_tokens  + excluded.cache_read_tokens,
    cache_write_tokens = u.cache_write_tokens + excluded.cache_write_tokens,
    requests           = u.requests           + 1,
    updated_at         = now();
$$;

-- Only the service role calls this. Revoking the rest makes that explicit
-- rather than relying on nobody noticing the function exists.
revoke all on function add_usage(uuid, date, bigint, bigint, bigint, bigint) from public;
revoke all on function add_usage(uuid, date, bigint, bigint, bigint, bigint) from anon;
revoke all on function add_usage(uuid, date, bigint, bigint, bigint, bigint) from authenticated;
grant execute on function add_usage(uuid, date, bigint, bigint, bigint, bigint) to service_role;
