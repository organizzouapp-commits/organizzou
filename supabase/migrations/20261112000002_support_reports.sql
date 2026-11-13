-- PREPARED, NOT APPLIED (ask before running `db push`). Additive only: a new table.
-- A copy of every problem report sent from Ajuda (the e-mail to support is the main channel; this is the record).
-- Until this is applied the report is only e-mailed, and the hourly limit is kept in memory.

create table if not exists public.support_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message text not null check (char_length(message) between 10 and 2000),
  route text not null default '',
  user_agent text not null default '',
  app_version text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists support_reports_user_created_idx on public.support_reports (user_id, created_at desc);

alter table public.support_reports enable row level security;

drop policy if exists "support_reports_insert_own" on public.support_reports;
create policy "support_reports_insert_own" on public.support_reports for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "support_reports_select_own" on public.support_reports;
create policy "support_reports_select_own" on public.support_reports for select to authenticated
  using (user_id = (select auth.uid()));
