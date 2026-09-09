-- ============================================================================
-- FIX: "new row violates row-level security policy for table \"agents\""
--
-- Rulează TOT fișierul in Supabase SQL Editor, in proiectul rdlvnbvvxdwhydfugddw.
--
-- De ce exista separat de ensure_policies.sql: SQL Editor ruleaza tot scriptul
-- ca O SINGURA tranzactie. Daca o singura instructiune din scriptul mare da
-- eroare (o tabela care nu exista in DB-ul vechi), se face rollback la TOT si
-- politicile pentru `agents` nu se aplica niciodata — pare ca ai rulat, dar
-- nimic nu s-a schimbat. Fisierul asta atinge doar `agents` + `agent_methods`,
-- deci nu are de ce sa cada.
-- ============================================================================

-- 0. Coloana pe care se sprijina politica. `create table if not exists` din
--    migratia 0001 sare peste tabela daca ea exista deja in DB-ul vechi, deci
--    coloana poate lipsi.
alter table public.agents add column if not exists created_by uuid references auth.users(id);

-- 1. RLS pornit (fara el, politicile nu conteaza)
alter table public.agents enable row level security;
alter table public.agent_methods enable row level security;

-- 2. Politicile care lipsesc — INSERT e cea care blocheaza "Create Agent"
drop policy if exists "agents_select_authenticated" on public.agents;
create policy "agents_select_authenticated" on public.agents
  for select to authenticated using (true);

drop policy if exists "agents_insert_authenticated" on public.agents;
create policy "agents_insert_authenticated" on public.agents
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists "agent_methods_select_authenticated" on public.agent_methods;
create policy "agent_methods_select_authenticated" on public.agent_methods
  for select to authenticated using (true);

drop policy if exists "agent_methods_insert_authenticated" on public.agent_methods;
create policy "agent_methods_insert_authenticated" on public.agent_methods
  for insert to authenticated
  with check (exists (
    select 1 from public.agents a where a.id = agent_id and a.created_by = auth.uid()
  ));

-- 3. Plasa de siguranta: chiar daca appul ar uita created_by, DB-ul il completeaza
alter table public.agents alter column created_by set default auth.uid();

-- 4. Verificare — trebuie sa iasa 4 rânduri (agents INSERT/SELECT,
--    agent_methods INSERT/SELECT). Daca nu ies, trimite-mi ce iese.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('agents', 'agent_methods')
order by tablename, cmd, policyname;
