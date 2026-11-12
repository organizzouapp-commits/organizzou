-- PREPARED, NOT APPLIED (ask before running `db push`). Additive only: two new tables.
-- Passkeys (WebAuthn): the public keys of the person's passkeys, and the short-lived challenges of each ceremony.
--   passkey_credentials  one row per passkey: the credential id, the PUBLIC key (the private key never leaves the device), the signature
--                        counter (checked on every sign-in), and a name the person can edit. The person can read, rename and remove their
--                        own; rows are created only by the server (secret key) after it verified the registration.
--   webauthn_challenges  the random challenge of a ceremony: single use, 5 minutes. No policies for app users.

create table if not exists public.passkey_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0 check (counter >= 0),
  transports text[] not null default '{}',
  device_type text,
  backed_up boolean not null default false,
  device_label text not null default 'Passkey' check (char_length(device_label) between 1 and 80),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists passkey_credentials_user_idx on public.passkey_credentials (user_id);
alter table public.passkey_credentials enable row level security;

drop policy if exists "passkey_credentials_select_own" on public.passkey_credentials;
create policy "passkey_credentials_select_own" on public.passkey_credentials for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "passkey_credentials_update_own" on public.passkey_credentials;
create policy "passkey_credentials_update_own" on public.passkey_credentials for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "passkey_credentials_delete_own" on public.passkey_credentials;
create policy "passkey_credentials_delete_own" on public.passkey_credentials for delete to authenticated
  using (user_id = (select auth.uid()));

create table if not exists public.webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('register', 'login')),
  challenge text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists webauthn_challenges_expires_idx on public.webauthn_challenges (expires_at);
alter table public.webauthn_challenges enable row level security;
