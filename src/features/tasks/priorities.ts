import type { Priority, TaskView } from "./types"

/**
 * User-defined priorities. The database still stores the four-value `tasks.priority` column, so this layer keeps that column
 * consistent (`enumFor`) while the person's own list (names, order = weight) lives behind `PriorityRepo`. Today the repo is a
 * localStorage adapter; `supabase/migrations/20261105000001_task_priorities.sql` (prepared, NOT applied) adds the tables for a
 * server adapter. "Sem prioridade" is fixed and not part of the list.
 */
export type PriorityDef = { id: string; name: string }

export type PriorityState = {
  /** Ordered from the lightest to the heaviest: the position is the weight. */
  list: PriorityDef[]
  /** taskId -> priority id. A task without an entry falls back to its stored enum (see `resolvePriority`). */
  assigned: Record<string, string>
}

export const SEED_PRIORITIES: PriorityDef[] = [
  { id: "baixa", name: "Baixa" },
  { id: "media", name: "Média" },
  { id: "alta", name: "Alta" },
  { id: "urgente", name: "Urgente" },
]

export const DEFAULT_PRIORITY_STATE: PriorityState = { list: SEED_PRIORITIES, assigned: {} }

export type PriorityRepo = {
  load(): PriorityState
  save(state: PriorityState): void
}

const STORAGE_KEY = "organizzou:tarefas-priorities"

/** Tolerant reader: anything broken falls back to the seeds. */
export function parsePriorityState(raw: string | null): PriorityState {
  if (!raw) return DEFAULT_PRIORITY_STATE
  try {
    const data = JSON.parse(raw) as Partial<PriorityState>
    const list = Array.isArray(data.list)
      ? data.list.filter((p): p is PriorityDef => Boolean(p) && typeof p.id === "string" && typeof p.name === "string" && p.name.trim() !== "").map((p) => ({ id: p.id, name: p.name.trim().slice(0, 80) }))
      : null
    if (!list) return DEFAULT_PRIORITY_STATE
    const assigned = data.assigned && typeof data.assigned === "object" ? Object.fromEntries(Object.entries(data.assigned).filter(([, v]) => typeof v === "string" && list.some((p) => p.id === v))) : {}
    return { list, assigned }
  } catch {
    return DEFAULT_PRIORITY_STATE
  }
}

export const localPriorityRepo: PriorityRepo = {
  load() {
    try {
      return parsePriorityState(window.localStorage.getItem(STORAGE_KEY))
    } catch {
      return DEFAULT_PRIORITY_STATE
    }
  },
  save(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Private mode: the choice just does not survive the visit.
    }
  },
}

const LEGACY: Record<Exclude<Priority, "none">, string> = { low: "baixa", medium: "media", high: "alta" }

/** The priority a task shows: its own assignment, else the one its stored enum stands for; null = "Sem prioridade". */
export function priorityOf(state: PriorityState, task: Pick<TaskView, "id" | "priority">): PriorityDef | null {
  const assigned = state.assigned[task.id]
  if (assigned) return state.list.find((p) => p.id === assigned) ?? null
  if (task.priority === "none") return null
  return state.list.find((p) => p.id === LEGACY[task.priority as Exclude<Priority, "none">]) ?? null
}

/** The stored enum that stands for a priority (so filters, sorting and the server keep working): thirds of the list. */
export function enumFor(list: PriorityDef[], id: string | null): Priority {
  if (!id) return "none"
  const index = list.findIndex((p) => p.id === id)
  if (index < 0) return "none"
  const ratio = (index + 1) / list.length
  return ratio <= 1 / 3 ? "low" : ratio <= 2 / 3 ? "medium" : "high"
}

/** The flag is filled for the heavier half of the list and an outline for the lighter half. */
export function isTopHalf(list: PriorityDef[], id: string) {
  const index = list.findIndex((p) => p.id === id)
  return index >= Math.floor(list.length / 2) && index >= 0
}

export function newPriorityId() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** How many of these tasks currently show the priority (for "usada em N tarefas"). */
export function usageOf(state: PriorityState, tasks: Pick<TaskView, "id" | "priority">[], id: string) {
  return tasks.filter((t) => priorityOf(state, t)?.id === id).length
}
