// Pure helpers of the "Hoje" tab of Estudos. Everything is derived from the study sessions, subjects and deadlines already saved.
import { shiftDay } from "@/features/habits/stats"

import { daysUntil } from "./spaced-repetition"

export type SessionLike = { studied_on: string; minutes: number }

/** "5 h 45 min" as parts, so the unit can be dimmed: [{text:"5"},{text:" h ",unit},{text:"45"},{text:" min",unit}]. */
export type DurationPart = { text: string; unit?: boolean }
export function durationParts(minutes: number): DurationPart[] {
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return [{ text: String(m) }, { text: " min", unit: true }]
  if (m === 0) return [{ text: String(h) }, { text: " h", unit: true }]
  return [{ text: String(h) }, { text: " h ", unit: true }, { text: String(m) }, { text: " min", unit: true }]
}

/** "48 min", "3 h", "5 h 45 min". */
export const durationText = (minutes: number) => durationParts(minutes).map((p) => p.text).join("")

/** Days with at least one minute studied. */
export function studiedDays(sessions: SessionLike[]): Set<string> {
  return new Set(sessions.filter((s) => s.minutes > 0).map((s) => s.studied_on))
}

/**
 * Consecutive days studied. It counts back from today; while today is still empty the streak is not broken yet, so it counts back from
 * yesterday (it only resets once a whole day passes without studying).
 */
export function currentStreak(days: Set<string>, today: string): number {
  let cursor = days.has(today) ? today : shiftDay(today, -1)
  let count = 0
  while (days.has(cursor)) {
    count += 1
    cursor = shiftDay(cursor, -1)
  }
  return count
}

/** The longest run of consecutive studied days in the data we have. */
export function bestStreak(days: Set<string>): number {
  const sorted = [...days].sort()
  let best = 0
  let run = 0
  let previous: string | null = null
  for (const day of sorted) {
    run = previous !== null && shiftDay(previous, 1) === day ? run + 1 : 1
    best = Math.max(best, run)
    previous = day
  }
  return best
}

/** The seven days of the week that starts on `weekStart` (Monday), in order. */
export const weekOf = (weekStart: string) => Array.from({ length: 7 }, (_, i) => shiftDay(weekStart, i))

/** Minutes studied on each of the seven days of the week. */
export function minutesByDay(sessions: SessionLike[], weekStart: string): { day: string; minutes: number }[] {
  return weekOf(weekStart).map((day) => ({ day, minutes: sessions.filter((s) => s.studied_on === day).reduce((sum, s) => sum + s.minutes, 0) }))
}

/** The day of the week with the most minutes (the earliest wins a tie); null when nothing was studied. */
export function bestDay(week: { day: string; minutes: number }[]) {
  let best: { day: string; minutes: number } | null = null
  for (const d of week) if (d.minutes > 0 && (best === null || d.minutes > best.minutes)) best = d
  return best
}

/** Average minutes per day of the week so far: the week's total over the days elapsed (Monday = 1 … Sunday = 7). */
export function averagePerDay(week: { day: string; minutes: number }[], today: string): number {
  const elapsed = week.filter((d) => d.day <= today)
  if (elapsed.length === 0) return 0
  return Math.round(elapsed.reduce((sum, d) => sum + d.minutes, 0) / elapsed.length)
}

/** 0–100+ : minutes over the goal, not capped (the bars cap it). 0 without a goal. */
export function percentOf(minutes: number, goal: number): number {
  return goal > 0 ? Math.round((minutes / goal) * 100) : 0
}

/** The daily goal implied by the weekly goals: their total over 7 days, rounded to the nearest 30 minutes (at least 30 when there is a goal). */
export function dailyGoal(weeklyGoalMinutes: number): number {
  if (weeklyGoalMinutes <= 0) return 0
  return Math.max(30, Math.round(weeklyGoalMinutes / 7 / 30) * 30)
}

export type StripState = "done" | "missed" | "today" | "future"

/** done = studied; missed = a past day without study; today = today still empty; future = not yet. */
export function stripState(day: string, today: string, studied: Set<string>): StripState {
  if (studied.has(day)) return "done"
  if (day > today) return "future"
  return day === today ? "today" : "missed"
}

/** Where the pomodoro cycle stands: `done` focus sessions of the current round of 4, and the cycle number (1–4) being worked on. */
export function pomodoroCycle(focusSessionsToday: number) {
  const done = ((focusSessionsToday % 4) + 4) % 4
  return { done, cycle: done + 1 }
}

/** Days left until a deadline, the chip text and whether the chip is solid (3 days or less, today included). */
export function deadlineChip(due: string, today: string) {
  const left = daysUntil(due, today)
  return { left, text: left === 0 ? "Hoje" : left === 1 ? "1 dia" : `${left} dias`, solid: left <= 3 }
}

/** The next deadlines from today on, soonest first. */
export function nextDeadlines<T extends { due_on: string }>(deadlines: T[], today: string, limit = 3): T[] {
  return deadlines
    .filter((d) => d.due_on >= today)
    .sort((a, b) => a.due_on.localeCompare(b.due_on))
    .slice(0, limit)
}
