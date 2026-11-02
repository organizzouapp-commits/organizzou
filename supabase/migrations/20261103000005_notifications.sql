-- In-app notifications (the bell). Additive: one new table. Rows are created by the server (the secret key / future jobs); a person
-- can only READ their own, mark them read (update) and delete them. There is NO insert policy, so nobody can write a notification
-- for themselves or for anyone else from the browser. Delivery by push and WhatsApp stays "Em breve"; this is only the in-app list.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'info' check (kind in ('info', 'task', 'agenda', 'bill', 'habit', 'workout', 'study', 'goal', 'reminder')),
  title text not null check (char_length(title) between 1 and 160),
  body text check (body is null or char_length(body) <= 400),
  link text check (link is null or (char_length(link) <= 200 and link like '/dashboard%')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
-- A person may only change whether it was read: the trigger below refuses any other column.
create policy "notifications_update_own" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications_delete_own" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.notifications_only_read_state()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and (new.title is distinct from old.title or new.body is distinct from old.body or new.kind is distinct from old.kind
          or new.link is distinct from old.link or new.created_at is distinct from old.created_at or new.user_id is distinct from old.user_id) then
    raise exception 'a notification can only be marked as read or unread' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger notifications_only_read_state before update on public.notifications
  for each row execute function public.notifications_only_read_state();
create trigger notifications_set_updated_at before update on public.notifications
  for each row execute function public.set_updated_at();
