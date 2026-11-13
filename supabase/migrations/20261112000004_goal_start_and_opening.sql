-- PREPARED, NOT APPLIED (ask before running `db push`). Additive only: two new columns on public.finance_goals.
-- A savings goal has a start date AND an end date (deadline), and may begin with money already saved.
--   start_date     when the goal starts. Backfilled from created_at for the goals that exist today, so nothing changes for them.
--   opening_cents  the "Saldo inicial": what was already saved at the start. It is one amount per goal, already inside current_cents; it is
--                  never a finance_transactions row, so it does not enter the month's income, expenses or cash flow.
-- Until this is applied the app keeps both in localStorage (src/features/finance/goal-schedule.ts, GoalMetaRepo) and treats a missing
-- start as the creation day. RLS is unchanged: the existing policies on finance_goals cover the new columns.

alter table public.finance_goals add column if not exists start_date date;
alter table public.finance_goals add column if not exists opening_cents bigint not null default 0 check (opening_cents >= 0);

update public.finance_goals set start_date = (created_at at time zone 'America/Sao_Paulo')::date where start_date is null;

alter table public.finance_goals drop constraint if exists finance_goals_dates_check;
alter table public.finance_goals add constraint finance_goals_dates_check
  check (deadline is null or start_date is null or deadline > start_date) not valid;
