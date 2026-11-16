-- Goals driven by module data. Additive only; NOT applied (ask before db push).
-- The app writes these columns through src/features/persist/registry.ts (life_goals) and src/features/goals/link-columns.ts, and until this is
-- applied it keeps the link of each goal in localStorage ("organizzou:metas-links").
alter table public.life_goals
  add column if not exists kind text not null default 'free',
  add column if not exists link_type text,
  add column if not exists link_id uuid,
  add column if not exists params jsonb not null default '{}'::jsonb,
  add column if not exists start_date date,
  add column if not exists end_date date;

-- Existing goals keep working as free goals: the column default ('free') already fills every current row.
alter table public.life_goals
  drop constraint if exists life_goals_kind_check;
alter table public.life_goals
  add constraint life_goals_kind_check check (kind in ('free','linked'));
