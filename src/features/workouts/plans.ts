// Pure helpers of the "Meus treinos" tab: the weekly planning, the order of the exercises and the numbers of a workout.
import { estimatedMinutes } from "./session"
import type { PlanExerciseRow, SetLogRow, WorkoutSessionRow } from "./types"

/** The week as the tab shows it: Monday first (0 = Sunday … 6 = Saturday). */
export const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0]

/** Weekdays without repeats, Monday first. */
export function sortWeekdays(weekdays: number[]) {
  return MONDAY_FIRST.filter((d) => weekdays.includes(d))
}

/** The workout also happens on `day` (a workout can be on several days). */
export const addWeekday = (weekdays: number[], day: number) => sortWeekdays([...weekdays, day])

/** The workout no longer happens on `day`. */
export const removeWeekday = (weekdays: number[], day: number) => sortWeekdays(weekdays.filter((d) => d !== day))

/** Dropped on a day it is not on: add it; chosen again from the menu: remove it. */
export const toggleWeekday = (weekdays: number[], day: number) => (weekdays.includes(day) ? removeWeekday(weekdays, day) : addWeekday(weekdays, day))

/**
 * Moves the exercise `fromId` to the place of `toId` inside one workout and renumbers that workout's positions from 1.
 * Rows of other workouts come back untouched; an unknown id changes nothing.
 */
export function reorderExercises<T extends Pick<PlanExerciseRow, "id" | "plan_id" | "position">>(rows: T[], planId: string, fromId: string, toId: string): T[] {
  const own = rows.filter((r) => r.plan_id === planId).sort((a, b) => a.position - b.position)
  const from = own.findIndex((r) => r.id === fromId)
  const to = own.findIndex((r) => r.id === toId)
  if (from < 0 || to < 0 || from === to) return rows
  const moved = [...own]
  const [item] = moved.splice(from, 1)
  moved.splice(to, 0, item)
  const positions = new Map(moved.map((r, index) => [r.id, index + 1]))
  return rows.map((r) => (positions.has(r.id) ? { ...r, position: positions.get(r.id)! } : r))
}

/** Exercises, sets and the estimated minutes of a workout (the same estimate as the Hoje tab). */
export function planTotals(items: Pick<PlanExerciseRow, "sets" | "rest_seconds">[]) {
  return { exercises: items.length, sets: items.reduce((sum, item) => sum + item.sets, 0), minutes: estimatedMinutes(items) }
}

/** The heaviest load of the latest completed session that has the exercise; null when it was never done. */
export function lastLoad(exerciseId: string, sets: SetLogRow[], sessions: WorkoutSessionRow[]) {
  const last = sessions
    .filter((s) => s.completed && sets.some((set) => set.session_id === s.id && set.exercise_id === exerciseId))
    .sort((a, b) => b.performed_on.localeCompare(a.performed_on))[0]
  if (!last) return null
  const loads = sets.filter((set) => set.session_id === last.id && set.exercise_id === exerciseId).map((set) => set.load_kg)
  return Math.max(...loads)
}

/** "72,5 kg", or null for no load. */
export function formatLoad(load: number | null) {
  return load && load > 0 ? `${load.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg` : null
}
