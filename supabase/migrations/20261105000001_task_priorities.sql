-- PREPARED, NOT APPLIED (do not db push without approval).
-- User-defined task priorities, additive: the old `tasks.priority` column and its check stay untouched so nothing that reads it breaks.
-- The app works today with a localStorage adapter (src/features/tasks/priorities.ts, PriorityRepo); this file is what a server adapter needs.

create table public.task_priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  -- Position in the person's list: the weight (0 = lightest).
  rank integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index task_priorities_user_idx on public.task_priorities (user_id, rank);

alter table public.task_priorities enable row level security;

create policy "task_priorities_select_own" on public.task_priorities for select using (user_id = (select auth.uid()));
create policy "task_priorities_insert_own" on public.task_priorities for insert with check (user_id = (select auth.uid()));
create policy "task_priorities_update_own" on public.task_priorities for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "task_priorities_delete_own" on public.task_priorities for delete using (user_id = (select auth.uid()));

-- A task points at its priority. Deleting a priority makes affected tasks fall back to "Sem prioridade" (null) on its own.
alter table public.tasks add column priority_id uuid;
alter table public.tasks
  add constraint tasks_priority_fk foreign key (priority_id, user_id) references public.task_priorities (id, user_id) on delete set null (priority_id);

create index tasks_priority_id_idx on public.tasks (priority_id);

-- Seeds for every existing user (Baixa, Média, Alta, Urgente) and a backfill from the old enum.
insert into public.task_priorities (user_id, name, rank)
select u.id, p.name, p.rank
from auth.users u
cross join (values ('Baixa', 0), ('Média', 1), ('Alta', 2), ('Urgente', 3)) as p (name, rank);

update public.tasks t
set priority_id = p.id
from public.task_priorities p
where p.user_id = t.user_id
  and ((t.priority = 'low' and p.name = 'Baixa') or (t.priority = 'medium' and p.name = 'Média') or (t.priority = 'high' and p.name = 'Alta'));

-- TODO before applying: seed the same four priorities for NEW users (extend the new-user trigger), otherwise they start with an empty list.
