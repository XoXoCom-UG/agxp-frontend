-- AgxP — fisierele unui proiect sters pleaca prin Storage API, nu prin SQL (2026-11-03)
--
-- Din martie 2026 Supabase are pe storage.objects un trigger la nivel de
-- statement care refuza orice DELETE din SQL (42501, deci 403 prin PostgREST),
-- daca sesiunea nu are storage.allow_delete_query = true. Motivul lor: un rand
-- sters din SQL lasa fisierul fizic in S3, platit si fara stapan.
--
-- delete_project_files() din 0011 facea exact asta, intr-un trigger BEFORE
-- DELETE pe agxp_projects. Trigger-ul lor e la nivel de statement, deci pica si
-- cand proiectul nu are niciun fisier: de atunci NICIO stergere de proiect nu
-- mai trece. Concret, pe site-ul live:
--   * discard_empty_projects() da 403 la fiecare deschidere de History si de
--     proiect, deci proiectele goale raman, se numara in History si umfla
--     nivelul agentilor;
--   * stergerea contului (app/api/account/delete) se opreste la proiecte.
--
-- Ocolirea cu set_config('storage.allow_delete_query', ...) ar sterge doar
-- randul si ar lasa fisierul in S3, adica exact ce trigger-ul lor previne.
-- Asa ca trigger-ul nostru dispare, iar fisierele pleaca prin Storage API:
--   * stergerea contului le stergea deja asa, inainte de proiecte;
--   * cele doua functii de curatare intorc acum ce au sters, iar browserul
--     sterge dosarul <user>/<proiect>/ al fiecaruia (lib/projects.ts). Un
--     proiect gol poate avea un fisier: se urca la atasare, inainte de trimitere.
--
-- Safe to re-run.

drop trigger if exists agxp_projects_files_cleanup on agxp_projects;
drop function if exists delete_project_files();

-- Tipul intors se schimba (integer -> uuid[]), deci drop + create.
drop function if exists discard_empty_projects(uuid);

create function discard_empty_projects(keep uuid default null)
returns uuid[]
language plpgsql
security invoker
set search_path = public
as $$
declare
  removed uuid[];
begin
  with gone as (
    delete from agxp_projects p
     where p.owner_id = auth.uid()
       and (keep is null or p.id <> keep)
       and p.created_at < now() - interval '2 minutes'
       and not exists (select 1 from agxp_project_messages m where m.project_id = p.id)
    returning p.id
  )
  select coalesce(array_agg(id), '{}') into removed from gone;
  return removed;
end;
$$;

revoke all on function discard_empty_projects(uuid) from public;
grant execute on function discard_empty_projects(uuid) to authenticated;

-- discard_empty_project(target) ramane cum e (boolean): browserul stie deja ce
-- id a cerut, deci sterge dosarul cand raspunsul e true.
