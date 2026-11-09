// Pure helpers of the "Evolução" tab. Everything is derived from the sessions and sets already saved.
import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns"

import { estimatedOneRepMax, volume } from "./stats"
import type { SetLogRow, WorkoutPlanRow, WorkoutSessionRow } from "./types"

export type PeriodId = "4w" | "12w" | "6m"
export const EVOLUTION_PERIODS: { id: PeriodId; label: string; long: string; weeks: number }[] = [
  { id: "4w", label: "4 sem", long: "4 semanas", weeks: 4 },
  { id: "12w", label: "12 sem", long: "12 semanas", weeks: 12 },
  { id: "6m", label: "6 meses", long: "6 meses", weeks: 26 },
]
export const periodWeeks = (id: PeriodId) => EVOLUTION_PERIODS.find((p) => p.id === id)?.weeks ?? 4

const key = (date: Date) => format(date, "yyyy-MM-dd")

/** The Monday of the first week of the period: `weeks` whole weeks (Monday first) ending with the current one. */
export function periodStart(today: string, weeks: number) {
  return key(addDays(startOfWeek(parseISO(today), { weekStartsOn: 1 }), -(weeks - 1) * 7))
}

/** Completed sessions inside the period (from its first Monday up to today). */
export function sessionsInPeriod(sessions: WorkoutSessionRow[], today: string, weeks: number) {
  const start = periodStart(today, weeks)
  return sessions.filter((s) => s.completed && s.performed_on >= start && s.performed_on <= today)
}

export type WeekBucket = { start: string; label: string; volume: number; sessions: number }

/**
 * One bucket per week of the period, oldest first, the last one is the current week (so there are never empty future weeks).
 * Weeks before the first workout of the period carry nothing to draw and are dropped.
 */
export function weeklyBuckets(sets: SetLogRow[], sessions: WorkoutSessionRow[], today: string, weeks: number): WeekBucket[] {
  const monday = startOfWeek(parseISO(today), { weekStartsOn: 1 })
  const all = Array.from({ length: weeks }, (_, index) => {
    const start = addDays(monday, (index - (weeks - 1)) * 7)
    const startKey = key(start)
    const endKey = key(addDays(start, 7))
    const ids = new Set(sessions.filter((s) => s.completed && s.performed_on >= startKey && s.performed_on < endKey).map((s) => s.id))
    return { start: startKey, label: format(start, "dd/MM"), volume: Math.round(volume(sets.filter((set) => ids.has(set.session_id)))), sessions: ids.size }
  })
  const first = all.findIndex((w) => w.sessions > 0 || w.volume > 0)
  return first < 0 ? [] : all.slice(first)
}

/** Change of the current week's volume against the week before, in percent; null when there is no week before to compare with. */
export function volumeDelta(buckets: Pick<WeekBucket, "volume">[]) {
  if (buckets.length < 2) return null
  const previous = buckets[buckets.length - 2].volume
  if (previous <= 0) return null
  return Math.round(((buckets[buckets.length - 1].volume - previous) / previous) * 100)
}

/** Workouts planned per week: every weekday of every plan counts once. */
export const plannedPerWeek = (plans: Pick<WorkoutPlanRow, "weekdays">[]) => plans.reduce((sum, p) => sum + new Set(p.weekdays).size, 0)

/** Sessions per week, one decimal. */
export const averagePerWeek = (sessions: number, weeks: number) => (weeks <= 0 ? 0 : Math.round((sessions / weeks) * 10) / 10)

// ------------------------------------------------------------------ records

export type RecordRow = {
  exerciseId: string
  loadKg: number
  reps: number
  on: string
  /** The record that was beaten (null when it is the first one). */
  previous: { loadKg: number; reps: number } | null
}

const oneRepMax = (set: Pick<SetLogRow, "load_kg" | "reps">) => estimatedOneRepMax(set.load_kg, set.reps)

/** The personal record of every exercise (best estimated 1RM) with the record it replaced. */
export function recordRows(sets: SetLogRow[], sessions: WorkoutSessionRow[]): RecordRow[] {
  const dayOf = new Map(sessions.filter((s) => s.completed).map((s) => [s.id, s.performed_on]))
  const byExercise = new Map<string, { set: SetLogRow; day: string }[]>()
  for (const set of sets) {
    const day = dayOf.get(set.session_id)
    if (!day) continue
    byExercise.set(set.exercise_id, [...(byExercise.get(set.exercise_id) ?? []), { set, day }])
  }
  const rows: RecordRow[] = []
  for (const [exerciseId, entries] of byExercise) {
    const best = entries.reduce((a, b) => (oneRepMax(b.set) > oneRepMax(a.set) ? b : a))
    const before = entries.filter((e) => e.day < best.day)
    const previous = before.length === 0 ? null : before.reduce((a, b) => (oneRepMax(b.set) > oneRepMax(a.set) ? b : a))
    rows.push({ exerciseId, loadKg: best.set.load_kg, reps: best.set.reps, on: best.day, previous: previous ? { loadKg: previous.set.load_kg, reps: previous.set.reps } : null })
  }
  return rows.sort((a, b) => b.on.localeCompare(a.on) || oneRepMax({ load_kg: b.loadKg, reps: b.reps }) - oneRepMax({ load_kg: a.loadKg, reps: a.reps }))
}

/** A record set in the last 7 days (today included). */
export const isNewRecord = (row: Pick<RecordRow, "on">, today: string) => {
  const age = differenceInCalendarDays(parseISO(today), parseISO(row.on))
  return age >= 0 && age <= 6
}

/** Records set in the month of `today`. */
export const recordsInMonth = (rows: Pick<RecordRow, "on">[], today: string) => rows.filter((r) => r.on.startsWith(today.slice(0, 7))).length

/** "+2,5 kg" (or "+1 rep" when only the repetitions grew); null without a previous record or any gain. */
export function recordGain(row: Pick<RecordRow, "loadKg" | "reps" | "previous">) {
  if (!row.previous) return null
  const kg = Math.round((row.loadKg - row.previous.loadKg) * 10) / 10
  if (kg > 0) return `+${kg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`
  const reps = row.reps - row.previous.reps
  return reps > 0 ? `+${reps} ${reps === 1 ? "rep" : "reps"}` : null
}

// ------------------------------------------------------------------ load of one exercise

export type LoadPoint = { day: string; load: number; reps: number }

/** The heaviest set of each session that had the exercise inside the period, oldest first. */
export function loadSeries(exerciseId: string, sets: SetLogRow[], sessions: WorkoutSessionRow[], today: string, weeks: number): LoadPoint[] {
  return sessionsInPeriod(sessions, today, weeks)
    .map((session) => {
      const own = sets.filter((set) => set.session_id === session.id && set.exercise_id === exerciseId)
      if (own.length === 0) return null
      const top = own.reduce((a, b) => (b.load_kg > a.load_kg || (b.load_kg === a.load_kg && b.reps > a.reps) ? b : a))
      return { day: session.performed_on, load: top.load_kg, reps: top.reps }
    })
    .filter((p): p is LoadPoint => p !== null)
    .sort((a, b) => a.day.localeCompare(b.day))
}

/** "+17,5 kg em 9 semanas": the difference between the first and the last load of the period. */
export function loadSummary(points: LoadPoint[]) {
  if (points.length < 2) return points.length === 1 ? "1 registro no período" : "Sem registros no período"
  const first = points[0]
  const last = points[points.length - 1]
  const diff = Math.round((last.load - first.load) * 10) / 10
  const weeks = Math.max(1, Math.round(differenceInCalendarDays(parseISO(last.day), parseISO(first.day)) / 7))
  const span = `${weeks} ${weeks === 1 ? "semana" : "semanas"}`
  if (diff === 0) return `Sem variação em ${span}`
  return `${diff > 0 ? "+" : "−"}${Math.abs(diff).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg em ${span}`
}

/** A "nice" axis for a chart: ticks every 1, 2, 2.5, 5, 10… that cover the values (with at most `max` ticks). */
export function niceAxis(values: number[], options: { zero?: boolean; max?: number } = {}) {
  const maxTicks = options.max ?? 5
  const top = Math.max(...values, 0)
  const bottom = options.zero ? 0 : Math.min(...values, top)
  const span = Math.max(top - bottom, top * 0.1, 1)
  const steps = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000]
  const step = steps.find((s) => Math.ceil(span / s) + 1 <= maxTicks) ?? steps[steps.length - 1]
  const min = options.zero ? 0 : Math.floor(bottom / step) * step
  let max = Math.ceil(top / step) * step
  if (max === min) max = min + step
  const ticks: number[] = []
  for (let v = min; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100)
  return { min, max, step, ticks }
}
