-- AgxP — feedback: seriozitatea o judeca AI-ul (2026-10-28)
--
-- Ana, 2026-10-28: dashboardul cu feedback-uri se ordoneaza dupa seriozitate,
-- iar seriozitatea o decide AI-ul, nu testerul. Bifa "serious" a testerului
-- ramane doar declansatorul emailului (0026).
--
-- Safe to re-run; needs 0025 and 0026 applied first.
--
--   severity         — critical / high / medium / low, scris de app/api/feedback/triage
--                      (service role) dupa ce un model a citit MESAJUL testerului,
--                      nu conversatia.
--   severity_reason  — o propozitie scurta de la model, ca echipa sa vada de ce.
--   triaged_at       — cand a inceput/terminat evaluarea. Ruta il pune atomic,
--                      deci un feedback e evaluat o singura data; null = nu e
--                      evaluat (inca, sau a esuat) si panoul il arata ca atare.
--
-- Lista echipei vine deja ordonata: critical, high, medium, low. Un rand
-- neevaluat intra dupa bifa testerului (serios = high, altfel la coada), ca un
-- model care nu raspunde sa nu ingroape un feedback grav. Aceeasi regula de
-- acces ca in 0026: is_team_member() despre APELANT.

alter table agxp_feedback add column if not exists severity text
  check (severity in ('critical','high','medium','low'));
alter table agxp_feedback add column if not exists severity_reason text
  check (char_length(severity_reason) <= 300);
alter table agxp_feedback add column if not exists triaged_at timestamptz;

create index if not exists agxp_feedback_severity_idx on agxp_feedback(severity, created_at desc);

drop function if exists team_feedback();

create function team_feedback()
returns table (
  id                   uuid,
  created_at           timestamptz,
  email                text,
  message              text,
  serious              boolean,
  notified_at          timestamptz,
  severity             text,
  severity_reason      text,
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
           f.severity, f.severity_reason,
           f.include_conversation, coalesce(char_length(f.conversation), 0), f.page, f.project_id
      from agxp_feedback f
      left join auth.users usr on usr.id = f.user_id
     order by
       case
         when f.severity = 'critical' then 0
         when f.severity = 'high'     then 1
         when f.severity = 'medium'   then 2
         when f.severity = 'low'      then 3
         when f.serious               then 1   -- neevaluat, dar testerul l-a bifat
         else 4                                -- neevaluat
       end,
       f.created_at desc
     limit 300;
end $$;

revoke all on function team_feedback() from public, anon;
grant execute on function team_feedback() to authenticated, service_role;
