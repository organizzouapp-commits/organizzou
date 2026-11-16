import { describe, expect, it } from "vitest"

import { addMeal, defaultLayout, editMeal, mealIdOf, moveMeal, parseMealLayout, persistedPlacement, removeMeal, suggestedMeal, validateMealName, withPlacement } from "./meals"

let n = 0
const newId = () => `x${++n}`
const item = (id: string, meal: "breakfast" | "lunch" | "snack" | "dinner") => ({ id, meal })

describe("the default meals", () => {
  it("starts with the four classic ones, for everybody", () => {
    expect(defaultLayout().meals.map((m) => m.name)).toEqual(["Café da manhã", "Almoço", "Lanche", "Jantar"])
    expect(parseMealLayout(null)).toEqual(defaultLayout())
    expect(parseMealLayout({ meals: [] })).toEqual(defaultLayout())
  })
})

describe("meal names", () => {
  const meals = defaultLayout().meals
  it("needs a name, within 40 characters, not repeated", () => {
    expect(validateMealName("  ", meals).ok).toBe(false)
    expect(validateMealName("x".repeat(41), meals).ok).toBe(false)
    expect(validateMealName("almoco", meals).ok).toBe(false)
    expect(validateMealName("Ceia", meals)).toEqual({ ok: true, name: "Ceia" })
    expect(validateMealName("Almoço", meals, "lunch").ok).toBe(true)
  })
})

describe("custom meals", () => {
  it("adds, edits and orders meals", () => {
    let layout = addMeal(defaultLayout(), { name: "Ceia", time: "22:00", icon: "moon" }, newId)
    expect(layout.meals.at(-1)).toMatchObject({ name: "Ceia", time: "22:00", builtin: false })
    const id = layout.meals.at(-1)!.id
    layout = editMeal(layout, id, { name: "Pré-treino", time: null, icon: "dumbbell" })
    layout = moveMeal(layout, id, -1)
    expect(layout.meals.map((m) => m.name)).toEqual(["Café da manhã", "Almoço", "Lanche", "Pré-treino", "Jantar"])
    expect(moveMeal(layout, "breakfast", -1)).toBe(layout)
  })
  it("a food of a custom meal is saved as a snack with an assignment, and reads back in its meal", () => {
    const layout = addMeal(defaultLayout(), { name: "Ceia", time: null, icon: null }, newId)
    const ceia = layout.meals.at(-1)!.id
    expect(persistedPlacement(ceia)).toEqual({ meal: "snack", assign: ceia })
    expect(persistedPlacement("lunch")).toEqual({ meal: "lunch", assign: null })
    const placed = { ...layout, assignments: withPlacement(layout.assignments, "f1", ceia) }
    expect(mealIdOf(item("f1", "snack"), placed)).toBe(ceia)
    expect(mealIdOf(item("f2", "snack"), placed)).toBe("snack")
    expect(withPlacement(placed.assignments, "f1", "dinner")).toEqual({})
  })
  it("deleting a meal returns its foods and keeps at least one meal", () => {
    const layout = addMeal(defaultLayout(), { name: "Ceia", time: null, icon: null }, newId)
    const ceia = layout.meals.at(-1)!.id
    const withFood = { ...layout, assignments: { f1: ceia } }
    const removed = removeMeal(withFood, ceia, [item("f1", "snack"), item("f2", "snack")])
    expect(removed?.itemIds).toEqual(["f1"])
    expect(removed?.layout.meals).toHaveLength(4)
    expect(removed?.layout.assignments).toEqual({})
    expect(removeMeal({ meals: [defaultLayout().meals[0]], assignments: {} }, "breakfast", [])).toBeNull()
  })
  it("foods of a deleted classic meal fall to the first meal", () => {
    const layout = { meals: defaultLayout().meals.filter((m) => m.id !== "lunch"), assignments: {} }
    expect(mealIdOf(item("f", "lunch"), layout)).toBe("breakfast")
  })
})

describe("suggestedMeal", () => {
  it("follows the hour and falls back to the first meal", () => {
    expect(suggestedMeal(defaultLayout(), 8)).toBe("breakfast")
    expect(suggestedMeal(defaultLayout(), 12)).toBe("lunch")
    expect(suggestedMeal(defaultLayout(), 20)).toBe("dinner")
    expect(suggestedMeal({ meals: defaultLayout().meals.slice(0, 2), assignments: {} }, 20)).toBe("breakfast")
  })
})

describe("parseMealLayout", () => {
  it("drops broken meals and assignments to meals that do not exist", () => {
    const layout = parseMealLayout({ meals: [{ id: "a", name: "A", time: "99:99" }, { id: "a", name: "dup" }, { id: "b" }, { id: "c", name: "  " }], assignments: { f1: "a", f2: "zzz" } })
    expect(layout.meals).toEqual([{ id: "a", name: "A", time: null, icon: null, builtin: false }])
    expect(layout.assignments).toEqual({ f1: "a" })
  })
})
