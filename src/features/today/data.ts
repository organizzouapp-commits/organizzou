import "server-only"

import { cache } from "react"

import { expandEvent } from "@/features/calendar/recurrence"
import { dayTotals } from "@/features/diet/stats"
import { billStatus, monthOf, spendByCategory, totals } from "@/features/finance/stats"
import { currentStreak, isDone, isScheduled, shiftDay } from "@/features/habits/stats"
import { MOOD_LABELS, type Mood } from "@/features/journal/types"
import { daysUntil, isDue } from "@/features/studies/spaced-repetition"
import { getTodayData } from "@/features/tasks/today"
import { dayDiff, isOverdue } from "@/lib/dates"
import { formatBRL } from "@/lib/money"
import { buildMockEvents } from "@/mocks/calendar"
import { isMock } from "@/mocks/config"
import { buildMockBills, buildMockTransactions, mockCategories } from "@/mocks/finance"
import { buildMockHabitLogs, mockHabits } from "@/mocks/habits"
import { buildMockMealItems, mockDietGoal, mockFoods, buildMockWeight } from "@/mocks/diet"
import { buildMockJournal } from "@/mocks/journal"
import { buildMockNotes, buildMockReminders } from "@/mocks/notes"
import { mockStudySlots, mockWorkoutSlots } from "@/mocks/schedule"
import { buildMockCards, buildMockDeadlines, buildMockSessions, mockSubjects } from "@/mocks/studies"
import { getMockBoardsStore } from "@/mocks/tasks-api"
import { at, dayOf, MOCK_TIMEZONE } from "@/mocks/time"
import { buildMockWorkoutHistory } from "@/mocks/workouts"
import type { TaskView } from "@/features/tasks/types"

import type { StatId } from "./catalog"
import type { DayData, DayItem, DietData, FinanceData, NotesData, StatData, StudyData, WorkoutData } from "./types"

/**
 * Data for the "Hoje" widgets. Each widget calls ONE function here and streams on its own (own Suspense boundary).
 *  - Prototype (isMock): the same example data the rest of the app shows, read from `src/mocks/`.
 *  - Otherwise: only Tarefas has a real backend, so every other module answers "soon" and its widget says "Em breve".
 * All "today" boundaries use the São Paulo day.
 */

const soonStat = (id: StatId, href: string): StatData => ({ id, state: "soon", value: "—", support: "Em breve", href })

// ---------------------------------------------------------------------------------------------------------------------
// One model per request and per `nowIso`, shared by every widget that asks for it.

type MockTask = TaskView & { boardName: string; boardId: string }

const model = cache((nowIso: string) => {
  const now = new Date(nowIso)
  const today = dayOf(nowIso)
  const tz = MOCK_TIMEZONE

  const allTasks: MockTask[] = getMockBoardsStore(nowIso).boards.flatMap((b) => b.tasks.map((t) => ({ ...t, boardName: b.board.name, boardId: b.board.id })))
  const open = allTasks.filter((t) => !t.completed_at)
  const overdue = open.filter((t) => isOverdue(t, now, tz))
  const dueToday = open.filter((t) => t.due_at && dayDiff(t.due_at, now, tz) === 0 && !overdue.includes(t))
  const focus = [...overdue, ...dueToday]
  const doneBefore = allTasks.filter((t) => t.completed_at && dayDiff(t.completed_at, now, tz) === 0).length

  const from = new Date(at(nowIso, 0, "00:00"))
  const to = new Date(at(nowIso, 1, "00:00"))
  const slotsToday = <T extends { start: string }>(slots: T[]) => slots.filter((s) => new Date(s.start) >= from && new Date(s.start) < to)
  const events = buildMockEvents(nowIso)
  const todaysEvents = events.flatMap((e) => expandEvent(e, from, to, tz))
  const week = events.flatMap((e) => expandEvent(e, now, new Date(at(nowIso, 7, "00:00")), tz)).sort((a, b) => a.start.getTime() - b.start.getTime())

  const logs = buildMockHabitLogs(nowIso)
  const todaysHabits = mockHabits.filter((h) => !h.paused && isScheduled(h, today))

  const transactions = buildMockTransactions(nowIso)
  const month = monthOf(today)
  const bills = buildMockBills(nowIso).map((b) => billStatus(b, today))

  const dow = new Date(`${today}T12:00:00`).getDay()
  const weekStart = shiftDay(today, -((dow + 6) % 7))

  return { now, today, tz, allTasks, open, overdue, dueToday, focus, doneBefore, from, to, slotsToday, todaysEvents, week, logs, todaysHabits, transactions, month, bills, weekStart }
})

const hoursText = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`
const kg = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`
const liters = (ml: number) => `${(ml / 1000).toLocaleString("pt-BR")} L`
const clock = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: MOCK_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))

// ---------------------------------------------------------------------------------------------------------------------
// Stats

export async function getStat(id: StatId, nowIso: string): Promise<StatData> {
  if (!isMock) return getLiveStat(id)
  const m = model(nowIso)

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
        state: "ok",
        value: formatBRL(today),
        support: diff === 0 ? "igual a ontem" : `${diff > 0 ? "+" : "−"}${formatBRL(Math.abs(diff))} vs ontem`,
        trend: diff === 0 ? undefined : diff > 0 ? "up" : "down",
        href: "/dashboard/financas",
      }
    }
    case "sobra-mes": {
      const t = totals(m.transactions, m.month)
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
      const ml = 1250
      return {
        id,
        state: "ok",
        value: liters(ml),
        support: `meta ${liters(mockDietGoal.water_ml)}`,
        progress: Math.min(100, Math.round((ml / mockDietGoal.water_ml) * 100)),
        href: "/dashboard/dieta",
        live: { kind: "water", ml, goalMl: mockDietGoal.water_ml },
      }
    }
    case "calorias": {
      const kcal = Math.round(dayTotals(buildMockMealItems(), mockFoods).kcal)
      return { id, state: "ok", value: kcal.toLocaleString("pt-BR"), support: `de ${mockDietGoal.kcal.toLocaleString("pt-BR")} kcal`, progress: Math.min(100, Math.round((kcal / mockDietGoal.kcal) * 100)), href: "/dashboard/dieta" }
    }
    case "peso": {
      const weights = buildMockWeight(nowIso).sort((a, b) => a.log_date.localeCompare(b.log_date))
      const last = weights.at(-1)
      if (!last) return { id, state: "empty", value: "—", support: "Sem registro de peso", href: "/dashboard/dieta" }
      const first = weights.find((w) => w.log_date >= shiftDay(last.log_date, -30)) ?? weights[0]
      const diff = Math.round((last.weight_kg - first.weight_kg) * 10) / 10
      return { id, state: "ok", value: kg(last.weight_kg), support: diff === 0 ? "estável em 30 dias" : `${diff > 0 ? "+" : "−"}${kg(Math.abs(diff))} em 30 dias`, trend: diff === 0 ? undefined : diff > 0 ? "up" : "down", href: "/dashboard/dieta" }
    }
    case "treino-semana": {
      const done = buildMockWorkoutHistory(nowIso).sessions.filter((s) => s.completed && s.performed_on >= m.weekStart && s.performed_on <= m.today).length
      const planned = mockWorkoutSlots(nowIso).filter((s) => dayOf(s.start) >= m.weekStart && dayOf(s.start) <= shiftDay(m.weekStart, 6)).length
      return { id, state: planned === 0 ? "empty" : "ok", value: String(done), support: planned === 0 ? "Sem treino no plano" : `de ${planned} no plano da semana`, progress: planned === 0 ? undefined : Math.min(100, Math.round((done / planned) * 100)), href: "/dashboard/treinos" }
    }
    case "estudo-semana": {
      const minutes = buildMockSessions(nowIso).filter((s) => s.studied_on >= m.weekStart && s.studied_on <= m.today).reduce((s, x) => s + x.minutes, 0)
      const goal = mockSubjects.reduce((s, x) => s + x.weekly_goal_min, 0)
      return { id, state: goal === 0 && minutes === 0 ? "empty" : "ok", value: hoursText(minutes), support: goal === 0 ? "sem meta definida" : `meta ${hoursText(goal)}`, progress: goal === 0 ? undefined : Math.min(100, Math.round((minutes / goal) * 100)), href: "/dashboard/estudos" }
    }
    case "proxima-prova": {
      const exam = buildMockDeadlines(nowIso)
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
      const next = buildMockReminders(nowIso)
        .filter((r) => r.status === "pending" && new Date(r.remind_at) >= m.now)
        .sort((a, b) => a.remind_at.localeCompare(b.remind_at))[0]
      if (!next) return { id, state: "empty", value: "—", support: "Nenhum lembrete pendente", href: "/dashboard/notas" }
      const day = dayDiff(next.remind_at, m.now, m.tz)
      return { id, state: "ok", value: clock(next.remind_at), support: `${day === 0 ? "Hoje" : day === 1 ? "Amanhã" : `Em ${day} dias`} · ${next.title}`, href: "/dashboard/notas" }
    }
    case "sequencia": {
      const best = mockHabits
        .filter((h) => !h.paused)
        .map((h) => ({ h, n: currentStreak(h, m.logs, m.today) }))
        .sort((a, b) => b.n - a.n)[0]
      if (!best || best.n === 0) return { id, state: "empty", value: "0", support: "Comece um hábito hoje", href: "/dashboard/rotina" }
      return { id, state: "ok", value: best.n === 1 ? "1 dia" : `${best.n} dias`, support: best.h.name, href: "/dashboard/rotina" }
    }
    case "sono": {
      const day = buildMockJournal(nowIso).find((d) => d.entry_date === shiftDay(m.today, -1))
      if (!day || day.sleep_hours == null) return { id, state: "empty", value: "—", support: "Sem registro de ontem", href: "/dashboard/diario" }
      return { id, state: "ok", value: hoursText(Math.round(day.sleep_hours * 60)), support: "dormidas ontem", href: "/dashboard/diario" }
    }
    case "humor-semana": {
      const week = buildMockJournal(nowIso).filter((d) => d.entry_date >= shiftDay(m.today, -6))
      if (week.length === 0) return { id, state: "empty", value: "—", support: "Sem check-ins na semana", href: "/dashboard/diario" }
      const avg = week.reduce((s, d) => s + d.mood, 0) / week.length
      return { id, state: "ok", value: MOOD_LABELS[Math.min(5, Math.max(1, Math.round(avg))) as Mood], support: `média ${avg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} de 5 · ${week.length} check-ins`, href: "/dashboard/diario" }
    }
  }
}

/** Outside the prototype only Tarefas is real. Everything else is honest about it. */
async function getLiveStat(id: StatId): Promise<StatData> {
  if (id !== "tarefas-hoje") return soonStat(id, "/dashboard")
  const data = await getTodayData()
  const focus = [...data.overdue, ...data.dueToday]
  const planned = focus.length + data.doneToday
  return {
    id,
    state: planned === 0 ? "empty" : "ok",
    value: String(focus.length),
    support: planned === 0 ? "Nenhuma tarefa para hoje" : `${data.doneToday} de ${planned} concluídas`,
    progress: planned === 0 ? undefined : Math.round((data.doneToday / planned) * 100),
    href: "/dashboard/tarefas",
    live: { kind: "tasks", pendingIds: focus.map((t) => t.id), planned, doneBefore: data.doneToday },
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// "Seu dia"

export async function getDay(nowIso: string): Promise<DayData> {
  if (!isMock) {
    const data = await getTodayData()
    const taskItem = (t: (typeof data.dueToday)[number], overdue: boolean): DayItem => ({
      id: t.id,
      kind: "task",
      title: t.title,
      meta: `Tarefas · ${t.boardName}`,
      at: t.due_has_time ? t.due_at : null,
      overdue,
      due: t.due_at ? { at: t.due_at, hasTime: t.due_has_time } : undefined,
      href: `/dashboard/tarefas/${t.boardId}`,
      action: "check",
    })
    return { state: "ok", nowIso, items: [...data.overdue.map((t) => taskItem(t, true)), ...data.dueToday.map((t) => taskItem(t, false))] }
  }

  const m = model(nowIso)
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
      due: t.due_at ? { at: t.due_at, hasTime: t.due_has_time } : undefined,
      href: `/dashboard/tarefas/${t.boardId}`,
      action: "check",
    })
  }
  // Tasks done today (before the page opened) go straight to "Concluídos".
  for (const t of m.allTasks.filter((x) => x.completed_at && dayDiff(x.completed_at, m.now, m.tz) === 0)) {
    items.push({ id: t.id, kind: "task", title: t.title, meta: `Tarefas · ${t.boardName}`, at: t.due_at && t.due_has_time ? t.due_at : null, href: `/dashboard/tarefas/${t.boardId}`, action: "check", done: true })
  }

  for (const e of m.todaysEvents) {
    const minutes = e.allDay ? undefined : Math.round(((e.end?.getTime() ?? e.start.getTime()) - e.start.getTime()) / 60000) || undefined
    items.push({ id: e.key, kind: "event", title: e.title, meta: ["Agenda", e.allDay ? "Dia todo" : e.detail].filter(Boolean).join(" · "), at: e.allDay ? null : e.start.toISOString(), durationMin: minutes, href: "/dashboard/agenda", action: "none" })
  }
  for (const s of m.slotsToday(mockWorkoutSlots(nowIso))) {
    items.push({ id: s.id, kind: "workout", title: s.title, meta: `Treinos · ${s.detail}`, at: s.start, durationMin: Math.round((new Date(s.end).getTime() - new Date(s.start).getTime()) / 60000), href: "/dashboard/treinos", action: "none" })
  }
  for (const s of m.slotsToday(mockStudySlots(nowIso))) {
    items.push({ id: s.id, kind: "study", title: s.title, meta: `Estudos · ${s.detail}`, at: s.start, durationMin: Math.round((new Date(s.end).getTime() - new Date(s.start).getTime()) / 60000), href: "/dashboard/estudos", action: "none" })
  }

  for (const h of m.todaysHabits) {
    const log = m.logs.find((l) => l.habit_id === h.id && l.log_date === m.today)
    const goal = h.type === "goal"
    items.push({
      id: h.id,
      kind: "habit",
      title: h.name,
      meta: goal ? `Hábitos · meta ${h.target_qty?.toLocaleString("pt-BR")} ${h.unit}` : "Hábitos",
      at: null,
      href: "/dashboard/rotina",
      action: goal ? "plus" : "check",
      done: isDone(h, m.logs, m.today),
      habit: goal ? { qty: log?.qty ?? 0, target: h.target_qty ?? 1, unit: h.unit ?? "" } : undefined,
    })
  }

  for (const b of m.bills.filter((x) => x.status === "overdue" || (x.status === "soon" && x.daysLeft <= 0))) {
    items.push({
      id: b.bill.id,
      kind: "bill",
      title: b.bill.name,
      meta: `Finanças · ${b.status === "overdue" ? `venceu há ${Math.abs(b.daysLeft)} ${Math.abs(b.daysLeft) === 1 ? "dia" : "dias"}` : "vence hoje"} · ${formatBRL(b.bill.amount_cents)}`,
      at: null,
      overdue: b.status === "overdue",
      href: "/dashboard/financas",
      action: "pay",
    })
  }

  return { state: items.length === 0 ? "empty" : "ok", nowIso, items }
}

// ---------------------------------------------------------------------------------------------------------------------
// Panels

export async function getNotes(nowIso: string): Promise<NotesData> {
  if (!isMock) return { state: "soon", reminders: [], pinned: [] }
  const m = model(nowIso)
  const reminders = buildMockReminders(nowIso)
    .filter((r) => r.status === "pending" && dayDiff(r.remind_at, m.now, m.tz) === 0)
    .sort((a, b) => a.remind_at.localeCompare(b.remind_at))
    .slice(0, 3)
    .map((r) => ({ id: r.id, title: r.title, at: r.remind_at }))
  const pinned = buildMockNotes(nowIso)
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
  if (!isMock) return { state: "soon", surplus: "—", surplusTrend: "up", budgetPct: 0, budgetLine: "" }
  const m = model(nowIso)
  const t = totals(m.transactions, m.month)
  const budget = mockCategories.reduce((s, c) => s + (c.monthly_limit_cents ?? 0), 0)
  const spent = spendByCategory(mockCategories, m.transactions, m.month).filter((c) => c.limit).reduce((s, c) => s + c.spent, 0)
  return {
    state: "ok",
    surplus: formatBRL(t.surplus),
    surplusTrend: t.surplus >= 0 ? "up" : "down",
    budgetPct: budget === 0 ? 0 : Math.round((spent / budget) * 100),
    budgetLine: `${formatBRL(spent)} de ${formatBRL(budget)}`,
  }
}

export async function getDiet(): Promise<DietData> {
  if (!isMock) return { state: "soon", kcal: 0, goalKcal: 0, protein: 0, waterMl: 0, waterGoalMl: 0 }
  const totalsToday = dayTotals(buildMockMealItems(), mockFoods)
  return { state: "ok", kcal: Math.round(totalsToday.kcal), goalKcal: mockDietGoal.kcal, protein: Math.round(totalsToday.protein), waterMl: 1250, waterGoalMl: mockDietGoal.water_ml }
}

export async function getWorkout(nowIso: string): Promise<WorkoutData> {
  if (!isMock) return { state: "soon", title: null, time: null, weekDone: 0, weekPlanned: 0 }
  const m = model(nowIso)
  const slot = m.slotsToday(mockWorkoutSlots(nowIso))[0]
  const weekDone = buildMockWorkoutHistory(nowIso).sessions.filter((s) => s.completed && s.performed_on >= m.weekStart && s.performed_on <= m.today).length
  const weekPlanned = mockWorkoutSlots(nowIso).filter((s) => dayOf(s.start) >= m.weekStart && dayOf(s.start) <= shiftDay(m.weekStart, 6)).length
  return { state: "ok", title: slot?.title ?? null, time: slot ? clock(slot.start) : null, weekDone, weekPlanned }
}

export async function getStudy(nowIso: string): Promise<StudyData> {
  if (!isMock) return { state: "soon", studiedMin: 0, dailyGoalMin: 0, dueCards: 0, exam: null }
  const m = model(nowIso)
  const studiedMin = buildMockSessions(nowIso).filter((s) => s.studied_on === m.today).reduce((s, x) => s + x.minutes, 0)
  const dailyGoalMin = Math.round(mockSubjects.reduce((s, x) => s + x.weekly_goal_min, 0) / 7)
  const dueCards = buildMockCards(nowIso).filter((c) => isDue(c, m.today)).length
  const exam = buildMockDeadlines(nowIso)
    .filter((d) => d.kind === "exam" && d.due_on >= m.today)
    .sort((a, b) => a.due_on.localeCompare(b.due_on))[0]
  return { state: "ok", studiedMin, dailyGoalMin, dueCards, exam: exam ? { title: exam.title, days: daysUntil(exam.due_on, m.today) } : null }
}
