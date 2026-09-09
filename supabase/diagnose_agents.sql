-- ============================================================================
-- DIAGNOSTIC — citeste doar cataloagele, nu schimba nimic, nu poate cadea.
--
-- Rulează-l in SQL Editor si trimite-mi rezultatul (o singura celula "report").
-- Cu el vad sigur de ce "Create Agent" da eroare de RLS:
--   * tables         → exista tabelele si e RLS pornit?
--   * agents_columns → exista coloana created_by, ce default are?
--   * policies       → ce politici exista; "permissive: RESTRICTIVE" ar bloca
--                      inserarea chiar daca politica mea permisiva exista
--   * roles          → politica trebuie sa fie pe {authenticated}
--
-- Nota: "me" iese null aici — e normal, SQL Editor ruleaza fara JWT de user.
-- ============================================================================

select jsonb_pretty(jsonb_build_object(
  'tables', (
    select jsonb_agg(jsonb_build_object('table', c.relname, 'rls_enabled', c.relrowsecurity))
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('agents', 'agent_methods')
  ),
  'agents_columns', (
    select jsonb_agg(jsonb_build_object(
             'col', column_name, 'type', data_type,
             'nullable', is_nullable, 'default', column_default)
             order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public' and table_name = 'agents'
  ),
  'policies', (
    select jsonb_agg(jsonb_build_object(
             'table', tablename, 'name', policyname, 'permissive', permissive,
             'roles', roles, 'cmd', cmd, 'using', qual, 'with_check', with_check))
    from pg_policies
    where schemaname = 'public' and tablename in ('agents', 'agent_methods')
  ),
  'me', auth.uid()
)) as report;
