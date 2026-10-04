-- AgxP — chei beta (2026-10-05)
--
-- Priority one on Patryk's list: get the site live, which means letting in
-- the people we invited and nobody else. Until now sign-up was open — anyone
-- who found the URL got an account and could start spending Anthropic
-- tokens on the first message.
--
-- A key is not a second account system. It grants an ENTITLEMENT, the row
-- 0007 already uses to decide what a person may do, so the whole plan
-- machinery works unchanged: redeem a key, get a plan, the limits follow.
--
-- Keys grant 'max' by default. A beta tester on the free tier would hit a
-- wall after three short interviews and report back about the wall instead
-- of about the product, which is the opposite of why they were invited.

create table if not exists agxp_beta_keys (
  code         text primary key,
  plan         text not null default 'max' check (plan in ('free','mid','max')),
  -- One key can seat a few people — a key per team is easier to hand out at
  -- a meeting than a key per person.
  max_uses     integer not null default 1 check (max_uses > 0),
  used_count   integer not null default 0,
  expires_at   timestamptz,
  note         text,                      -- who it went to, in plain words
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

alter table agxp_beta_keys enable row level security;
-- No policy at all: a signed-in user must never be able to read the key list
-- or discover an unused code. Redemption happens through the function below,
-- which runs as its owner.

-- ── redeem_beta_key ─────────────────────────────────────────────────────────
-- Atomic on purpose. Two people redeeming the last seat of the same key at
-- the same moment is exactly the case a read-then-write would get wrong:
-- both would read used_count = max_uses - 1 and both would be let in. The
-- UPDATE ... WHERE used_count < max_uses RETURNING takes a row lock, so the
-- second one finds nothing to update and is refused.
create or replace function redeem_beta_key(p_user uuid, p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(btrim(p_code));
  v_plan text;
  v_existing text;
begin
  -- Already admitted: hand back the plan they have rather than burning a
  -- seat. Someone who re-enters their key after clearing a browser should
  -- not use up an invitation they already spent.
  select plan into v_existing from agxp_entitlements where user_id = p_user;
  if v_existing is not null then
    return v_existing;
  end if;

  update agxp_beta_keys
     set used_count = used_count + 1,
         last_used_at = now()
   where code = v_code
     and used_count < max_uses
     and (expires_at is null or expires_at > now())
  returning plan into v_plan;

  if v_plan is null then
    -- Deliberately one message for every failure. Telling the difference
    -- between "no such key", "already used" and "expired" turns the form
    -- into an oracle for guessing valid codes.
    raise exception 'That key is not valid, or it has already been used.'
      using errcode = 'P0001';
  end if;

  insert into agxp_entitlements (user_id, plan, started_at, note)
  values (p_user, v_plan, now(), 'beta key ' || v_code)
  on conflict (user_id) do update set
    plan = excluded.plan,
    started_at = now(),
    note = excluded.note,
    updated_at = now();

  return v_plan;
end $$;

revoke all on function redeem_beta_key(uuid, text) from public;
revoke all on function redeem_beta_key(uuid, text) from anon;
revoke all on function redeem_beta_key(uuid, text) from authenticated;
grant execute on function redeem_beta_key(uuid, text) to service_role;

-- ── making keys ─────────────────────────────────────────────────────────────
-- Run this in the SQL editor to mint invitations. The note is what tells you
-- six weeks from now who AGXP-7K2M4P actually went to.
--
--   insert into agxp_beta_keys (code, plan, max_uses, note) values
--     ('AGXP-7K2M4P', 'max', 1, 'Patryk — Firma Mustermann, Hr. Wenzel'),
--     ('AGXP-QR93XT', 'max', 3, 'Ana — Uni-Gruppe, 3 Plaetze');
--
-- And to see where they went:
--
--   select code, plan, used_count, max_uses, last_used_at, note
--     from agxp_beta_keys order by created_at desc;
