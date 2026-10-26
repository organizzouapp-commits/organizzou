# Clickable prototype

Every module has a working screen on static example data. No database, no new migrations.
Interactions (checks, drag and drop, tabs, dialogs, timers, the assistant) live in memory and reset on reload.

## How it is wired

- `src/mocks/config.ts` exports `isMock`. It is only read in code; nothing in the UI says "prototype".
- `src/mocks/<module>.ts` holds the example data (pt-BR names, R$ values, dates relative to "today").
- `src/features/<module>/types.ts` holds the types, shaped like the planned Supabase tables
  (`docs/PLAN-PHASE-0.md` §4.1). The pure logic next to them (`stats.ts`, `recurrence.ts`, ...) is tested with Vitest and is reused as is later.
- Screens (`src/components/<module>/*-screen.tsx`) receive `nowIso` and build their data from the mocks.
  Replacing a mock with Supabase means swapping that one data source; the screen does not change.
- Tasks use an adapter: `BoardApi` (`src/features/tasks/board-api.ts`) has two implementations,
  Supabase server actions (`server-api.ts`) and an in-memory one (`src/mocks/tasks-api.ts`).
  With `isMock = false` the Tasks and Hoje routes fall back to the real Phase 2 code.

## Running it

```
npm run dev                      # sign in with your account, then open the pages below
```

Screenshots and automated checks do not need an account. Use the dev-only bypass (ignored in production builds):

```
PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100
node tests/e2e/prototype.mjs     # all screens in both themes and sizes, tasks, assistant, search
```

## Pages

`/hoje` · `/tarefas` (Kanban, Lista, Calendário) · `/rotina` · `/agenda` (Mês, Semana, Dia) · `/financas` ·
`/treinos` · `/dieta` · `/estudos` · `/notas` · `/cofre` · `/metas` · `/diario` · `/configuracoes`

The assistant opens from the floating button, `Ctrl/Cmd + K` searches every module, and the "+" in the mobile bar opens quick capture.
