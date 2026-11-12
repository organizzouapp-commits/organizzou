-- PREPARED, NOT APPLIED (ask before running `db push`). Additive only: one table and three functions.
-- Active sessions: the list of the devices signed in, and the power to end one (or all the others) for real.
--   user_sessions         one row per Supabase session (auth_session_id = the session_id claim of the JWT): a device label made from the
--                         user agent, the place (city/country, only when the host sends it for free), when it started and was last seen.
--                         The person can READ their own rows; every write goes through the functions below.
--   register_session      called by the proxy at most once a minute per session: creates or refreshes the row and tells the caller whether
--                         the session was revoked, so that device is sent to the login on its very next request.
--   revoke_session        ends one of the person's own sessions: marks it revoked AND deletes it from auth.sessions, so its refresh token
--                         stops working (its short-lived access token is also refused by the proxy through register_session).
--   revoke_other_sessions the same for every session but the current one.
-- Ownership is checked inside each function against auth.uid(): nobody can end somebody else's session.

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  auth_session_id uuid not null,
  label text not null default 'Aparelho' check (char_length(label) <= 120),
  place text check (place is null or char_length(place) <= 120),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, auth_session_id)
);
create index if not exists user_sessions_user_idx on public.user_sessions (user_id, last_seen_at desc);
alter table public.user_sessions enable row level security;

drop policy if exists "user_sessions_select_own" on public.user_sessions;
create policy "user_sessions_select_own" on public.user_sessions for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.register_session(p_session uuid, p_label text, p_place text)
returns boolean
language plpgsql security definer set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  was_revoked timestamptz;
begin
  if uid is null or p_session is null then return false; end if;
  insert into public.user_sessions (user_id, auth_session_id, label, place)
  values (uid, p_session, left(coalesce(nullif(p_label, ''), 'Aparelho'), 120), left(nullif(p_place, ''), 120))
  on conflict (user_id, auth_session_id) do update set last_seen_at = now()
  returning revoked_at into was_revoked;
  return was_revoked is not null;
end;
$$;

create or replace function public.revoke_session(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  target uuid;
begin
  if uid is null then return false; end if;
  select auth_session_id into target from public.user_sessions where id = p_id and user_id = uid;
  if target is null then return false; end if;
  update public.user_sessions set revoked_at = coalesce(revoked_at, now()) where id = p_id and user_id = uid;
  delete from auth.sessions where id = target and user_id = uid;
  return true;
end;
$$;

create or replace function public.revoke_other_sessions(p_current uuid)
returns integer
language plpgsql security definer set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  ended integer;
begin
  if uid is null then return 0; end if;
  update public.user_sessions set revoked_at = coalesce(revoked_at, now())
   where user_id = uid and auth_session_id is distinct from p_current and revoked_at is null;
  get diagnostics ended = row_count;
  delete from auth.sessions where user_id = uid and id is distinct from p_current;
  return ended;
end;
$$;

revoke all on function public.register_session(uuid, text, text) from public, anon;
revoke all on function public.revoke_session(uuid) from public, anon;
revoke all on function public.revoke_other_sessions(uuid) from public, anon;
grant execute on function public.register_session(uuid, text, text) to authenticated;
grant execute on function public.revoke_session(uuid) to authenticated;
grant execute on function public.revoke_other_sessions(uuid) to authenticated;
