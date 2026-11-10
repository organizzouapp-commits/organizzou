import { describe, expect, it } from "vitest"

import { EMPTY_FOOD_FORM, approxKcal, formFromFood, kcalHint, parseNumber, servingLabel, validateFood, type FoodForm } from "./custom-food"

const form = (patch: Partial<FoodForm>): FoodForm => ({ ...EMPTY_FOOD_FORM, name: "Pão de queijo", portionQty: "1", unit: "unidade", ...patch })

describe("servingLabel", () => {
  it("never pluralizes g and ml", () => {
    expect(servingLabel(100, "g")).toBe("100 g")
    expect(servingLabel(250, "ml")).toBe("250 ml")
  })
  it("uses the singular for exactly 1 and the plural otherwise", () => {
    expect(servingLabel(1, "colher-sopa")).toBe("1 colher de sopa")
    expect(servingLabel(2, "colher-sopa")).toBe("2 colheres de sopa")
    expect(servingLabel(1.5, "xicara")).toBe("1,5 xícaras")
    expect(servingLabel(3, "fatia")).toBe("3 fatias")
    expect(servingLabel(1, "pote")).toBe("1 pote")
  })
})

describe("approxKcal", () => {
  it("is 4/4/9 per gram, rounded", () => {
    expect(approxKcal(10, 20, 5)).toBe(165)
    expect(approxKcal(0, 0, 0)).toBe(0)
    expect(approxKcal(1.2, 0, 0.3)).toBe(8)
  })
})

describe("parseNumber", () => {
  it("accepts comma and dot, blank is null, junk and negatives are NaN", () => {
    expect(parseNumber("12,5")).toBe(12.5)
    expect(parseNumber(" 3.25 ")).toBe(3.25)
    expect(parseNumber("")).toBeNull()
    expect(Number.isNaN(parseNumber("abc"))).toBe(true)
    expect(Number.isNaN(parseNumber("-1"))).toBe(true)
  })
})

describe("kcalHint", () => {
  it("shows the approximation only when kcal is empty and a macro is filled", () => {
    expect(kcalHint(form({ protein: "10", carbs: "20" }))).toBe(120)
    expect(kcalHint(form({ kcal: "100", protein: "10" }))).toBeNull()
    expect(kcalHint(form({}))).toBeNull()
    expect(kcalHint(form({ protein: "x" }))).toBeNull()
  })
})

describe("validateFood", () => {
  it("accepts a complete food and builds its serving label", () => {
    const r = validateFood(form({ portionQty: "50", unit: "g", kcal: "130", protein: "4", carbs: "15", fat: "6", fiber: "1,5" }), [])
    expect(r).toEqual({ ok: true, values: { name: "Pão de queijo", serving_label: "50 g", kcal: 130, protein_g: 4, carbs_g: 15, fat_g: 6, fiber_g: 1.5 } })
  })

  it("treats empty macros as 0 and no fiber as null", () => {
    const r = validateFood(form({ kcal: "90" }), [])
    expect(r.ok && r.values).toMatchObject({ kcal: 90, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: null })
  })

  it("uses the calories the macros add up to when kcal is empty", () => {
    const r = validateFood(form({ protein: "10", carbs: "20", fat: "5" }), [])
    expect(r.ok && r.values.kcal).toBe(165)
  })

  it("requires a name, and refuses a repeated one ignoring case and accents", () => {
    expect(validateFood(form({ name: "  " }), [])).toMatchObject({ ok: false, errors: { name: expect.any(String) } })
    expect(validateFood(form({ name: "PAO DE QUEIJO" }), [{ name: "Pão de queijo" }])).toMatchObject({ ok: false, errors: { name: "Você já tem um alimento com esse nome." } })
    expect(validateFood(form({ name: "Pão de queijo" }), [{ name: "Pão francês" }]).ok).toBe(true)
  })

  it("requires a portion above zero and numbers from zero up", () => {
    const bad = validateFood(form({ portionQty: "0", kcal: "-5", protein: "abc", fat: "2000" }), [])
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(["fat", "kcal", "portionQty", "protein"])
  })
})

describe("formFromFood", () => {
  it("splits a serving label made here back into quantity and unit", () => {
    expect(formFromFood({ name: "X", serving_label: "2 colheres de sopa", kcal: 50, protein_g: 1.5, carbs_g: 8, fat_g: 0 }, 2)).toMatchObject({ portionQty: "2", unit: "colher-sopa", protein: "1,5", fiber: "2" })
  })
  it("falls back to 1 unidade for a label it does not know", () => {
    expect(formFromFood({ name: "X", serving_label: "1 pedaço grande", kcal: 1, protein_g: 0, carbs_g: 0, fat_g: 0 }, null)).toMatchObject({ portionQty: "1", unit: "unidade", fiber: "" })
  })
})
