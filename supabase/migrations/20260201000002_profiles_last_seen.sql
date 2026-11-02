-- Activity tracking for the admin area ("pessoas ativas"). Additive: one nullable column, one new table, one new function.
--
-- profiles.last_seen_at     the last time the person opened the app.
-- user_activity_hourly      one row per person per hour in which they opened the app. This is what makes DAU/WAU/MAU history,
--                           cohort retention and the peak-hours heatmap possible: last_seen_at alone only keeps the latest moment.
--                           It stores NO content: just (user, hour).
--
-- Written by public.touch_activity(), which the proxy calls at most once every 10 minutes per browser (a short-lived cookie
-- throttles it), so it costs no extra request per page. History starts when this migration is applied; the admin pages say so.
--
-- Definitions (also in docs/ADMIN.md): "active day" = a calendar day in America/Sao_Paulo with at least one touch. Active today =
-- today is an active day. DAU/WAU/MAU = distinct people with an active day in the last 1 / 7 / 30 days. While a person has no touch
-- yet, the admin functions fall back to auth.users.last_sign_in_at (see admin.activity_days).

alter table public.profiles add column if not exists last_seen_at timestamptz;
create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at desc) where last_seen_at is not null;

create table if not exists public.user_activity_hourly (
  user_id uuid not null references auth.users (id) on delete cascade,
  hour_start timestamptz not null,
  primary key (user_id, hour_start)
);
create index if not exists user_activity_hour_idx on public.user_activity_hourly (hour_start);

-- RLS on and no policy: nobody reads or writes it through the Data API. Only touch_activity() (below) writes, and the SECURITY
-- DEFINER admin functions read it.
alter table public.user_activity_hourly enable row level security;
revoke all on public.user_activity_hourly from anon, authenticated;

create or replace function public.touch_activity()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then return; end if;
  update public.profiles set last_seen_at = now() where id = me;
  insert into public.user_activity_hourly (user_id, hour_start)
  values (me, date_trunc('hour', now()))
  on conflict do nothing;
end;
$$;

revoke execute on function public.touch_activity() from public, anon;
grant execute on function public.touch_activity() to authenticated;
