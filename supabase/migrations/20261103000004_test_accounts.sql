-- Test accounts. The demo account (organizzouapp@gmail.com) is marked `profiles.is_test` and the admin numbers leave it out by default,
-- with a per-admin "Incluir contas de teste" switch. COUNTS only, as before: no function below reads any content.
--
-- Additive: one new column (not null WITH a default, so nothing is rewritten), one new table, one helper function and one trigger.
-- The admin functions are redefined with CREATE OR REPLACE with the SAME signatures and grants (the only change is a filter), so
-- nothing is dropped and the app's calls keep working.

alter table public.profiles add column if not exists is_test boolean not null default false;

-- Only the server (secret key / service role) can mark an account as a test account. A person cannot hide themselves from the
-- numbers by editing their own profile, nor create a profile that is already marked.
create or replace function public.profiles_protect_is_test()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.is_test := false;
    elsif new.is_test is distinct from old.is_test then
      raise exception 'is_test can only be changed by the service role' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_is_test on public.profiles;
create trigger profiles_protect_is_test before insert or update on public.profiles
  for each row execute function public.profiles_protect_is_test();

-- Each admin chooses for themselves whether the numbers include test accounts (default: no).
create table if not exists public.admin_preferences (
  admin_id uuid primary key references auth.users (id) on delete cascade,
  include_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_preferences enable row level security;
revoke all on public.admin_preferences from anon;
create policy "admin_preferences_select_own" on public.admin_preferences
  for select to authenticated using (admin_id = (select auth.uid()) and public.is_admin());
create policy "admin_preferences_insert_own" on public.admin_preferences
  for insert to authenticated with check (admin_id = (select auth.uid()) and public.is_admin());
create policy "admin_preferences_update_own" on public.admin_preferences
  for update to authenticated using (admin_id = (select auth.uid()) and public.is_admin()) with check (admin_id = (select auth.uid()) and public.is_admin());
create trigger admin_preferences_set_updated_at before update on public.admin_preferences
  for each row execute function public.set_updated_at();

-- "Does this person count in the admin numbers?": yes unless they are a test account and the calling admin did not ask for them.
-- Only the SECURITY DEFINER admin functions call it (they run as the owner), so nobody else needs execute.
create or replace function public.admin_counts_user(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not coalesce((select p.is_test from public.profiles p where p.id = uid), false)
      or coalesce((select a.include_test from public.admin_preferences a where a.admin_id = (select auth.uid())), false)
$$;
revoke all on function public.admin_counts_user(uuid) from public, anon, authenticated;

-- Everyone who was seen on a day (feeds active users, retention and the activity numbers).
create or replace view admin.activity_days as
  select d.user_id, d.day from (
    select h.user_id, (h.hour_start at time zone 'America/Sao_Paulo')::date as day
    from public.user_activity_hourly h
    group by h.user_id, (h.hour_start at time zone 'America/Sao_Paulo')::date
    union
    select u.id, (coalesce(p.last_seen_at, u.last_sign_in_at) at time zone 'America/Sao_Paulo')::date
    from auth.users u
    left join public.profiles p on p.id = u.id
    where coalesce(p.last_seen_at, u.last_sign_in_at) is not null
      and not exists (select 1 from public.user_activity_hourly h where h.user_id = u.id)
  ) d
  where public.admin_counts_user(d.user_id);

create or replace function admin.overview_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  result jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;

  select jsonb_build_object(
    'total_users', (select count(*) from auth.users u where public.admin_counts_user(u.id)),
    'total_users_prev', (select count(*) from auth.users u where u.created_at <= now() - interval '7 days' and public.admin_counts_user(u.id)),
    'active_today', (select count(distinct a.user_id) from admin.activity_days a where a.day = today),
    'active_yesterday', (select count(distinct a.user_id) from admin.activity_days a where a.day = today - 1),
    'active_7d', (select count(distinct a.user_id) from admin.activity_days a where a.day between today - 6 and today),
    'active_7d_prev', (select count(distinct a.user_id) from admin.activity_days a where a.day between today - 13 and today - 7),
    'new_7d', (select count(*) from auth.users u where u.created_at > now() - interval '7 days' and public.admin_counts_user(u.id)),
    'new_7d_prev', (select count(*) from auth.users u where u.created_at > now() - interval '14 days' and u.created_at <= now() - interval '7 days' and public.admin_counts_user(u.id)),
    'pro_users', (select count(*) from public.profiles p where p.plan = 'pro' and (p.plan_until is null or p.plan_until > now()) and public.admin_counts_user(p.id)),
    -- No plan history older than the plan_history table: there is no honest "Pro a week ago".
    'pro_users_prev', null,
    'waitlist', (select count(*) from public.waitlist),
    'waitlist_prev', (select count(*) from public.waitlist where created_at <= now() - interval '7 days'),
    'tracking_since', (select min(hour_start) from public.user_activity_hourly)
  ) into result;
  return result;
end;
$$;

create or replace function admin.signups_by_day(range_days integer)
returns table (day date, signups bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n integer := greatest(least(coalesce(range_days, 30), 400), 1);
  today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select d.day, count(u.id)
    from (select g::date as day from generate_series(today - (n - 1), today, interval '1 day') g) d
    left join auth.users u on (u.created_at at time zone 'America/Sao_Paulo')::date = d.day and public.admin_counts_user(u.id)
    group by d.day
    order by d.day;
end;
$$;

create or replace function admin.plan_distribution()
returns table (plan text, courtesy boolean, users bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select x.plan, x.courtesy, count(*)
    from (
      select
        case when p.plan = 'pro' and (p.plan_until is null or p.plan_until > now()) then 'pro' else 'free' end as plan,
        (p.plan = 'pro' and p.plan_until is not null and p.plan_until > now()) as courtesy
      from auth.users u
      left join public.profiles p on p.id = u.id
      where public.admin_counts_user(u.id)
    ) x
    group by x.plan, x.courtesy
    order by x.plan, x.courtesy;
end;
$$;

create or replace function admin.active_courtesies()
returns table (user_id uuid, email text, until timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select p.id, u.email::text, p.plan_until
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.plan = 'pro' and p.plan_until is not null and p.plan_until > now() and public.admin_counts_user(p.id)
    order by p.plan_until;
end;
$$;

create or replace function admin.recent_signups(lim integer)
returns table (id uuid, name text, email text, created_at timestamptz, plan text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select u.id, p.display_name, u.email::text, u.created_at,
      case when p.plan = 'pro' and (p.plan_until is null or p.plan_until > now()) then 'pro' else 'free' end
    from auth.users u
    left join public.profiles p on p.id = u.id
    where public.admin_counts_user(u.id)
    order by u.created_at desc
    limit greatest(least(coalesce(lim, 5), 50), 1);
end;
$$;

create or replace function admin.list_users(
  p_search text,
  p_plan text,
  p_status text,
  p_activity text,
  p_from date,
  p_to date,
  p_sort text,
  p_dir text,
  p_page integer,
  p_size integer
)
returns table (
  id uuid,
  name text,
  email text,
  plan text,
  plan_until timestamptz,
  created_at timestamptz,
  last_seen timestamptz,
  provider text,
  whatsapp_linked boolean,
  status text,
  total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  size integer := greatest(least(coalesce(p_size, 20), 200), 1);
  skip integer := (greatest(coalesce(p_page, 1), 1) - 1) * greatest(least(coalesce(p_size, 20), 200), 1);
  needle text := nullif(btrim(coalesce(p_search, '')), '');
  descending boolean := lower(coalesce(p_dir, 'desc')) <> 'asc';
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if needle is not null then
    needle := '%' || replace(replace(replace(needle, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
    with base as (
      select
        u.id,
        p.display_name::text as name,
        u.email::text as email,
        case when p.plan = 'pro' and (p.plan_until is null or p.plan_until > now()) then 'pro' else 'free' end as plan,
        p.plan_until,
        u.created_at,
        coalesce(p.last_seen_at, u.last_sign_in_at) as last_seen,
        coalesce((select string_agg(distinct i.provider, ', ' order by i.provider) from auth.identities i where i.user_id = u.id), 'email') as provider,
        -- WhatsApp linking is not built yet (docs/INTEGRATIONS-STATUS.md): there is nothing to link. Wire this to the link table when it exists.
        false as whatsapp_linked,
        case
          when u.banned_until is not null and u.banned_until > now() then 'suspended'
          when u.email_confirmed_at is null then 'pending'
          else 'active'
        end as status
      from auth.users u
      left join public.profiles p on p.id = u.id
      where public.admin_counts_user(u.id)
    ),
    filtered as (
      select b.* from base b
      where (needle is null or b.email ilike needle or coalesce(b.name, '') ilike needle)
        and (p_plan is null or b.plan = p_plan)
        and (p_status is null or b.status = p_status)
        and (p_activity is null
             or (p_activity = 'active' and b.last_seen >= now() - interval '7 days')
             or (p_activity = 'inactive' and (b.last_seen is null or b.last_seen < now() - interval '7 days')))
        and (p_from is null or (b.created_at at time zone 'America/Sao_Paulo')::date >= p_from)
        and (p_to is null or (b.created_at at time zone 'America/Sao_Paulo')::date <= p_to)
    )
    select f.id, f.name, f.email, f.plan, f.plan_until, f.created_at, f.last_seen, f.provider, f.whatsapp_linked, f.status,
           count(*) over () as total
    from filtered f
    order by
      case when p_sort = 'name' and not descending then lower(coalesce(f.name, f.email)) end asc,
      case when p_sort = 'name' and descending then lower(coalesce(f.name, f.email)) end desc,
      case when p_sort = 'email' and not descending then lower(f.email) end asc,
      case when p_sort = 'email' and descending then lower(f.email) end desc,
      case when p_sort = 'plan' and not descending then f.plan end asc,
      case when p_sort = 'plan' and descending then f.plan end desc,
      case when p_sort = 'last_seen' and not descending then f.last_seen end asc nulls last,
      case when p_sort = 'last_seen' and descending then f.last_seen end desc nulls last,
      case when coalesce(p_sort, 'created_at') = 'created_at' and not descending then f.created_at end asc,
      case when coalesce(p_sort, 'created_at') = 'created_at' and descending then f.created_at end desc,
      f.id
    limit size offset skip;
end;
$$;

create or replace function admin.cohort_retention(cohorts integer)
returns table (cohort_week date, cohort_size bigint, week_offset integer, active_users bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n integer := greatest(least(coalesce(cohorts, 12), 52), 1);
  this_week date := date_trunc('week', (now() at time zone 'America/Sao_Paulo'))::date;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    with members as (
      select u.id, date_trunc('week', (u.created_at at time zone 'America/Sao_Paulo'))::date as cw
      from auth.users u
      where public.admin_counts_user(u.id) and date_trunc('week', (u.created_at at time zone 'America/Sao_Paulo'))::date >= this_week - (n - 1) * 7
    ),
    sizes as (select m.cw, count(*) as n from members m group by m.cw),
    active_weeks as (
      select distinct a.user_id, date_trunc('week', a.day::timestamp)::date as aw from admin.activity_days a
    )
    select s.cw, s.n, w.w, count(aw.user_id)
    from sizes s
    cross join generate_series(0, 8) as w(w)
    left join members m on m.cw = s.cw
    left join active_weeks aw on aw.user_id = m.id and aw.aw = s.cw + w.w * 7
    where s.cw + w.w * 7 <= this_week
    group by s.cw, s.n, w.w
    order by s.cw, w.w;
end;
$$;

create or replace function admin.activity_heatmap(range_days integer)
returns table (dow integer, hour integer, users bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select extract(dow from h.hour_start at time zone 'America/Sao_Paulo')::integer,
           extract(hour from h.hour_start at time zone 'America/Sao_Paulo')::integer,
           count(distinct h.user_id)
    from public.user_activity_hourly h
    where public.admin_counts_user(h.user_id) and h.hour_start >= now() - make_interval(days => greatest(least(coalesce(range_days, 30), 365), 1))
    group by 1, 2
    order by 1, 2;
end;
$$;

create or replace function admin.module_usage(weeks integer)
returns table (feature text, week date, records bigint, users bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n integer := greatest(least(coalesce(weeks, 12), 52), 1);
  since date := date_trunc('week', (now() at time zone 'America/Sao_Paulo'))::date - (greatest(least(coalesce(weeks, 12), 52), 1) - 1) * 7;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select x.feature, x.week, count(*), count(distinct x.user_id)
    from (
      select 'tarefas'::text as feature, date_trunc('week', (t.created_at at time zone 'America/Sao_Paulo'))::date as week, t.user_id from public.tasks t
      union all
      select 'quadros', date_trunc('week', (b.created_at at time zone 'America/Sao_Paulo'))::date, b.user_id from public.boards b
      union all
      select 'etiquetas', date_trunc('week', (g.created_at at time zone 'America/Sao_Paulo'))::date, g.user_id from public.tags g
      union all
      select 'anexos', date_trunc('week', (a.created_at at time zone 'America/Sao_Paulo'))::date, a.user_id from public.attachments a
    ) x
    where x.week >= since and public.admin_counts_user(x.user_id)
    group by x.feature, x.week
    order by x.feature, x.week;
end;
$$;

create or replace function admin.integration_numbers()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'total_users', (select count(*) from auth.users u where public.admin_counts_user(u.id)),
    'google_users', (select count(distinct i.user_id) from auth.identities i where i.provider = 'google' and public.admin_counts_user(i.user_id)),
    'email_users', (select count(distinct i.user_id) from auth.identities i where i.provider = 'email' and public.admin_counts_user(i.user_id)),
    -- Phone numbers typed at sign-up. They are NOT linked WhatsApp numbers: linking is not built yet.
    'phones_informed', (select count(*) from public.profiles p where p.phone is not null and public.admin_counts_user(p.id)),
    'waitlist', (select count(*) from public.waitlist)
  );
end;
$$;
