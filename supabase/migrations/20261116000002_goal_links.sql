-- Goals driven by module data. Additive only; NOT applied (ask before db push).
-- The app keeps the link of each goal in localStorage ("organizzou:metas-links") until this exists.
alter table public.life_goals
  add column if not exists kind text not null default 'free',
  add column if not exists link_type text,
  add column if not exists link_id uuid,
  add column if not exists params jsonb not null default '{}'::jsonb,
  add column if not exists start_date date,
  add column if not exists end_date date;

-- Existing goals keep working as free goals.
update public.life_goals set kind = 'free' where kind is null;

alter table public.life_goals
  drop constraint if exists life_goals_kind_check;
alter table public.life_goals
  add constraint life_goals_kind_check check (kind in ('free','linked'));
