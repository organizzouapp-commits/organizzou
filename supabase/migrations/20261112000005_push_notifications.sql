-- PREPARED, NOT APPLIED (ask before running `db push`). Additive only.
-- Web push: the device label of each subscription, the per-event choices (kept per person, not only on one device) and the log that makes the
-- dispatcher idempotent.
--
-- public.push_subscriptions already exists (endpoint, p256dh, auth, user_agent) with row level security: this only adds a label.
alter table public.push_subscriptions add column if not exists device_label text
  check (device_label is null or char_length(device_label) <= 80);

-- The choices of "Avisos": which events warn, and the quiet hours. One JSON document per person, validated by the app
-- (src/features/settings/notification-prefs.ts). Until this is applied the choices stay in localStorage on each device.
alter table public.notification_preferences add column if not exists settings jsonb not null default '{}'::jsonb;

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
