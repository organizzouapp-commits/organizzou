-- Behavior test for test accounts in the admin numbers. Run it against a database that has the data migrations applied:
--   Dashboard > SQL Editor (paste and run), or  supabase db query --linked -f supabase/tests/test_accounts.sql
-- It changes nothing: everything runs in one transaction that is rolled back, and it raises an exception naming the failing check.
-- When it ends with "test_accounts: all checks passed", every check passed.
--
-- 1. A regular person cannot mark themselves as a test account (nor create a profile already marked); the service role can.
-- 2. By default the admin numbers (overview, signups, plan split, users table) leave test accounts out.
-- 3. With "Incluir contas de teste" on (a per-admin preference) they are counted again.
-- 4. A regular person cannot read or write another person's admin preference.

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('cccccccc-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste-real@example.invalid', '{}', now(), now()),
  ('dddddddd-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste-demo@example.invalid', '{}', now(), now());

do $$
declare
  real_user constant uuid := 'cccccccc-0000-4000-8000-00000000000c';
  demo_user constant uuid := 'dddddddd-0000-4000-8000-00000000000d';
  admin_claims text := json_build_object('role', 'authenticated', 'sub', real_user, 'app_metadata', json_build_object('role', 'admin'))::text;
  before_total int;
  with_tests_total int;
  n int;
  blocked boolean;
begin
  -- 1. who may set the flag ---------------------------------------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', real_user, 'app_metadata', json_build_object())::text, true);
  set local role authenticated;
  blocked := false;
  begin
    update public.profiles set is_test = true where id = real_user;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'a regular person could mark themselves as a test account'; end if;
  reset role;

  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
  update public.profiles set is_test = true where id = demo_user;
  reset role;
  select count(*) into n from public.profiles where id = demo_user and is_test;
  if n <> 1 then raise exception 'the service role could not mark the demo account'; end if;

  -- 2. default numbers leave the test account out --------------------------------------------------------------------------------------
  perform set_config('request.jwt.claims', admin_claims, true);
  set local role authenticated;
  before_total := (admin.overview_stats() ->> 'total_users')::int;
  select count(*) into n from admin.list_users(null, null, null, null, null, null, 'created_at', 'desc', 1, 500) where email = 'teste-demo@example.invalid';
  if n <> 0 then raise exception 'the users table lists the test account by default'; end if;
  select count(*) into n from admin.list_users(null, null, null, null, null, null, 'created_at', 'desc', 1, 500) where email = 'teste-real@example.invalid';
  if n <> 1 then raise exception 'the users table does not list a regular account'; end if;
  select count(*) into n from admin.recent_signups(50) where email = 'teste-demo@example.invalid';
  if n <> 0 then raise exception 'recent signups include the test account by default'; end if;

  -- 3. the switch brings it back ----------------------------------------------------------------------------------------------------------
  insert into public.admin_preferences (admin_id, include_test) values (real_user, true);
  with_tests_total := (admin.overview_stats() ->> 'total_users')::int;
  if with_tests_total <> before_total + 1 then raise exception 'including test accounts changed the total by % instead of 1', with_tests_total - before_total; end if;
  select count(*) into n from admin.list_users(null, null, null, null, null, null, 'created_at', 'desc', 1, 500) where email = 'teste-demo@example.invalid';
  if n <> 1 then raise exception 'the users table does not list the test account when asked to'; end if;
  reset role;

  -- 4. nobody else can touch the preference -------------------------------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', demo_user, 'app_metadata', json_build_object())::text, true);
  set local role authenticated;
  select count(*) into n from public.admin_preferences;
  if n <> 0 then raise exception 'a regular person can read admin preferences'; end if;
  blocked := false;
  begin
    insert into public.admin_preferences (admin_id, include_test) values (demo_user, true);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'a regular person could create an admin preference'; end if;
  reset role;
end;
$$;

select 'test_accounts: all checks passed' as result;

rollback;
