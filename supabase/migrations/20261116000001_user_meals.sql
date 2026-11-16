-- PREPARED, NOT APPLIED (ask before running `db push`). Additive only: one new table and one nullable column.
-- Custom meals in Dieta: besides Cafe da manha, Almoco, Lanche and Jantar the person can add any meal ("Ceia", "Pre-treino"), rename it,
-- reorder it and delete it. The list is per person (the same every day); the foods stay per date in meal_items.
--   user_meals            the person's meals, in order (position), with an optional time and icon. A person with no rows gets the four
--                         classic meals in the app, so nothing changes for anyone until they edit the list.
--   meal_items.meal_key   which user_meals row (or classic meal id) a food belongs to. Null = use the classic meal column as before.
-- Until this is applied the app keeps the list and the placement of each food in localStorage (src/features/diet/meals.ts, MealLayoutRepo),
-- and saves a food of a custom meal with the nearest classic meal ("snack"). RLS mirrors the other personal tables.

create table if not exists public.user_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  meal_time time,
  icon text check (icon is null or char_length(icon) <= 20),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_meals_user_idx on public.user_meals (user_id, position);
alter table public.user_meals enable row level security;

drop policy if exists "user_meals_select_own" on public.user_meals;
create policy "user_meals_select_own" on public.user_meals for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "user_meals_insert_own" on public.user_meals;
create policy "user_meals_insert_own" on public.user_meals for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "user_meals_update_own" on public.user_meals;
create policy "user_meals_update_own" on public.user_meals for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "user_meals_delete_own" on public.user_meals;
create policy "user_meals_delete_own" on public.user_meals for delete to authenticated using (user_id = (select auth.uid()));

alter table public.meal_items add column if not exists meal_key text check (meal_key is null or char_length(meal_key) <= 60);
