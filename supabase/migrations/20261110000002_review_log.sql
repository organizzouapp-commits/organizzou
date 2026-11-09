-- PREPARED, NOT APPLIED. Additive only: the history of flashcard answers, behind the accuracy chart and the review streak of Estudos > Flashcards.
-- Until this is applied the history lives in localStorage (organizzou:estudos-review-log), read through ReviewLogRepo (src/features/studies/review.ts).
-- After applying: add `review_log` to src/features/persist/registry.ts and switch the repo to the table.
create table if not exists public.review_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.flashcards (id) on delete cascade,
  deck_id uuid not null references public.flashcard_decks (id) on delete cascade,
  reviewed_on date not null,
  rating text not null check (rating in ('again', 'good', 'easy')),
  created_at timestamptz not null default now()
);
create index if not exists review_log_user_day_idx on public.review_log (user_id, reviewed_on desc);

-- Row Level Security, mirroring the other study tables (own rows only, per operation).
alter table public.review_log enable row level security;
create policy review_log_select_own on public.review_log for select to authenticated using (user_id = (select auth.uid()));
create policy review_log_insert_own on public.review_log for insert to authenticated with check (user_id = (select auth.uid()));
create policy review_log_update_own on public.review_log for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy review_log_delete_own on public.review_log for delete to authenticated using (user_id = (select auth.uid()));
