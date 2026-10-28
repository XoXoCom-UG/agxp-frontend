-- AgxP — feedback: "problema grava" + panoul pentru echipa (2026-10-28)
--
-- Ana, 2026-10-28: un dashboard unde se vad toate feedback-urile, si o casuta
-- prin care omul spune ca e o problema grava — atunci pleaca un email catre
-- ana@ si tudor@xoxocom.net (app/api/feedback/alert/route.ts).
--
-- Safe to re-run, and safe whether 0025 was applied before or not (it has to be
-- applied first: this adds to its table).
--
--   serious      — omul a bifat "problema grava".
--   notified_at  — cand a plecat emailul. Il pune ruta de server, atomic, DOAR o
--                  data per rand; null la un rand grav = emailul n-a plecat,
--                  si panoul o arata.
--
-- Echipa citeste prin doua functii, nu prin politici de select: ca team_usage()
-- (0022), ele intreaba is_team_member despre APELANT. Ascunderea panoului e o
-- politete, refuzul de aici e securitatea. Lista NU poarta conversatiile (pana
-- la 100 KB pe rand): una se citeste la cerere, cu team_feedback_conversation().

alter table agxp_feedback add column if not exists serious boolean not null default false;
alter table agxp_feedback add column if not exists notified_at timestamptz;

create index if not exists agxp_feedback_serious_idx on agxp_feedback(created_at desc) where serious;

drop function if exists team_feedback();

create function team_feedback()
returns table (
  id                   uuid,
  created_at           timestamptz,
  email                text,
  message              text,
  serious              boolean,
  notified_at          timestamptz,
  include_conversation boolean,
  conversation_chars   integer,
  page                 text,
  project_id           uuid
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not coalesce(is_team_member(auth.uid()), false) then
    raise exception 'This account cannot see feedback.' using errcode = 'P0001';
  end if;

  return query
    select f.id, f.created_at, usr.email::text, f.message, f.serious, f.notified_at,
           f.include_conversation, coalesce(char_length(f.conversation), 0), f.page, f.project_id
      from agxp_feedback f
      left join auth.users usr on usr.id = f.user_id
     order by f.created_at desc
     limit 300;
end $$;

revoke all on function team_feedback() from public, anon;
grant execute on function team_feedback() to authenticated, service_role;

create or replace function team_feedback_conversation(p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_text text;
begin
  if not coalesce(is_team_member(auth.uid()), false) then
    raise exception 'This account cannot see feedback.' using errcode = 'P0001';
  end if;

  select f.conversation into v_text from agxp_feedback f where f.id = p_id;
  return v_text;
end $$;

revoke all on function team_feedback_conversation(uuid) from public, anon;
grant execute on function team_feedback_conversation(uuid) to authenticated, service_role;
