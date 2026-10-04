-- 0012_team_domain.sql — the team panels need a company address, not just a flag.
--
-- Until now one boolean decided it: can_switch_plan on agxp_entitlements.
-- That is a thing someone with database access sets, and nothing tied it to
-- who the person actually is. The rule we want is "the three of us, from our
-- own addresses", so both halves now have to hold:
--
--   1. can_switch_plan is true  — someone deliberately granted it
--   2. the address ends in @xoxocom.net AND is confirmed
--
-- Two conditions rather than one, on purpose. A flag granted by mistake is
-- useless from a private address; a company address is useless without the
-- grant. Neither alone opens anything.
--
-- The address comes from auth.users, which the browser cannot write: changing
-- it goes through Supabase and a confirmation mail. email_confirmed_at is
-- checked because an unconfirmed address proves nothing — anyone can type
-- someone@xoxocom.net into a sign-up form. Google sign-in arrives confirmed.

create or replace function is_team_member(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
      from agxp_entitlements e
      join auth.users u on u.id = e.user_id
     where e.user_id = p_user
       and e.can_switch_plan
       and u.email_confirmed_at is not null
       and lower(u.email) like '%@xoxocom.net'
  );
$$;

comment on function is_team_member is
  'True only for a granted account whose confirmed address is on the company '
  'domain. The single gate behind set_own_plan, mint_beta_key and '
  'list_beta_keys — change the rule here, not in three places.';

-- Not callable by a signed-in user: it takes any uuid, and answering
-- "is this other person on the team" for an arbitrary id is a question
-- nobody needs to be able to ask.
revoke all on function is_team_member(uuid) from public, anon, authenticated;
grant execute on function is_team_member(uuid) to service_role;

-- What a client asks instead: about itself, with no argument to point
-- somewhere else. auth.uid() comes from the verified token, so this cannot
-- be aimed at another account.
create or replace function am_i_team()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(is_team_member(auth.uid()), false);
$$;

comment on function am_i_team is
  'Whether the CALLER is on the team. Used to decide whether the team panels '
  'are drawn, and re-asked server-side before anything privileged runs — '
  'hiding a button is a courtesy, the refusal inside the functions is the '
  'security.';

revoke all on function am_i_team() from public, anon;
grant execute on function am_i_team() to authenticated, service_role;

-- ── The three privileged functions now ask that one question ───────────────
-- Bodies are otherwise unchanged from 0010; only the check at the top moves.

create or replace function set_own_plan(p_user uuid, p_plan text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_team_member(p_user) then
    raise exception 'This account cannot change plans.' using errcode = 'P0001';
  end if;
  if p_plan not in ('free','mid','max') then
    raise exception 'Unknown plan.' using errcode = 'P0001';
  end if;

  insert into agxp_entitlements (user_id, plan, updated_at)
  values (p_user, p_plan, now())
  on conflict (user_id) do update
    set plan = excluded.plan, updated_at = now();

  return p_plan;
end $$;

create or replace function mint_beta_key(p_user uuid, p_plan text, p_uses integer, p_note text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  -- No I, O, 0 or 1: these get read off a screen and typed by someone else,
  -- and a key nobody can transcribe is worse than no key.
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i integer;
begin
  if not is_team_member(p_user) then
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

create or replace function list_beta_keys(p_user uuid)
returns table (code text, plan text, used_count integer, max_uses integer, note text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_team_member(p_user) then
    raise exception 'This account cannot see invitations.' using errcode = 'P0001';
  end if;

  return query
    select k.code, k.plan, k.used_count, k.max_uses, k.note, k.created_at
      from agxp_beta_keys k
     order by k.created_at desc
     limit 50;
end $$;

revoke all on function set_own_plan(uuid, text) from public, anon, authenticated;
revoke all on function mint_beta_key(uuid, text, integer, text) from public, anon, authenticated;
revoke all on function list_beta_keys(uuid) from public, anon, authenticated;
grant execute on function set_own_plan(uuid, text) to service_role;
grant execute on function mint_beta_key(uuid, text, integer, text) to service_role;
grant execute on function list_beta_keys(uuid) to service_role;

-- ── Who has the flag today ─────────────────────────────────────────────────
-- Run this after applying, and revoke anyone who should not be on the list.
-- An account off the domain keeps the flag but can no longer use it.
--
--   select u.email, e.can_switch_plan, is_team_member(e.user_id) as still_allowed
--     from agxp_entitlements e
--     join auth.users u on u.id = e.user_id
--    where e.can_switch_plan;
