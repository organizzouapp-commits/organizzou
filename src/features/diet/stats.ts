import type { FoodRow, MealItemRow, MealKind } from "./types"

export type Macros = { kcal: number; protein: number; carbs: number; fat: number }

export const EMPTY_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

export function itemMacros(item: Pick<MealItemRow, "servings">, food: FoodRow): Macros {
  return {
    kcal: Math.round(food.kcal * item.servings),
    protein: Math.round(food.protein_g * item.servings * 10) / 10,
    carbs: Math.round(food.carbs_g * item.servings * 10) / 10,
    fat: Math.round(food.fat_g * item.servings * 10) / 10,
  }
}

export function sumMacros(list: Macros[]): Macros {
  const total = list.reduce(
    (acc, m) => ({ kcal: acc.kcal + m.kcal, protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat }),
    EMPTY_MACROS
  )
  return {
    kcal: Math.round(total.kcal),
    protein: Math.round(total.protein * 10) / 10,
    carbs: Math.round(total.carbs * 10) / 10,
    fat: Math.round(total.fat * 10) / 10,
  }
}

export function mealTotals(items: MealItemRow[], foods: FoodRow[], meal: MealKind): Macros {
  return sumMacros(
    items
      .filter((i) => i.meal === meal)
      .map((i) => {
        const food = foods.find((f) => f.id === i.food_id)
        return food ? itemMacros(i, food) : EMPTY_MACROS
      })
  )
}

export function dayTotals(items: MealItemRow[], foods: FoodRow[]): Macros {
  return sumMacros(
    items.map((i) => {
      const food = foods.find((f) => f.id === i.food_id)
      return food ? itemMacros(i, food) : EMPTY_MACROS
    })
  )
}

/** Calories from macros (4/4/9) — a quick consistency check for user-created foods. */
export function kcalFromMacros(m: Pick<Macros, "protein" | "carbs" | "fat">) {
  return Math.round(m.protein * 4 + m.carbs * 4 + m.fat * 9)
}

export function formatServings(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
}
