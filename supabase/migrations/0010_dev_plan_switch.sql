-- AgxP — comutator de plan pentru dezvoltatori (2026-10-05)
--
-- Being able to flip between Free, Mid and Max from Settings is the only way
-- to actually see what a tier looks like without editing the database every
-- time. It is also, obviously, the one thing that must never be available to
-- the people the tiers apply to: a plan the user can set is not a plan.
--
-- So it is a flag on the entitlement row, false for everyone by default, and
-- the server checks it on every switch. The user can read the flag (RLS
-- already allows reading your own row, and the Settings panel needs to know
-- whether to draw the control) but cannot write it — same rule as the plan
-- itself.

alter table agxp_entitlements
  add column if not exists can_switch_plan boolean not null default false;

comment on column agxp_entitlements.can_switch_plan is
  'Developer switch. Lets this account change its own plan from Settings and '
  'mint beta keys. Never grant it to a tester — a plan the user can set is '
  'not a plan. Set it with the statement below, by hand, for the team only.';

-- Grant it to yourselves, by email, so nobody has to paste a uuid:
--
--   update agxp_entitlements e
--      set can_switch_plan = true
--     from auth.users u
--    where u.id = e.user_id
--      and u.email in ('tudor@xoxocom.net', 'ana@xoxocom.net');
--
-- And to see who has it:
--
--   select u.email, e.plan, e.can_switch_plan
--     from agxp_entitlements e join auth.users u on u.id = e.user_id
--    where e.can_switch_plan;

-- ── set_own_plan ────────────────────────────────────────────────────────────
-- The check lives in the function, not in the caller, so the route cannot
-- forget it and a second caller added later inherits it.
create or replace function set_own_plan(p_user uuid, p_plan text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
begin
  if p_plan not in ('free','mid','max') then
    raise exception 'Unknown plan.' using errcode = 'P0001';
  end if;

  select can_switch_plan into v_allowed
    from agxp_entitlements where user_id = p_user;

  if coalesce(v_allowed, false) = false then
    raise exception 'This account cannot change its own plan.' using errcode = 'P0001';
  end if;

  update agxp_entitlements
     set plan = p_plan, updated_at = now()
   where user_id = p_user;

  return p_plan;
end $$;

revoke all on function set_own_plan(uuid, text) from public, anon, authenticated;
grant execute on function set_own_plan(uuid, text) to service_role;

-- ── mint_beta_key ───────────────────────────────────────────────────────────
-- Handing out an invitation should not require opening the SQL editor. Same
-- flag guards it: a tester must not be able to mint themselves more seats.
create or replace function mint_beta_key(p_user uuid, p_plan text, p_uses integer, p_note text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
  v_code text;
  -- No I, O, 0 or 1: these get read off a screen and typed by someone else,
  -- and a key nobody can transcribe is worse than no key.
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i integer;
begin
  select can_switch_plan into v_allowed
    from agxp_entitlements where user_id = p_user;
  if coalesce(v_allowed, false) = false then
    raise exception 'This account cannot create invitations.' using errcode = 'P0001';
  end if;
  if p_plan not in ('free','mid','max') then
    raise exception 'Unknown plan.' using errcode = 'P0001';
  end if;

  loop
    v_code := 'AGXP-';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from agxp_beta_keys where code = v_code);
  end loop;

  insert into agxp_beta_keys (code, plan, max_uses, note)
  values (v_code, p_plan, greatest(1, coalesce(p_uses, 1)), p_note);

  return v_code;
end $$;

revoke all on function mint_beta_key(uuid, text, integer, text) from public, anon, authenticated;
grant execute on function mint_beta_key(uuid, text, integer, text) to service_role;

-- ── list_beta_keys ──────────────────────────────────────────────────────────
-- Read-only, same flag. The table itself stays closed to clients.
create or replace function list_beta_keys(p_user uuid)
returns table (code text, plan text, used_count integer, max_uses integer, note text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare v_allowed boolean;
begin
  select can_switch_plan into v_allowed
    from agxp_entitlements where user_id = p_user;
  if coalesce(v_allowed, false) = false then
    raise exception 'This account cannot see invitations.' using errcode = 'P0001';
  end if;

  return query
    select k.code, k.plan, k.used_count, k.max_uses, k.note, k.created_at
      from agxp_beta_keys k
     order by k.created_at desc
     limit 50;
end $$;

revoke all on function list_beta_keys(uuid) from public, anon, authenticated;
grant execute on function list_beta_keys(uuid) to service_role;
