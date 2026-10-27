# Build Organizzou — master prompt

You are the lead engineer and product designer for **Organizzou**, a mobile-first, installable (PWA) personal
"Life OS" web app in Brazilian Portuguese. Follow `CLAUDE.md` at all times. The full product spec is in
`docs/PRD.md` and the visual source of truth is `docs/design-system/DESIGN-SYSTEM.md` — **use the design system on
every screen, component and state, without exception.** The design system foundation (tokens, theme, base shadcn
components, `src/components/organizzou/*`, `/design-system` showcase) is already in the project; build on it.

Note on the spec: `docs/PRD.md` was written before the design system. Where it mentions "accent color per module",
"card colors", "event theme/color" or "subject color", apply the design-system rule instead: modules are identified
by icon only, and any user-selectable color is a fixed swatch from the 6 brand colors. The product name is
**Organizzou** (ignore the name finalists listed in the PRD).

---

## Product summary

One app that unifies: Dashboard, Tasks (Trello/ClickUp-style Kanban), Routine (habits), Calendar (Google
Calendar-style), Finance (with Open Finance), Workouts, Diet (MyFitnessPal-style), Studies, Notes & Reminders, and a
zero-knowledge Password Vault (NordPass-style). Everything can be created, edited and queried by talking to a Claude
assistant — in the app (floating button, text and voice) and on WhatsApp (text, audio, buttons), which also sends
reminders at the right time. There will also be a Manifest V3 browser extension. Differentiator: all of this in one
product, with conversation as a first-class input.

## Tech stack (decided)

- Next.js App Router, TypeScript strict, Tailwind v4, shadcn/ui (Radix, preset Nova) via the **shadcn MCP**,
  Lucide icons, `next-themes` (dark default), `date-fns` with `ptBR`, `react-hook-form` + `zod`.
- Supabase: Postgres, Auth, Storage, Realtime, RLS on **every** table; SQL migrations in `supabase/migrations/`.
- Vercel for hosting and Vercel Cron (or Supabase `pg_cron`) for scheduled jobs.
- Drag and drop: `@dnd-kit`. Charts: shadcn `chart` (Recharts) using only `chart-1…5`.
- AI: Anthropic API (official TypeScript SDK) from server routes only, with **tool use** to read/write records in
  every module except the Vault.
- WhatsApp: official WhatsApp Business Platform (Meta Cloud API), webhook on Vercel.
- Voice: speech-to-text on the server **before** sending text to Claude (provider to be confirmed with me).
- Open Finance: regulated aggregator, Pluggy or Belvo (to be confirmed with me).
- Vault crypto: WebCrypto in the browser, key derived from the master password (Argon2id via a WASM lib, or
  PBKDF2-SHA256 with ≥ 600k iterations as fallback), AES-256-GCM per item. The server only stores ciphertext.
- PWA: service worker (Serwist or equivalent for the App Router), web push, offline cache + sync queue.
- If a **Mobbin MCP** is available in this session, use it to look up reference screens (dashboards, kanban,
  calendar, habits, finance, fitness, study, vault) before designing each module; adapt them to our design system,
  never copy their colors.

## App structure and navigation

- Routes (pt-BR slugs): `/dashboard` (dashboard), `/dashboard/tarefas`, `/dashboard/rotina`, `/dashboard/agenda`, `/dashboard/financas`, `/dashboard/treinos`, `/dashboard/dieta`,
  `/dashboard/estudos`, `/dashboard/notas`, `/dashboard/cofre`, `/dashboard/metas`, `/dashboard/diario`, `/dashboard/configuracoes`, plus auth routes.
- Mobile: `BottomNav` with Hoje · Tarefas · **+** (quick capture) · Finanças · Mais (sheet with all modules).
  Desktop: collapsible shadcn `sidebar` with all modules, the logo, theme toggle and user menu.
- Global: `AssistantFab` (floating Claude button) on every screen, global search with `Ctrl/Cmd + K` (shadcn
  `command`), toasts via `sonner`, empty states via `EmptyState`.
- Every screen must handle loading (`skeleton`), empty, error and success states, in both themes, at 375 px and
  1280 px.

## Data model (first draft — refine and show me before migrating)

All tables have `id uuid`, `user_id uuid references auth.users`, `created_at`, `updated_at`, and RLS policies
`user_id = auth.uid()` for select/insert/update/delete.

- Core: `profiles` (name, timezone default `America/Sao_Paulo`, locale, theme, onboarding flags), `tags`,
  `attachments` (Supabase Storage paths), `audit_log` (actor: app/assistant/whatsapp, action, entity, payload,
  confirmed_at).
- Tasks: `boards`, `board_lists` (position), `tasks` (title, description, status/list, priority, due_at, category,
  swatch, position), `task_checklist_items`, `task_comments`, `task_tags`.
- Routine: `habits` (type fixed|goal, target qty/unit, schedule, deadline, paused), `habit_logs`.
- Calendar: `events` (start/end, all-day, description, category, swatch, RRULE recurrence, reminder offsets),
  plus a unified agenda view that also surfaces dated tasks, habits and study sessions.
- Finance: `accounts`, `categories` (with monthly limit), `transactions` (in/out, amount in cents, date, method,
  source manual|open_finance), `recurring_bills` (due day, amount, active), `budgets`, `financial_goals`,
  `open_finance_connections` (provider item id, status — no bank credentials ever stored).
- Workouts: `workout_plans`, `exercises`, `workout_plan_exercises`, `workout_sessions`, `set_logs` (reps, load);
  personal records derived.
- Diet: `foods` (shared catalog + user foods; kcal and macros per 100 g / portion), `meals`, `meal_items`,
  `diet_goals`, `water_logs`, `weight_logs`.
- Studies: `subjects` (type subject|course|book|exam, priority, swatch), `study_schedule_blocks`, `study_sessions`
  (Pomodoro/focus, duration), `study_goals`, `flashcard_decks`, `flashcards` (SM-2 spaced-repetition fields),
  `exams_deadlines`.
- Notes & reminders: `note_folders`, `notes` (rich text JSON, pinned, subject_id nullable), `reminders`
  (remind_at, channels push|whatsapp, status).
- Life goals & journal: `life_goals` (linked entities), `journal_entries` (mood 1–5, text), `sleep_logs`.
- Gamification: `streaks`, `achievements`, `user_levels`.
- WhatsApp: `whatsapp_links` (phone E.164, verified_at, opt_in_at, opt_out_at), `whatsapp_messages`,
  `notification_preferences` (per reminder type, allowed hours, do-not-disturb).
- Push: `push_subscriptions`.
- Vault (**isolated**, separate schema `vault`, never exposed to assistant code paths): `vault_folders`,
  `vault_items` (type login|card|document|secure_note, `ciphertext`, `iv`, `version`), `vault_keys` (salt, KDF
  params, encrypted verification blob). No plaintext ever leaves the browser.

## The Claude assistant (in-app and WhatsApp share one engine)

- One server-side "assistant engine" (`src/server/assistant/`) used by both the app chat and the WhatsApp webhook.
- Tools (zod-validated): create/update/complete/query for tasks, habits, events, transactions, bills, workouts,
  meals/water/weight, study sessions/flashcards, notes/reminders, goals, journal/mood/sleep; plus read-only summary
  tools ("quanto gastei este mês?", "o que tenho amanhã?", "como estão meus hábitos?").
- Rules: if intent or values are ambiguous, ask before saving; destructive/sensitive actions return a confirmation
  request first (buttons in the app and on WhatsApp); every executed action is written to `audit_log`; the engine has
  **no Vault tools and cannot query the `vault` schema** (enforced with a separate DB role/client and a test).
- Replies are short, calm pt-BR confirmations ("Gasto de R$ 45,00 registrado em Mercado.").
- Quick capture (text or voice) in the app sends the input to the engine, which classifies the destination module.
- Weekly review: a scheduled job generates a summary (habits, spending, workouts, study hours, overdue tasks) shown
  in the app and sent on WhatsApp.
- Flashcards/summaries: the engine can generate flashcards and summaries from the user's study notes.

## WhatsApp

- Webhook route verifies Meta's signature; only **verified, opted-in numbers** linked to a user are processed.
- Linking flow in Settings: user enters phone → receives a code on WhatsApp → confirms in the app; explicit opt-in
  and one-tap opt-out ("SAIR") at any time (LGPD and Meta policies).
- Audio messages: download media → speech-to-text → assistant engine → reply. Optional: receipt photos.
- Reminders at the right time (tasks, events, habits, bills due, workout time, meals, water, study sessions),
  morning summary, optional evening summary and weekly review, using approved message templates where Meta requires
  them. Quick replies on reminders: "feito", "adiar 1 hora", "cancelar". Respect allowed hours and do-not-disturb.

---

## Delivery phases (stop after each one for my validation)

**Phase 0 — Plan.** Read `CLAUDE.md`, `docs/PRD.md` and the design system. Propose: folder architecture, final
data model (ERD as a Mermaid diagram), route map, list of dependencies, env vars, and open questions. Wait for my OK.

**Phase 1 — Foundation.** Supabase project wiring (client/server helpers, middleware, typed client), migrations for
core + tasks tables with RLS, Auth (sign up, sign in, password recovery, persistent session; pt-BR copy) with
login/sign-up screens using the logo and design system, app shell (sidebar desktop + BottomNav mobile +
AssistantFab placeholder + Cmd/Ctrl+K search shell), settings with theme toggle. PWA manifest and icons from
`public/brand/`.

**Phase 2 — Dashboard ("Hoje") + Tasks.** Tasks: boards, customizable lists, cards with all fields, checklist,
comments, attachments, tags, priority, due date; drag and drop between lists; Kanban, List and Calendar views;
filters, search and sorting; swipe gestures on mobile. Dashboard: day overview with real data from the modules that
exist so far and placeholders for the others.

**Phase 3 — Assistant in the app.** Assistant engine with tool use for Tasks (then each new module adds its tools),
chat sheet from the floating button, quick capture by text and voice (browser recording → server STT),
confirmations and audit log.

**Phase 4 — Routine + Calendar.** Habits (fixed and goal-based, pause, consistency calendar, streaks, stats);
Calendar with month/week/day views, recurrence, reminders, and dated tasks/habits/study items in the agenda.

**Phase 5 — Finance.** Transactions, categories with limits, recurring bills and subscriptions with due alerts,
monthly budget, goals, charts (where I spend, monthly surplus, evolution). Open Finance comes in Phase 8.

**Phase 6 — Workouts + Diet + Water/Sleep + Journal & mood.** Workouts (plans, sets/reps/load, rest timer, progress
charts, PRs); Diet (kcal/macro goals, food search, meals duplicate/edit, daily totals, water, weight chart); sleep and
water quick log; daily mood check-in with correlation chart.

**Phase 7 — Studies + Notes & Reminders + Life goals + Gamification.** Subjects/courses/books/exams, weekly
schedule in the calendar, Pomodoro/focus timer with automatic hour logging, goals, charts and ranking, countdowns,
flashcards with spaced repetition and quiz, AI-generated flashcards/summaries; Notes with folders, tags, pinning,
search and a rich-text editor; reminders (push now, WhatsApp in Phase 9); life goals linked to other modules;
light gamification (streaks, achievements, level — no pressure).

**Phase 8 — Vault + Open Finance.** Zero-knowledge vault with master password, folders, item types, password
generator, weak/reused password alerts, encrypted-only export; Open Finance connection (Pluggy or Belvo) with
import and auto-categorization.

**Phase 9 — WhatsApp + push + scheduled jobs.** Number linking, webhook, text/audio/buttons, reminders and
summaries, weekly review, preferences and do-not-disturb, web push notifications.

**Phase 10 — PWA offline, export, browser extension, launch.** Offline mode with sync on reconnect, CSV/JSON export
and backup, home-screen widgets where the platform allows, Manifest V3 extension (login, quick capture, save page,
vault autofill), Vercel deployment and `docs/SETUP.md` (env vars, Supabase, Meta, providers).

## Definition of done for every phase

- Uses only design-system tokens and components; correct in dark **and** light, at 375 px and 1280 px.
- Loading, empty, error and success states; keyboard and screen-reader accessible; pt-BR copy.
- RLS policies + server-side zod validation for every new table/action; no secrets on the client.
- Lint, typecheck, build and tests pass. Short summary of what changed and how I can test it.

## Start now

Do **Phase 0 only**: read the documents, inspect the current project, and present the plan and your questions.
Do not write application code until I approve the plan.
