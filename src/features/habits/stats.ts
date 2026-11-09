import { addDays, addMonths, format, getDay, parseISO } from "date-fns"

import type { HabitLogRow, HabitRow } from "./types"

/** A day counts when a fixed habit has a log, or a goal habit reached its target. */
export function isDone(habit: HabitRow, logs: HabitLogRow[], day: string) {
  const log = logs.find((l) => l.habit_id === habit.id && l.log_date === day)
  if (!log) return false
  return habit.type === "goal" ? log.qty >= (habit.target_qty ?? 1) : log.qty > 0
}

export function isScheduled(habit: HabitRow, day: string) {
  return habit.weekdays.includes(getDay(parseISO(day)))
}

export function shiftDay(day: string, offset: number) {
  return format(addDays(parseISO(day), offset), "yyyy-MM-dd")
}

/** Consecutive scheduled days completed, ending today (today may still be pending). */
export function currentStreak(habit: HabitRow, logs: HabitLogRow[], today: string) {
  let streak = 0
  let cursor = today
  for (let i = 0; i < 400; i += 1) {
    if (isScheduled(habit, cursor)) {
      if (isDone(habit, logs, cursor)) streak += 1
      else if (cursor !== today) break
    }
    cursor = shiftDay(cursor, -1)
  }
  return streak
}

export function bestStreak(habit: HabitRow, logs: HabitLogRow[], today: string, lookback = 120) {
  let best = 0
  let run = 0
  for (let i = lookback; i >= 0; i -= 1) {
    const day = shiftDay(today, -i)
    if (!isScheduled(habit, day)) continue
    if (isDone(habit, logs, day)) {
      run += 1
      best = Math.max(best, run)
    } else if (day !== today) run = 0
  }
  return best
}

/** Share (0–100) of scheduled days completed in the last `days` days, today included. */
export function consistency(habit: HabitRow, logs: HabitLogRow[], today: string, days = 30) {
  let scheduled = 0
  let done = 0
  for (let i = 0; i < days; i += 1) {
    const day = shiftDay(today, -i)
    if (!isScheduled(habit, day)) continue
    scheduled += 1
    if (isDone(habit, logs, day)) done += 1
  }
  return scheduled === 0 ? 0 : Math.round((done / scheduled) * 100)
}

/** Fraction (0–1) of active habits completed on a day; null when nothing was scheduled. */
export function dayCompletion(habits: HabitRow[], logs: HabitLogRow[], day: string) {
  const scheduled = habits.filter((h) => !h.paused && isScheduled(h, day))
  if (scheduled.length === 0) return null
  return scheduled.filter((h) => isDone(h, logs, day)).length / scheduled.length
}

// ---------------------------------------------------------------------------------------------------------------------
// Rotina > Hoje (derived from the same habits and logs: nothing new is stored)

/** The state of one habit on one day of its last-7-days strip. `pending` is the selected day when it is scheduled and not done yet. */
export type DayState = "done" | "missed" | "off" | "pending"

export function dayState(habit: HabitRow, logs: HabitLogRow[], day: string, selected: string): DayState {
  if (!isScheduled(habit, day)) return "off"
  if (isDone(habit, logs, day)) return "done"
  return day === selected ? "pending" : "missed"
}

/** The `count` days ending on `end` (oldest first), each with its state; `end` is the "selected" day (pending when scheduled and not done). */
export function dayStrip(habit: HabitRow, logs: HabitLogRow[], end: string, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const day = shiftDay(end, i - (count - 1))
    return { day, state: dayState(habit, logs, day, end) }
  })
}

/** The 7 days ending on `end` (oldest first), each with its state. */
export const weekStrip = (habit: HabitRow, logs: HabitLogRow[], end: string) => dayStrip(habit, logs, end, 7)

/** Habits that count on a day: active and scheduled for it. */
export function dueOn(habits: HabitRow[], day: string) {
  return habits.filter((h) => !h.paused && isScheduled(h, day))
}

/** Completion (0–100) of everything scheduled in the `days` days ending on `end`: done check-ins over scheduled ones, all habits together. */
export function overallConsistency(habits: HabitRow[], logs: HabitLogRow[], end: string, days = 30) {
  let scheduled = 0
  let done = 0
  for (let i = 0; i < days; i += 1) {
    const day = shiftDay(end, -i)
    for (const habit of dueOn(habits, day)) {
      scheduled += 1
      if (isDone(habit, logs, day)) done += 1
    }
  }
  return scheduled === 0 ? 0 : Math.round((done / scheduled) * 100)
}

/** Change, in percentage points, of the last `days` days against the `days` before them. */
export function consistencyDelta(habits: HabitRow[], logs: HabitLogRow[], end: string, days = 30) {
  return overallConsistency(habits, logs, end, days) - overallConsistency(habits, logs, shiftDay(end, -days), days)
}

/** Daily completion rate (0–100) for the `days` days ending on `end`, oldest first; a day with nothing scheduled carries the previous value (0 at the start). */
export function dailyRates(habits: HabitRow[], logs: HabitLogRow[], end: string, days = 30) {
  let last = 0
  return Array.from({ length: days }, (_, i) => {
    const value = dayCompletion(habits, logs, shiftDay(end, i - (days - 1)))
    if (value !== null) last = Math.round(value * 100)
    return last
  })
}

/** The longest streak of a habit ever recorded in a long lookback (the personal record). */
export function recordStreak(habit: HabitRow, logs: HabitLogRow[], today: string) {
  return bestStreak(habit, logs, today, 400)
}

/** Habits ranked by current streak (longest first, then by name), those without a streak left out. */
export function topStreaks(habits: HabitRow[], logs: HabitLogRow[], today: string, limit = 3) {
  return habits
    .filter((h) => !h.paused)
    .map((habit) => ({ habit, streak: currentStreak(habit, logs, today), record: recordStreak(habit, logs, today) }))
    .filter((row) => row.streak > 0)
    .sort((a, b) => b.streak - a.streak || a.habit.name.localeCompare(b.habit.name, "pt-BR"))
    .slice(0, limit)
}

// ---------------------------------------------------------------------------------------------------------------------
// Rotina > Histórico

export type DayRecord = { day: string; done: number; total: number; /** 0–1, null when nothing was scheduled. */ rate: number | null }

/** What one day looks like across the given habits (paused ones never count). */
export function dayRecord(habits: HabitRow[], logs: HabitLogRow[], day: string): DayRecord {
  const due = dueOn(habits, day)
  const done = due.filter((h) => isDone(h, logs, day)).length
  return { day, done, total: due.length, rate: due.length === 0 ? null : done / due.length }
}

/** The calendar shade of a day: 4 = 100%, 3 = 67–99%, 2 = 50–66%, 1 = 1–49%, 0 = nothing done (or nothing scheduled). */
export type Level = 0 | 1 | 2 | 3 | 4
export function completionLevel(rate: number | null): Level {
  if (rate === null) return 0
  const pct = Math.round(rate * 100)
  if (pct >= 100) return 4
  if (pct >= 67) return 3
  if (pct >= 50) return 2
  return pct >= 1 ? 1 : 0
}

/** Single-habit calendar state: done, missed, not scheduled, or still open (today not done yet, or a day to come). */
export type HabitDayKind = "done" | "missed" | "off" | "open"
export function habitDayKind(habit: HabitRow, logs: HabitLogRow[], day: string, today: string): HabitDayKind {
  if (!isScheduled(habit, day)) return "off"
  if (isDone(habit, logs, day)) return "done"
  return day >= today ? "open" : "missed"
}

/** A month as whole weeks (Sunday first): every day with whether it belongs to the month ("yyyy-MM"). */
export function monthCells(month: string) {
  const first = parseISO(`${month}-01`)
  const start = addDays(first, -getDay(first))
  const lastDay = addDays(addMonths(first, 1), -1)
  const end = addDays(lastDay, 6 - getDay(lastDay))
  const count = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  return Array.from({ length: count }, (_, i) => {
    const day = format(addDays(start, i), "yyyy-MM-dd")
    return { day, inMonth: day.startsWith(month) }
  })
}

/** The first day of each 7-day block of the last `blocks` weeks ending on `end` (the labels above the 28-day strip). */
export function blockStarts(end: string, blocks = 4) {
  return Array.from({ length: blocks }, (_, i) => shiftDay(end, -(blocks * 7 - 1) + i * 7))
}

/** Completion (0–100) of one habit over the last `days` days. */
export const windowRate = (habit: HabitRow, logs: HabitLogRow[], end: string, days = 28) => consistency(habit, logs, end, days)

/** Mean of the habits' completion over the last `days` days. */
export function averageRate(habits: HabitRow[], logs: HabitLogRow[], end: string, days = 28) {
  const active = habits.filter((h) => !h.paused)
  return active.length === 0 ? 0 : Math.round(active.reduce((sum, h) => sum + windowRate(h, logs, end, days), 0) / active.length)
}

/** The "4 semanas" calendar: the 4 whole Sunday-first weeks that end with the current week (28 days, the later ones still to come). */
export function fourWeekCells(today: string) {
  const start = shiftDay(today, -getDay(parseISO(today)) - 21)
  return Array.from({ length: 28 }, (_, i) => ({ day: shiftDay(start, i), inMonth: true }))
}

// ---------------------------------------------------------------------------------------------------------------------
// Rotina > Estatísticas (everything is derived from habits and logs at read time)

export const PERIODS = [7, 30, 90] as const
export type Period = (typeof PERIODS)[number]

/** How many weekly bars the "Constância por semana" chart draws for a period. */
export const weeksFor = (days: number) => (days <= 7 ? 4 : days <= 30 ? 8 : 12)

/** Scheduled check-ins of a habit in the `days` days ending on `end`. */
export function scheduledIn(habit: HabitRow, end: string, days: number) {
  let count = 0
  for (let i = 0; i < days; i += 1) if (isScheduled(habit, shiftDay(end, -i))) count += 1
  return count
}

/** The longest streak reached by any active habit inside the period (a streak is not cut at the period start). */
export function bestStreakOf(habits: HabitRow[], logs: HabitLogRow[], end: string, days: number) {
  let best: { habit: HabitRow; days: number } | null = null
  for (const habit of habits.filter((h) => !h.paused)) {
    const value = bestStreak(habit, logs, end, days - 1)
    if (value > 0 && (!best || value > best.days)) best = { habit, days: value }
  }
  return best
}

/** Check-ins (days with a log) in the month of `day` ("yyyy-MM"). */
export const monthCheckins = (logs: HabitLogRow[], day: string) => logs.filter((l) => l.qty > 0 && l.log_date.startsWith(day.slice(0, 7))).length

export type WeekdayStat = { weekday: number; done: number; total: number; /** 0–100, null when nothing was scheduled on that weekday. */ rate: number | null }

/** Completion per weekday (0 = Sunday … 6 = Saturday) over the `days` days ending on `end`, all active habits together. */
export function weekdayStats(habits: HabitRow[], logs: HabitLogRow[], end: string, days: number): WeekdayStat[] {
  const stats = Array.from({ length: 7 }, (_, weekday) => ({ weekday, done: 0, total: 0, rate: null as number | null }))
  for (let i = 0; i < days; i += 1) {
    const day = shiftDay(end, -i)
    const slot = stats[getDay(parseISO(day))]
    for (const habit of dueOn(habits, day)) {
      slot.total += 1
      if (isDone(habit, logs, day)) slot.done += 1
    }
  }
  for (const slot of stats) slot.rate = slot.total === 0 ? null : Math.round((slot.done / slot.total) * 100)
  return stats
}

/** The best and the hardest weekday (ties go to the earlier weekday, Monday first); null when there is no data. */
export function bestAndWorstWeekday(stats: WeekdayStat[]) {
  const ordered = [1, 2, 3, 4, 5, 6, 0].map((d) => stats[d]).filter((s) => s.rate !== null)
  if (ordered.length === 0) return null
  const best = ordered.reduce((a, b) => ((b.rate ?? 0) > (a.rate ?? 0) ? b : a))
  const worst = ordered.reduce((a, b) => ((b.rate ?? 0) < (a.rate ?? 0) ? b : a))
  return { best, worst }
}

export type WeekRate = { start: string; end: string; rate: number | null }

function overallTotals(habits: HabitRow[], logs: HabitLogRow[], end: string, days: number) {
  let scheduled = 0
  let done = 0
  for (let i = 0; i < days; i += 1) {
    const day = shiftDay(end, -i)
    for (const habit of dueOn(habits, day)) {
      scheduled += 1
      if (isDone(habit, logs, day)) done += 1
    }
  }
  return { scheduled, done }
}

/** Rolling 7-day blocks ending today, oldest first (the last one is the current week). Leading blocks with nothing scheduled are dropped. */
export function weeklyRates(habits: HabitRow[], logs: HabitLogRow[], end: string, weeks: number): WeekRate[] {
  const all = Array.from({ length: weeks }, (_, i) => {
    const blockEnd = shiftDay(end, -(weeks - 1 - i) * 7)
    const total = overallTotals(habits, logs, blockEnd, 7)
    return { start: shiftDay(blockEnd, -6), end: blockEnd, rate: total.scheduled === 0 ? null : Math.round((total.done / total.scheduled) * 100) }
  })
  const first = all.findIndex((w) => w.rate !== null)
  return first < 0 ? [] : all.slice(first)
}

export type HabitStat = { habit: HabitRow; rate: number; previous: number; /** Points against the previous period. */ delta: number; scheduled: number }

/** One row per habit: completion in the period, in the period before it, and the change; best first, paused habits last. */
export function habitStats(habits: HabitRow[], logs: HabitLogRow[], end: string, days: number): HabitStat[] {
  return habits
    .map((habit) => {
      const rate = windowRate(habit, logs, end, days)
      const previous = windowRate(habit, logs, shiftDay(end, -days), days)
      return { habit, rate, previous, delta: rate - previous, scheduled: scheduledIn(habit, end, days) }
    })
    .sort((a, b) => Number(a.habit.paused) - Number(b.habit.paused) || b.rate - a.rate || a.habit.name.localeCompare(b.habit.name, "pt-BR"))
}

export type Insight = {
  kind: "weekday" | "improved" | "below"
  title: string
  text: string
  /** The habit the action opens (the schedule / the habit editor). */
  habitId?: string
  action?: string
}

const LONG_WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

/** Up to three hints, in this order: hardest weekday under 60%, biggest gain of 10+ points, a habit under 60%. Rules that do not apply are skipped. */
export function insightsFor(habits: HabitRow[], logs: HabitLogRow[], end: string, days: number): Insight[] {
  const out: Insight[] = []
  const active = habits.filter((h) => !h.paused)
  const weekdays = bestAndWorstWeekday(weekdayStats(active, logs, end, days))
  if (weekdays && weekdays.worst.rate !== null && weekdays.worst.rate < 60) {
    const misses = (habit: HabitRow) => {
      let count = 0
      for (let i = 0; i < days; i += 1) {
        const day = shiftDay(end, -i)
        if (getDay(parseISO(day)) === weekdays.worst.weekday && isScheduled(habit, day) && !isDone(habit, logs, day)) count += 1
      }
      return count
    }
    const target = [...active].sort((a, b) => misses(b) - misses(a))[0]
    out.push({ kind: "weekday", title: `${LONG_WEEKDAYS[weekdays.worst.weekday]} é seu dia mais difícil`, text: `${weekdays.worst.rate}% de conclusão nesse dia`, habitId: target?.id, action: "Ajustar dias" })
  }
  const stats = habitStats(active, logs, end, days).filter((s) => s.scheduled > 0)
  const gain = stats.reduce<HabitStat | null>((a, b) => (b.delta >= 10 && (!a || b.delta > a.delta) ? b : a), null)
  if (gain) out.push({ kind: "improved", title: `${gain.habit.name} subiu ${gain.delta} pts`, text: `de ${gain.previous}% para ${gain.rate}% em relação ao período anterior`, habitId: gain.habit.id })
  const low = stats.filter((s) => s.rate < 60).sort((a, b) => a.rate - b.rate)[0]
  if (low) out.push({ kind: "below", title: `${low.habit.name} está abaixo de 60%`, text: `${low.rate}% de conclusão: vale ajustar a meta ou os dias`, habitId: low.habit.id, action: "Editar hábito" })
  return out.slice(0, 3)
}
