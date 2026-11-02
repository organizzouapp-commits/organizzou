-- Admin area, part 3: read functions in the `admin` schema.
--
-- RULES (enforced by supabase/tests/admin-privacy.test.ts):
--   1. Every function is SECURITY DEFINER, has `set search_path = ''` and its FIRST statement is
--        if not public.is_admin() then raise exception 'forbidden'; end if;
--   2. Execute is revoked from public/anon and granted to authenticated only (the loop at the end does it for every function).
--   3. PRIVACY (LGPD): account data and aggregates only. Nothing here reads task, note, finance, diet, journal or study CONTENT
--      (titles, descriptions, bodies, comments, checklist text), nothing reads public.audit_log.payload, and nothing touches the
--      `vault` schema, not even per-user counts. Module usage is `count(*)` per user/week and nothing else.
--
-- Time zone for every "day": America/Sao_Paulo.

-- ---------------------------------------------------------------------------------------------------------------------
-- One row per person per active day. Internal: nobody but the SECURITY DEFINER functions below can read it.
-- Source of truth is user_activity_hourly; people with no touch yet fall back to profiles.last_seen_at / auth.users.last_sign_in_at.
create or replace view admin.activity_days as
  select h.user_id, (h.hour_start at time zone 'America/Sao_Paulo')::date as day
  from public.user_activity_hourly h
  group by h.user_id, (h.hour_start at time zone 'America/Sao_Paulo')::date
  union
  select u.id, (coalesce(p.last_seen_at, u.last_sign_in_at) at time zone 'America/Sao_Paulo')::date
  from auth.users u
  left join public.profiles p on p.id = u.id
  where coalesce(p.last_seen_at, u.last_sign_in_at) is not null
    and not exists (select 1 from public.user_activity_hourly h where h.user_id = u.id);

revoke all on admin.activity_days from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- Overview: numbers plus the comparison base for the "+/-" variation. NULL = no honest base to compare with.
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
    'total_users', (select count(*) from auth.users),
    'total_users_prev', (select count(*) from auth.users where created_at <= now() - interval '7 days'),
    'active_today', (select count(distinct a.user_id) from admin.activity_days a where a.day = today),
    'active_yesterday', (select count(distinct a.user_id) from admin.activity_days a where a.day = today - 1),
    'active_7d', (select count(distinct a.user_id) from admin.activity_days a where a.day between today - 6 and today),
    'active_7d_prev', (select count(distinct a.user_id) from admin.activity_days a where a.day between today - 13 and today - 7),
    'new_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'new_7d_prev', (select count(*) from auth.users where created_at > now() - interval '14 days' and created_at <= now() - interval '7 days'),
    'pro_users', (select count(*) from public.profiles where plan = 'pro' and (plan_until is null or plan_until > now())),
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
    left join auth.users u on (u.created_at at time zone 'America/Sao_Paulo')::date = d.day
    group by d.day
    order by d.day;
end;
$$;

create or replace function admin.active_users_series(range_days integer)
returns table (day date, dau bigint, wau bigint, mau bigint)
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
    select d.day,
      (select count(distinct a.user_id) from admin.activity_days a where a.day = d.day),
      (select count(distinct a.user_id) from admin.activity_days a where a.day between d.day - 6 and d.day),
      (select count(distinct a.user_id) from admin.activity_days a where a.day between d.day - 29 and d.day)
    from (select g::date as day from generate_series(today - (n - 1), today, interval '1 day') g) d
    order by d.day;
end;
$$;

-- Effective plan: Pro only while it has no end date or the end date is in the future.
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
    where p.plan = 'pro' and p.plan_until is not null and p.plan_until > now()
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
    order by u.created_at desc
    limit greatest(least(coalesce(lim, 5), 50), 1);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Users table: filters, sort and pagination all happen here (server-side). `total` repeats on every row (the full match count).
--   p_plan     null | 'free' | 'pro'            (effective plan)
--   p_status   null | 'active' | 'suspended' | 'pending'
--   p_activity null | 'active' (seen in the last 7 days) | 'inactive'
--   p_sort     'name' | 'email' | 'plan' | 'created_at' | 'last_seen'   p_dir 'asc' | 'desc'
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

-- Detail panel: account info and COUNTS of records per module. Never the records themselves. NULL when the user does not exist.
create or replace function admin.user_detail(target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;

  select jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'name', p.display_name,
    'created_at', u.created_at,
    'email_confirmed_at', u.email_confirmed_at,
    'last_sign_in_at', u.last_sign_in_at,
    'last_seen', coalesce(p.last_seen_at, u.last_sign_in_at),
    'banned_until', u.banned_until,
    'providers', coalesce((select jsonb_agg(distinct i.provider) from auth.identities i where i.user_id = u.id), '["email"]'::jsonb),
    'plan', case when p.plan = 'pro' and (p.plan_until is null or p.plan_until > now()) then 'pro' else 'free' end,
    'plan_until', p.plan_until,
    'has_phone', (p.phone is not null),
    'timezone', p.timezone,
    'locale', p.locale,
    'theme', p.theme,
    'sessions', (select count(*) from auth.sessions s where s.user_id = u.id),
    -- COUNTS only. Modules that only exist as simulated data in the app have no table, so they have no count.
    'counts', jsonb_build_object(
      'boards', (select count(*) from public.boards t where t.user_id = u.id),
      'tasks', (select count(*) from public.tasks t where t.user_id = u.id),
      'tags', (select count(*) from public.tags t where t.user_id = u.id),
      'attachments', (select count(*) from public.attachments t where t.user_id = u.id)
    )
  ) into result
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = target;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Activity: cohort retention (signup week x weeks since signup) and the peak-hours heatmap.
-- week_offset counts weeks since the signup week (0 = the signup week). Only weeks that already happened are returned, and the
-- caller must treat weeks before tracking_since as "no data" (activity history starts when user_activity_hourly was created).
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
      where date_trunc('week', (u.created_at at time zone 'America/Sao_Paulo'))::date >= this_week - (n - 1) * 7
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

-- Distinct people seen in each weekday x hour (America/Sao_Paulo) over the last `range_days` days. dow: 0 = Sunday.
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
    where h.hour_start >= now() - make_interval(days => greatest(least(coalesce(range_days, 30), 365), 1))
    group by 1, 2
    order by 1, 2;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Waiting list (the existing public.waitlist table). `total` repeats on every row.
create or replace function admin.waitlist_list(p_search text, p_source text, p_page integer, p_size integer)
returns table (id uuid, name text, email text, phone text, source text, created_at timestamptz, total bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  size integer := greatest(least(coalesce(p_size, 20), 500), 1);
  skip integer := (greatest(coalesce(p_page, 1), 1) - 1) * greatest(least(coalesce(p_size, 20), 500), 1);
  needle text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if needle is not null then
    needle := '%' || replace(replace(replace(needle, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;
  return query
    select w.id, w.name, w.email, w.phone, w.source, w.created_at, count(*) over ()
    from public.waitlist w
    where (needle is null or w.email ilike needle or w.name ilike needle)
      and (p_source is null or w.source = p_source)
    order by w.created_at desc
    limit size offset skip;
end;
$$;

create or replace function admin.waitlist_summary()
returns table (source text, total bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select w.source, count(*) from public.waitlist w group by w.source order by count(*) desc;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Module usage: COUNTS of rows created per week, and how many people use each feature. Only modules that have real tables exist
-- here; the others are simulated in the app and have nothing to count. No title, description or any other content column is read.
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
    where x.week >= since
    group by x.feature, x.week
    order by x.feature, x.week;
end;
$$;

-- Share of people active in the last 30 days that have at least one record in each feature.
create or replace function admin.module_adoption()
returns table (feature text, users bigint, active_users bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    with active as (select distinct a.user_id from admin.activity_days a where a.day between today - 29 and today)
    select f.feature, count(distinct f.user_id), (select count(*) from active)
    from (
      select 'tarefas'::text as feature, t.user_id from public.tasks t where t.user_id in (select user_id from active)
      union all
      select 'quadros', b.user_id from public.boards b where b.user_id in (select user_id from active)
      union all
      select 'etiquetas', g.user_id from public.tags g where g.user_id in (select user_id from active)
      union all
      select 'anexos', a.user_id from public.attachments a where a.user_id in (select user_id from active)
    ) f
    group by f.feature
    order by f.feature;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Assistant: ONLY actor, action, confirmed_at, user and date of public.audit_log. Never payload or entity columns (they can hold
-- content). There is no message log yet, so there are no "messages per day" and no token cost (see the page for what to log).
create or replace function admin.assistant_usage(range_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n integer := greatest(least(coalesce(range_days, 30), 365), 1);
  result jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;

  select jsonb_build_object(
    'total', (select count(*) from public.audit_log l where l.actor in ('assistant', 'whatsapp') and l.created_at >= now() - make_interval(days => n)),
    'confirmed', (select count(*) from public.audit_log l where l.actor in ('assistant', 'whatsapp') and l.created_at >= now() - make_interval(days => n) and l.confirmed_at is not null),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'actions', d.actions) order by d.day)
      from (
        select (l.created_at at time zone 'America/Sao_Paulo')::date as day, count(*) as actions
        from public.audit_log l
        where l.actor in ('assistant', 'whatsapp') and l.created_at >= now() - make_interval(days => n)
        group by 1
      ) d
    ), '[]'::jsonb),
    'by_action', coalesce((
      select jsonb_agg(jsonb_build_object('action', a.action, 'actions', a.actions, 'confirmed', a.confirmed) order by a.actions desc)
      from (
        select l.action, count(*) as actions, count(l.confirmed_at) as confirmed
        from public.audit_log l
        where l.actor in ('assistant', 'whatsapp') and l.created_at >= now() - make_interval(days => n)
        group by l.action
      ) a
    ), '[]'::jsonb),
    'top_users', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', t.user_id, 'email', t.email, 'actions', t.actions) order by t.actions desc)
      from (
        select l.user_id, u.email, count(*) as actions
        from public.audit_log l
        join auth.users u on u.id = l.user_id
        where l.actor in ('assistant', 'whatsapp') and l.created_at >= now() - make_interval(days => n)
        group by l.user_id, u.email
        order by count(*) desc
        limit 10
      ) t
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Integrations and status.
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
    'total_users', (select count(*) from auth.users),
    'google_users', (select count(distinct i.user_id) from auth.identities i where i.provider = 'google'),
    'email_users', (select count(distinct i.user_id) from auth.identities i where i.provider = 'email'),
    -- Phone numbers typed at sign-up. They are NOT linked WhatsApp numbers: linking is not built yet.
    'phones_informed', (select count(*) from public.profiles p where p.phone is not null),
    'waitlist', (select count(*) from public.waitlist)
  );
end;
$$;

-- Latest migration the Supabase CLI recorded, or NULL when the bookkeeping table is not there.
create or replace function admin.last_migration()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  latest text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if to_regclass('supabase_migrations.schema_migrations') is null then return null; end if;
  execute 'select max(version) from supabase_migrations.schema_migrations' into latest;
  return latest;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Rule 2: no admin function is callable by anon or public; only signed-in users reach it, and each one then checks is_admin().
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'admin'
  loop
    execute format('revoke all on function %s from public, anon', fn.signature);
    execute format('grant execute on function %s to authenticated', fn.signature);
  end loop;
end;
$$;
