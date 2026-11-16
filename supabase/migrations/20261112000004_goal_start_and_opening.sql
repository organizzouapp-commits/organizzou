-- PREPARED, NOT APPLIED (ask before running `db push`). Additive only: two new columns on public.finance_goals.
-- A savings goal has a start date AND an end date (deadline), and may begin with money already saved.
--   start_date     when the goal starts. Backfilled for the goals that exist today (see below), so nothing changes for them.
--   opening_cents  the "Saldo inicial": what was already saved at the start. It is one amount per goal, already inside current_cents; it is
--                  never a finance_transactions row, so it does not enter the month's income, expenses or cash flow.
-- Until this is applied the app keeps both in localStorage (src/features/finance/goal-schedule.ts, GoalMetaRepo) and treats a missing
-- start as the creation day. RLS is unchanged: the existing policies on finance_goals cover the new columns.

alter table public.finance_goals add column if not exists start_date date;
alter table public.finance_goals add column if not exists opening_cents bigint not null default 0 check (opening_cents >= 0);

-- Idempotent backfill (only rows without a start date, so running it twice changes nothing). The start is the day the goal was created in
-- São Paulo; when a legacy goal has a deadline on or before that day, the start is the day before the deadline. That way NO existing row
-- breaks the constraint below, so an unrelated UPDATE of an old goal (a new aporte, a rename) can never be refused because of it.
-- The app computes the same value for rows it still reads without a start (goalStart in src/features/finance/goal-schedule.ts).
update public.finance_goals
   set start_date = case
     when deadline is not null and deadline <= (created_at at time zone 'America/Sao_Paulo')::date then deadline - 1
     else (created_at at time zone 'America/Sao_Paulo')::date
   end
 where start_date is null;

-- A plain CHECK (no trigger). It passes when either date is missing. NOT VALID keeps Postgres from scanning old rows now; new and updated
-- rows are checked. The backfill above already satisfies it, so the line below is only a final confirmation to run LATER, by hand:
--   alter table public.finance_goals validate constraint finance_goals_dates_check;
alter table public.finance_goals drop constraint if exists finance_goals_dates_check;
alter table public.finance_goals add constraint finance_goals_dates_check
  check (deadline is null or start_date is null or deadline > start_date) not valid;
-- alter table public.finance_goals validate constraint finance_goals_dates_check;
