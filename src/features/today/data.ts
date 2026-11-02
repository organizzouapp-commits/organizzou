import "server-only"

import { cache } from "react"

import { expandEvent } from "@/features/calendar/recurrence"
import type { EventRow } from "@/features/calendar/types"
import { dayTotals } from "@/features/diet/stats"
import type { DietGoalRow, FoodRow, MealItemRow, WeightLogRow } from "@/features/diet/types"
import { billStatus, monthOf, spendByCategory, totals } from "@/features/finance/stats"
import type { CategoryRow, RecurringBillRow, TransactionRow } from "@/features/finance/types"
import { currentStreak, isDone, isScheduled, shiftDay } from "@/features/habits/stats"
import type { HabitLogRow, HabitRow } from "@/features/habits/types"
import { MOOD_LABELS, type JournalEntryRow, type Mood } from "@/features/journal/types"
import type { NoteRow, ReminderRow } from "@/features/notes/types"
import { loadTodaySource } from "@/features/persist/load"
import { daysUntil, isDue } from "@/features/studies/spaced-repetition"
import type { DeadlineRow, FlashcardRow, StudySessionRow, SubjectRow } from "@/features/studies/types"
import { getTodayData } from "@/features/tasks/today"
import type { WorkoutPlanRow, WorkoutSessionRow } from "@/features/workouts/types"
import { dayDiff, isOverdue } from "@/lib/dates"
import { formatBRL } from "@/lib/money"
import { at, dayOf, SP_TIMEZONE } from "@/lib/sp-time"

import type { StatId } from "./catalog"
import type { DayData, DayItem, DietData, FinanceData, NotesData, StatData, StudyData, WorkoutData } from "./types"

/**
 * Data for the "Hoje" widgets. Each widget calls ONE function here and streams on its own (own Suspense boundary); all of them
 * read the same `source` of the request, so the page asks the database once.
 * The source is the person's own rows (src/features/persist/load.ts), and a module with nothing in it answers "empty".
 * All "today" boundaries use the São Paulo day.
 */

// ---------------------------------------------------------------------------------------------------------------------
// The source: one shape, filled from the database.

type SrcTask = { id: string; title: string; due_at: string | null; due_has_time: boolean; completed_at: string | null; priority: string; boardName: string; boardId: string }

/** What a workout / study plan puts on one day: a slot with an hour (examples) or a plain day (real plans have no hour). */
type Planned = { id: string; title: string; detail: string; start?: string; end?: string }

type Source = {
  tasks: SrcTask[]
  events: EventRow[]
  habits: HabitRow[]
  logs: HabitLogRow[]
  transactions: TransactionRow[]
  bills: RecurringBillRow[]
  categories: CategoryRow[]
  foods: FoodRow[]
  mealItems: MealItemRow[]
  goal: Pick<DietGoalRow, "kcal" | "water_ml">
  waterMl: number
  weights: WeightLogRow[]
  workoutSessions: WorkoutSessionRow[]
  workoutOn: (day: string) => Planned[]
  studyOn: (day: string) => Planned[]
  studySessions: StudySessionRow[]
  subjects: SubjectRow[]
  deadlines: DeadlineRow[]
  cards: FlashcardRow[]
  reminders: ReminderRow[]
  notes: NoteRow[]
  journal: JournalEntryRow[]
}

const DEFAULT_GOAL = { kcal: 2000, water_ml: 2500 }
const weekdayOf = (day: string) => new Date(`${day}T12:00:00`).getDay()

async function realSource(nowIso: string): Promise<Source> {
  const [data, db] = await Promise.all([getTodayData(), loadTodaySource(nowIso)])
  return {
    tasks: data.all.map((t) => ({ id: t.id, title: t.title, due_at: t.due_at, due_has_time: t.due_has_time, completed_at: t.completed_at, priority: t.priority, boardName: t.boardName, boardId: t.boardId })),
    events: db.events,
    habits: db.habits,
    logs: db.logs,
    transactions: db.transactions,
    bills: db.bills,
    categories: db.categories,
    foods: db.foods,
    mealItems: db.mealItems,
    goal: db.goal ?? DEFAULT_GOAL,
    waterMl: db.waterMl,
    weights: db.weights,
    workoutSessions: db.sessions,
    // A real plan names weekdays, not hours: it lands on the day without a time.
    workoutOn: (day) => db.plans.filter((p) => p.weekdays.includes(weekdayOf(day))).map((p: WorkoutPlanRow) => ({ id: `${p.id}:${day}`, title: p.name, detail: "Plano de treino" })),
    studyOn: () => [],
    studySessions: db.studySessions,
    subjects: db.subjects,
    deadlines: db.deadlines,
    cards: db.cards,
    reminders: db.reminders,
    notes: db.notes,
    journal: db.journal,
  }
}

const getSource = cache((nowIso: string): Promise<Source> => realSource(nowIso))

// ---------------------------------------------------------------------------------------------------------------------
// One model per request and per `nowIso`, shared by every widget that asks for it.

const model = cache(async (nowIso: string) => {
  const src = await getSource(nowIso)
  const now = new Date(nowIso)
  const today = dayOf(nowIso)
  const tz = SP_TIMEZONE

  const allTasks = src.tasks
  const open = allTasks.filter((t) => !t.completed_at)
  const overdue = open.filter((t) => isOverdue(t, now, tz))
  const dueToday = open.filter((t) => t.due_at && dayDiff(t.due_at, now, tz) === 0 && !overdue.includes(t))
  const focus = [...overdue, ...dueToday]
  const doneBefore = allTasks.filter((t) => t.completed_at && dayDiff(t.completed_at, now, tz) === 0).length

  const from = new Date(at(nowIso, 0, "00:00"))
  const to = new Date(at(nowIso, 1, "00:00"))
  const todaysEvents = src.events.flatMap((e) => expandEvent(e, from, to, tz))
  const week = src.events.flatMap((e) => expandEvent(e, now, new Date(at(nowIso, 7, "00:00")), tz)).sort((a, b) => a.start.getTime() - b.start.getTime())

  const todaysHabits = src.habits.filter((h) => !h.paused && isScheduled(h, today))

  const month = monthOf(today)
  const bills = src.bills.map((b) => billStatus(b, today))

  const dow = weekdayOf(today)
  const weekStart = shiftDay(today, -((dow + 6) % 7))
  const weekDays = Array.from({ length: 7 }, (_, i) => shiftDay(weekStart, i))

  return { src, now, today, tz, allTasks, open, overdue, dueToday, focus, doneBefore, from, to, todaysEvents, week, logs: src.logs, todaysHabits, transactions: src.transactions, month, bills, weekStart, weekDays }
})

const hoursText = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`
const kg = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`
const liters = (ml: number) => `${(ml / 1000).toLocaleString("pt-BR")} L`
const clock = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: SP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))

// ---------------------------------------------------------------------------------------------------------------------
// Stats

export async function getStat(id: StatId, nowIso: string): Promise<StatData> {
  const m = await model(nowIso)
  const src = m.src

  switch (id) {
    case "tarefas-hoje": {
      const planned = m.focus.length + m.doneBefore
      return {
        id,
        state: planned === 0 ? "empty" : "ok",
        value: String(m.focus.length),
        support: planned === 0 ? "Nenhuma tarefa para hoje" : `${m.doneBefore} de ${planned} concluídas`,
        // A total of 0 never produces a bar, so "0 tasks" can never read as 100%.
        progress: planned === 0 ? undefined : Math.round((m.doneBefore / planned) * 100),
        href: "/dashboard/tarefas",
        live: { kind: "tasks", pendingIds: m.focus.map((t) => t.id), planned, doneBefore: m.doneBefore },
      }
    }
    case "habitos-hoje": {
      const done = m.todaysHabits.filter((h) => isDone(h, m.logs, m.today))
      const total = m.todaysHabits.length
      return {
        id,
        state: total === 0 ? "empty" : "ok",
        value: total === 0 ? "0" : `${done.length}/${total}`,
        support: total === 0 ? "Nenhum hábito para hoje" : "em dia hoje",
        progress: total === 0 ? undefined : Math.round((done.length / total) * 100),
        href: "/dashboard/rotina",
        live: { kind: "habits", total, doneIds: done.map((h) => h.id), scheduledIds: m.todaysHabits.map((h) => h.id) },
      }
    }
    case "gasto-hoje": {
      const out = (day: string) => m.transactions.filter((t) => t.kind === "out" && t.occurred_on === day).reduce((s, t) => s + t.amount_cents, 0)
      const today = out(m.today)
      const yesterday = out(shiftDay(m.today, -1))
      const diff = today - yesterday
      return {
        id,
        state: m.transactions.length === 0 ? "empty" : "ok",
        value: formatBRL(today),
        support: m.transactions.length === 0 ? "Nenhum lançamento ainda" : diff === 0 ? "igual a ontem" : `${diff > 0 ? "+" : "−"}${formatBRL(Math.abs(diff))} vs ontem`,
        trend: diff === 0 || m.transactions.length === 0 ? undefined : diff > 0 ? "up" : "down",
        href: "/dashboard/financas",
      }
    }
    case "sobra-mes": {
      const t = totals(m.transactions, m.month)
      if (t.income === 0 && t.expense === 0) return { id, state: "empty", value: "—", support: "Nenhum lançamento neste mês", href: "/dashboard/financas" }
      return { id, state: "ok", value: formatBRL(t.surplus), support: `Entradas ${formatBRL(t.income)} · saídas ${formatBRL(t.expense)}`, trend: t.surplus >= 0 ? "up" : "down", href: "/dashboard/financas" }
    }
    case "proxima-conta": {
      const next = m.bills.filter((b) => b.status !== "paid").sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0]
      if (!next) return { id, state: "empty", value: "—", support: "Nenhuma conta a vencer", href: "/dashboard/financas" }
      const days = next.daysLeft
      return {
        id,
        state: "ok",
        value: days < 0 ? "Vencida" : days === 0 ? "Hoje" : days === 1 ? "1 dia" : `${days} dias`,
        support: `${next.bill.name} · ${formatBRL(next.bill.amount_cents)}`,
        href: "/dashboard/financas",
      }
    }
    case "agua": {
      const ml = src.waterMl
      return {
        id,
        state: "ok",
        value: liters(ml),
        support: `meta ${liters(src.goal.water_ml)}`,
        progress: Math.min(100, Math.round((ml / src.goal.water_ml) * 100)),
        href: "/dashboard/dieta",
        live: { kind: "water", ml, goalMl: src.goal.water_ml },
      }
    }
    case "calorias": {
      const kcal = Math.round(dayTotals(src.mealItems, src.foods).kcal)
      return { id, state: src.mealItems.length === 0 ? "empty" : "ok", value: kcal.toLocaleString("pt-BR"), support: src.mealItems.length === 0 ? `meta ${src.goal.kcal.toLocaleString("pt-BR")} kcal · nada registrado` : `de ${src.goal.kcal.toLocaleString("pt-BR")} kcal`, progress: src.mealItems.length === 0 ? undefined : Math.min(100, Math.round((kcal / src.goal.kcal) * 100)), href: "/dashboard/dieta" }
    }
    case "peso": {
      const weights = [...src.weights].sort((a, b) => a.log_date.localeCompare(b.log_date))
      const last = weights.at(-1)
      if (!last) return { id, state: "empty", value: "—", support: "Sem registro de peso", href: "/dashboard/dieta" }
      const first = weights.find((w) => w.log_date >= shiftDay(last.log_date, -30)) ?? weights[0]
      const diff = Math.round((last.weight_kg - first.weight_kg) * 10) / 10
      return { id, state: "ok", value: kg(last.weight_kg), support: diff === 0 ? "estável em 30 dias" : `${diff > 0 ? "+" : "−"}${kg(Math.abs(diff))} em 30 dias`, trend: diff === 0 ? undefined : diff > 0 ? "up" : "down", href: "/dashboard/dieta" }
    }
    case "treino-semana": {
      const done = src.workoutSessions.filter((s) => s.completed && s.performed_on >= m.weekStart && s.performed_on <= m.today).length
      const planned = m.weekDays.reduce((sum, day) => sum + src.workoutOn(day).length, 0)
      return { id, state: planned === 0 ? "empty" : "ok", value: String(done), support: planned === 0 ? "Sem treino no plano" : `de ${planned} no plano da semana`, progress: planned === 0 ? undefined : Math.min(100, Math.round((done / planned) * 100)), href: "/dashboard/treinos" }
    }
    case "estudo-semana": {
      const minutes = src.studySessions.filter((s) => s.studied_on >= m.weekStart && s.studied_on <= m.today).reduce((s, x) => s + x.minutes, 0)
      const goal = src.subjects.reduce((s, x) => s + x.weekly_goal_min, 0)
      return { id, state: goal === 0 && minutes === 0 ? "empty" : "ok", value: hoursText(minutes), support: goal === 0 ? "sem meta definida" : `meta ${hoursText(goal)}`, progress: goal === 0 ? undefined : Math.min(100, Math.round((minutes / goal) * 100)), href: "/dashboard/estudos" }
    }
    case "proxima-prova": {
      const exam = src.deadlines
        .filter((d) => d.kind === "exam" && d.due_on >= m.today)
        .sort((a, b) => a.due_on.localeCompare(b.due_on))[0]
      if (!exam) return { id, state: "empty", value: "—", support: "Nenhuma prova marcada", href: "/dashboard/estudos" }
      const days = daysUntil(exam.due_on, m.today)
      return { id, state: "ok", value: days === 0 ? "Hoje" : days === 1 ? "1 dia" : `${days} dias`, support: exam.title, href: "/dashboard/estudos" }
    }
    case "proximo-evento": {
      const next = m.week.find((e) => !e.allDay && e.start.getTime() >= m.now.getTime()) ?? m.week[0]
      if (!next) return { id, state: "empty", value: "—", support: "Nada na agenda nos próximos 7 dias", href: "/dashboard/agenda" }
      const day = dayDiff(next.start.toISOString(), m.now, m.tz)
      return { id, state: "ok", value: next.allDay ? "Dia todo" : clock(next.start.toISOString()), support: `${day === 0 ? "Hoje" : day === 1 ? "Amanhã" : `Em ${day} dias`} · ${next.title}`, href: "/dashboard/agenda" }
    }
    case "proximo-lembrete": {
      const next = src.reminders
        .filter((r) => r.status === "pending" && new Date(r.remind_at) >= m.now)
        .sort((a, b) => a.remind_at.localeCompare(b.remind_at))[0]
      if (!next) return { id, state: "empty", value: "—", support: "Nenhum lembrete pendente", href: "/dashboard/notas" }
      const day = dayDiff(next.remind_at, m.now, m.tz)
      return { id, state: "ok", value: clock(next.remind_at), support: `${day === 0 ? "Hoje" : day === 1 ? "Amanhã" : `Em ${day} dias`} · ${next.title}`, href: "/dashboard/notas" }
    }
    case "sequencia": {
      const best = src.habits
        .filter((h) => !h.paused)
        .map((h) => ({ h, n: currentStreak(h, m.logs, m.today) }))
        .sort((a, b) => b.n - a.n)[0]
      if (!best || best.n === 0) return { id, state: "empty", value: "0", support: "Comece um hábito hoje", href: "/dashboard/rotina" }
      return { id, state: "ok", value: best.n === 1 ? "1 dia" : `${best.n} dias`, support: best.h.name, href: "/dashboard/rotina" }
    }
    case "sono": {
      const day = src.journal.find((d) => d.entry_date === shiftDay(m.today, -1))
      if (!day || day.sleep_hours == null) return { id, state: "empty", value: "—", support: "Sem registro de ontem", href: "/dashboard/diario" }
      return { id, state: "ok", value: hoursText(Math.round(day.sleep_hours * 60)), support: "dormidas ontem", href: "/dashboard/diario" }
    }
    case "humor-semana": {
      const week = src.journal.filter((d) => d.entry_date >= shiftDay(m.today, -6))
      if (week.length === 0) return { id, state: "empty", value: "—", support: "Sem check-ins na semana", href: "/dashboard/diario" }
      const avg = week.reduce((s, d) => s + d.mood, 0) / week.length
      return { id, state: "ok", value: MOOD_LABELS[Math.min(5, Math.max(1, Math.round(avg))) as Mood], support: `média ${avg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} de 5 · ${week.length} check-ins`, href: "/dashboard/diario" }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// "Seu dia"

export async function getDay(nowIso: string): Promise<DayData> {
  const m = await model(nowIso)
  const src = m.src
  const items: DayItem[] = []

  for (const t of m.focus) {
    const isLate = m.overdue.includes(t)
    items.push({
      id: t.id,
      kind: "task",
      title: t.title,
      meta: `Tarefas · ${t.boardName}`,
      at: t.due_at && t.due_has_time ? t.due_at : null,
      overdue: isLate,
      overdueSince: isLate ? (t.due_at ?? undefined) : undefined,
      priority: asPriorityValue(t.priority),
      due: t.due_at ? { at: t.due_at, hasTime: t.due_has_time } : undefined,
      href: `/dashboard/tarefas/${t.boardId}`,
      action: "check",
    })
  }
  // Tasks done today (before the page opened) go straight to "Concluídos".
  for (const t of m.allTasks.filter((x) => x.completed_at && dayDiff(x.completed_at, m.now, m.tz) === 0)) {
    items.push({ id: t.id, kind: "task", title: t.title, meta: `Tarefas · ${t.boardName}`, at: t.due_at && t.due_has_time ? t.due_at : null, href: `/dashboard/tarefas/${t.boardId}`, action: "check", done: true, doneAtMs: t.completed_at ? new Date(t.completed_at).getTime() : undefined })
  }

  for (const e of m.todaysEvents) {
    const minutes = e.allDay ? undefined : Math.round(((e.end?.getTime() ?? e.start.getTime()) - e.start.getTime()) / 60000) || undefined
    items.push({ id: e.key, kind: "event", title: e.title, meta: ["Agenda", e.allDay ? "Dia todo" : e.detail].filter(Boolean).join(" · "), at: e.allDay ? null : e.start.toISOString(), endAt: e.allDay || !e.end ? undefined : e.end.toISOString(), durationMin: minutes, href: "/dashboard/agenda", action: "none" })
  }
  for (const s of src.workoutOn(m.today)) {
    items.push({ id: s.id, kind: "workout", title: s.title, meta: `Treinos · ${s.detail}`, at: s.start ?? null, endAt: s.end, durationMin: s.start && s.end ? Math.round((new Date(s.end).getTime() - new Date(s.start).getTime()) / 60000) : undefined, href: "/dashboard/treinos", action: "none" })
  }
  for (const s of src.studyOn(m.today)) {
    items.push({ id: s.id, kind: "study", title: s.title, meta: `Estudos · ${s.detail}`, at: s.start ?? null, endAt: s.end, durationMin: s.start && s.end ? Math.round((new Date(s.end).getTime() - new Date(s.start).getTime()) / 60000) : undefined, href: "/dashboard/estudos", action: "none" })
  }

  for (const h of m.todaysHabits) {
    const log = m.logs.find((l) => l.habit_id === h.id && l.log_date === m.today)
    const goal = h.type === "goal"
    const streak = goal ? 0 : currentStreak(h, m.logs, m.today)
    items.push({
      id: h.id,
      kind: "habit",
      title: h.name,
      meta: "Hábitos",
      at: null,
      href: "/dashboard/rotina",
      action: goal ? "plus" : "check",
      done: isDone(h, m.logs, m.today),
      streak: streak >= 2 ? streak : undefined,
      habit: goal ? { qty: log?.qty ?? 0, target: h.target_qty ?? 1, unit: h.unit ?? "" } : undefined,
    })
  }

  for (const b of m.bills.filter((x) => x.status === "overdue" || (x.status === "soon" && x.daysLeft <= 0))) {
    const late = b.status === "overdue"
    const days = Math.abs(b.daysLeft)
    items.push({
      id: b.bill.id,
      kind: "bill",
      title: b.bill.name,
      meta: "Finanças",
      at: null,
      overdue: late,
      overdueSince: late ? at(nowIso, -days, "00:00") : undefined,
      bill: { amount: formatBRL(b.bill.amount_cents), when: late ? `Venceu há ${days} ${days === 1 ? "dia" : "dias"}` : "Vence hoje" },
      href: "/dashboard/financas",
      action: "pay",
    })
  }

  return { state: items.length === 0 ? "empty" : "ok", nowIso, items }
}

const asPriorityValue = (value: string): DayItem["priority"] => (value === "high" || value === "medium" || value === "low" ? value : "none")

// ---------------------------------------------------------------------------------------------------------------------
// Panels

export async function getMood(nowIso: string): Promise<{ state: "ok"; mood: number | null }> {
  const m = await model(nowIso)
  return { state: "ok", mood: m.src.journal.find((d) => d.entry_date === m.today)?.mood ?? null }
}

export async function getNotes(nowIso: string): Promise<NotesData> {
  const m = await model(nowIso)
  const reminders = m.src.reminders
    .filter((r) => r.status === "pending" && dayDiff(r.remind_at, m.now, m.tz) === 0)
    .sort((a, b) => a.remind_at.localeCompare(b.remind_at))
    .slice(0, 5)
    .map((r) => ({ id: r.id, title: r.title, at: r.remind_at }))
  const pinned = m.src.notes
    .filter((n) => n.pinned)
    .slice(0, 2)
    .map((n) => ({
      id: n.id,
      title: n.title,
      // Plain text preview: markdown markers off, first two lines of content.
      preview: n.body
        .split("\n")
        .map((l) => l.replace(/^#+\s*/, "").replace(/^-\s*/, "").replace(/\*\*?/g, "").trim())
        .filter(Boolean)
        .slice(1, 3)
        .join(" · "),
    }))
  return { state: reminders.length + pinned.length === 0 ? "empty" : "ok", reminders, pinned }
}

export async function getFinance(nowIso: string): Promise<FinanceData> {
  const m = await model(nowIso)
  const t = totals(m.transactions, m.month)
  const budget = m.src.categories.reduce((s, c) => s + (c.monthly_limit_cents ?? 0), 0)
  const spent = spendByCategory(m.src.categories, m.transactions, m.month).filter((c) => c.limit).reduce((s, c) => s + c.spent, 0)
  return {
    state: m.transactions.length === 0 ? "empty" : "ok",
    surplus: formatBRL(t.surplus),
    surplusTrend: t.surplus >= 0 ? "up" : "down",
    budgetPct: budget === 0 ? 0 : Math.round((spent / budget) * 100),
    budgetLine: budget === 0 ? "Sem orçamento definido" : `${formatBRL(spent)} de ${formatBRL(budget)}`,
  }
}

export async function getDiet(nowIso: string): Promise<DietData> {
  const { src } = await model(nowIso)
  const totalsToday = dayTotals(src.mealItems, src.foods)
  return { state: "ok", kcal: Math.round(totalsToday.kcal), goalKcal: src.goal.kcal, protein: Math.round(totalsToday.protein), waterMl: src.waterMl, waterGoalMl: src.goal.water_ml }
}

export async function getWorkout(nowIso: string): Promise<WorkoutData> {
  const m = await model(nowIso)
  const slot = m.src.workoutOn(m.today)[0]
  const weekDone = m.src.workoutSessions.filter((s) => s.completed && s.performed_on >= m.weekStart && s.performed_on <= m.today).length
  const weekPlanned = m.weekDays.reduce((sum, day) => sum + m.src.workoutOn(day).length, 0)
  return { state: weekPlanned === 0 && weekDone === 0 ? "empty" : "ok", title: slot?.title ?? null, time: slot?.start ? clock(slot.start) : null, weekDone, weekPlanned }
}

export async function getStudy(nowIso: string): Promise<StudyData> {
  const m = await model(nowIso)
  const studiedMin = m.src.studySessions.filter((s) => s.studied_on === m.today).reduce((s, x) => s + x.minutes, 0)
  const dailyGoalMin = Math.round(m.src.subjects.reduce((s, x) => s + x.weekly_goal_min, 0) / 7)
  const dueCards = m.src.cards.filter((c) => isDue(c, m.today)).length
  const exam = m.src.deadlines
    .filter((d) => d.kind === "exam" && d.due_on >= m.today)
    .sort((a, b) => a.due_on.localeCompare(b.due_on))[0]
  return { state: m.src.subjects.length === 0 && studiedMin === 0 ? "empty" : "ok", studiedMin, dailyGoalMin, dueCards, exam: exam ? { title: exam.title, days: daysUntil(exam.due_on, m.today) } : null }
}
