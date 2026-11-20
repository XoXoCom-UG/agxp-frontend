-- AgxP — dashboardul de metrici pentru sef si marketing (2026-11-19)
--
-- O pagina (/metrics) care arata cum merge produsul: conturi noi, cine e activ,
-- proiecte, documente terminate, ce tipuri de consultant se aleg, cat costa.
-- Totul aici e construit ca sa fie GREU de citit de cine nu trebuie:
--
--   1. Un drept separat: agxp_metrics_viewers. NU e can_switch_plan — cine vede
--      metricile nu poate schimba planuri si nu poate face chei.
--   2. Doua conditii deodata, ca la echipa (0012): randul in agxp_metrics_viewers
--      SI adresa confirmata pe @xoxocom.net. Un rand pus din greseala nu deschide
--      nimic de pe o adresa privata.
--   3. 2FA obligatoriu: tokenul trebuie sa fie aal2 (cod din aplicatia de
--      autentificare, verificat in sesiunea asta). O parola furata nu ajunge.
--   4. Doar totaluri. Nicio functie de aici nu intoarce emailuri de clienti, nume
--      de proiecte sau text din conversatii. Grupurile mai mici de 5 conturi sunt
--      ascunse ("< 5"), ca un filtru sa nu arate cine e cine.
--   5. Fiecare cerere se scrie in agxp_metrics_access_log — si cele refuzate.
--      Jurnalul nu are nicio politica: nici cei care se uita nu il pot sterge.
--
-- Refuzurile NU se fac cu raise exception: un raise ar anula si randul din jurnal.
-- Functia intoarce {"refused": "..."} si ruta (app/api/metrics) raspunde 403.
--
-- CUM DAI ACCES (doar din SQL editor — nu exista alt drum):
--
--   insert into agxp_metrics_viewers (user_id, note)
--   select id, 'sef' from auth.users where lower(email) = 'nume@xoxocom.net';
--
-- CUM IL IEI:   delete from agxp_metrics_viewers where user_id = '...';
-- CINE ARE:     select u.email, v.note, v.granted_at, is_metrics_viewer(v.user_id)
--                 from agxp_metrics_viewers v join auth.users u on u.id = v.user_id;
-- CINE S-A UITAT: select * from agxp_metrics_access_log order by at desc limit 100;
--
-- Safe to re-run.

-- ── Cine are voie ───────────────────────────────────────────────────────────
create table if not exists agxp_metrics_viewers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  note       text,
  granted_at timestamptz not null default now()
);

alter table agxp_metrics_viewers enable row level security;
-- Nicio politica: un cont logat nu poate citi lista si nu se poate adauga singur.

-- ── Jurnalul ────────────────────────────────────────────────────────────────
create table if not exists agxp_metrics_access_log (
  id      bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  at      timestamptz not null default now(),
  what    text not null,
  -- 'ok', 'not_viewer', 'mfa_required'
  outcome text not null
);

create index if not exists agxp_metrics_access_log_at_idx on agxp_metrics_access_log(at desc);
create index if not exists agxp_metrics_access_log_user_idx on agxp_metrics_access_log(user_id, at desc);

alter table agxp_metrics_access_log enable row level security;
-- Nicio politica: se scrie doar din functiile de mai jos, se citeste doar prin
-- metrics_access_log() (cu drept + 2FA) sau din SQL editor.

-- ── Regula, intr-un singur loc ──────────────────────────────────────────────
create or replace function is_metrics_viewer(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
      from agxp_metrics_viewers v
      join auth.users u on u.id = v.user_id
     where v.user_id = p_user
       and u.email_confirmed_at is not null
       and lower(u.email) like '%@xoxocom.net'
  );
$$;

-- Ca is_team_member: primeste orice uuid, deci nu e pentru clienti.
revoke all on function is_metrics_viewer(uuid) from public, anon, authenticated;
grant execute on function is_metrics_viewer(uuid) to service_role;

-- aal2 = sesiunea a trecut prin al doilea factor. Claim-ul vine din tokenul
-- semnat de Supabase, nu din ce trimite browserul.
create or replace function metrics_mfa_ok()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

revoke all on function metrics_mfa_ok() from public, anon, authenticated;

-- Scrie in jurnal. Un refuz se scrie cel mult o data pe minut per cont, ca un
-- cont care apasa in bucla sa nu umple tabela.
create or replace function metrics_log(p_what text, p_outcome text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_outcome <> 'ok' and exists (
    select 1 from agxp_metrics_access_log
     where user_id = auth.uid() and outcome = p_outcome and at > now() - interval '1 minute'
  ) then
    return;
  end if;
  insert into agxp_metrics_access_log (user_id, what, outcome)
  values (auth.uid(), left(p_what, 80), p_outcome);
end $$;

revoke all on function metrics_log(text, text) from public, anon, authenticated;

-- Ce stie pagina ca sa decida ce deseneaza: are drept? a trecut de 2FA?
-- Despre APELANT, fara argument — nu poate fi indreptata spre alt cont.
create or replace function metrics_access()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'viewer', coalesce(is_metrics_viewer(auth.uid()), false),
    'mfa',    metrics_mfa_ok()
  );
$$;

revoke all on function metrics_access() from public, anon;
grant execute on function metrics_access() to authenticated;

-- Poarta comuna a functiilor de date. Intoarce null cand se poate continua,
-- altfel motivul refuzului (deja scris in jurnal).
create or replace function metrics_gate(p_what text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return 'not_viewer';
  end if;
  if not coalesce(is_metrics_viewer(auth.uid()), false) then
    perform metrics_log(p_what, 'not_viewer');
    return 'not_viewer';
  end if;
  if not metrics_mfa_ok() then
    perform metrics_log(p_what, 'mfa_required');
    return 'mfa_required';
  end if;
  perform metrics_log(p_what, 'ok');
  return null;
end $$;

revoke all on function metrics_gate(text) from public, anon, authenticated;

-- ── Cifrele ─────────────────────────────────────────────────────────────────
-- p_days: fereastra graficelor (7..180). p_include_team: false = fara conturile
-- @xoxocom.net, adica doar clientii reali; costul e mereu TOTAL (banii sunt reali
-- indiferent cine i-a cheltuit).
--
-- "Cont AgxP" = un cont cu rand in agxp_entitlements (a intrat cu cheie). Baza e
-- comuna cu o aplicatie mai veche, deci auth.users singur ar numara si conturile ei.
--
-- "Document terminat" = prima replica cu [[DOC:]] intr-o conversatie (proiect +
-- panou). Regenerarile nu se numara de doua ori — ca in lib/team-stats.ts.
create or replace function metrics_overview(p_days integer default 30, p_include_team boolean default false)
returns jsonb
language plpgsql
-- volatile, nu stable: scrie in jurnal.
security definer
set search_path = public, auth
as $$
declare
  v_refused text;
  v_days    integer := least(greatest(coalesce(p_days, 30), 7), 180);
  v_from    date;
  v_today   date := (now() at time zone 'utc')::date;
  v_month   date := date_trunc('month', now() at time zone 'utc')::date;
  v_k       integer := 5;   -- grupurile sub v_k conturi/proiecte se ascund
  v_result  jsonb;
begin
  v_refused := metrics_gate('overview:' || v_days || case when p_include_team then ':team' else '' end);
  if v_refused is not null then
    return jsonb_build_object('refused', v_refused);
  end if;

  v_from := v_today - (v_days - 1);

  with
  members as (
    select u.id, u.created_at
      from agxp_entitlements e
      join auth.users u on u.id = e.user_id
     where p_include_team or lower(coalesce(u.email, '')) not like '%@xoxocom.net'
  ),
  projects as (
    select p.id, p.owner_id, p.created_at, p.consultant_agent_id, p.coach_agent_id
      from agxp_projects p
      join members m on m.id = p.owner_id
  ),
  user_msgs as (
    select pr.owner_id, msg.created_at
      from agxp_project_messages msg
      join projects pr on pr.id = msg.project_id
     where msg.role = 'user'
  ),
  docs as (
    select pr.owner_id, min(msg.created_at) as first_at
      from agxp_project_messages msg
      join projects pr on pr.id = msg.project_id
     where msg.role = 'assistant' and msg.content like '%[[DOC:%'
     group by pr.owner_id, msg.project_id, msg.column_type
  ),
  days as (
    select d::date as d from generate_series(v_from, v_today, interval '1 day') d
  ),
  series as (
    select jsonb_agg(jsonb_build_object(
             'd', days.d,
             'accounts', (select count(*) from members m where (m.created_at at time zone 'utc')::date = days.d),
             'projects', (select count(*) from projects p where (p.created_at at time zone 'utc')::date = days.d),
             'messages', (select count(*) from user_msgs um where (um.created_at at time zone 'utc')::date = days.d),
             'docs',     (select count(*) from docs dc where (dc.first_at at time zone 'utc')::date = days.d),
             'active',   (select count(distinct um.owner_id) from user_msgs um where (um.created_at at time zone 'utc')::date = days.d)
           ) order by days.d) as s
      from days
  ),
  types as (
    select lower(trim(coalesce(a.tagline, ''))) as tagline, count(*) as n
      from projects p
      join agents a on a.id = p.consultant_agent_id
     group by 1
  ),
  plans as (
    select coalesce(e.plan, 'free') as plan, count(*) as n
      from members m
      left join agxp_entitlements e on e.user_id = m.id
     group by 1
  ),
  returning_users as (
    select owner_id
      from user_msgs
     where created_at >= now() - interval '30 days'
     group by owner_id
    having count(distinct (created_at at time zone 'utc')::date) >= 2
  )
  select jsonb_build_object(
    'generated_at', now(),
    'days', v_days,
    'include_team', p_include_team,
    'min_group', v_k,
    'totals', jsonb_build_object(
      'accounts',          (select count(*) from members),
      'accounts_in_range', (select count(*) from members where (created_at at time zone 'utc')::date >= v_from),
      'projects',          (select count(*) from projects),
      'projects_in_range', (select count(*) from projects where (created_at at time zone 'utc')::date >= v_from),
      'messages_in_range', (select count(*) from user_msgs where (created_at at time zone 'utc')::date >= v_from),
      'docs',              (select count(*) from docs),
      'docs_in_range',     (select count(*) from docs where (first_at at time zone 'utc')::date >= v_from),
      'active_7',          (select count(distinct owner_id) from user_msgs where created_at >= now() - interval '7 days'),
      'active_30',         (select count(distinct owner_id) from user_msgs where created_at >= now() - interval '30 days'),
      'returning_30',      (select count(*) from returning_users)
    ),
    'funnel', jsonb_build_object(
      'accounts',      (select count(*) from members),
      'with_project',  (select count(distinct owner_id) from projects),
      'with_message',  (select count(distinct owner_id) from user_msgs),
      'with_doc',      (select count(distinct owner_id) from docs)
    ),
    'series', (select s from series),
    -- Sub v_k: numarul nu pleaca din baza, doar "small".
    'consultant_types', coalesce((
      select jsonb_agg(case when n >= v_k
                            then jsonb_build_object('tagline', tagline, 'n', n)
                            else jsonb_build_object('tagline', tagline, 'n', null, 'small', true) end
                       order by n desc)
        from types), '[]'::jsonb),
    'plans', coalesce((
      select jsonb_agg(case when n >= v_k
                            then jsonb_build_object('plan', plan, 'n', n)
                            else jsonb_build_object('plan', plan, 'n', null, 'small', true) end
                       order by n desc)
        from plans), '[]'::jsonb),
    'beta_keys', (
      select jsonb_build_object(
               'keys', count(*),
               'seats_used', coalesce(sum(used_count), 0),
               'seats_total', coalesce(sum(max_uses), 0))
        from agxp_beta_keys),
    -- Bani: toate conturile, pe luna calendaristica (agxp_usage tine o luna pe rand).
    'cost', jsonb_build_object(
      'month_micro_usd',      (select coalesce(sum(cost_micro_usd), 0) from agxp_usage where period_start >= v_month),
      'last_month_micro_usd', (select coalesce(sum(cost_micro_usd), 0) from agxp_usage
                                where period_start >= (v_month - interval '1 month')::date and period_start < v_month),
      'free_pool_micro_usd',  month_spend_free_micro_usd(),
      'requests_month',       (select coalesce(sum(requests), 0) from agxp_usage where period_start >= v_month),
      'by_month', coalesce((
        select jsonb_agg(jsonb_build_object('month', m, 'micro_usd', c) order by m)
          from (select date_trunc('month', period_start)::date as m, sum(cost_micro_usd) as c
                  from agxp_usage
                 where period_start >= (v_month - interval '5 months')::date
                 group by 1) x), '[]'::jsonb)
    )
  ) into v_result;

  return v_result;
end $$;

revoke all on function metrics_overview(integer, boolean) from public, anon;
grant execute on function metrics_overview(integer, boolean) to authenticated;

-- Cine s-a uitat, ultimele 100. Emailul apare doar pentru cei cu drept; un cont
-- refuzat apare ca "alt cont" — un client care a nimerit adresa nu devine un
-- nume pe ecranul marketingului.
create or replace function metrics_access_log()
returns jsonb
language plpgsql
-- volatile, nu stable: scrie in jurnal.
security definer
set search_path = public, auth
as $$
declare
  v_refused text;
begin
  v_refused := metrics_gate('access_log');
  if v_refused is not null then
    return jsonb_build_object('refused', v_refused);
  end if;

  return jsonb_build_object('rows', coalesce((
    select jsonb_agg(jsonb_build_object(
             'at', l.at,
             'who', case when v.user_id is not null then u.email else null end,
             'what', l.what,
             'outcome', l.outcome) order by l.at desc)
      from (select * from agxp_metrics_access_log order by at desc limit 100) l
      left join agxp_metrics_viewers v on v.user_id = l.user_id
      left join auth.users u on u.id = l.user_id), '[]'::jsonb));
end $$;

revoke all on function metrics_access_log() from public, anon;
grant execute on function metrics_access_log() to authenticated;
