// One source of truth for the daily water: the Dieta water log (water_logs) and the Dieta water goal (diet_goals.water_ml). A goal habit
// in a water unit (L, ml, copos) reads its progress from that log and writes to it, and its goal becomes the water goal. Pure.
import { fromMl, isWaterHabit, toMl } from "./steps"
import type { HabitLogRow, HabitRow } from "./types"

export type WaterLog = { id: string; log_date: string; ml: number }

export const waterOf = (logs: WaterLog[], day: string): number => logs.filter((l) => l.log_date === day).reduce((sum, l) => sum + l.ml, 0)

/**
 * The water log after moving the day's total by `deltaMl`: more water adds one entry, less water takes the most recent entries back
 * (an entry larger than what is left is only shortened). Never below zero.
 */
export function adjustWater(logs: WaterLog[], day: string, deltaMl: number, newId: () => string): WaterLog[] {
  const delta = Math.round(deltaMl)
  if (delta === 0) return logs
  if (delta > 0) return [...logs, { id: newId(), log_date: day, ml: delta }]
  let left = -delta
  const next = [...logs]
  for (let i = next.length - 1; i >= 0 && left > 0; i--) {
    if (next[i].log_date !== day) continue
    if (next[i].ml > left) {
      next[i] = { ...next[i], ml: next[i].ml - left }
      left = 0
    } else {
      left -= next[i].ml
      next.splice(i, 1)
    }
  }
  return next
}

/** Sets the day's total to `targetMl` (an exact amount typed, or a quantity saved from Hoje). */
export const setWater = (logs: WaterLog[], day: string, targetMl: number, newId: () => string): WaterLog[] => adjustWater(logs, day, Math.max(0, Math.round(targetMl)) - waterOf(logs, day), newId)

/** The habit's goal in ml, which becomes the water goal of Dieta and Hoje (at least 1 ml). */
export const waterGoalMlOf = (habit: Pick<HabitRow, "target_qty" | "unit">): number => Math.max(1, toMl(habit.target_qty ?? 0, habit.unit))

/**
 * The habit logs as every screen should read them: for a water habit the day's quantity comes from the water log (in the habit's unit); the
 * logs of other habits are untouched.
 */
export function withWaterLogs(habits: HabitRow[], logs: HabitLogRow[], water: WaterLog[]): HabitLogRow[] {
  const waterHabits = habits.filter(isWaterHabit)
  if (waterHabits.length === 0) return logs
  const ids = new Set(waterHabits.map((h) => h.id))
  const kept = logs.filter((l) => !ids.has(l.habit_id))
  const days = [...new Set(water.map((w) => w.log_date))]
  const derived: HabitLogRow[] = []
  for (const habit of waterHabits) {
    for (const day of days) {
      const ml = waterOf(water, day)
      if (ml <= 0) continue
      const stamp = `${day}T12:00:00.000Z`
      derived.push({ id: `water-${habit.id}-${day}`, user_id: habit.user_id, habit_id: habit.id, log_date: day, qty: fromMl(ml, habit.unit), created_at: stamp, updated_at: stamp })
    }
  }
  return [...kept, ...derived]
}
