import { addDays, format, getDay, parseISO } from "date-fns"

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

/** The 7 days ending on `end` (oldest first), each with its state. */
export function weekStrip(habit: HabitRow, logs: HabitLogRow[], end: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = shiftDay(end, i - 6)
    return { day, state: dayState(habit, logs, day, end) }
  })
}

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
