// Pure helpers of the "Hoje" tab of Treinos. Everything here is derived from the plan, the drafts of the session and the saved history.
import { volume } from "./stats"
import type { SetLogRow, WorkoutPlanRow, WorkoutSessionRow } from "./types"

/** What one set of the running session looks like: the fields as typed (decimal comma allowed) and whether it was checked. */
export type SetDraft = { reps: string; load: string; done: boolean }

/** "72,5" -> 72.5, "" or junk -> 0. */
export function parseNumber(text: string) {
  const value = Number(text.trim().replace(",", "."))
  return Number.isFinite(value) && value > 0 ? value : 0
}

/** Average time under tension of one set, used for the estimate. */
export const SECONDS_PER_SET = 45

/** Estimated minutes of a workout: every set takes ~45 s and is followed by its exercise's rest. */
export function estimatedMinutes(items: { sets: number; rest_seconds: number }[]) {
  const seconds = items.reduce((sum, item) => sum + item.sets * (SECONDS_PER_SET + Math.max(0, item.rest_seconds)), 0)
  return Math.round(seconds / 60)
}

/** Volume (kg) of the sets that are checked so far. */
export function doneVolume(drafts: SetDraft[]) {
  return volume(drafts.filter((d) => d.done).map((d) => ({ reps: parseNumber(d.reps), load_kg: parseNumber(d.load) })))
}

/** The first set still to do, walking the exercises in order: which exercise and which set (0-based). Null when everything is checked. */
export function nextPendingSet<T extends { id: string }>(items: T[], draftsOf: (item: T) => SetDraft[]) {
  for (const item of items) {
    const index = draftsOf(item).findIndex((d) => !d.done)
    if (index >= 0) return { item, index }
  }
  return null
}

/** The rest that starts when a set is checked: that exercise's rest time, nothing after the very last set or when the exercise has no rest. */
export function restAfterSet(restSeconds: number, allDone: boolean) {
  return allDone || restSeconds <= 0 ? 0 : Math.round(restSeconds)
}

/** Volume of the most recent completed session of a plan before `before` (a "yyyy-MM-dd" day); null when there is none. */
export function lastVolume(sessions: WorkoutSessionRow[], sets: SetLogRow[], planId: string, before: string) {
  const last = sessions
    .filter((s) => s.plan_id === planId && s.completed && s.performed_on < before)
    .sort((a, b) => b.performed_on.localeCompare(a.performed_on))[0]
  if (!last) return null
  return volume(sets.filter((s) => s.session_id === last.id))
}

/** A, B, C… by the position of the plan in the list. */
export function planLetter(plans: Pick<WorkoutPlanRow, "id">[], id: string) {
  const index = plans.findIndex((p) => p.id === id)
  return index < 0 ? "" : String.fromCharCode(65 + (index % 26))
}

/** "850 kg" below a ton, "4,2 t" from there on. */
export function formatVolume(kg: number) {
  if (kg < 1000) return `${Math.round(kg).toLocaleString("pt-BR")} kg`
  return `${(Math.round(kg / 100) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} t`
}

/** "1:30" (the rest of an exercise). */
export function restLabel(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/** "mm:ss" of an elapsed time. */
export function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}
