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
