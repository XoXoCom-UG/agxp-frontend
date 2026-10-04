-- AgxP — limita de proiecte, aplicata in baza (2026-10-05)
--
-- 0007 left the project count as a browser-side check, which is fine for a
-- clear message and useless against anyone who opens devtools. The token
-- ceiling in the chat route is the real cost control, but the project count
-- is what the plan is SOLD on, so once money is involved it has to hold.
--
-- The numbers below are duplicated from lib/plans.ts. That is a real cost —
-- two places to change — and it is deliberate: the alternative is trusting
-- the client with a limit it is also allowed to edit. The table makes the
-- duplication visible instead of hiding it inside a function body, so a
-- mismatch is one SELECT away rather than a code read.
--
--   CHANGING A LIMIT MEANS CHANGING BOTH lib/plans.ts AND agxp_plan_limits.
--   lib/plans.ts stays the source of truth for the product; this table is
--   the enforcement copy.

create table if not exists agxp_plan_limits (
  plan      text primary key check (plan in ('free','mid','max')),
  projects  integer not null,
  period    text not null check (period in ('week','month'))
);

alter table agxp_plan_limits enable row level security;

-- Readable by anyone signed in: the pricing page is not a secret, and the UI
-- can cross-check the number it shows against the one that is enforced.
drop policy if exists agxp_plan_limits_select on agxp_plan_limits;
create policy agxp_plan_limits_select on agxp_plan_limits for select to authenticated using (true);

insert into agxp_plan_limits (plan, projects, period) values
  ('free', 3,       'week'),
  ('mid',  15,      'month'),
  -- Sold as unlimited. The real stop for this plan is the token ceiling in
  -- the chat route; this number exists so one runaway script cannot create a
  -- million rows.
  ('max',  100000,  'month')
on conflict (plan) do update set
  projects = excluded.projects,
  period   = excluded.period;

-- ── the trigger ─────────────────────────────────────────────────────────────
create or replace function enforce_project_quota() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan    text;
  v_limit   integer;
  v_period  text;
  v_start   date;
  v_count   integer;
begin
  -- No entitlement row means the default plan, the same rule the app uses.
  select coalesce(e.plan, 'free') into v_plan
    from agxp_entitlements e where e.user_id = new.owner_id;
  v_plan := coalesce(v_plan, 'free');

  select l.projects, l.period into v_limit, v_period
    from agxp_plan_limits l where l.plan = v_plan;
  -- An unknown plan must not hand out unlimited projects.
  if v_limit is null then
    select l.projects, l.period into v_limit, v_period
      from agxp_plan_limits l where l.plan = 'free';
  end if;

  -- Monday for a weekly window, the 1st for a monthly one — the same windows
  -- lib/plans.ts computes, so the browser and the database never disagree
  -- about which week it is. date_trunc('week') is ISO: it starts on Monday.
  if v_period = 'week' then
    v_start := (date_trunc('week', (now() at time zone 'utc')))::date;
  else
    v_start := (date_trunc('month', (now() at time zone 'utc')))::date;
  end if;

  select count(*) into v_count
    from agxp_projects p
    where p.owner_id = new.owner_id
      and p.created_at >= v_start;

  if v_count >= v_limit then
    -- The message reaches the browser as the error text, so it says what
    -- happened in words a user can act on rather than a constraint name.
    raise exception
      'You have used all % projects your plan allows for this %. The allowance resets at the start of the next one.',
      v_limit, v_period
      using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists agxp_projects_quota on agxp_projects;
create trigger agxp_projects_quota
  before insert on agxp_projects
  for each row execute function enforce_project_quota();
