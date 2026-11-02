-- Behavior test for the admin area. Run it against a database that has the admin migrations applied:
--   Dashboard > SQL Editor (paste and run), or locally:  supabase db test
-- It changes nothing: everything runs in one transaction that is rolled back at the end, and it raises an exception (with the
-- failing function's name) if any check fails. When it finishes without an error, every check passed.
--
-- 1. A signed-in user WITHOUT app_metadata.role = 'admin' gets exactly 'forbidden' from every function in the admin schema.
-- 2. A user whose JWT says role = 'admin' is let through (the call may return data or an empty result, never 'forbidden').
-- 3. anon cannot even execute them.
-- 4. The admin-only tables cannot be read by a regular user, and can be read by an admin.

begin;

-- Pretend to be a regular signed-in user.
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-0000000000aa","app_metadata":{}}', true);
set local role authenticated;

do $$
declare
  failures text[] := '{}';
  call text;
  calls text[] := array[
    'select admin.overview_stats()',
    'select * from admin.signups_by_day(30)',
    'select * from admin.active_users_series(30)',
    'select * from admin.plan_distribution()',
    'select * from admin.active_courtesies()',
    'select * from admin.recent_signups(5)',
    'select * from admin.list_users(null, null, null, null, null, null, ''created_at'', ''desc'', 1, 20)',
    'select admin.user_detail(''00000000-0000-4000-8000-0000000000aa'')',
    'select * from admin.cohort_retention(12)',
    'select * from admin.activity_heatmap(30)',
    'select * from admin.waitlist_list(null, null, 1, 20)',
    'select * from admin.waitlist_summary()',
    'select * from admin.module_usage(12)',
    'select * from admin.module_adoption()',
    'select admin.assistant_usage(30)',
    'select admin.integration_numbers()',
    'select admin.last_migration()',
    'select admin.revoke_user_sessions(''00000000-0000-4000-8000-0000000000aa'')'
  ];
begin
  foreach call in array calls loop
    begin
      execute call;
      failures := failures || (call || '  -> returned instead of raising forbidden');
    exception when others then
      if sqlerrm <> 'forbidden' then
        failures := failures || (call || '  -> raised "' || sqlerrm || '" instead of forbidden');
      end if;
    end;
  end loop;

  -- The same count must exist in the schema, so a new function cannot be added without a test line above.
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'admin') <> array_length(calls, 1) then
    failures := failures || ('admin schema has ' || (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'admin') || ' functions but this test covers ' || array_length(calls, 1));
  end if;

  if public.is_admin() then failures := failures || 'is_admin() is true for a user without the role'; end if;

  if array_length(failures, 1) is not null then
    raise exception E'admin_forbidden.sql FAILED:\n%', array_to_string(failures, E'\n');
  end if;
end;
$$;

-- Regular users cannot read the admin-only tables (RLS returns no rows).
do $$
begin
  if exists (select 1 from public.admin_audit_log) then raise exception 'a regular user can read admin_audit_log'; end if;
  if exists (select 1 from public.plan_history) then raise exception 'a regular user can read plan_history'; end if;
end;
$$;

-- anon cannot execute any admin function.
reset role;
set local role anon;
do $$
declare
  fn record;
begin
  for fn in select p.oid::regprocedure as signature, p.oid as oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'admin' loop
    if has_function_privilege('anon', fn.oid, 'execute') then
      raise exception 'anon can execute %', fn.signature;
    end if;
  end loop;
end;
$$;

-- Now an admin: the same calls must NOT answer 'forbidden'.
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-0000000000bb","app_metadata":{"role":"admin"}}', true);
set local role authenticated;
do $$
declare
  failures text[] := '{}';
  call text;
  calls text[] := array[
    'select admin.overview_stats()',
    'select * from admin.signups_by_day(7)',
    'select * from admin.active_users_series(7)',
    'select * from admin.plan_distribution()',
    'select * from admin.list_users(null, null, null, null, null, null, ''created_at'', ''desc'', 1, 5)',
    'select * from admin.cohort_retention(4)',
    'select * from admin.waitlist_list(null, null, 1, 5)',
    'select admin.assistant_usage(7)'
  ];
begin
  if not public.is_admin() then raise exception 'is_admin() is false for a JWT with app_metadata.role = admin'; end if;
  foreach call in array calls loop
    begin
      execute call;
    exception when others then
      failures := failures || (call || '  -> ' || sqlerrm);
    end;
  end loop;
  perform 1 from public.admin_audit_log limit 1;  -- readable (may be empty)
  if array_length(failures, 1) is not null then
    raise exception E'admin_forbidden.sql (admin half) FAILED:\n%', array_to_string(failures, E'\n');
  end if;
end;
$$;

rollback;
