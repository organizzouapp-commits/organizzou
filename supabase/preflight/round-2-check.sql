-- READ-ONLY PREFLIGHT for the 10 prepared migrations of round 2. Only SELECT statements: it changes nothing.
-- Paste the whole file into the Supabase SQL editor and run it once. It returns ONE table: section | item | result | note.
-- How to read it: see supabase/preflight/README-pt.md.

with
-- ------------------------------------------------------------------ who am I, who owns what
roles as (
  select
    current_user::text as me,
    (select r.rolname::text from pg_class c join pg_roles r on r.oid = c.relowner where c.oid = 'storage.objects'::regclass) as storage_objects_owner,
    (select r.rolname::text from pg_class c join pg_roles r on r.oid = c.relowner where c.oid = 'auth.sessions'::regclass) as auth_sessions_owner
),
-- ------------------------------------------------------------------ the objects of the 10 migrations
tables_wanted(migration, name) as (values
  ('#2 support_reports', 'support_reports'),
  ('#5 push_notifications', 'push_subscriptions'),
  ('#5 push_notifications', 'notification_preferences'),
  ('#5 push_notifications', 'notification_log'),
  ('#6 two_factor', 'two_factor_codes'),
  ('#7 passkeys', 'passkey_credentials'),
  ('#7 passkeys', 'webauthn_challenges'),
  ('#8 user_sessions', 'user_sessions'),
  ('#9 user_meals', 'user_meals')
),
columns_wanted(migration, tbl, col) as (values
  ('#1 avatars', 'profiles', 'avatar_path'),
  ('#3 installment_bills', 'finance_bills', 'installment_total'),
  ('#3 installment_bills', 'finance_bills', 'installment_first_month'),
  ('#3 installment_bills', 'finance_bills', 'installment_first_day'),
  ('#3 installment_bills', 'finance_bills', 'installment_paid'),
  ('#3 installment_bills', 'finance_bills', 'installment_skipped'),
  ('#3 installment_bills', 'finance_bills', 'installment_amounts'),
  ('#3 installment_bills', 'finance_bills', 'series_id'),
  ('#4 goal_start_and_opening', 'finance_goals', 'start_date'),
  ('#4 goal_start_and_opening', 'finance_goals', 'opening_cents'),
  ('#5 push_notifications', 'push_subscriptions', 'device_label'),
  ('#5 push_notifications', 'notification_preferences', 'settings'),
  ('#6 two_factor', 'profiles', 'two_factor_enabled'),
  ('#9 user_meals', 'meal_items', 'meal_key'),
  ('#10 goal_links', 'life_goals', 'kind'),
  ('#10 goal_links', 'life_goals', 'link_type'),
  ('#10 goal_links', 'life_goals', 'link_id'),
  ('#10 goal_links', 'life_goals', 'params'),
  ('#10 goal_links', 'life_goals', 'start_date'),
  ('#10 goal_links', 'life_goals', 'end_date')
),
policies_wanted(migration, sch, tbl, pol, note) as (values
  ('#1 avatars', 'storage', 'objects', 'avatars_select_own', ''),
  ('#1 avatars', 'storage', 'objects', 'avatars_insert_own', ''),
  ('#1 avatars', 'storage', 'objects', 'avatars_update_own', ''),
  ('#1 avatars', 'storage', 'objects', 'avatars_delete_own', ''),
  ('#2 support_reports', 'public', 'support_reports', 'support_reports_insert_own', ''),
  ('#2 support_reports', 'public', 'support_reports', 'support_reports_select_own', ''),
  ('#7 passkeys', 'public', 'passkey_credentials', 'passkey_credentials_select_own', ''),
  ('#7 passkeys', 'public', 'passkey_credentials', 'passkey_credentials_rename_own', 'policy nova'),
  ('#7 passkeys', 'public', 'passkey_credentials', 'passkey_credentials_update_own', 'policy ANTIGA, substituída pela rename_own'),
  ('#7 passkeys', 'public', 'passkey_credentials', 'passkey_credentials_delete_own', ''),
  ('#8 user_sessions', 'public', 'user_sessions', 'user_sessions_select_own', ''),
  ('#9 user_meals', 'public', 'user_meals', 'user_meals_select_own', ''),
  ('#9 user_meals', 'public', 'user_meals', 'user_meals_insert_own', ''),
  ('#9 user_meals', 'public', 'user_meals', 'user_meals_update_own', ''),
  ('#9 user_meals', 'public', 'user_meals', 'user_meals_delete_own', '')
),
functions_wanted(migration, fn) as (values
  ('#8 user_sessions', 'register_session'),
  ('#8 user_sessions', 'revoke_session'),
  ('#8 user_sessions', 'revoke_other_sessions')
),
-- ------------------------------------------------------------------ legacy goals that would break the dates check (migration #4)
bad_goals as (
  select id::text as id from public.finance_goals
   where deadline is not null and deadline <= (created_at at time zone 'America/Sao_Paulo')::date
)

-- ================================================================== the report
select 'A. quem sou eu' as section, 'current_user' as item, (select me from roles) as result, '' as note
union all
select 'A. quem sou eu', 'dono de storage.objects', (select storage_objects_owner from roles),
  case when pg_has_role(current_user, (select storage_objects_owner from roles), 'member')
       then 'OK: este papel pode criar policies em storage.objects (migração #1)'
       else 'ATENÇÃO: este papel não é o dono nem membro dele; a migração #1 pode falhar com "must be owner of table objects"' end
union all
select 'A. quem sou eu', 'dono de auth.sessions', (select auth_sessions_owner from roles), ''
union all
select 'B. permissão (migração #8)', 'este papel pode DELETE em auth.sessions', has_table_privilege(current_user, 'auth.sessions', 'DELETE')::text,
  case when has_table_privilege(current_user, 'auth.sessions', 'DELETE')
       then 'OK'
       else 'FALTA: as funções revoke_* (SECURITY DEFINER) rodam como o dono da função e falhariam com sessions_delete_not_permitted' end
union all
select 'B. permissão (migração #8)', 'papel postgres pode DELETE em auth.sessions',
  coalesce((select has_table_privilege('postgres', 'auth.sessions', 'DELETE')::text from pg_roles where rolname = 'postgres'), 'papel postgres não existe'),
  'normalmente é este papel que aplica o db push e passa a ser dono das funções'
union all
select 'C. tabelas base (migração #5)', 'push_subscriptions existe', (to_regclass('public.push_subscriptions') is not null)::text, 'a migração #5 cria a tabela se não existir'
union all
select 'C. tabelas base (migração #5)', 'notification_preferences existe', (to_regclass('public.notification_preferences') is not null)::text, 'a migração #5 cria a tabela se não existir'
union all
select 'D. metas de Finanças (migração #4)', 'metas com prazo <= dia de criação (qtd)', (select count(*) from bad_goals)::text,
  'o backfill da migração #4 corrige estas linhas (início = véspera do prazo); ids na linha abaixo'
union all
select 'D. metas de Finanças (migração #4)', 'ids dessas metas', coalesce((select string_agg(id, ', ') from bad_goals), '(nenhuma)'), ''
union all
select 'E. o que já existe (' || t.migration || ')', 'tabela public.' || t.name, (to_regclass('public.' || t.name) is not null)::text, ''
  from tables_wanted t
union all
select 'E. o que já existe (' || c.migration || ')', 'coluna ' || c.tbl || '.' || c.col,
  exists (select 1 from information_schema.columns i where i.table_schema = 'public' and i.table_name = c.tbl and i.column_name = c.col)::text,
  case when to_regclass('public.' || c.tbl) is null then 'a tabela ' || c.tbl || ' nem existe' else '' end
  from columns_wanted c
union all
select 'E. o que já existe (' || p.migration || ')', 'policy ' || p.pol || ' em ' || p.sch || '.' || p.tbl,
  exists (select 1 from pg_policies x where x.schemaname = p.sch and x.tablename = p.tbl and x.policyname = p.pol)::text, p.note
  from policies_wanted p
union all
select 'E. o que já existe (' || f.migration || ')', 'função public.' || f.fn,
  exists (select 1 from pg_proc pr join pg_namespace ns on ns.oid = pr.pronamespace where ns.nspname = 'public' and pr.proname = f.fn)::text, ''
  from functions_wanted f
union all
select 'E. o que já existe (#1 avatars)', 'bucket avatars', exists (select 1 from storage.buckets where id = 'avatars')::text, ''
union all
select 'E. o que já existe (#4 goal_start_and_opening)', 'constraint finance_goals_dates_check',
  coalesce((select case when convalidated then 'true (validada)' else 'true (NOT VALID)' end from pg_constraint where conname = 'finance_goals_dates_check' and conrelid = 'public.finance_goals'::regclass), 'false'), ''
union all
select 'E. o que já existe (#10 goal_links)', 'constraint life_goals_kind_check',
  exists (select 1 from pg_constraint where conname = 'life_goals_kind_check' and conrelid = 'public.life_goals'::regclass)::text, ''
union all
select 'E. o que já existe (#7 passkeys)', 'colunas com UPDATE para o papel authenticated em passkey_credentials',
  coalesce((select string_agg(column_name, ', ') from information_schema.column_privileges where table_schema = 'public' and table_name = 'passkey_credentials' and grantee = 'authenticated' and privilege_type = 'UPDATE'), '(nenhuma ou tabela inexistente)'),
  'depois da migração #7 deve ser só: device_label'
order by 1, 2;
