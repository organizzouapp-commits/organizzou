// The order of the goals in progress; the first one is the featured (large) card. Until the columns of 20261109000001 exist, the order
// lives in localStorage behind the same interface a Supabase adapter will implement (sort_order per goal, is_featured on the first).
// No saved order means "nearest deadline first", so the default featured goal is the one closest to its date.

export type GoalLayoutRepo = {
  /** Goal ids in the order the person chose (possibly stale: ids of deleted goals are ignored by `applyGoalOrder`). */
  load(): string[]
  save(order: string[]): void
}

const KEY = "organizzou:financas-goal-order"

export const localGoalLayoutRepo: GoalLayoutRepo = {
  load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []
    } catch {
      return []
    }
  },
  save(order) {
    try {
      localStorage.setItem(KEY, JSON.stringify(order))
    } catch {
      // Private mode: the choice just does not survive the visit.
    }
  },
}

/** The goals in the saved order; the ones the order does not know yet follow, nearest deadline first. */
export function applyGoalOrder<T extends { id: string; deadline: string | null }>(goals: T[], order: string[]): T[] {
  const byDeadline = [...goals].sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"))
  const known = order.map((id) => byDeadline.find((g) => g.id === id)).filter((g): g is T => Boolean(g))
  const rest = byDeadline.filter((g) => !order.includes(g.id))
  return [...known, ...rest]
}

/** `id` moved to the front: the new featured goal. */
export const featureFirst = (ids: string[], id: string) => [id, ...ids.filter((x) => x !== id)]
