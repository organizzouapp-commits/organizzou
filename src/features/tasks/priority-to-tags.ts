import { priorityOf, type PriorityState } from "./priorities"
import type { TagRow, TaskView } from "./types"

/**
 * Priorities became tags. This is the pure planner of the one-time, non-destructive conversion (the board runs it once per quadro, flagged
 * in `organizzou:tarefas-priority-tags-v1:<board>`; `supabase/migrations/20261106000002_priorities_to_tags.sql` does the same on the server,
 * prepared and NOT applied). The old `tasks.priority` column and the priority list are left exactly as they were.
 *
 *  - every task with a priority P gets a tag named P (same name, same color);
 *  - a tag with that name (case-insensitive) is reused, otherwise it is created once;
 *  - a task that already carries the tag is skipped (so running it twice changes nothing);
 *  - "Sem prioridade" creates nothing.
 */
export type PriorityTagPlan = {
  /** Tags to create, one per distinct name (case-insensitive). */
  create: { name: string; color: string | null }[]
  /** Tasks that need the tag with this (lower-cased) name. */
  assign: { taskId: string; key: string }[]
}

const keyOf = (name: string) => name.trim().toLocaleLowerCase("pt-BR")

export function planPriorityTags(input: { tasks: Pick<TaskView, "id" | "priority" | "tagIds">[]; priorities: PriorityState; tags: Pick<TagRow, "id" | "name">[]; colorOf: (priorityId: string) => string | null }): PriorityTagPlan {
  const existing = new Map(input.tags.map((t) => [keyOf(t.name), t.id]))
  const create = new Map<string, { name: string; color: string | null }>()
  const assign: PriorityTagPlan["assign"] = []
  for (const task of input.tasks) {
    const def = priorityOf(input.priorities, task)
    if (!def) continue
    const key = keyOf(def.name)
    const tagId = existing.get(key)
    if (tagId && task.tagIds.includes(tagId)) continue
    if (!tagId && !create.has(key)) create.set(key, { name: def.name.trim(), color: input.colorOf(def.id) })
    assign.push({ taskId: task.id, key })
  }
  return { create: [...create.values()], assign }
}

/** Old shortcut criteria stored enum priorities; they become the equivalent tag ids (by the migrated names). */
export const LEGACY_PRIORITY_NAMES: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta" }

export function tagIdsForLegacyPriorities(legacy: string[], tags: Pick<TagRow, "id" | "name">[]): string[] {
  const ids: string[] = []
  for (const value of legacy) {
    const name = LEGACY_PRIORITY_NAMES[value] ?? value
    const tag = tags.find((t) => keyOf(t.name) === keyOf(name))
    if (tag && !ids.includes(tag.id)) ids.push(tag.id)
  }
  return ids
}
