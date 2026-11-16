// Goals driven by the real data of the modules. A goal is "linked" to one source (a Finanças goal, a habit, a subject, workouts, weight, tasks...)
// and its progress is COMPUTED from that source whenever the page loads: nothing is typed in, so it can never drift. The link (kind, what it
// points at, the target, start and end dates) is kept in localStorage behind `LinkedGoalRepo` until supabase/migrations/20261116000002_goal_links.sql
// is applied (prepared, NOT applied). Free goals keep working as before. Pure apart from that adapter.
import { addDays, format, parseISO } from "date-fns"

import type { ModuleId } from "@/components/organizzou/modules"
import { currentStreak, isDone, isScheduled } from "@/features/habits/stats"
import type { HabitLogRow, HabitRow } from "@/features/habits/types"

export type Period = "week" | "month"

export type LinkSpec =
  | { kind: "finance_saving"; goalId: string }
  | { kind: "finance_limit"; categoryId: string; limitCents: number }
  | { kind: "habit"; habitId: string; mode: "streak" | "month_pct" | "week_times"; target: number }
  | { kind: "study_hours"; subjectId: string | null; period: Period; hours: number }
  | { kind: "study_cards"; period: Period; count: number }
  | { kind: "workout_count"; period: Period; count: number }
  | { kind: "workout_pr"; exerciseId: string; targetKg: number }
  | { kind: "weight"; targetKg: number; startKg: number }
  | { kind: "calories_days"; daysPerWeek: number }
  | { kind: "tasks"; scope: "board" | "list" | "tag"; scopeId: string }

export type LinkKind = LinkSpec["kind"]

/** What is saved for a linked goal: the link, and the dates of the goal. */
export type LinkedGoalMeta = { spec: LinkSpec; startDate: string; endDate: string | null }
export type LinkedGoalMap = Record<string, LinkedGoalMeta>

export type GoalSources = {
  financeGoals: { id: string; name: string; target_cents: number; current_cents: number; deadline: string | null }[]
  categories: { id: string; name: string; monthly_limit_cents: number | null }[]
  transactions: { category_id: string | null; kind: "in" | "out"; amount_cents: number; occurred_on: string }[]
  habits: HabitRow[]
  habitLogs: HabitLogRow[]
  subjects: { id: string; name: string }[]
  studySessions: { subject_id: string; studied_on: string; minutes: number }[]
  reviews: { reviewed_on: string }[]
  workoutSessions: { id: string; performed_on: string; completed: boolean }[]
  exercises: { id: string; name: string }[]
  setLogs: { exercise_id: string; load_kg: number; session_id: string }[]
  weights: { log_date: string; weight_kg: number }[]
  mealKcalByDay: Record<string, number>
  dietGoalKcal: number
  tasks: { id: string; completed_at: string | null; board_id: string; list_id: string; tagIds: string[] }[]
  boards: { id: string; name: string }[]
  lists: { id: string; name: string }[]
  tags: { id: string; name: string }[]
}

export const EMPTY_SOURCES: GoalSources = {
  financeGoals: [],
  categories: [],
  transactions: [],
  habits: [],
  habitLogs: [],
  subjects: [],
  studySessions: [],
  reviews: [],
  workoutSessions: [],
  exercises: [],
  setLogs: [],
  weights: [],
  mealKcalByDay: {},
  dietGoalKcal: 2000,
  tasks: [],
  boards: [],
  lists: [],
  tags: [],
}

export type LinkProgress = {
  module: ModuleId
  /** "Ligada a: ..." row text. */
  label: string
  done: number
  total: number
  /** "R$" means cents. */
  unit: string
  href: string
  /** A limit is better the LESS is used: it never completes a goal by filling up. */
  inverse?: boolean
  /** Why there is nothing to measure (the habit or subject was deleted). */
  broken?: boolean
}

// ---------------------------------------------------------------- calendar helpers

const iso = (d: Date) => format(d, "yyyy-MM-dd")
/** The Monday of the week of `day`. */
export function weekStart(day: string): string {
  const d = parseISO(day)
  return iso(addDays(d, -((d.getDay() + 6) % 7)))
}
export const monthStart = (day: string) => `${day.slice(0, 7)}-01`
const periodStart = (period: Period, today: string, goalStart: string) => {
  const from = period === "week" ? weekStart(today) : monthStart(today)
  return from > goalStart ? from : goalStart
}
const within = (day: string, from: string, to: string) => day >= from && day <= to

/** The reais (cents) the goal reads as "R$ 1.234,56": the unit "R$" always means cents. */
export const MONEY_UNIT = "R$"

const kg = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`

// ---------------------------------------------------------------- the computation

/** The live progress of a linked goal: one or more rows of "Ligada a:" with what is done of what is needed. */
export function computeLinked(meta: LinkedGoalMeta, src: GoalSources, today: string): LinkProgress[] {
  const { spec, startDate } = meta
  const start = startDate || "0000-00-00"
  switch (spec.kind) {
    case "finance_saving": {
      const goal = src.financeGoals.find((g) => g.id === spec.goalId)
      if (!goal) return [{ module: "financas", label: "Meta de Finanças removida", done: 0, total: 1, unit: "", href: "/dashboard/financas", broken: true }]
      return [{ module: "financas", label: `Guardado em ${goal.name}`, done: Math.min(goal.current_cents, goal.target_cents), total: goal.target_cents, unit: MONEY_UNIT, href: "/dashboard/financas" }]
    }
    case "finance_limit": {
      const category = src.categories.find((c) => c.id === spec.categoryId)
      const from = monthStart(today) > start ? monthStart(today) : start
      const spent = src.transactions.filter((t) => t.kind === "out" && t.category_id === spec.categoryId && within(t.occurred_on, from, today)).reduce((sum, t) => sum + t.amount_cents, 0)
      return [{ module: "financas", label: `Gasto do mês em ${category?.name ?? "categoria"}`, done: spent, total: spec.limitCents, unit: MONEY_UNIT, href: "/dashboard/financas", inverse: true, broken: !category }]
    }
    case "habit": {
      const habit = src.habits.find((h) => h.id === spec.habitId)
      if (!habit) return [{ module: "rotina", label: "Hábito removido", done: 0, total: 1, unit: "", href: "/dashboard/rotina", broken: true }]
      if (spec.mode === "streak") return [{ module: "rotina", label: `${habit.name}: dias seguidos`, done: Math.min(currentStreak(habit, src.habitLogs, today), spec.target), total: spec.target, unit: "dias", href: "/dashboard/rotina" }]
      if (spec.mode === "week_times") {
        const from = periodStart("week", today, start)
        let count = 0
        for (let day = from; day <= today; day = iso(addDays(parseISO(day), 1))) if (isScheduled(habit, day) && isDone(habit, src.habitLogs, day)) count += 1
        return [{ module: "rotina", label: `${habit.name}: vezes na semana`, done: Math.min(count, spec.target), total: spec.target, unit: "vezes", href: "/dashboard/rotina" }]
      }
      const from = periodStart("month", today, start)
      let scheduled = 0
      let done = 0
      for (let day = from; day <= today; day = iso(addDays(parseISO(day), 1))) {
        if (!isScheduled(habit, day)) continue
        scheduled += 1
        if (isDone(habit, src.habitLogs, day)) done += 1
      }
      const pct = scheduled === 0 ? 0 : Math.round((done / scheduled) * 100)
      return [{ module: "rotina", label: `${habit.name}: conclusão no mês`, done: Math.min(pct, spec.target), total: spec.target, unit: "%", href: "/dashboard/rotina" }]
    }
    case "study_hours": {
      const subject = spec.subjectId ? src.subjects.find((s) => s.id === spec.subjectId) : null
      const from = periodStart(spec.period, today, start)
      const minutes = src.studySessions.filter((s) => (!spec.subjectId || s.subject_id === spec.subjectId) && within(s.studied_on, from, today)).reduce((sum, s) => sum + s.minutes, 0)
      const hours = Math.round((minutes / 60) * 10) / 10
      return [{ module: "estudos", label: `${subject ? subject.name : "Estudo"}: horas ${spec.period === "week" ? "na semana" : "no mês"}`, done: Math.min(hours, spec.hours), total: spec.hours, unit: "h", href: "/dashboard/estudos", broken: Boolean(spec.subjectId) && !subject }]
    }
    case "study_cards": {
      const from = periodStart(spec.period, today, start)
      const count = src.reviews.filter((r) => within(r.reviewed_on, from, today)).length
      return [{ module: "estudos", label: `Flashcards revisados ${spec.period === "week" ? "na semana" : "no mês"}`, done: Math.min(count, spec.count), total: spec.count, unit: "cartões", href: "/dashboard/estudos" }]
    }
    case "workout_count": {
      const from = periodStart(spec.period, today, start)
      const count = src.workoutSessions.filter((s) => s.completed && within(s.performed_on, from, today)).length
      return [{ module: "treinos", label: `Treinos ${spec.period === "week" ? "na semana" : "no mês"}`, done: Math.min(count, spec.count), total: spec.count, unit: "treinos", href: "/dashboard/treinos" }]
    }
    case "workout_pr": {
      const exercise = src.exercises.find((e) => e.id === spec.exerciseId)
      const best = src.setLogs.filter((s) => s.exercise_id === spec.exerciseId).reduce((max, s) => Math.max(max, s.load_kg), 0)
      return [{ module: "treinos", label: `Recorde em ${exercise?.name ?? "exercício"}`, done: Math.min(best, spec.targetKg), total: spec.targetKg, unit: "kg", href: "/dashboard/treinos", broken: !exercise }]
    }
    case "weight": {
      const logs = [...src.weights].sort((a, b) => a.log_date.localeCompare(b.log_date))
      const current = logs.at(-1)?.weight_kg ?? spec.startKg
      const total = Math.abs(spec.startKg - spec.targetKg)
      const moved = spec.targetKg < spec.startKg ? spec.startKg - current : current - spec.startKg
      return [{ module: "dieta", label: `Peso: ${kg(current)} → ${kg(spec.targetKg)}`, done: total === 0 ? 0 : Math.max(0, Math.min(total, Math.round(moved * 10) / 10)), total: Math.round(total * 10) / 10, unit: "kg", href: "/dashboard/dieta" }]
    }
    case "calories_days": {
      const from = periodStart("week", today, start)
      let count = 0
      for (let day = from; day <= today; day = iso(addDays(parseISO(day), 1))) {
        const kcal = src.mealKcalByDay[day] ?? 0
        if (kcal > 0 && Math.abs(kcal - src.dietGoalKcal) <= src.dietGoalKcal * 0.1) count += 1
      }
      return [{ module: "dieta", label: "Dias na meta de calorias (semana)", done: Math.min(count, spec.daysPerWeek), total: spec.daysPerWeek, unit: "dias", href: "/dashboard/dieta" }]
    }
    case "tasks": {
      const scopeName = (spec.scope === "board" ? src.boards : spec.scope === "list" ? src.lists : src.tags).find((x) => x.id === spec.scopeId)?.name
      const matching = src.tasks.filter((t) => (spec.scope === "board" ? t.board_id === spec.scopeId : spec.scope === "list" ? t.list_id === spec.scopeId : t.tagIds.includes(spec.scopeId)))
      return [{ module: "tarefas", label: `Tarefas de ${scopeName ?? "um filtro"}`, done: matching.filter((t) => t.completed_at).length, total: Math.max(1, matching.length), unit: "tarefas", href: "/dashboard/tarefas", broken: !scopeName }]
    }
  }
}

/** 0-1 progress of a link row. */
export const linkProgressRatio = (row: LinkProgress) => (row.total <= 0 ? 0 : Math.min(1, row.done / row.total))

/** A linked goal is complete when every measurable row is full. A limit never completes by itself, and a goal with nothing to measure never does either. */
export function isLinkedComplete(rows: LinkProgress[]): boolean {
  const measurable = rows.filter((r) => !r.inverse && !r.broken)
  return measurable.length > 0 && measurable.every((r) => r.done >= r.total)
}

/** The label of each kind in the creation sheet. */
export const KIND_LABELS: Record<"finance" | "habit" | "study" | "workout" | "diet" | "tasks" | "free", string> = {
  finance: "Finanças",
  habit: "Hábitos",
  study: "Estudos",
  workout: "Treinos",
  diet: "Dieta e peso",
  tasks: "Tarefas",
  free: "Livre",
}

export const kindGroup = (kind: LinkKind): keyof typeof KIND_LABELS => (kind.startsWith("finance") ? "finance" : kind === "habit" ? "habit" : kind.startsWith("study") ? "study" : kind.startsWith("workout") ? "workout" : kind === "weight" || kind === "calories_days" ? "diet" : "tasks")

// ---------------------------------------------------------------- storage (fallback until the migration is applied)

export interface LinkedGoalRepo {
  load(): LinkedGoalMap
  save(map: LinkedGoalMap): void
}

const KEY = "organizzou:metas-links"

const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v > 0
const str = (v: unknown) => typeof v === "string" && v.length > 0
const PERIODS = ["week", "month"]

function parseSpec(raw: Record<string, unknown>): LinkSpec | null {
  switch (raw.kind) {
    case "finance_saving":
      return str(raw.goalId) ? { kind: "finance_saving", goalId: raw.goalId as string } : null
    case "finance_limit":
      return str(raw.categoryId) && num(raw.limitCents) ? { kind: "finance_limit", categoryId: raw.categoryId as string, limitCents: raw.limitCents as number } : null
    case "habit":
      return str(raw.habitId) && ["streak", "month_pct", "week_times"].includes(raw.mode as string) && num(raw.target) ? { kind: "habit", habitId: raw.habitId as string, mode: raw.mode as "streak" | "month_pct" | "week_times", target: raw.target as number } : null
    case "study_hours":
      return PERIODS.includes(raw.period as string) && num(raw.hours) ? { kind: "study_hours", subjectId: str(raw.subjectId) ? (raw.subjectId as string) : null, period: raw.period as Period, hours: raw.hours as number } : null
    case "study_cards":
      return PERIODS.includes(raw.period as string) && num(raw.count) ? { kind: "study_cards", period: raw.period as Period, count: raw.count as number } : null
    case "workout_count":
      return PERIODS.includes(raw.period as string) && num(raw.count) ? { kind: "workout_count", period: raw.period as Period, count: raw.count as number } : null
    case "workout_pr":
      return str(raw.exerciseId) && num(raw.targetKg) ? { kind: "workout_pr", exerciseId: raw.exerciseId as string, targetKg: raw.targetKg as number } : null
    case "weight":
      return num(raw.targetKg) && num(raw.startKg) ? { kind: "weight", targetKg: raw.targetKg as number, startKg: raw.startKg as number } : null
    case "calories_days":
      return num(raw.daysPerWeek) && (raw.daysPerWeek as number) <= 7 ? { kind: "calories_days", daysPerWeek: raw.daysPerWeek as number } : null
    case "tasks":
      return ["board", "list", "tag"].includes(raw.scope as string) && str(raw.scopeId) ? { kind: "tasks", scope: raw.scope as "board" | "list" | "tag", scopeId: raw.scopeId as string } : null
    default:
      return null
  }
}

export function parseLinkedGoals(raw: unknown): LinkedGoalMap {
  const out: LinkedGoalMap = {}
  if (!raw || typeof raw !== "object") return out
  for (const [id, value] of Object.entries(raw as Record<string, Record<string, unknown>>)) {
    if (!value || typeof value !== "object" || !value.spec || typeof value.spec !== "object") continue
    const spec = parseSpec(value.spec as Record<string, unknown>)
    const ISO = /^\d{4}-\d{2}-\d{2}$/
    if (!spec || typeof value.startDate !== "string" || !ISO.test(value.startDate)) continue
    out[id] = { spec, startDate: value.startDate, endDate: typeof value.endDate === "string" && ISO.test(value.endDate) ? value.endDate : null }
  }
  return out
}

export const localLinkedGoalRepo: LinkedGoalRepo = {
  load() {
    try {
      return parseLinkedGoals(JSON.parse(localStorage.getItem(KEY) ?? "{}"))
    } catch {
      return {}
    }
  },
  save(map) {
    try {
      localStorage.setItem(KEY, JSON.stringify(map))
    } catch {
      // Private mode: the links just do not survive the visit.
    }
  },
}
