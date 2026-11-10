-- PREPARED, NOT APPLIED (ask before running `db push`). Additive only: one nullable column on public.subjects.
-- archived_at: a subject the person archived (hidden from the timer and the lists, kept with its study history).
-- Until this is applied the app keeps the archived ids in localStorage (src/features/studies/subject-meta.ts).
-- RLS is unchanged: the existing policies on subjects cover the new column.
alter table public.subjects add column if not exists archived_at timestamptz;
