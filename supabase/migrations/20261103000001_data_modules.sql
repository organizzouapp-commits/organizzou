-- Real data for every module (docs/DATA-AUDIT.md). Additive: only NEW tables, one nullable column on profiles and new policies.
-- Nothing that exists is altered or dropped. Every table follows the same rules:
--   id uuid default gen_random_uuid(), user_id uuid not null -> auth.users on delete cascade, created_at / updated_at (the shared
--   set_updated_at trigger), RLS enabled with select / insert / update / delete policies `user_id = (select auth.uid())`
--   (with check on insert and update), and indexes on the columns the screens filter by.
-- Money is integer cents. "Day" fields are `date` in America/Sao_Paulo; instants are timestamptz.
-- Shared catalogs (foods, exercises) have user_id NULL: readable by everyone signed in, writable by nobody but the service role.

create or replace function public.today_sp() returns date
language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

alter table public.profiles add column if not exists avatar_path text;

-- ---------------------------------------------------------------------------------------------------------------------
-- Rotina
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  type text not null default 'fixed' check (type in ('fixed', 'goal')),
  target_qty numeric(10, 2) check (target_qty is null or target_qty > 0),
  unit text check (unit is null or char_length(unit) <= 20),
  weekdays smallint[] not null default '{0,1,2,3,4,5,6}',
  deadline date,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists habits_user_idx on public.habits (user_id);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  log_date date not null,
  qty numeric(10, 2) not null default 1 check (qty >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, log_date)
);
create index if not exists habit_logs_user_date_idx on public.habit_logs (user_id, log_date desc);

-- ---------------------------------------------------------------------------------------------------------------------
-- Agenda
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  description text check (description is null or char_length(description) <= 4000),
  location text check (location is null or char_length(location) <= 300),
  category text check (category is null or char_length(category) <= 60),
  swatch text not null default 'neutro' check (swatch in ('neutro', 'lima', 'lima-verso', 'tinta-verso', 'grafite', 'papel')),
  rrule text check (rrule is null or char_length(rrule) <= 200),
  reminder_offsets integer[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);
create index if not exists events_user_start_idx on public.events (user_id, starts_at);

-- ---------------------------------------------------------------------------------------------------------------------
-- Finanças
create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  institution text not null default '' check (char_length(institution) <= 80),
  opening_balance_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finance_accounts_user_idx on public.finance_accounts (user_id);

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  icon text not null default 'tag' check (char_length(icon) <= 40),
  monthly_limit_cents bigint check (monthly_limit_cents is null or monthly_limit_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finance_categories_user_idx on public.finance_categories (user_id);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.finance_accounts (id) on delete cascade,
  category_id uuid references public.finance_categories (id) on delete set null,
  kind text not null check (kind in ('in', 'out')),
  amount_cents bigint not null check (amount_cents > 0),
  occurred_on date not null,
  method text check (method is null or char_length(method) <= 60),
  description text not null default '' check (char_length(description) <= 200),
  source text not null default 'manual' check (source in ('manual', 'open_finance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finance_transactions_user_day_idx on public.finance_transactions (user_id, occurred_on desc);
create index if not exists finance_transactions_account_idx on public.finance_transactions (account_id);

create table if not exists public.finance_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  amount_cents bigint not null check (amount_cents > 0),
  due_day smallint not null check (due_day between 1 and 28),
  category_id uuid references public.finance_categories (id) on delete set null,
  active boolean not null default true,
  last_paid_month text check (last_paid_month is null or last_paid_month ~ '^[0-9]{4}-[0-9]{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finance_bills_user_idx on public.finance_bills (user_id) where active;

create table if not exists public.finance_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  target_cents bigint not null check (target_cents > 0),
  current_cents bigint not null default 0 check (current_cents >= 0),
  deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finance_goals_user_idx on public.finance_goals (user_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- Treinos
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade, -- null = shared catalog
  name text not null check (char_length(name) between 1 and 120),
  muscle_group text not null default '' check (char_length(muscle_group) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists exercises_user_idx on public.exercises (user_id);

create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  weekdays smallint[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workout_plans_user_idx on public.workout_plans (user_id);

create table if not exists public.plan_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.workout_plans (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  position integer not null default 0,
  sets smallint not null default 3 check (sets between 1 and 20),
  reps smallint not null default 10 check (reps between 1 and 200),
  rest_seconds integer not null default 60 check (rest_seconds between 0 and 1800),
  target_load_kg numeric(6, 2) check (target_load_kg is null or target_load_kg >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plan_exercises_plan_idx on public.plan_exercises (plan_id, position);
create index if not exists plan_exercises_user_idx on public.plan_exercises (user_id);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.workout_plans (id) on delete cascade,
  performed_on date not null,
  duration_min integer check (duration_min is null or duration_min between 0 and 1440),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workout_sessions_user_day_idx on public.workout_sessions (user_id, performed_on desc);

create table if not exists public.set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  set_index smallint not null check (set_index >= 0),
  reps smallint not null check (reps >= 0),
  load_kg numeric(6, 2) not null default 0 check (load_kg >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists set_logs_session_idx on public.set_logs (session_id);
create index if not exists set_logs_user_idx on public.set_logs (user_id, exercise_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- Dieta
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade, -- null = shared catalog
  name text not null check (char_length(name) between 1 and 120),
  serving_label text not null check (char_length(serving_label) between 1 and 60),
  kcal numeric(7, 1) not null check (kcal >= 0),
  protein_g numeric(6, 1) not null default 0 check (protein_g >= 0),
  carbs_g numeric(6, 1) not null default 0 check (carbs_g >= 0),
  fat_g numeric(6, 1) not null default 0 check (fat_g >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists foods_user_idx on public.foods (user_id);

create table if not exists public.meal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null default public.today_sp(),
  meal text not null check (meal in ('breakfast', 'lunch', 'snack', 'dinner')),
  food_id uuid not null references public.foods (id) on delete cascade,
  servings numeric(6, 2) not null default 1 check (servings > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meal_items_user_day_idx on public.meal_items (user_id, log_date desc);

create table if not exists public.diet_goals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  kcal integer not null default 2000 check (kcal > 0),
  protein_g integer not null default 120 check (protein_g >= 0),
  carbs_g integer not null default 220 check (carbs_g >= 0),
  fat_g integer not null default 65 check (fat_g >= 0),
  water_ml integer not null default 2500 check (water_ml > 0),
  target_weight_kg numeric(5, 1) check (target_weight_kg is null or target_weight_kg > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  weight_kg numeric(5, 1) not null check (weight_kg > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);
create index if not exists weight_logs_user_day_idx on public.weight_logs (user_id, log_date desc);

create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null default public.today_sp(),
  ml integer not null check (ml > 0 and ml <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists water_logs_user_day_idx on public.water_logs (user_id, log_date desc);

-- ---------------------------------------------------------------------------------------------------------------------
-- Estudos
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  type text not null default 'subject' check (type in ('subject', 'course', 'book', 'exam')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  swatch text not null default 'neutro' check (swatch in ('neutro', 'lima', 'lima-verso', 'tinta-verso', 'grafite', 'papel')),
  weekly_goal_min integer not null default 0 check (weekly_goal_min between 0 and 10080),
  progress_pct smallint check (progress_pct is null or progress_pct between 0 and 100),
  progress_label text check (progress_label is null or char_length(progress_label) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subjects_user_idx on public.subjects (user_id);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  studied_on date not null,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  mode text not null default 'free' check (mode in ('pomodoro', 'free')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists study_sessions_user_day_idx on public.study_sessions (user_id, studied_on desc);

create table if not exists public.study_deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  due_on date not null,
  kind text not null default 'exam' check (kind in ('exam', 'delivery')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists study_deadlines_user_due_idx on public.study_deadlines (user_id, due_on);

create table if not exists public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists flashcard_decks_user_idx on public.flashcard_decks (user_id);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  deck_id uuid not null references public.flashcard_decks (id) on delete cascade,
  front text not null check (char_length(front) between 1 and 2000),
  back text not null check (char_length(back) between 1 and 2000),
  ease numeric(4, 2) not null default 2.5 check (ease >= 1.3),
  interval_days integer not null default 0 check (interval_days >= 0),
  repetitions integer not null default 0 check (repetitions >= 0),
  due_on date not null default public.today_sp(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists flashcards_user_due_idx on public.flashcards (user_id, due_on);
create index if not exists flashcards_deck_idx on public.flashcards (deck_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- Notas e lembretes
create table if not exists public.note_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists note_folders_user_idx on public.note_folders (user_id);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  folder_id uuid references public.note_folders (id) on delete set null,
  title text not null default '' check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 100000),
  pinned boolean not null default false,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at desc);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  remind_at timestamptz not null,
  channels text[] not null default '{push}',
  status text not null default 'pending' check (status in ('pending', 'done')),
  note_id uuid references public.notes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reminders_user_when_idx on public.reminders (user_id, remind_at) where status = 'pending';

-- ---------------------------------------------------------------------------------------------------------------------
-- Metas, diário e sono
create table if not exists public.life_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text check (description is null or char_length(description) <= 2000),
  deadline date,
  status text not null default 'active' check (status in ('active', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists life_goals_user_idx on public.life_goals (user_id, status);

create table if not exists public.life_goal_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.life_goals (id) on delete cascade,
  module text not null check (char_length(module) between 1 and 40),
  label text not null check (char_length(label) between 1 and 120),
  done numeric(14, 2) not null default 0 check (done >= 0),
  total numeric(14, 2) not null default 1 check (total > 0),
  unit text not null default '' check (char_length(unit) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists life_goal_links_goal_idx on public.life_goal_links (goal_id);

create table if not exists public.life_goal_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.life_goals (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists life_goal_milestones_goal_idx on public.life_goal_milestones (goal_id);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  mood smallint not null check (mood between 1 and 5),
  text text not null default '' check (char_length(text) <= 20000),
  sleep_hours numeric(3, 1) check (sleep_hours is null or sleep_hours between 0 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);
create index if not exists journal_entries_user_day_idx on public.journal_entries (user_id, entry_date desc);

-- ---------------------------------------------------------------------------------------------------------------------
-- Notificações, WhatsApp, push e gamificação (the delivery itself stays "Em breve"; the preferences and links are stored)
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  push_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  email_enabled boolean not null default false,
  daily_summary boolean not null default true,
  daily_summary_time time not null default '08:00',
  quiet_start time,
  quiet_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  verified_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'linked', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table if not exists public.user_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  best_streak integer not null default 0 check (best_streak >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null check (char_length(code) between 1 and 60),
  unlocked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

-- ---------------------------------------------------------------------------------------------------------------------
-- RLS and updated_at on every table above. Own rows only; no policy ever reads another user's row.
do $$
declare
  t text;
begin
  foreach t in array array[
    'habits', 'habit_logs', 'events',
    'finance_accounts', 'finance_categories', 'finance_transactions', 'finance_bills', 'finance_goals',
    'workout_plans', 'plan_exercises', 'workout_sessions', 'set_logs',
    'meal_items', 'diet_goals', 'weight_logs', 'water_logs',
    'subjects', 'study_sessions', 'study_deadlines', 'flashcard_decks', 'flashcards',
    'note_folders', 'notes', 'reminders',
    'life_goals', 'life_goal_links', 'life_goal_milestones', 'journal_entries',
    'notification_preferences', 'whatsapp_links', 'push_subscriptions', 'user_stats', 'achievements'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t || '_delete_own', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_set_updated_at', t);
  end loop;

  -- Shared catalogs: everyone reads the catalog (user_id null) and their own rows; they write only their own.
  foreach t in array array['foods', 'exercises'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id is null or user_id = (select auth.uid()))', t || '_select_catalog_or_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t || '_delete_own', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_set_updated_at', t);
  end loop;
end;
$$;

