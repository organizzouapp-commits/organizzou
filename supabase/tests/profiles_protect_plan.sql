-- Behavior test for the trigger that protects profiles.plan and profiles.plan_until. Run it against a database that has the
-- admin migrations applied:  Dashboard > SQL Editor (paste and run), or  supabase db query --linked -f supabase/tests/profiles_protect_plan.sql
-- It changes nothing: everything runs in one transaction that is rolled back at the end, and it raises an exception naming the
-- failing check. When it ends with "profiles_protect_plan: all checks passed", every check passed.
--
-- 1. The service role (what the server-only admin action uses with the secret key) CAN change plan and plan_until.
-- 2. A regular signed-in user editing their own profile CANNOT change plan or plan_until (SQLSTATE 42501) ...
-- 3. ... but still CAN change the rest of their own profile (so the guard is not over-broad).
-- It needs at least one row in public.profiles.

begin;

do $$
declare
  me uuid;
  seen_plan text;
  blocked boolean;
begin
  select id into me from public.profiles limit 1;
  if me is null then
    raise exception 'profiles_protect_plan: needs one row in public.profiles to test with';
  end if;

  -- 1. service role -------------------------------------------------------------------------------------------------
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
  update public.profiles set plan = 'pro', plan_until = now() + interval '7 days' where id = me;
  select plan into seen_plan from public.profiles where id = me;
  if seen_plan is distinct from 'pro' then
    raise exception 'profiles_protect_plan: the service role could NOT change plan (read back: %)', seen_plan;
  end if;
  reset role;

  -- 2. regular user: plan and plan_until are refused --------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', me, 'app_metadata', json_build_object())::text, true);
  set local role authenticated;

  blocked := false;
  begin
    update public.profiles set plan = 'free' where id = me;
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then
    raise exception 'profiles_protect_plan: a regular user CHANGED their own plan';
  end if;

  blocked := false;
  begin
    update public.profiles set plan_until = null where id = me;
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then
    raise exception 'profiles_protect_plan: a regular user CHANGED their own plan_until';
  end if;

  -- 3. regular user: the rest of the profile is still theirs to edit --------------------------------------------------------
  update public.profiles set display_name = 'Teste do gatilho' where id = me;
  if not found then
    raise exception 'profiles_protect_plan: a regular user could not edit their own display_name (the guard is too broad)';
  end if;
  reset role;
end;
$$;

select 'profiles_protect_plan: all checks passed' as result;

rollback;
