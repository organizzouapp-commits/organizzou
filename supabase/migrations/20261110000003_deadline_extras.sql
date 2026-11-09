-- PREPARED, NOT APPLIED. Additive: what the new "Provas e prazos" screen needs on top of study_deadlines.
--   done_at      when the deadline was marked as done (null = open)
--   remind_days  reminders chosen in the dialog (1, 3 or 7 days before); only stored for now, no push yet
--   kind         now also accepts 'other' (the "Outro" type of the dialog)
-- Until this is applied the three live in localStorage (organizzou:estudos-deadline-meta), read through DeadlineMetaRepo
-- (src/features/studies/deadlines.ts). After applying: add the columns to study_deadlines in src/features/persist/registry.ts,
-- widen the `kind` enum there, backfill from the localStorage copy if wanted, and switch the repo to the table.
-- RLS already covers the table (user_id = auth.uid()), so no policy changes are needed.
alter table public.study_deadlines add column if not exists done_at timestamptz;
alter table public.study_deadlines add column if not exists remind_days integer[] not null default '{}';
alter table public.study_deadlines drop constraint if exists study_deadlines_kind_check;
alter table public.study_deadlines add constraint study_deadlines_kind_check check (kind in ('exam', 'delivery', 'other'));
