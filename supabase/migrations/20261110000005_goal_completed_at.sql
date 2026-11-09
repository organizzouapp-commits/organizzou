-- PREPARED, NOT APPLIED. Additive only: when a goal was completed (the "Concluídas" tab: completed-on chip, average time to complete).
-- Until this is applied the date lives in localStorage (organizzou:metas-meta), read through GoalMetaRepo (src/features/goals/overview.ts).
-- After applying: add `completed_at: z.iso.datetime({ offset: true }).nullable()` to life_goals in src/features/persist/registry.ts,
-- set it when a goal is closed and clear it when it is reopened, and switch the repo to the column.
-- RLS already covers the table (user_id = auth.uid()), so no policy changes are needed.
alter table public.life_goals add column if not exists completed_at timestamptz;
-- Backfill: a goal that is already done was, in practice, closed at its last update.
update public.life_goals set completed_at = updated_at where status = 'done' and completed_at is null;
