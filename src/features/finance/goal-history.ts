// The contributions made with "Guardar", per goal, so the featured goal can draw its sparkline. There is no table for them yet, and
// series B must not invent data: with no history the sparkline is simply hidden. localStorage adapter; nothing to migrate.

/** `opening` marks the "Saldo inicial": the amount already saved when the goal was created (one per goal, never a lançamento). */
export type Contribution = { day: string; cents: number; opening?: boolean }
export type GoalHistory = Record<string, Contribution[]>

export type GoalHistoryRepo = {
  load(): GoalHistory
  save(history: GoalHistory): void
}

const KEY = "organizzou:financas-goal-history"

export const localGoalHistoryRepo: GoalHistoryRepo = {
  load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>
      const out: GoalHistory = {}
      for (const [id, list] of Object.entries(parsed)) {
        if (!Array.isArray(list)) continue
        out[id] = list.filter((c): c is Contribution => Boolean(c) && typeof c.day === "string" && typeof c.cents === "number" && c.cents > 0).map((c) => (c.opening === true ? c : { day: c.day, cents: c.cents }))
      }
      return out
    } catch {
      return {}
    }
  },
  save(history) {
    try {
      localStorage.setItem(KEY, JSON.stringify(history))
    } catch {
      // Private mode: the history just does not survive the visit.
    }
  },
}

/** The running total after each contribution, starting from what was saved before the first one. Empty when there is no history. */
export function runningTotal(current: number, history: Contribution[]): number[] {
  if (history.length === 0) return []
  const base = Math.max(0, current - history.reduce((sum, c) => sum + c.cents, 0))
  const points = [base]
  for (const c of history) points.push(points[points.length - 1] + c.cents)
  return points
}
