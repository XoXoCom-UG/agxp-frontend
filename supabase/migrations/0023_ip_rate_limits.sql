-- 0023_ip_rate_limits.sql — a limit per network, shared by every instance.
--
-- 0017 limits an ACCOUNT (take_rate_slot). That cannot see what happens before
-- there is an account holder: a flood of requests without a token, or one person
-- spreading a guessing attack over many accounts. lib/ip-gate.ts counts per
-- network, ahead of the session lookup, and this is the count every instance shares.
--
-- What is stored: a keyed hash of the network (an IPv4 address, or the /64 of an
-- IPv6 one) — never the address. The key is IP_HASH_SALT, or the service role key
-- when that is not set; both live only on the server. Rows are one per network and
-- scope, overwritten each window, and rows nobody has touched for a day are swept
-- by whichever request happens to draw it, so there is no job to schedule.
--
-- Written only by the service role. Safe to re-run. Until it is applied the app
-- keeps its per-instance count and logs one line saying so — it does not lock anyone out.

create table if not exists agxp_ip_rate_limits (
  ip_key       text        not null,
  bucket       text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (ip_key, bucket)
);

alter table agxp_ip_rate_limits enable row level security;
-- No policy: only the service role reads or writes it.

create or replace function take_ip_slot(
  p_key text,
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
  insert into agxp_ip_rate_limits as r (ip_key, bucket, window_start, hits)
  values (p_key, p_bucket, v_window, 1)
  on conflict (ip_key, bucket) do update set
    hits = case when r.window_start = excluded.window_start then r.hits + 1 else 1 end,
    window_start = excluded.window_start
  returning hits into v_hits;

  if random() < 0.01 then
    delete from agxp_ip_rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_max;
end $$;

revoke all on function take_ip_slot(text, text, integer, integer) from public, anon, authenticated;
grant execute on function take_ip_slot(text, text, integer, integer) to service_role;
