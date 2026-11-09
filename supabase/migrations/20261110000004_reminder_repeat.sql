-- PREPARED, NOT APPLIED. Additive only: how a reminder repeats and how early it should warn.
--   repeat_rule  'none' | 'daily' | 'weekly' | 'monthly' (completing a repeating reminder creates the next occurrence)
--   advance_min  minutes before remind_at that the notice should arrive (0 = at the time); stored only, delivery is unchanged
-- Until this is applied both live in localStorage (organizzou:lembretes-meta), read through ReminderMetaRepo
-- (src/features/notes/reminders.ts). After applying: add the two columns to reminders in src/features/persist/registry.ts,
-- backfill from the localStorage copy if wanted, and switch the repo to the table.
-- RLS already covers the table (user_id = auth.uid()), so no policy changes are needed.
alter table public.reminders add column if not exists repeat_rule text not null default 'none' check (repeat_rule in ('none', 'daily', 'weekly', 'monthly'));
alter table public.reminders add column if not exists advance_min integer not null default 0 check (advance_min in (0, 10, 60, 1440));
