-- PREPARED, NOT APPLIED (do not db push without approval).
-- Per-occurrence state for the Agenda page: events, treinos and estudos can be concluded or deleted for ONE date without touching the
-- series. Additive: nothing existing changes. The app works today with a localStorage adapter (`organizzou:agenda-local`, in
-- src/components/calendar/agenda-screen.tsx); this file is what a server adapter needs.

create table public.agenda_occurrence_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- "event" | "workout" | "study" (tasks keep their own completed_at).
  kind text not null check (kind in ('event', 'workout', 'study')),
  item_id uuid not null,
  -- The occurrence's day (America/Sao_Paulo calendar day).
  day date not null,
  done boolean not null default false,
  -- "Só esta ocorrência": the date is skipped instead of deleting the series.
  skipped boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, item_id, day)
);

alter table public.agenda_occurrence_state enable row level security;

create policy "agenda_occurrence_state_select_own" on public.agenda_occurrence_state for select using (user_id = (select auth.uid()));
create policy "agenda_occurrence_state_insert_own" on public.agenda_occurrence_state for insert with check (user_id = (select auth.uid()));
create policy "agenda_occurrence_state_update_own" on public.agenda_occurrence_state for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "agenda_occurrence_state_delete_own" on public.agenda_occurrence_state for delete using (user_id = (select auth.uid()));
