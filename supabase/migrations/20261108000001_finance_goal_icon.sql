-- PREPARED, NOT APPLIED. Additive only: the icon key of a financial goal ("shield", "plane", "laptop", ...).
-- Goals without one keep working (the app falls back to the piggy bank); until this is applied the choice lives in localStorage
-- (organizzou:financas-goal-icons). RLS already covers the table (user_id = auth.uid()), so no policy changes are needed.
alter table public.finance_goals add column if not exists icon text;
