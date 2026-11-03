-- PREPARED, NOT APPLIED (do not db push without approval).
-- Colors people give to priorities, tags, categories and tasks, plus the custom colors they save. Additive: nothing is dropped.
-- The app works today with a localStorage adapter (src/features/tasks/colors.ts, LabelColorRepo); this file is what a server adapter needs.
-- Depends on 20261105000001_task_priorities.sql (priorities table).

-- A color is a hex "#RRGGBB" or a palette swatch id, or null ("Sem cor").
create domain public.label_color as text
  check (value ~ '^#[0-9A-Fa-f]{6}$' or value in ('cinza', 'lima', 'lima-verso', 'tinta-verso', 'grafite', 'papel'));

alter table public.task_priorities add column color public.label_color;

-- Tags and tasks already have `swatch` (palette ids only, by CHECK). Custom hex needs a wider check; the old values stay valid.
alter table public.tags drop constraint if exists tags_swatch_check;
alter table public.tags
  add constraint tags_swatch_check check (swatch ~ '^#[0-9A-Fa-f]{6}$' or swatch in ('lima', 'lima-verso', 'tinta-verso', 'grafite', 'papel', 'neutro', 'cinza'));

alter table public.tasks drop constraint if exists tasks_swatch_check;
alter table public.tasks
  add constraint tasks_swatch_check check (swatch ~ '^#[0-9A-Fa-f]{6}$' or swatch in ('lima', 'lima-verso', 'tinta-verso', 'grafite', 'papel', 'neutro', 'cinza'));

-- Categories are free text on tasks, so their color lives in its own small table (one row per person and category name).
create table public.task_category_colors (
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  color public.label_color not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, name)
);

alter table public.task_category_colors enable row level security;

create policy "task_category_colors_select_own" on public.task_category_colors for select using (user_id = (select auth.uid()));
create policy "task_category_colors_insert_own" on public.task_category_colors for insert with check (user_id = (select auth.uid()));
create policy "task_category_colors_update_own" on public.task_category_colors for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "task_category_colors_delete_own" on public.task_category_colors for delete using (user_id = (select auth.uid()));

-- The custom colors a person saved from the color panel (at most 5), in order.
create table public.user_custom_colors (
  user_id uuid primary key references auth.users (id) on delete cascade,
  colors text[] not null default '{}' check (cardinality(colors) <= 5),
  updated_at timestamptz not null default now()
);

alter table public.user_custom_colors enable row level security;

create policy "user_custom_colors_select_own" on public.user_custom_colors for select using (user_id = (select auth.uid()));
create policy "user_custom_colors_insert_own" on public.user_custom_colors for insert with check (user_id = (select auth.uid()));
create policy "user_custom_colors_update_own" on public.user_custom_colors for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "user_custom_colors_delete_own" on public.user_custom_colors for delete using (user_id = (select auth.uid()));

-- TODO before applying: confirm the real names of the two swatch CHECK constraints (the `drop constraint if exists` lines assume the
-- Postgres default <table>_swatch_check), and the Agenda reads `swatch` through `getSwatch`, which must learn hex values.
