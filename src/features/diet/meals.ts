// The person's own meals. Everybody starts with the four classic ones (Café da manhã, Almoço, Lanche, Jantar); they can add any other
// ("Ceia", "Pré-treino"...), rename, reorder and delete them. The list is per person, so a new meal shows up every day, while the foods
// stay per date. A food of a custom meal is saved with the nearest classic meal ("snack") because the table only knows four; which meal it
// really belongs to is kept in `assignments`. localStorage adapter behind `MealLayoutRepo` until supabase/migrations/20261116000001_user_meals.sql
// is applied (prepared, NOT applied). Pure apart from that adapter.
import { MEAL_LABELS, type MealItemRow, type MealKind } from "./types"

export type MealDef = { id: string; name: string; /** "HH:mm" or null. */ time: string | null; icon: MealIconKey | null; builtin: boolean }
export type MealLayout = { meals: MealDef[]; /** food item id -> meal id, for the foods of custom meals (or moved to one). */ assignments: Record<string, string> }

export const MEAL_ICON_KEYS = ["utensils", "coffee", "apple", "sandwich", "cookie", "moon", "dumbbell"] as const
export type MealIconKey = (typeof MEAL_ICON_KEYS)[number]

export const BUILTIN_IDS: MealKind[] = ["breakfast", "lunch", "snack", "dinner"]
export const MAX_MEALS = 12
export const MEAL_NAME_MAX = 40

/** The classic meals, in order: what every person (new or existing) has until they change it. */
export const defaultMeals = (): MealDef[] => BUILTIN_IDS.map((id) => ({ id, name: MEAL_LABELS[id], time: null, icon: null, builtin: true }))
export const defaultLayout = (): MealLayout => ({ meals: defaultMeals(), assignments: {} })

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export type NameCheck = { ok: true; name: string } | { ok: false; error: string }

/** Required, up to 40 characters, and not the name of another meal (case and accents ignored). */
export function validateMealName(raw: string, meals: Pick<MealDef, "id" | "name">[], ignoreId?: string): NameCheck {
  const name = raw.trim().replace(/\s+/g, " ")
  if (!name) return { ok: false, error: "Dê um nome à refeição." }
  if (name.length > MEAL_NAME_MAX) return { ok: false, error: `Use no máximo ${MEAL_NAME_MAX} caracteres.` }
  if (meals.some((m) => m.id !== ignoreId && fold(m.name) === fold(name))) return { ok: false, error: "Já existe uma refeição com esse nome." }
  return { ok: true, name }
}

/** Reads what was saved, tolerating anything: broken meals are dropped; an empty list falls back to the classic four. */
export function parseMealLayout(raw: unknown): MealLayout {
  const value = (raw && typeof raw === "object" ? raw : {}) as { meals?: unknown; assignments?: unknown }
  const meals: MealDef[] = []
  const seen = new Set<string>()
  if (Array.isArray(value.meals)) {
    for (const entry of value.meals as Record<string, unknown>[]) {
      if (!entry || typeof entry.id !== "string" || typeof entry.name !== "string" || seen.has(entry.id)) continue
      const name = entry.name.trim().slice(0, MEAL_NAME_MAX)
      if (!name) continue
      seen.add(entry.id)
      meals.push({ id: entry.id, name, time: typeof entry.time === "string" && TIME.test(entry.time) ? entry.time : null, icon: MEAL_ICON_KEYS.includes(entry.icon as MealIconKey) ? (entry.icon as MealIconKey) : null, builtin: (BUILTIN_IDS as string[]).includes(entry.id) })
    }
  }
  const assignments: Record<string, string> = {}
  if (value.assignments && typeof value.assignments === "object") for (const [item, meal] of Object.entries(value.assignments as Record<string, unknown>)) if (typeof meal === "string" && seen.has(meal)) assignments[item] = meal
  return meals.length > 0 ? { meals, assignments } : defaultLayout()
}

/** The meal a food belongs to: its assignment, else its saved classic meal, else (that meal was deleted) the first meal. */
export function mealIdOf(item: Pick<MealItemRow, "id" | "meal">, layout: MealLayout): string {
  const assigned = layout.assignments[item.id]
  if (assigned && layout.meals.some((m) => m.id === assigned)) return assigned
  return layout.meals.some((m) => m.id === item.meal) ? item.meal : layout.meals[0].id
}

/** What is saved for a food placed in a meal: the classic meal column plus, for a custom meal, the assignment. */
export function persistedPlacement(mealId: string): { meal: MealKind; assign: string | null } {
  return (BUILTIN_IDS as string[]).includes(mealId) ? { meal: mealId as MealKind, assign: null } : { meal: "snack", assign: mealId }
}

/** `assignments` after a food was placed in `mealId`. */
export function withPlacement(assignments: Record<string, string>, itemId: string, mealId: string): Record<string, string> {
  const { assign } = persistedPlacement(mealId)
  const next = { ...assignments }
  if (assign) next[itemId] = assign
  else delete next[itemId]
  return next
}

export type MealInput = { name: string; time: string | null; icon: MealIconKey | null }

export function addMeal(layout: MealLayout, input: MealInput, newId: () => string): MealLayout {
  if (layout.meals.length >= MAX_MEALS) return layout
  return { ...layout, meals: [...layout.meals, { id: `custom-${newId()}`, name: input.name, time: input.time, icon: input.icon, builtin: false }] }
}

export const editMeal = (layout: MealLayout, id: string, input: MealInput): MealLayout => ({ ...layout, meals: layout.meals.map((m) => (m.id === id ? { ...m, ...input } : m)) })

/** Moves a meal one place up (-1) or down (1). */
export function moveMeal(layout: MealLayout, id: string, direction: -1 | 1): MealLayout {
  const index = layout.meals.findIndex((m) => m.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= layout.meals.length) return layout
  const meals = [...layout.meals]
  ;[meals[index], meals[target]] = [meals[target], meals[index]]
  return { ...layout, meals }
}

/** Removes a meal (never the last one); the ids of its foods are returned so the caller can move or delete them. */
export function removeMeal(layout: MealLayout, id: string, items: Pick<MealItemRow, "id" | "meal">[]): { layout: MealLayout; itemIds: string[] } | null {
  if (layout.meals.length <= 1 || !layout.meals.some((m) => m.id === id)) return null
  const itemIds = items.filter((i) => mealIdOf(i, layout) === id).map((i) => i.id)
  const assignments = Object.fromEntries(Object.entries(layout.assignments).filter(([, meal]) => meal !== id))
  return { layout: { meals: layout.meals.filter((m) => m.id !== id), assignments }, itemIds }
}

/** The meal that "Adicionar alimento" suggests for the hour: breakfast, lunch, snack or dinner when those exist, else the first meal. */
export function suggestedMeal(layout: MealLayout, hour: number): string {
  const wanted: MealKind = hour < 10 ? "breakfast" : hour < 15 ? "lunch" : hour < 18 ? "snack" : "dinner"
  return layout.meals.some((m) => m.id === wanted) ? wanted : layout.meals[0].id
}

// ---------------------------------------------------------------- storage (fallback until the migration is applied)

export interface MealLayoutRepo {
  load(): MealLayout
  save(layout: MealLayout): void
}

const KEY = "organizzou:dieta-meal-layout"

export const localMealLayoutRepo: MealLayoutRepo = {
  load() {
    try {
      return parseMealLayout(JSON.parse(localStorage.getItem(KEY) ?? "null"))
    } catch {
      return defaultLayout()
    }
  },
  save(layout) {
    try {
      localStorage.setItem(KEY, JSON.stringify(layout))
    } catch {
      // Private mode: the meals just do not survive the visit.
    }
  },
}
