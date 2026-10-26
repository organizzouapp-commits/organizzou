# Organizzou — project rules for Claude Code

Organizzou is a mobile-first, installable (PWA) personal "Life OS" web app for Brazilian users: Dashboard, Tasks,
Routine, Calendar, Finance, Workouts, Diet, Studies, Notes & Reminders and a Password Vault, all controllable by
conversation with a built-in Claude assistant — in the app and on WhatsApp (text and voice).

Read these before any UI or product work:
- `docs/PRD.md` — full product requirements (Portuguese, original spec)
- `docs/design-system/DESIGN-SYSTEM.md` — visual source of truth (v2, "clean")
- `docs/design-system/organizzou-tokens.css` — theme tokens (already merged into `src/app/globals.css`)

## Language
- All UI copy, dates, numbers and currency in **Brazilian Portuguese** (`pt-BR`, `R$ 1.234,56`, `date-fns` `ptBR`).
- Code, identifiers, commits and code comments in **English**.

## Design system — non-negotiable
1. **Only 6 colors exist**: Lima `#DBFD00`, Lima verso `#8FA800`, Tinta `#0C0E07`, Tinta verso `#4B5A00`,
   Grafite `#1A1D12`, Papel `#F6F7F0`, plus their transparencies. Use them **only through the theme tokens**
   (`bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `bg-primary`, `bg-highlight`,
   `border-border`, `ring-ring`, `chart-1…5`, `brand`, …).
2. **Never** use Tailwind palette colors (`red-*`, `green-*`, `gray-*`, `zinc-*`, `slate-*`, `blue-*`…), raw hex,
   `rgb()`/`hsl()` literals, or inline color styles in components. No red/green status colors.
3. Modules have **no color of their own** — they are identified by their Lucide icon (see DESIGN-SYSTEM §7).
   Any user-chosen "color" (task cards, labels, calendar events, study subjects) must pick from a fixed swatch
   set built from the 6 colors (e.g. Lima, Lima verso, Tinta verso, Papel/Grafite, neutral) — never a free picker.
4. Lima is the only accent (≈5–10% of a screen): primary action in dark mode, active item, progress, checks, focus.
   **Never use Lima as text or thin lines on a light (Papel) background.** In light mode, primary = Tinta.
5. Errors/destructive actions: icon + text + confirmation dialog. Never rely on color alone.
6. Dark mode is the default (`next-themes`, `defaultTheme="dark"`); light mode must be complete.
7. Clean layout: generous spacing, hairline dividers, lists before cards, no shadows in dark mode, radii 12/16/20 px,
   44 px minimum touch targets, Geist font, `tabular-nums` for numbers, Lucide icons (stroke 1.75).
8. Build new UI from **shadcn/ui components (via the shadcn MCP)** and the shared components in
   `src/components/organizzou/`. Don't create one-off styled duplicates.
9. If a requirement seems to need something outside the design system, **stop and ask**.

## Engineering conventions
- Next.js App Router + TypeScript `strict`. Server Components by default; Server Actions / Route Handlers for writes.
- Supabase via `@supabase/ssr`. **Row Level Security on every table**, scoped to `auth.uid()`. Migrations in
  `supabase/migrations/` (never edit the DB by hand). Generate types into `src/lib/supabase/types.ts`.
- Validate every input on the server with `zod`. Forms: `react-hook-form` + `zod`.
- Secrets (Anthropic, WhatsApp, speech-to-text, Open Finance, Supabase service role) **only on the server**,
  read from environment variables; keep `.env.example` up to date. Never expose them with `NEXT_PUBLIC_`.
- The Claude assistant (app and WhatsApp) must **never** read, write or receive Vault data. Enforce this in code
  (separate tables/schema, no assistant tools for it, server-side guard), not just in the prompt.
- Destructive or sensitive assistant actions require explicit user confirmation. Log every assistant/WhatsApp action
  in an audit table.
- Model name for the Claude API comes from an env var (`ANTHROPIC_MODEL`); don't hard-code it.
- Quality gate before saying a step is done: `npm run lint`, `npm run typecheck`, `npm run build`, and tests
  (Vitest for logic, Playwright for key flows) all pass.
- Small, focused commits with clear English messages.

## Working agreement
- Work in the phases defined in `docs/PROMPT-BUILD-APP.md`. At the end of each phase, stop, summarize what was
  built, how to test it, and wait for my approval before starting the next one.
- Ask before important decisions (new dependencies with lock-in, paid services, schema changes that affect other
  modules, anything security-related).
