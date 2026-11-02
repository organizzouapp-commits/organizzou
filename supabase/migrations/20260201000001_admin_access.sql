-- Admin area, part 1: who is an admin, the audit log and the plan history.
-- Additive and backward compatible: new function, new schema, new tables, one nullable column.
--
-- An admin is a Supabase user whose app_metadata.role = 'admin'. Users cannot edit app_metadata (only the secret key can,
-- see scripts/make-admin.ts), so the claim is trustworthy.
--
-- PRIVACY (LGPD): nothing in the admin schema may read task, note, finance, diet, journal or study content, and nothing may
-- touch the `vault` schema. Admins see account data and aggregates only. supabase/tests/admin-privacy.test.ts enforces it.

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- The schema that holds every admin function (SECURITY DEFINER, each starting with an is_admin() check).
-- It must also be exposed to the Data API: Project Settings > API > Exposed schemas (local: supabase/config.toml).
create schema if not exists admin;
revoke all on schema admin from public, anon;
grant usage on schema admin to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- Plan expiry (courtesy Pro with an end date). NULL = no end. Only the service role may change it, like `plan`.
alter table public.profiles add column if not exists plan_until timestamptz;

create or replace function public.profiles_protect_plan()
returns trigger
language plpgsql
as $$
begin
  if (new.plan is distinct from old.plan or new.plan_until is distinct from old.plan_until)
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'plan can only be changed by the service role' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Every plan change, newest first in the user's detail panel.
create table if not exists public.plan_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('free', 'pro')),
  -- 'admin' = changed by hand, 'courtesy' = free Pro with an end date, 'payment' = reserved for a future payment provider.
  kind text not null default 'admin' check (kind in ('admin', 'courtesy', 'payment')),
  until timestamptz,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists plan_history_user_idx on public.plan_history (user_id, created_at desc);

alter table public.plan_history enable row level security;
revoke all on public.plan_history from anon, authenticated;
grant select on public.plan_history to authenticated;
create policy "plan_history_select_admin" on public.plan_history
  for select to authenticated using (public.is_admin());
-- No insert/update/delete policy: rows are written by the server with the secret key (which bypasses RLS).

-- ---------------------------------------------------------------------------------------------------------------------
-- Everything an admin does to someone's account. Admin-only select; inserts come from the server only.
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users (id) on delete set null,
  -- Snapshots, so the entry stays readable after an account is deleted.
  admin_email text,
  action text not null,
  target_user_id uuid references auth.users (id) on delete set null,
  target_email text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log (target_user_id, created_at desc);
create index if not exists admin_audit_log_admin_idx on public.admin_audit_log (admin_id, created_at desc);

alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;
create policy "admin_audit_log_select_admin" on public.admin_audit_log
  for select to authenticated using (public.is_admin());
-- No insert/update/delete policy: append-only, written by the server with the secret key.

-- ---------------------------------------------------------------------------------------------------------------------
-- Ends every session of a user (the Auth API cannot do it by user id). Like every admin function it checks is_admin() first;
-- the server action calls it with the admin's own session after re-checking, then writes the audit entry.
create or replace function admin.revoke_user_sessions(target uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  -- Refresh tokens go with their session (foreign key on delete cascade).
  delete from auth.sessions where user_id = target;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke execute on function admin.revoke_user_sessions(uuid) from public, anon;
grant execute on function admin.revoke_user_sessions(uuid) to authenticated;
