-- Tasks module: boards, lists, tasks, checklist, comments, task tags.
-- Child tables carry user_id and use composite foreign keys (id, user_id)
-- so a row can never reference a parent owned by another user.

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  position double precision not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index boards_user_id_idx on public.boards (user_id);

create table public.board_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  board_id uuid not null,
  name text not null check (char_length(name) between 1 and 80),
  position double precision not null default 0,
  is_done_list boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (board_id, user_id) references public.boards (id, user_id) on delete cascade
);
create index board_lists_board_idx on public.board_lists (board_id);
create index board_lists_user_id_idx on public.board_lists (user_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  board_id uuid not null,
  list_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  priority text not null default 'none' check (priority in ('none', 'low', 'medium', 'high')),
  due_at timestamptz,
  category text,
  swatch text not null default 'neutro'
    check (swatch in ('lima', 'lima-verso', 'tinta-verso', 'grafite', 'papel', 'neutro')),
  position double precision not null default 0,
  completed_at timestamptz,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (board_id, user_id) references public.boards (id, user_id) on delete cascade,
  foreign key (list_id, user_id) references public.board_lists (id, user_id) on delete cascade
);
create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_list_position_idx on public.tasks (list_id, position);
create index tasks_board_idx on public.tasks (board_id);
create index tasks_due_idx on public.tasks (user_id, due_at) where due_at is not null;

create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null,
  text text not null check (char_length(text) between 1 and 300),
  done boolean not null default false,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);
create index task_checklist_task_idx on public.task_checklist_items (task_id);
create index task_checklist_user_id_idx on public.task_checklist_items (user_id);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);
create index task_comments_task_idx on public.task_comments (task_id);
create index task_comments_user_id_idx on public.task_comments (user_id);

create table public.task_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, tag_id),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references public.tags (id, user_id) on delete cascade
);
create index task_tags_tag_idx on public.task_tags (tag_id);
create index task_tags_user_id_idx on public.task_tags (user_id);

-- RLS + updated_at for every table above
do $$
declare
  t text;
begin
  foreach t in array array[
    'boards', 'board_lists', 'tasks', 'task_checklist_items', 'task_comments', 'task_tags'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))',
      t || '_delete_own', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t);
  end loop;
end;
$$;
