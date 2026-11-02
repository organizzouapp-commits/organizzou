-- New-user provisioning. One idempotent function builds everything a clean account needs; the sign-up trigger calls it, the
-- backfill script (scripts/backfill-users.ts) calls it for accounts that already exist, and provision_me() lets the app repair
-- an account that somehow has no profile. Running it twice changes nothing: every step only fills what is missing, never
-- updates or deletes an existing row.
-- No demo data: only sensible defaults (a board, categories, one account, goals, preferences).

create or replace function public.provision_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  u auth.users%rowtype;
  new_board uuid;
  new_phone text;
begin
  select * into u from auth.users where id = p_user;
  if not found then
    return;
  end if;

  new_phone := nullif(u.raw_user_meta_data ->> 'phone', '');

  -- Profile: name from Google (full_name / name) or the e-mail, São Paulo time zone, pt-BR, default Hoje layout.
  insert into public.profiles (id, display_name, phone, timezone, locale, dashboard_prefs)
  values (
    u.id,
    coalesce(
      nullif(u.raw_user_meta_data ->> 'display_name', ''),
      nullif(u.raw_user_meta_data ->> 'full_name', ''),
      nullif(u.raw_user_meta_data ->> 'name', ''),
      split_part(u.email, '@', 1)
    ),
    case when new_phone ~ '^\+[1-9][0-9]{7,14}$' then new_phone else null end,
    'America/Sao_Paulo',
    'pt-BR',
    '{"version": 2}'::jsonb
  )
  on conflict (id) do nothing;

  -- Tasks: one board with the three classic lists, only when the person has no board yet.
  if not exists (select 1 from public.boards where user_id = u.id) then
    insert into public.boards (user_id, name) values (u.id, 'Minhas tarefas') returning id into new_board;
    insert into public.board_lists (user_id, board_id, name, position, is_done_list)
    values
      (u.id, new_board, 'A fazer', 1000, false),
      (u.id, new_board, 'Em andamento', 2000, false),
      (u.id, new_board, 'Concluído', 3000, true);
  end if;

  -- Finanças: default categories (with icons, no limits) and one account at zero, only when there are none.
  if not exists (select 1 from public.finance_categories where user_id = u.id) then
    insert into public.finance_categories (user_id, name, icon)
    values
      (u.id, 'Moradia', 'house'),
      (u.id, 'Mercado', 'shopping-cart'),
      (u.id, 'Restaurantes', 'utensils'),
      (u.id, 'Transporte', 'bus'),
      (u.id, 'Saúde', 'heart-pulse'),
      (u.id, 'Lazer', 'popcorn'),
      (u.id, 'Assinaturas', 'repeat'),
      (u.id, 'Educação', 'graduation-cap'),
      (u.id, 'Salário', 'banknote'),
      (u.id, 'Renda extra', 'piggy-bank'),
      (u.id, 'Outros', 'tag');
  end if;
  if not exists (select 1 from public.finance_accounts where user_id = u.id) then
    insert into public.finance_accounts (user_id, name, institution, opening_balance_cents)
    values (u.id, 'Conta principal', '', 0);
  end if;

  -- Dieta (goals incl. the daily water goal), notificações, gamificação.
  insert into public.diet_goals (user_id) values (u.id) on conflict (user_id) do nothing;
  insert into public.notification_preferences (user_id) values (u.id) on conflict (user_id) do nothing;
  insert into public.user_stats (user_id) values (u.id) on conflict (user_id) do nothing;

  -- A profile that already existed without a Hoje layout gets the default one (an existing choice is never touched).
  update public.profiles set dashboard_prefs = '{"version": 2}'::jsonb where id = u.id and dashboard_prefs is null;
end;
$$;

revoke execute on function public.provision_user(uuid) from public, anon, authenticated;
grant execute on function public.provision_user(uuid) to service_role;

-- The app can repair the signed-in person's own account (never anyone else's).
create or replace function public.provision_me()
returns void
language sql
security definer
set search_path = ''
as $$
  select public.provision_user((select auth.uid()));
$$;
revoke execute on function public.provision_me() from public, anon;
grant execute on function public.provision_me() to authenticated;

-- The sign-up trigger now delegates to provision_user. It never blocks a sign-up: if provisioning fails the account is still
-- created and provision_me() / the backfill script finish the job.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.provision_user(new.id);
  exception when others then
    raise warning 'provision_user failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;
