-- AgxP — doar conturile cu cheie pot crea ceva (2026-10-30)
--
-- Pana acum poarta de beta (components/layout/beta-gate.tsx) era doar in browser,
-- iar ruta de chat refuza modelul unui cont fara cheie. Dar agentii, proiectele si
-- mesajele se scriu direct din browser, sub RLS, si RLS intreaba doar "e al tau?",
-- nu "esti invitat?". Cine ocolea poarta (devtools, o cerere care pica si lasa
-- ecranul deschis, un apel direct la Supabase cu tokenul propriu) putea construi
-- agenti si proiecte; doar raspunsurile agentului nu veneau.
--
-- Acum baza de date refuza insert-ul pe agents, agxp_projects si
-- agxp_project_messages pentru un cont fara rand in agxp_entitlements — acelasi
-- rand pe care il scrie redeem_beta_key() (0009) si pe care il citesc
-- lib/entitlement.ts si lib/entitlement-server.ts. Un singur raspuns la
-- "e invitat?", in trei locuri.
--
-- Service role-ul (raspunsurile agentului, scrise de ruta de chat, 0019) si SQL
-- editorul nu au auth.uid(), deci trec: ei nu sunt un utilizator care se
-- inscrie singur.
--
-- CAND SE DESCHIDE INSCRIEREA (INVITE_ONLY = false in lib/plans.ts), un cont fara
-- rand inseamna planul free, nu "neinvitat" — atunci ruleaza:
--
--   drop trigger if exists agents_invited_only on agents;
--   drop trigger if exists agxp_projects_invited_only on agxp_projects;
--   drop trigger if exists agxp_project_messages_invited_only on agxp_project_messages;
--
-- Safe to re-run.

create or replace function agxp_require_invite() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if not exists (select 1 from agxp_entitlements where user_id = auth.uid()) then
    -- Acelasi text ca blocked() din lib/entitlement-server.ts.
    raise exception 'AgentiX is in closed beta. Enter the key you were given to get started.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists agents_invited_only on agents;
create trigger agents_invited_only
  before insert on agents
  for each row execute function agxp_require_invite();

drop trigger if exists agxp_projects_invited_only on agxp_projects;
create trigger agxp_projects_invited_only
  before insert on agxp_projects
  for each row execute function agxp_require_invite();

drop trigger if exists agxp_project_messages_invited_only on agxp_project_messages;
create trigger agxp_project_messages_invited_only
  before insert on agxp_project_messages
  for each row execute function agxp_require_invite();
