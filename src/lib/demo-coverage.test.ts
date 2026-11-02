import { describe, expect, it } from "vitest"

import { buildDemo, type Refs } from "../../scripts/demo/content.ts"

/**
 * One example of every state a screen can show (docs/DEMO-COVERAGE.md lists them all). These are the data-level checks; the
 * screenshots in docs/demo-screenshots/ show the same states on screen.
 */
const CATEGORIES = ["Moradia", "Mercado", "Restaurantes", "Transporte", "Saúde", "Lazer", "Assinaturas", "Educação", "Salário", "Renda extra", "Outros"]
const refs: Refs = {
  userId: "00000000-0000-4000-8000-000000000000",
  categories: Object.fromEntries(CATEGORIES.map((n) => [n, `cat-${n}`])),
  foods: new Proxy({}, { get: (_t, name) => `food-${String(name)}` }) as Record<string, string>,
  exercises: new Proxy({}, { get: (_t, name) => `ex-${String(name)}` }) as Record<string, string>,
}

const now = new Date("2026-11-10T15:00:00.000Z") // Tuesday, noon in São Paulo, day 10 of the month
const TODAY = "2026-11-10"
const demo = buildDemo(now, refs)
const rows = (table: string) => demo.find((d) => d.table === table)!.rows

describe("the demo covers every visible state", () => {
  it("tasks: overdue, today, priorities, checklist, comments, attachments, labels, done, three- and four-list boards, untimed", () => {
    const tasks = rows("tasks")
    const dueMs = (t: (typeof tasks)[number]) => (t.due_at ? new Date(t.due_at as string).getTime() : null)
    const some = (pick: (t: (typeof tasks)[number]) => boolean) => tasks.filter(pick).length
    expect(some((t) => dueMs(t) !== null && dueMs(t)! < now.getTime() && !t.completed_at)).toBeGreaterThanOrEqual(2)
    expect(some((t) => String(t.due_at).startsWith(TODAY) && Boolean(t.due_has_time))).toBeGreaterThanOrEqual(2)
    expect(some((t) => t.priority === "high")).toBeGreaterThanOrEqual(3)
    expect(some((t) => t.priority === "medium") + some((t) => t.priority === "low")).toBeGreaterThanOrEqual(4)
    expect(some((t) => Boolean(t.completed_at))).toBeGreaterThanOrEqual(3)
    expect(some((t) => !t.due_at && !t.completed_at)).toBeGreaterThanOrEqual(2)
    expect(tasks.length).toBeGreaterThanOrEqual(15)
    expect(rows("task_checklist_items").some((c) => c.done) && rows("task_checklist_items").some((c) => !c.done)).toBe(true)
    expect(rows("task_comments").length).toBeGreaterThanOrEqual(3)
    expect(rows("attachments").length).toBeGreaterThanOrEqual(3)
    expect(rows("tags").length).toBeGreaterThanOrEqual(5)
    expect(rows("task_tags").length).toBeGreaterThanOrEqual(10)
    const listsPerBoard = new Map<string, number>()
    for (const l of rows("board_lists")) listsPerBoard.set(l.board_id as string, (listsPerBoard.get(l.board_id as string) ?? 0) + 1)
    expect([...listsPerBoard.values()]).toEqual(expect.arrayContaining([3, 4]))
    for (const a of rows("attachments")) expect(String(a.storage_path)).toContain(refs.userId)
  })

  it("habits: fixed done and pending, quantity partial and complete, paused, a 40-day streak, 60+ days of history", () => {
    const habits = rows("habits")
    const logs = rows("habit_logs")
    const logOf = (name: string) => logs.find((l) => l.habit_id === habits.find((h) => h.name === name)!.id && l.log_date === TODAY)
    expect(logOf("Meditar 10 minutos")?.qty).toBe(1)
    expect(logOf("Tomar vitamina D")).toBeUndefined()
    expect(Number(logOf("Beber 2,5 litros de água")?.qty)).toBeGreaterThan(0)
    expect(Number(logOf("Beber 2,5 litros de água")?.qty)).toBeLessThan(2.5)
    expect(logOf("Ler 20 páginas")?.qty).toBe(20)
    expect(habits.some((h) => h.paused)).toBe(true)
    const vitamin = habits.find((h) => h.name === "Tomar vitamina D")!
    expect(logs.filter((l) => l.habit_id === vitamin.id).length).toBeGreaterThanOrEqual(40)
    expect(new Set(logs.map((l) => l.log_date)).size).toBeGreaterThanOrEqual(60)
  })

  it("agenda: all-day, timed, recurring, two reminders, one happening now, spread over the month", () => {
    const events = rows("events")
    expect(events.some((e) => e.all_day) && events.some((e) => !e.all_day) && events.some((e) => e.rrule)).toBe(true)
    expect(events.some((e) => (e.reminder_offsets as number[]).length >= 2)).toBe(true)
    expect(events.filter((e) => !e.rrule).length).toBeGreaterThanOrEqual(6)
    expect(events.some((e) => new Date(e.starts_at as string) <= now && new Date(e.ends_at as string) >= now)).toBe(true)
    expect(new Set(events.filter((e) => !e.rrule).map((e) => String(e.starts_at).slice(0, 10))).size).toBeGreaterThanOrEqual(8)
  })

  it("finance: every category used, bills in every state, spending this month, goals in progress and reached", () => {
    const tx = rows("finance_transactions")
    expect(tx.length).toBeGreaterThanOrEqual(25)
    expect(tx.some((t) => t.kind === "in") && tx.some((t) => t.kind === "out")).toBe(true)
    const used = new Set(tx.map((t) => t.category_id))
    for (const name of CATEGORIES) expect(used.has(refs.categories[name]), `category ${name} has a transaction`).toBe(true)
    const thisMonth = TODAY.slice(0, 7)
    const state = (b: ReturnType<typeof rows>[number]) => (b.last_paid_month === thisMonth ? "paid" : Number(b.due_day) < 10 ? "overdue" : Number(b.due_day) === 10 ? "today" : "upcoming")
    expect(new Set(rows("finance_bills").map(state))).toEqual(new Set(["paid", "overdue", "today", "upcoming"]))
    const spendingThisMonth = tx.filter((t) => t.kind === "out" && String(t.occurred_on).startsWith(thisMonth))
    expect(new Set(spendingThisMonth.map((t) => t.category_id)).size).toBeGreaterThanOrEqual(3)
    const goals = rows("finance_goals")
    expect(goals.some((g) => Number(g.current_cents) > 0 && Number(g.current_cents) < Number(g.target_cents))).toBe(true)
    expect(goals.some((g) => Number(g.current_cents) >= Number(g.target_cents))).toBe(true)
    expect(rows("finance_accounts").length).toBeGreaterThanOrEqual(3)
  })

  it("training, diet and study: many exercises, progressing history, every meal, water and weight history, every subject type", () => {
    expect(rows("workout_plans").length).toBeGreaterThanOrEqual(3)
    expect(rows("plan_exercises").length).toBeGreaterThanOrEqual(12)
    expect(rows("workout_sessions").length).toBeGreaterThanOrEqual(30)
    const loads = rows("set_logs").map((s) => Number(s.load_kg))
    expect(Math.max(...loads)).toBeGreaterThan(Math.min(...loads))
    expect(new Set(rows("meal_items").filter((m) => m.log_date === TODAY).map((m) => m.meal))).toEqual(new Set(["breakfast", "lunch", "snack", "dinner"]))
    expect(new Set(rows("water_logs").map((w) => w.log_date)).size).toBeGreaterThanOrEqual(10)
    expect(rows("weight_logs").length).toBeGreaterThanOrEqual(10)
    expect(new Set(rows("subjects").map((s) => s.type))).toEqual(new Set(["subject", "course", "book", "exam"]))
    expect(rows("study_deadlines").some((d) => d.kind === "exam") && rows("study_deadlines").some((d) => d.kind === "delivery")).toBe(true)
    expect(rows("flashcards").some((c) => (c.due_on as string) <= TODAY) && rows("flashcards").some((c) => (c.due_on as string) > TODAY)).toBe(true)
  })

  it("notes, reminders, goals, journal and the bell: every state", () => {
    const notes = rows("notes")
    expect(notes.length).toBeGreaterThanOrEqual(8)
    expect(notes.some((n) => n.pinned) && notes.some((n) => !n.pinned)).toBe(true)
    expect(notes.some((n) => n.folder_id) && notes.some((n) => !n.folder_id)).toBe(true)
    expect(notes.some((n) => (n.tags as string[]).length > 0)).toBe(true)
    const reminders = rows("reminders")
    expect(reminders.some((r) => r.status === "done")).toBe(true)
    expect(reminders.some((r) => r.status === "pending" && new Date(r.remind_at as string) < now)).toBe(true)
    expect(reminders.some((r) => String(r.remind_at).startsWith(TODAY))).toBe(true)
    expect(reminders.some((r) => String(r.remind_at) > "2026-11-11")).toBe(true)
    const goals = rows("life_goals")
    expect(goals.some((g) => g.status === "active") && goals.some((g) => g.status === "done")).toBe(true)
    expect(rows("life_goal_milestones").some((m) => m.done) && rows("life_goal_milestones").some((m) => !m.done)).toBe(true)
    expect(new Set(rows("journal_entries").map((j) => j.mood))).toEqual(new Set([1, 2, 3, 4, 5]))
    expect(rows("journal_entries").some((j) => Number(j.sleep_hours) > 0)).toBe(true)
    const bell = rows("notifications")
    expect(bell.some((n) => n.read_at === null) && bell.some((n) => n.read_at !== null)).toBe(true)
    expect(bell.length).toBeGreaterThanOrEqual(8)
    expect(new Set(bell.map((n) => n.kind)).size).toBeGreaterThanOrEqual(7)
    expect(bell.every((n) => n.link === null || String(n.link).startsWith("/dashboard"))).toBe(true)
  })
})
