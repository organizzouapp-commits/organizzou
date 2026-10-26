import { addDays, format, parseISO, startOfWeek } from "date-fns"

import type { SetLogRow, WorkoutSessionRow } from "./types"

export function volume(sets: Pick<SetLogRow, "reps" | "load_kg">[]) {
  return sets.reduce((sum, s) => sum + s.reps * s.load_kg, 0)
}

/** Epley estimate of the one-rep max. */
export function estimatedOneRepMax(loadKg: number, reps: number) {
  return reps <= 1 ? loadKg : Math.round(loadKg * (1 + reps / 30) * 10) / 10
}

export type PersonalRecord = { exerciseId: string; loadKg: number; reps: number; oneRepMax: number; on: string }

/** Best set per exercise (highest estimated 1RM). */
export function personalRecords(sets: SetLogRow[], sessions: WorkoutSessionRow[]): PersonalRecord[] {
  const dayOf = new Map(sessions.map((s) => [s.id, s.performed_on]))
  const best = new Map<string, PersonalRecord>()
  for (const set of sets) {
    const oneRepMax = estimatedOneRepMax(set.load_kg, set.reps)
    const current = best.get(set.exercise_id)
    if (!current || oneRepMax > current.oneRepMax) {
      best.set(set.exercise_id, {
        exerciseId: set.exercise_id,
        loadKg: set.load_kg,
        reps: set.reps,
        oneRepMax,
        on: dayOf.get(set.session_id) ?? "",
      })
    }
  }
  return [...best.values()]
}

/** Heaviest load per session for one exercise, oldest first. */
export function loadProgress(exerciseId: string, sets: SetLogRow[], sessions: WorkoutSessionRow[]) {
  return sessions
    .filter((s) => s.completed)
    .map((session) => {
      const loads = sets.filter((set) => set.session_id === session.id && set.exercise_id === exerciseId).map((set) => set.load_kg)
      return { day: session.performed_on, load: loads.length ? Math.max(...loads) : null }
    })
    .filter((point): point is { day: string; load: number } => point.load !== null)
    .sort((a, b) => a.day.localeCompare(b.day))
}

/** Total lifted volume per ISO-ish week (weeks start on Monday), last `weeks` weeks. */
export function weeklyVolume(sets: SetLogRow[], sessions: WorkoutSessionRow[], today: string, weeks = 8) {
  const monday = startOfWeek(parseISO(today), { weekStartsOn: 1 })
  return Array.from({ length: weeks }, (_, index) => {
    const start = addDays(monday, (index - (weeks - 1)) * 7)
    const startKey = format(start, "yyyy-MM-dd")
    const endKey = format(addDays(start, 7), "yyyy-MM-dd")
    const ids = new Set(sessions.filter((s) => s.completed && s.performed_on >= startKey && s.performed_on < endKey).map((s) => s.id))
    const total = volume(sets.filter((set) => ids.has(set.session_id)))
    return { week: format(start, "dd/MM"), volume: Math.round(total), sessions: ids.size }
  })
}
