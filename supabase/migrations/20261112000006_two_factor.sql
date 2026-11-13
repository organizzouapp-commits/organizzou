-- PREPARED, NOT APPLIED (ask before running `db push`). Additive only.
-- Two-step verification by e-mail code.
--   profiles.two_factor_enabled  a mirror for the settings screen. The flag the SERVER enforces lives in the user's app_metadata
--                                (only the secret key can write it), read from the JWT by the proxy, never from the browser.
--   two_factor_codes             the codes sent: only a salted HMAC of the code is stored, never the code. Each code lives 10 minutes, works
--                                once and dies after 5 wrong tries. No policies for app users: only the secret key reads and writes it.

alter table public.profiles add column if not exists two_factor_enabled boolean not null default false;

create table if not exists public.two_factor_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('enable', 'disable', 'login')),
  code_hash text not null,
  salt text not null,
  attempts integer not null default 0 check (attempts >= 0),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists two_factor_codes_user_idx on public.two_factor_codes (user_id, created_at desc);
alter table public.two_factor_codes enable row level security;
