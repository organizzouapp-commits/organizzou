-- PREPARED, NOT APPLIED (ask before running `db push`). Additive only: two nullable columns on public.foods.
-- archived_at: a person's own food that was deleted from the list but is kept so past meal entries (meal_items.food_id) keep their numbers.
-- fiber_g: the optional fiber of one serving, in grams.
-- Until this is applied the app keeps both in localStorage (src/features/diet/food-meta.ts). RLS is unchanged: the existing policies on foods cover the new columns.
alter table public.foods add column if not exists archived_at timestamptz;
alter table public.foods add column if not exists fiber_g numeric(7, 2) check (fiber_g is null or fiber_g >= 0);
