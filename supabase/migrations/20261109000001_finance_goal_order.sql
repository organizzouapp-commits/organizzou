-- PREPARED, NOT APPLIED. Additive only: the order of the goals and which one is the featured (large) card.
-- Until this is applied the order lives in localStorage (organizzou:financas-goal-order); the app treats "no order" as nearest
-- deadline first, which is also what the defaults below produce (all zeros, nothing featured).
-- RLS already covers the table (user_id = auth.uid()), so no policy changes are needed.
alter table public.finance_goals add column if not exists sort_order integer not null default 0;
alter table public.finance_goals add column if not exists is_featured boolean not null default false;
-- At most one featured goal per person.
create unique index if not exists finance_goals_one_featured on public.finance_goals (user_id) where is_featured;
