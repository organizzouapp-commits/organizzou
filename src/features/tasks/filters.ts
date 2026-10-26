import { dayDiff, isOverdue } from "@/lib/dates"

import type { ListRow, Priority, TaskView } from "./types"
import { asPriority } from "./types"

export type DueFilter = "all" | "overdue" | "today" | "week" | "none"
export type SortKey = "manual" | "due" | "priority" | "title" | "created"

export type TaskFilters = {
  query: string
  priorities: Priority[]
  tagIds: string[]
  due: DueFilter
  listIds: string[]
  showCompleted: boolean
}

export const EMPTY_FILTERS: TaskFilters = {
  query: "",
  priorities: [],
  tagIds: [],
  due: "all",
  listIds: [],
  showCompleted: true,
}

export function countActiveFilters(filters: TaskFilters) {
  return (
    (filters.priorities.length > 0 ? 1 : 0) +
    (filters.tagIds.length > 0 ? 1 : 0) +
    (filters.due !== "all" ? 1 : 0) +
    (filters.listIds.length > 0 ? 1 : 0) +
    (filters.showCompleted ? 0 : 1)
  )
}

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

export function applyFilters(
  tasks: TaskView[],
  filters: TaskFilters,
  context: { now: Date; timeZone: string }
) {
  const query = normalize(filters.query.trim())

  return tasks.filter((task) => {
    if (!filters.showCompleted && task.completed_at) return false
    if (filters.priorities.length > 0 && !filters.priorities.includes(asPriority(task.priority))) return false
    if (filters.tagIds.length > 0 && !filters.tagIds.some((id) => task.tagIds.includes(id))) return false
    if (filters.listIds.length > 0 && !filters.listIds.includes(task.list_id)) return false

    switch (filters.due) {
      case "none":
        if (task.due_at) return false
        break
      case "overdue":
        if (task.completed_at || !isOverdue(task, context.now, context.timeZone)) return false
        break
      case "today":
        if (!task.due_at || dayDiff(task.due_at, context.now, context.timeZone) !== 0) return false
        break
      case "week": {
        if (!task.due_at) return false
        const diff = dayDiff(task.due_at, context.now, context.timeZone)
        if (diff < 0 || diff > 6) return false
        break
      }
    }

    if (query) {
      const haystack = normalize(`${task.title} ${task.description ?? ""} ${task.category ?? ""}`)
      if (!haystack.includes(query)) return false
    }
    return true
  })
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 }

export function sortTasks(tasks: TaskView[], sort: SortKey) {
  const copy = [...tasks]
  switch (sort) {
    case "due":
      return copy.sort((a, b) => {
        if (!a.due_at && !b.due_at) return a.position - b.position
        if (!a.due_at) return 1
        if (!b.due_at) return -1
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
      })
    case "priority":
      return copy.sort(
        (a, b) =>
          PRIORITY_RANK[asPriority(a.priority)] - PRIORITY_RANK[asPriority(b.priority)] ||
          a.position - b.position
      )
    case "title":
      return copy.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"))
    case "created":
      return copy.sort((a, b) => b.created_at.localeCompare(a.created_at))
    default:
      return copy.sort((a, b) => a.position - b.position)
  }
}

export function groupByList(tasks: TaskView[], lists: ListRow[]) {
  const map = new Map<string, TaskView[]>(lists.map((list) => [list.id, []]))
  for (const task of tasks) map.get(task.list_id)?.push(task)
  return map
}

/**
 * Returns the ordered id list of `listId` after moving `taskId` to `index`.
 * Used by drag and drop: the server stores positions as `index * 1000`.
 */
export function moveWithin(ids: string[], taskId: string, index: number) {
  const without = ids.filter((id) => id !== taskId)
  const clamped = Math.max(0, Math.min(index, without.length))
  return [...without.slice(0, clamped), taskId, ...without.slice(clamped)]
}
