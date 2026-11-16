-- PREPARED, NOT APPLIED (ask before running `db push`). Additive and fully IDEMPOTENT: safe to run twice, and safe whether
-- public.push_subscriptions and public.notification_preferences already exist in the remote database or not.
-- Web push: the device label of each subscription, the per-event choices (kept per person, not only on one device) and the log that makes the
-- dispatcher idempotent.
--
-- Part 1 creates the two base tables only when they are missing (same definition as 20261103000001_data_modules.sql, with RLS), and adds
-- every column this feature needs with "add column if not exists". Part 2 is the new notification_log table.

-- ------------------------------------------------------------------ push_subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Columns for a table that already existed with an older shape:
alter table public.push_subscriptions add column if not exists user_agent text check (user_agent is null or char_length(user_agent) <= 300);
alter table public.push_subscriptions add column if not exists updated_at timestamptz not null default now();
-- NEW: a label for the device ("Chrome no Android").
alter table public.push_subscriptions add column if not exists device_label text check (device_label is null or char_length(device_label) <= 80);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ------------------------------------------------------------------ notification_preferences
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  push_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  email_enabled boolean not null default false,
  daily_summary boolean not null default true,
  daily_summary_time time not null default '08:00',
  quiet_start time,
  quiet_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences add column if not exists push_enabled boolean not null default true;
alter table public.notification_preferences add column if not exists email_enabled boolean not null default false;
alter table public.notification_preferences add column if not exists daily_summary boolean not null default true;
alter table public.notification_preferences add column if not exists daily_summary_time time not null default '08:00';
alter table public.notification_preferences add column if not exists quiet_start time;
alter table public.notification_preferences add column if not exists quiet_end time;
alter table public.notification_preferences add column if not exists updated_at timestamptz not null default now();
-- NEW: the choices of "Avisos" (which events warn, the quiet hours), one JSON document per person, validated by the app
-- (src/features/settings/notification-prefs.ts). Until this is applied the choices stay in localStorage on each device.
alter table public.notification_preferences add column if not exists settings jsonb not null default '{}'::jsonb;

-- ------------------------------------------------------------------ RLS: own rows only (policies are dropped first, so a re-run is harmless)
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['push_subscriptions', 'notification_preferences'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t || '_delete_own', t);
    -- updated_at trigger, only when the shared function exists (it comes from 20261103000001_data_modules.sql).
    if to_regprocedure('public.set_updated_at()') is not null then
      execute format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
      execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_set_updated_at', t);
    end if;
  end loop;
end;
$$;

-- ------------------------------------------------------------------ notification_log
-- What was already sent: one row per person + event + target + moment, so a notification never goes out twice even if the scheduled job
-- runs again. Written only by the dispatcher with the secret key: row level security is on and there are NO policies for app users.
create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event text not null,
  target_id text not null,
  bucket text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, event, target_id, bucket)
);
create index if not exists notification_log_sent_idx on public.notification_log (sent_at);
alter table public.notification_log enable row level security;
