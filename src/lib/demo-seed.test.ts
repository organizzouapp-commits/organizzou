import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { buildDemo, DEMO_TABLES, demoId, type Refs } from "../../scripts/demo/content.ts"
import { checkSeedRequest, PRODUCTION_FLAG } from "../../scripts/demo/guard.ts"

/**
 * The demo seed puts rich data in ONE account and every other account starts empty. These tests prove the three promises that do not
 * need a database: the seed refuses every account but the allowlisted one, its content covers every module with stable ids (so
 * loading it twice cannot duplicate anything), and the sign-up provisioning writes defaults only. The same content is also loaded into
 * the real schema inside a rolled-back transaction when the migrations change (see docs/DATA-AUDIT.md).
 */
const refs: Refs = {
  userId: "00000000-0000-4000-8000-000000000000",
  categories: Object.fromEntries(["Moradia", "Mercado", "Restaurantes", "Transporte", "Saúde", "Lazer", "Assinaturas", "Educação", "Salário", "Renda extra", "Outros"].map((n) => [n, `cat-${n}`])),
  foods: new Proxy({}, { get: (_t, name) => `food-${String(name)}` }) as Record<string, string>,
  exercises: new Proxy({}, { get: (_t, name) => `ex-${String(name)}` }) as Record<string, string>,
}

describe("who may be seeded", () => {
  it("the test account is allowed, with no flags, outside production", () => {
    expect(checkSeedRequest({ email: "organizzouapp@gmail.com", env: {}, flags: [] })).toEqual({ ok: true, email: "organizzouapp@gmail.com" })
    expect(checkSeedRequest({ email: "  OrganizzouApp@Gmail.com ", env: {}, flags: [] }).ok).toBe(true)
  })

  it("Patrick's personal account is refused, always, even if someone adds it to the allowlist", () => {
    for (const env of [{}, { DEMO_SEED_ALLOWLIST: "patrick.toledo.barros@gmail.com" }, { DEMO_SEED_ALLOWLIST: "organizzouapp@gmail.com,patrick.toledo.barros@gmail.com" }]) {
      const decision = checkSeedRequest({ email: "patrick.toledo.barros@gmail.com", env, flags: [PRODUCTION_FLAG] })
      expect(decision.ok).toBe(false)
      expect(decision.ok === false && decision.message).toMatch(/conta pessoal/)
    }
    expect(checkSeedRequest({ email: "PATRICK.TOLEDO.BARROS@gmail.com", env: {}, flags: [] }).ok).toBe(false)
  })

  it("any e-mail outside the allowlist is refused", () => {
    for (const email of ["alguem@gmail.com", "organizzouapp@gmail.com.br", "admin@organizzou.app", ""]) expect(checkSeedRequest({ email, env: {}, flags: [] }).ok).toBe(false)
    expect(checkSeedRequest({ email: undefined, env: {}, flags: [] }).ok).toBe(false)
    // The allowlist can be widened on purpose, for a second test account.
    expect(checkSeedRequest({ email: "teste2@gmail.com", env: { DEMO_SEED_ALLOWLIST: "organizzouapp@gmail.com, teste2@gmail.com" }, flags: [] }).ok).toBe(true)
  })

  it("production needs the explicit flag", () => {
    for (const env of [{ NODE_ENV: "production" }, { VERCEL_ENV: "production" }, { APP_ENV: "production" }]) {
      expect(checkSeedRequest({ email: "organizzouapp@gmail.com", env, flags: [] }).ok).toBe(false)
      expect(checkSeedRequest({ email: "organizzouapp@gmail.com", env, flags: ["--reset"] }).ok).toBe(false)
      expect(checkSeedRequest({ email: "organizzouapp@gmail.com", env, flags: [PRODUCTION_FLAG] }).ok).toBe(true)
    }
  })
})

describe("the demo content", () => {
  const now = new Date("2026-11-04T15:00:00.000Z") // Wednesday, noon in São Paulo
  const demo = buildDemo(now, refs)
  const rowsOf = (table: string) => demo.find((d) => d.table === table)!.rows

  it("covers every module", () => {
    const modules: Record<string, string[]> = {
      tarefas: ["boards", "board_lists", "tasks", "tags", "task_tags", "task_checklist_items", "task_comments"],
      rotina: ["habits", "habit_logs"],
      agenda: ["events"],
      financas: ["finance_accounts", "finance_transactions", "finance_bills", "finance_goals"],
      treinos: ["workout_plans", "plan_exercises", "workout_sessions", "set_logs"],
      dieta: ["meal_items", "water_logs", "weight_logs"],
      estudos: ["subjects", "study_sessions", "study_deadlines", "flashcard_decks", "flashcards"],
      notas: ["note_folders", "notes", "reminders"],
      metas: ["life_goals", "life_goal_links", "life_goal_milestones"],
      diario: ["journal_entries"],
    }
    for (const [module, tables] of Object.entries(modules)) for (const table of tables) expect(rowsOf(table).length, `${module}: ${table}`).toBeGreaterThan(0)
    // Every table the demo writes is listed (so the reset can find every row).
    expect(demo.map((d) => d.table)).toEqual([...DEMO_TABLES])
  })

  it("has the old example content, as real rows", () => {
    const titles = (table: string, column: string) => rowsOf(table).map((r) => r[column])
    expect(titles("tasks", "title")).toContain("Enviar relatório semanal à Marina")
    expect(titles("habits", "name")).toEqual(expect.arrayContaining(["Beber 2,5 litros de água", "Ler 20 páginas", "Treinar", "Estudar inglês", "Meditar 10 minutos"]))
    expect(titles("events", "title")).toContain("Consulta com a Dra. Camila (dentista)")
    expect(titles("workout_plans", "name")).toContain("Treino A — Peito e tríceps")
    expect(titles("subjects", "name")).toContain("Direito Constitucional")
    expect(rowsOf("notes").filter((n) => n.pinned).length).toBeGreaterThanOrEqual(2)
    expect(rowsOf("reminders").length).toBeGreaterThanOrEqual(5)
    expect(titles("life_goals", "title")).toContain("Passar na 1ª fase da OAB")
  })

  it("looks alive: overdue, today (timed and untimed), done, and months of history", () => {
    const tasks = rowsOf("tasks")
    const dueMs = (t: (typeof tasks)[number]) => (t.due_at ? new Date(t.due_at as string).getTime() : null)
    expect(tasks.some((t) => dueMs(t) !== null && dueMs(t)! < now.getTime() && !t.completed_at)).toBe(true)
    expect(tasks.some((t) => t.due_has_time && String(t.due_at).startsWith("2026-11-04T09"))).toBe(true) // today, morning
    expect(tasks.some((t) => t.due_has_time && String(t.due_at).startsWith("2026-11-04T17"))).toBe(true) // today, afternoon
    expect(tasks.some((t) => t.due_at === null && !t.completed_at)).toBe(true) // untimed
    expect(tasks.some((t) => t.completed_at)).toBe(true)
    const span = (table: string, column: string) => new Set(rowsOf(table).map((r) => r[column])).size
    expect(span("habit_logs", "log_date")).toBeGreaterThanOrEqual(60)
    expect(span("workout_sessions", "performed_on")).toBeGreaterThanOrEqual(30)
    expect(span("journal_entries", "entry_date")).toBeGreaterThanOrEqual(50)
    expect(span("finance_transactions", "occurred_on")).toBeGreaterThanOrEqual(60)
    expect(span("weight_logs", "log_date")).toBeGreaterThanOrEqual(10)
    // Dates are relative to "now": the same content is later when run later.
    const later = buildDemo(new Date(now.getTime() + 3 * 86_400_000), refs)
    const weights = (d: typeof demo) => d.find((t) => t.table === "weight_logs")!.rows.map((r) => r.log_date as string).sort()
    expect(weights(later).at(-1)).toBe("2026-11-07")
    expect(weights(demo).at(-1)).toBe("2026-11-04")
  })

  it("is idempotent: same ids for the same day, and every id is a version-5 uuid the reset can recognize", () => {
    const again = buildDemo(now, refs)
    const key = (d: typeof demo) => d.map((t) => `${t.table}:${t.rows.map((r) => r.id).join(",")}`)
    expect(key(again)).toEqual(key(demo))
    const ids = demo.flatMap((t) => t.rows.map((r) => r.id as string))
    expect(new Set(ids).size).toBe(ids.length)
    // Real rows are random v4 uuids. v5 is only ever the demo, so "remove what the demo made" can be found even when a later run
    // (another day, a different set of rows) wrote different ids.
    expect(ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))).toBe(true)
    expect(crypto.randomUUID()).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5/)
    // Another day: the ids of the stable rows (everything but the calendar-shaped ones) are the same, and nothing collides.
    const later = buildDemo(new Date("2027-02-10T15:00:00.000Z"), refs)
    const stable = ["tags", "boards", "board_lists", "tasks", "habits", "events", "finance_accounts", "finance_bills", "finance_goals", "workout_plans", "plan_exercises", "subjects", "study_deadlines", "flashcards", "notes", "reminders", "life_goals"]
    for (const table of stable) expect(later.find((t) => t.table === table)!.rows.map((r) => r.id)).toEqual(demo.find((t) => t.table === table)!.rows.map((r) => r.id))
    const laterIds = later.flatMap((t) => t.rows.map((r) => r.id as string))
    expect(new Set(laterIds).size).toBe(laterIds.length)
    expect(demoId("tasks", "work:report")).toBe(demoId("tasks", "work:report"))
    expect(demoId("tasks", "work:report")).not.toBe(demoId("habits", "work:report"))
  })

  it("every reference points to a row the demo (or the account's defaults) provides", () => {
    const ids = new Set(demo.flatMap((t) => t.rows.map((r) => r.id as string)))
    const defaults = new Set([...Object.values(refs.categories), "food-", "ex-"])
    const parents: Record<string, string> = { board_id: "boards", list_id: "board_lists", task_id: "tasks", tag_id: "tags", habit_id: "habits", account_id: "finance_accounts", plan_id: "workout_plans", session_id: "workout_sessions", subject_id: "subjects", deck_id: "flashcard_decks", folder_id: "note_folders", goal_id: "life_goals" }
    for (const { table, rows } of demo) {
      for (const row of rows) {
        for (const [column, parent] of Object.entries(parents)) {
          const value = row[column]
          if (value === undefined || value === null) continue
          expect(ids.has(value as string), `${table}.${column} -> ${parent}`).toBe(true)
        }
        for (const column of ["category_id", "food_id", "exercise_id"]) {
          const value = row[column]
          if (value === undefined || value === null) continue
          expect([...defaults].some((d) => String(value).startsWith(String(d).slice(0, 3))), `${table}.${column}`).toBe(true)
        }
      }
    }
  })
})

describe("every other account starts empty", () => {
  const dir = join(process.cwd(), "supabase", "migrations")
  const provisioning = readFileSync(join(dir, readdirSync(dir).find((f) => f.includes("provisioning"))!), "utf8")
  const body = provisioning.slice(provisioning.indexOf("function public.provision_user"), provisioning.indexOf("revoke execute on function public.provision_user"))

  it("provisioning only inserts defaults: profile, board and lists, categories, one account, goals, preferences, stats", () => {
    const targets = [...body.matchAll(/insert into public\.(\w+)/g)].map((m) => m[1])
    expect(new Set(targets)).toEqual(new Set(["profiles", "boards", "board_lists", "finance_categories", "finance_accounts", "diet_goals", "notification_preferences", "user_stats"]))
  })

  it("never creates content (tasks, habits, events, transactions, workouts, meals, notes, goals...)", () => {
    for (const table of ["tasks", "habits", "habit_logs", "events", "finance_transactions", "finance_bills", "workout_plans", "workout_sessions", "set_logs", "meal_items", "water_logs", "weight_logs", "notes", "reminders", "life_goals", "journal_entries", "subjects", "flashcards"]) {
      expect(body, table).not.toMatch(new RegExp(`insert into public\\.${table}\\b`))
    }
  })

  it("the app ships no example data: nothing imports fixtures and no mocks folder exists", () => {
    expect(() => readdirSync(join(process.cwd(), "src", "mocks"))).toThrow()
    const walk = (path: string): string[] => readdirSync(path, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(path, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [join(path, e.name)] : []))
    for (const file of walk(join(process.cwd(), "src"))) {
      const source = readFileSync(file, "utf8")
      expect(source, file).not.toMatch(/from\s+["'][^"']*\/mocks\//)
      expect(source, file).not.toMatch(/\b(buildMock\w+|mock[A-Z]\w+)\b/)
    }
  })
})
