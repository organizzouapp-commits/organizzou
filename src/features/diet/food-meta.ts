// What a custom food needs that `foods` has no column for yet: whether it was deleted (archived, so past meals keep their numbers) and its fiber.
// supabase/migrations/20261110000099_foods_archive_fiber.sql is prepared, NOT applied; until it is, these live in localStorage behind the
// same interface a Supabase adapter will implement.
export type FoodMeta = { archived: string[]; fiber: Record<string, number> }

export type FoodMetaRepo = {
  load(): FoodMeta
  save(meta: FoodMeta): void
}

const KEY = "organizzou:dieta-food-meta"
const EMPTY: FoodMeta = { archived: [], fiber: {} }

export function parseFoodMeta(raw: unknown): FoodMeta {
  const value = (raw && typeof raw === "object" ? raw : {}) as { archived?: unknown; fiber?: unknown }
  const archived = Array.isArray(value.archived) ? value.archived.filter((id): id is string => typeof id === "string") : []
  const fiber = value.fiber && typeof value.fiber === "object" ? Object.fromEntries(Object.entries(value.fiber as Record<string, unknown>).filter((e): e is [string, number] => typeof e[1] === "number" && e[1] >= 0)) : {}
  return { archived, fiber }
}

export const localFoodMetaRepo: FoodMetaRepo = {
  load() {
    try {
      return parseFoodMeta(JSON.parse(localStorage.getItem(KEY) ?? "null"))
    } catch {
      return { ...EMPTY }
    }
  },
  save(meta) {
    try {
      localStorage.setItem(KEY, JSON.stringify(parseFoodMeta(meta)))
    } catch {
      // Private mode: the change just does not survive the visit.
    }
  },
}
