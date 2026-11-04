import { dayDiff, isOverdue } from "@/lib/dates"

import { applyFilters, EMPTY_FILTERS, type DueFilter } from "./filters"
import type { TaskView } from "./types"

/**
 * What "Tarefas" counts, in ONE place. A task is PENDING when it is not completed and not archived. The sidebar badge counts the
 * pending tasks of every board (the same predicate, in SQL: layout.tsx); the toolbar chips count the pending tasks of the board on
 * screen. With a single board the two numbers are the same, with several the badge is the sum of the boards.
 */
export const isPending = (task: Pick<TaskView, "completed_at" | "archived">) => !task.completed_at && !task.archived
export const countPending = (tasks: Pick<TaskView, "completed_at" | "archived">[]) => tasks.filter(isPending).length

export type Shortcut = "todas" | "hoje" | "semana" | "atrasadas" | "sem-data"

/** The shortcut chips, in order, and the due filter each one applies. */
export const SHORTCUTS: { id: Shortcut; label: string; due: DueFilter }[] = [
  { id: "todas", label: "Todas", due: "all" },
  { id: "hoje", label: "Hoje", due: "today" },
  { id: "semana", label: "Esta semana", due: "week" },
  { id: "atrasadas", label: "Atrasadas", due: "overdue" },
  { id: "sem-data", label: "Sem data", due: "none" },
]

export const shortcutOf = (due: DueFilter): Shortcut => SHORTCUTS.find((s) => s.due === due)?.id ?? "todas"
export const dueOfShortcut = (id: string | null | undefined): DueFilter => SHORTCUTS.find((s) => s.id === id)?.due ?? "all"

/** Pending tasks per shortcut (a chip with 0 is hidden by the toolbar). */
export function shortcutCounts(tasks: TaskView[], context: { now: Date; timeZone: string }): Record<Shortcut, number> {
  const pending = tasks.filter(isPending)
  const count = (due: DueFilter) => applyFilters(pending, { ...EMPTY_FILTERS, due }, context).length
  return { todas: pending.length, hoje: count("today"), semana: count("week"), atrasadas: count("overdue"), "sem-data": count("none") }
}

export type DueGroupId = "atrasadas" | "hoje" | "amanha" | "semana" | "depois" | "sem-data" | "concluidas"

export const DUE_GROUPS: { id: DueGroupId; label: string }[] = [
  { id: "atrasadas", label: "Atrasadas" },
  { id: "hoje", label: "Hoje" },
  { id: "amanha", label: "Amanhã" },
  { id: "semana", label: "Esta semana" },
  { id: "depois", label: "Mais tarde" },
  { id: "sem-data", label: "Sem data" },
  { id: "concluidas", label: "Concluídas" },
]

export function dueGroupOf(task: TaskView, context: { now: Date; timeZone: string }): DueGroupId {
  if (task.completed_at) return "concluidas"
  if (!task.due_at) return "sem-data"
  if (isOverdue(task, context.now, context.timeZone)) return "atrasadas"
  const diff = dayDiff(task.due_at, context.now, context.timeZone)
  if (diff <= 0) return "hoje"
  if (diff === 1) return "amanha"
  return diff <= 6 ? "semana" : "depois"
}

/** The non-empty groups of the Lista view, in the fixed order (Atrasadas ... Concluídas); each keeps the order it came in. */
export function groupByDue(tasks: TaskView[], context: { now: Date; timeZone: string }) {
  const buckets = new Map<DueGroupId, TaskView[]>(DUE_GROUPS.map((g) => [g.id, []]))
  for (const task of tasks) buckets.get(dueGroupOf(task, context))!.push(task)
  return DUE_GROUPS.map((g) => ({ ...g, tasks: buckets.get(g.id)! })).filter((g) => g.tasks.length > 0)
}

