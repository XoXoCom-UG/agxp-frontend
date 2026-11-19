-- 0032 — who an invitation was emailed to, and when (Ana, 2026-11-19).
--
-- Until now the address an invitation went to lived only in the panel's
-- memory: reload, and nobody could tell who got which key, or send it again.
-- Two columns on the key, one function that writes them, and list_beta_keys
-- returns them. Same rule as every other invitation function (0012): the
-- grant AND a confirmed company address, asked of is_team_member().
--
-- The app works without this migration: the route ignores a missing
-- record_invite_email(), and the panel shows what the list gives it.

alter table agxp_beta_keys add column if not exists email text;
alter table agxp_beta_keys add column if not exists emailed_at timestamptz;

create or replace function record_invite_email(p_user uuid, p_code text, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_team_member(p_user) then
    raise exception 'This account cannot send invitations.' using errcode = 'P0001';
  end if;
  update agxp_beta_keys
     set email = nullif(trim(p_email), ''), emailed_at = now()
   where code = upper(trim(p_code));
end $$;

revoke all on function record_invite_email(uuid, text, text) from public, anon, authenticated;
grant execute on function record_invite_email(uuid, text, text) to service_role;

-- The return type grows, which create or replace cannot do.
drop function if exists list_beta_keys(uuid);

create function list_beta_keys(p_user uuid)
returns table (code text, plan text, used_count integer, max_uses integer, note text,
               created_at timestamptz, email text, emailed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_team_member(p_user) then
    raise exception 'This account cannot see invitations.' using errcode = 'P0001';
  end if;

  return query
    select k.code, k.plan, k.used_count, k.max_uses, k.note, k.created_at, k.email, k.emailed_at
      from agxp_beta_keys k
     order by k.created_at desc
     limit 50;
end $$;

revoke all on function list_beta_keys(uuid) from public, anon, authenticated;
grant execute on function list_beta_keys(uuid) to service_role;
