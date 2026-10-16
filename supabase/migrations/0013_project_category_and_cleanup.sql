-- AgxP — categorie per proiect si curatarea proiectelor goale (2026-10-13)
--
-- Doua lucruri din sedinta cu Patryk din 9 oct.:
--
--  1. Istoricul proiectelor se sorteaza si se coloreaza dupa categorie. Pana
--     acum industria nu era stocata nicaieri: se citea din markerele
--     [[INDUSTRY:]] ale mesajelor, scanand pana la 4000 de mesaje la fiecare
--     deschidere a istoricului. Acum agentul o scrie pe rand, odata.
--
--  2. Un chat deschis fara niciun mesaj nu trebuie sa ramana. Randul se
--     creeaza cand alegi un agent (assignAgent are nevoie de un proiect), deci
--     un start abandonat lasa un proiect gol — si, cum trigger-ul din 0008
--     numara randurile, il lasa si scazut din limita saptamanala.

alter table agxp_projects add column if not exists category text;

-- Fara index: se filtreaza si se sorteaza pe lista proprie a utilizatorului,
-- care are zeci de randuri, nu milioane.

-- ── proiectele goale ────────────────────────────────────────────────────────
-- security INVOKER, deliberat: stergerea trece prin politica
-- agxp_projects_owner_delete (0003), deci apelantul nu poate atinge proiectele
-- altcuiva chiar daca ar da alt `keep`. Cascada spre mesaje si
-- delete_project_files() din 0011 curata restul.
--
-- Doua conditii pe langa "fara mesaje":
--   * `keep` — proiectul deschis acum pe ecran, care e gol exact cat timp
--     utilizatorul inca scrie primul mesaj;
--   * mai vechi de 2 minute — o a doua fila sau un alt dispozitiv care tocmai
--     a ales un agent nu trebuie sa-si piarda proiectul pe sub picioare.
create or replace function discard_empty_projects(keep uuid default null)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  removed integer;
begin
  with gone as (
    delete from agxp_projects p
     where p.owner_id = auth.uid()
       and (keep is null or p.id <> keep)
       and p.created_at < now() - interval '2 minutes'
       and not exists (select 1 from agxp_project_messages m where m.project_id = p.id)
    returning 1
  )
  select count(*) into removed from gone;
  return removed;
end;
$$;

revoke all on function discard_empty_projects(uuid) from public;
grant execute on function discard_empty_projects(uuid) to authenticated;

-- ── un singur proiect, la parasirea ecranului ───────────────────────────────
-- discard_empty_projects de mai sus asteapta 2 minute, deci un start parasit
-- imediat (alegi un agent, apesi "New task") ar ramane pana la urmatoarea
-- curatare. Ecranul de lucru il sterge pe al sau, la iesire, daca nu a primit
-- niciun mesaj. Tot security invoker: nu poate atinge proiectul altcuiva.
create or replace function discard_empty_project(target uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  removed integer;
begin
  with gone as (
    delete from agxp_projects p
     where p.id = target
       and p.owner_id = auth.uid()
       and not exists (select 1 from agxp_project_messages m where m.project_id = p.id)
    returning 1
  )
  select count(*) into removed from gone;
  return removed > 0;
end;
$$;

revoke all on function discard_empty_project(uuid) from public;
grant execute on function discard_empty_project(uuid) to authenticated;
