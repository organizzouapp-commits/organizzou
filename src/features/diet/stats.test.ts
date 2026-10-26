import { describe, expect, it } from "vitest"

import { dayTotals, itemMacros, kcalFromMacros, mealTotals } from "./stats"
import type { FoodRow, MealItemRow } from "./types"

const rice: FoodRow = { id: "f1", user_id: null, name: "Arroz", serving_label: "100 g", kcal: 128, protein_g: 2.5, carbs_g: 28.1, fat_g: 0.2 }
const chicken: FoodRow = { id: "f2", user_id: null, name: "Frango", serving_label: "100 g", kcal: 159, protein_g: 32, carbs_g: 0, fat_g: 2.5 }
const foods = [rice, chicken]

const items: MealItemRow[] = [
  { id: "i1", meal: "lunch", food_id: "f1", servings: 1.5 },
  { id: "i2", meal: "lunch", food_id: "f2", servings: 2 },
  { id: "i3", meal: "dinner", food_id: "f1", servings: 1 },
]

describe("diet stats", () => {
  it("scales a food by servings", () => {
    expect(itemMacros({ servings: 1.5 }, rice)).toEqual({ kcal: 192, protein: 3.8, carbs: 42.2, fat: 0.3 })
  })

  it("totals one meal and the whole day", () => {
    expect(mealTotals(items, foods, "lunch").kcal).toBe(192 + 318)
    expect(dayTotals(items, foods).kcal).toBe(192 + 318 + 128)
  })

  it("estimates calories from macros", () => {
    expect(kcalFromMacros({ protein: 30, carbs: 50, fat: 10 })).toBe(410)
  })
})
