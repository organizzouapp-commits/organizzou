-- Waitlist for the /em-breve coming-soon page.
-- RLS is on and there are NO policies: anon/authenticated cannot read or write. Rows are inserted server-side only
-- (Server Action using the service role key).

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'), -- E.164
  email text not null check (email = lower(email) and char_length(email) <= 254),
  consent_at timestamptz not null,
  source text not null default 'em-breve',
  user_agent text,
  created_at timestamptz not null default now()
);

create unique index waitlist_email_key on public.waitlist (email);

alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;

-- Rate limit bookkeeping: one row per submit attempt, keyed by HMAC hashes (no raw IP or e-mail is stored).
create table public.waitlist_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  email_hash text not null,
  created_at timestamptz not null default now()
);

create index waitlist_attempts_ip_idx on public.waitlist_attempts (ip_hash, created_at);
create index waitlist_attempts_email_idx on public.waitlist_attempts (email_hash, created_at);

alter table public.waitlist_attempts enable row level security;
revoke all on public.waitlist_attempts from anon, authenticated;
