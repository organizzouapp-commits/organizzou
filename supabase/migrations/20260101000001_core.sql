-- Core tables: profiles, tags, attachments, audit_log.
-- Every table has RLS enabled and policies scoped to auth.uid().

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles: one row per auth user (id = auth.users.id)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'America/Sao_Paulo',
  locale text not null default 'pt-BR',
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  onboarding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles_delete_own" on public.profiles
  for delete to authenticated using (id = (select auth.uid()));

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- tags
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  swatch text not null default 'neutro'
    check (swatch in ('lima', 'lima-verso', 'tinta-verso', 'grafite', 'papel', 'neutro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index tags_user_name_key on public.tags (user_id, lower(name));

alter table public.tags enable row level security;
create policy "tags_select_own" on public.tags
  for select to authenticated using (user_id = (select auth.uid()));
create policy "tags_insert_own" on public.tags
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "tags_update_own" on public.tags
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "tags_delete_own" on public.tags
  for delete to authenticated using (user_id = (select auth.uid()));
create trigger tags_set_updated_at before update on public.tags
  for each row execute function public.set_updated_at();

-- attachments (files live in Supabase Storage; this table stores the path)
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index attachments_user_id_idx on public.attachments (user_id);
create index attachments_entity_idx on public.attachments (entity_type, entity_id);

alter table public.attachments enable row level security;
create policy "attachments_select_own" on public.attachments
  for select to authenticated using (user_id = (select auth.uid()));
create policy "attachments_insert_own" on public.attachments
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "attachments_update_own" on public.attachments
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "attachments_delete_own" on public.attachments
  for delete to authenticated using (user_id = (select auth.uid()));
create trigger attachments_set_updated_at before update on public.attachments
  for each row execute function public.set_updated_at();

-- audit_log: append-only for users (no update/delete policy)
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  actor text not null check (actor in ('app', 'assistant', 'whatsapp')),
  action text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index audit_log_user_created_idx on public.audit_log (user_id, created_at desc);

alter table public.audit_log enable row level security;
create policy "audit_log_select_own" on public.audit_log
  for select to authenticated using (user_id = (select auth.uid()));
create policy "audit_log_insert_own" on public.audit_log
  for insert to authenticated with check (user_id = (select auth.uid()));
