// Which meals of "Hoje" are collapsed. Until a preferences column exists this lives in localStorage behind the same interface a Supabase
// adapter will implement (additive, nothing is migrated or pushed).
import type { MealKind } from "./types"

export type MealGroupRepo = {
  /** Meals the person opened or closed explicitly; a missing meal means "open". */
  load(): Partial<Record<MealKind, boolean>>
  save(state: Partial<Record<MealKind, boolean>>): void
}

const KEY = "organizzou:dieta-meals"
const MEALS: MealKind[] = ["breakfast", "lunch", "snack", "dinner"]

export const localMealGroupRepo: MealGroupRepo = {
  load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}") as unknown
      if (!parsed || typeof parsed !== "object") return {}
      const out: Partial<Record<MealKind, boolean>> = {}
      for (const meal of MEALS) {
        const value = (parsed as Record<string, unknown>)[meal]
        if (typeof value === "boolean") out[meal] = value
      }
      return out
    } catch {
      return {}
    }
  },
  save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // Private mode: the choice just does not survive the visit.
    }
  },
}
