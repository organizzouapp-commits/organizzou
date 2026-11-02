-- Behavior test for per-user data. Run it against a database that has the data migrations applied:
--   Dashboard > SQL Editor (paste and run), or  supabase db query --linked -f supabase/tests/rls_and_provisioning.sql
-- It changes nothing: it creates two throw-away accounts inside one transaction that is rolled back at the end, and it raises an
-- exception naming the failing check. When it ends with "rls_and_provisioning: all checks passed", every check passed.
--
-- PROVISIONING (the sign-up trigger calls public.provision_user)
--  1. A new account gets exactly: 1 profile (São Paulo, pt-BR), 1 board "Minhas tarefas" with 3 lists, 11 finance categories,
--     1 account "Conta principal", 1 diet goal, 1 notification preferences row, 1 stats row; and no demo data anywhere.
--  2. Running the provisioning again (the backfill) changes nothing, and never touches a row the person already changed.
-- RLS (every table in `public` that has a user_id column)
--  3. Row level security is ON.
--  4. A DIFFERENT signed-in user can neither read, update nor delete the first user's rows, and cannot insert a row for them.

begin;

-- Two accounts. The sign-up trigger provisions them.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('aaaaaaaa-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste-a@example.invalid', '{"full_name": "Pessoa A"}', now(), now()),
  ('bbbbbbbb-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste-b@example.invalid', '{"full_name": "Pessoa B"}', now(), now());

do $$
declare
  a constant uuid := 'aaaaaaaa-0000-4000-8000-00000000000a';
  b constant uuid := 'bbbbbbbb-0000-4000-8000-00000000000b';
  n integer;
  t record;
  failures text[] := '{}';
  counts_before text;
  counts_after text;
begin
  -- 1. defaults, exactly once ---------------------------------------------------------------------------------------------
  select count(*) into n from public.profiles where id = a and timezone = 'America/Sao_Paulo' and locale = 'pt-BR' and display_name = 'Pessoa A';
  if n <> 1 then failures := failures || 'profile (name from the sign-in metadata, timezone, locale)'; end if;
  select count(*) into n from public.boards where user_id = a and name = 'Minhas tarefas';
  if n <> 1 then failures := failures || 'default board'; end if;
  select count(*) into n from public.board_lists where user_id = a;
  if n <> 3 then failures := failures || 'three default lists'; end if;
  select count(*) into n from public.finance_categories where user_id = a and icon <> '';
  if n <> 11 then failures := failures || 'eleven default categories with icons'; end if;
  select count(*) into n from public.finance_accounts where user_id = a and name = 'Conta principal' and opening_balance_cents = 0;
  if n <> 1 then failures := failures || 'Conta principal'; end if;
  select count(*) into n from public.diet_goals where user_id = a and water_ml > 0;
  if n <> 1 then failures := failures || 'diet goals with a water goal'; end if;
  select count(*) into n from public.notification_preferences where user_id = a;
  if n <> 1 then failures := failures || 'notification preferences'; end if;
  select count(*) into n from public.user_stats where user_id = a;
  if n <> 1 then failures := failures || 'stats row'; end if;
  -- no demo data: nothing in any content table
  select count(*) into n from public.tasks where user_id = a;
  if n <> 0 then failures := failures || 'tasks must start empty'; end if;
  select (select count(*) from public.habits where user_id = a) + (select count(*) from public.events where user_id = a)
       + (select count(*) from public.finance_transactions where user_id = a) + (select count(*) from public.notes where user_id = a)
       + (select count(*) from public.life_goals where user_id = a) + (select count(*) from public.journal_entries where user_id = a) into n;
  if n <> 0 then failures := failures || 'no demo data (habits, events, transactions, notes, goals, journal)'; end if;
  if cardinality(failures) > 0 then
    raise exception 'provisioning: %', array_to_string(failures, '; ');
  end if;

  -- 2. idempotent: twice more changes nothing, and an edited row stays as it is -------------------------------------------------
  update public.boards set name = 'Meu quadro' where user_id = a;
  update public.finance_accounts set name = 'Carteira' where user_id = a;
  counts_before := (select string_agg(c, ',') from (
    select (select count(*) from public.profiles where id = a)::text || (select count(*) from public.boards where user_id = a)::text
        || (select count(*) from public.board_lists where user_id = a)::text || (select count(*) from public.finance_categories where user_id = a)::text
        || (select count(*) from public.finance_accounts where user_id = a)::text || (select count(*) from public.diet_goals where user_id = a)::text as c) x);
  perform public.provision_user(a);
  perform public.provision_user(a);
  counts_after := (select string_agg(c, ',') from (
    select (select count(*) from public.profiles where id = a)::text || (select count(*) from public.boards where user_id = a)::text
        || (select count(*) from public.board_lists where user_id = a)::text || (select count(*) from public.finance_categories where user_id = a)::text
        || (select count(*) from public.finance_accounts where user_id = a)::text || (select count(*) from public.diet_goals where user_id = a)::text as c) x);
  if counts_before is distinct from counts_after then
    raise exception 'provisioning ran twice and changed the row counts: % -> %', counts_before, counts_after;
  end if;
  if (select name from public.boards where user_id = a) <> 'Meu quadro' or (select name from public.finance_accounts where user_id = a) <> 'Carteira' then
    raise exception 'provisioning overwrote a row the person had already changed';
  end if;

  -- 3. RLS is on for every table that has a user_id ---------------------------------------------------------------------------------
  for t in
    select c.relname, c.relrowsecurity
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relkind = 'r'
      and exists (select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.relname and k.column_name = 'user_id')
  loop
    if not t.relrowsecurity then failures := failures || ('RLS is OFF on ' || t.relname); end if;
  end loop;
  if cardinality(failures) > 0 then
    raise exception 'rls: %', array_to_string(failures, '; ');
  end if;

  -- 4. user B against user A's rows, on every table with a user_id -------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', b, 'app_metadata', json_build_object())::text, true);
  set local role authenticated;
  for t in
    select c.relname
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relkind = 'r'
      and exists (select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.relname and k.column_name = 'user_id')
    order by c.relname
  loop
    -- read / update (moving A's rows to B is the sneaky way) / delete: zero rows, or a plain "permission denied" (a table whose
    -- grants already forbid it, like the admin tables), is a pass.
    n := 0;
    begin
      execute format('select count(*) from public.%I where user_id = %L', t.relname, a) into n;
    exception when insufficient_privilege then n := 0;
    end;
    if n <> 0 then failures := failures || (t.relname || ': B can READ A''s rows'); end if;
    n := 0;
    begin
      execute format('with changed as (update public.%I set user_id = %L where user_id = %L returning 1) select count(*) from changed', t.relname, b, a) into n;
    exception when insufficient_privilege then n := 0;
    end;
    if n <> 0 then failures := failures || (t.relname || ': B can UPDATE A''s rows'); end if;
    n := 0;
    begin
      execute format('with gone as (delete from public.%I where user_id = %L returning 1) select count(*) from gone', t.relname, a) into n;
    exception when insufficient_privilege then n := 0;
    end;
    if n <> 0 then failures := failures || (t.relname || ': B can DELETE A''s rows'); end if;
    -- insert as A (the policy is checked before any other constraint, so the failure is "insufficient privilege")
    begin
      execute format('insert into public.%I (user_id) values (%L)', t.relname, a);
      failures := failures || (t.relname || ': B can INSERT rows for A');
    exception
      when insufficient_privilege then null;
      when others then failures := failures || (t.relname || ': B''s insert for A failed with ' || sqlstate || ' instead of an RLS refusal');
    end;
  end loop;
  reset role;
  if cardinality(failures) > 0 then
    raise exception 'rls: %', array_to_string(failures, E'\n  ');
  end if;
end;
$$;

select 'rls_and_provisioning: all checks passed' as result;

rollback;
