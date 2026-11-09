-- PREPARED, NOT APPLIED. Additive only: an optional note on each weigh-in.
-- Until this is applied the notes live in localStorage (organizzou:dieta-weight-notes); the app reads them through WeightNoteRepo.
-- After applying: add `note: text(300).nullable()` to weight_logs in src/features/persist/registry.ts and switch the repo to the table.
-- RLS already covers the table (user_id = auth.uid()), so no policy changes are needed.
alter table public.weight_logs add column if not exists note text check (note is null or char_length(note) <= 300);
