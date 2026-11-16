// Mirrors the planned diet tables (docs/PLAN-PHASE-0.md §4.1). Nutrition values are per serving.
export type FoodRow = {
  id: string
  /** Null for the shared catalog, set for foods the user created. */
  user_id: string | null
  name: string
  /** What one serving is, e.g. "100 g", "1 unidade (50 g)". */
  serving_label: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export type MealKind = "breakfast" | "lunch" | "snack" | "dinner"

export const MEAL_LABELS: Record<MealKind, string> = {
  breakfast: "Café da manhã",
  lunch: "Almoço",
  snack: "Lanche",
  dinner: "Jantar",
}

export type MealItemRow = {
  id: string
  /** "yyyy-MM-dd" in the user's timezone. Every saved row has it. */
  log_date?: string
  meal: MealKind
  food_id: string
  /** Number of servings, e.g. 1.5. */
  servings: number
}

export type DietGoalRow = {
  user_id: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  water_ml: number
  /** Null until the person sets one. */
  target_weight_kg: number | null
}

export type WeightLogRow = { id: string; user_id: string; log_date: string; weight_kg: number }

/** The goals a person has before they set any (Dieta and Rotina both start the water goal from here). */
export const DEFAULT_DIET_GOAL: DietGoalRow = { user_id: "", kcal: 2000, protein_g: 120, carbs_g: 220, fat_g: 65, water_ml: 2500, target_weight_kg: null }
