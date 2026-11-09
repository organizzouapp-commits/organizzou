import { describe, expect, it } from "vitest"

import { recentFoods, searchFoods } from "./foods"
import { deltasVsPrevious, goalProgress, kgPlain, kgText, parseKg, signedKg, sortWeights, stepKg, validKg, variation, weightsInPeriod, yTicks } from "./weight"
import type { FoodRow, MealItemRow } from "./types"

const TODAY = "2026-11-09"
const w = (id: string, log_date: string, weight_kg: number) => ({ id, log_date, weight_kg })
const rows = [w("a", "2026-11-03", 80), w("b", "2026-08-20", 82.4), w("c", "2026-10-20", 80.7), w("d", "2025-01-01", 95)]

describe("weightsInPeriod and variation", () => {
  const sorted = sortWeights(rows)
  it("sorts oldest first", () => expect(sorted.map((r) => r.id)).toEqual(["d", "b", "c", "a"]))
  it("keeps only the entries of the period", () => {
    expect(weightsInPeriod(sorted, TODAY, 30).map((r) => r.id)).toEqual(["c", "a"])
    expect(weightsInPeriod(sorted, TODAY, 90).map((r) => r.id)).toEqual(["b", "c", "a"])
    expect(weightsInPeriod(sorted, TODAY, 365).map((r) => r.id)).toEqual(["b", "c", "a"])
  })
  it("is last minus first, one decimal", () => {
    expect(variation(weightsInPeriod(sorted, TODAY, 30))).toBe(-0.7)
    expect(variation(weightsInPeriod(sorted, TODAY, 90))).toBe(-2.4)
  })
  it("is null with fewer than two entries", () => {
    expect(variation([])).toBeNull()
    expect(variation([w("x", TODAY, 80)])).toBeNull()
  })
})

describe("deltasVsPrevious", () => {
  it("compares each entry with the one before it", () => {
    const d = deltasVsPrevious(sortWeights(rows))
    expect(d.get("d")).toBeNull()
    expect(d.get("b")).toBe(-12.6)
    expect(d.get("c")).toBe(-1.7)
    expect(d.get("a")).toBe(-0.7)
  })
  it("is zero when equal", () => {
    expect(deltasVsPrevious([w("p", "2026-11-01", 80), w("q", "2026-11-02", 80)]).get("q")).toBe(0)
  })
})

describe("yTicks", () => {
  it("is uniform, every 1 kg, around the data", () => {
    const { ticks, min, max } = yTicks([79.4, 80, 82.6])
    expect(ticks).toEqual([79, 80, 81, 82, 83])
    expect(min).toBe(79)
    expect(max).toBe(83)
  })
  it("widens the step for long ranges but stays uniform", () => {
    const { ticks } = yTicks([70, 95])
    const steps = new Set(ticks.slice(1).map((t, i) => t - ticks[i]))
    expect(steps.size).toBe(1)
    expect([...steps][0]).toBeGreaterThan(1)
    expect(ticks[0]).toBeLessThanOrEqual(70)
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(95)
  })
  it("has at least one interval for a single value", () => {
    expect(yTicks([80]).ticks.length).toBeGreaterThanOrEqual(2)
    expect(yTicks([]).ticks.length).toBe(2)
  })
})

describe("goalProgress", () => {
  const history = [w("1", "2026-08-01", 90), w("2", "2026-11-01", 82)]
  it("is the share of the way from the first weigh-in to the goal (losing)", () => {
    expect(goalProgress(history, 80)).toEqual({ pct: 80, remaining: 2, reached: false })
  })
  it("works when gaining", () => {
    expect(goalProgress([w("1", "2026-08-01", 60), w("2", "2026-11-01", 63)], 66)).toEqual({ pct: 50, remaining: 3, reached: false })
  })
  it("is complete once the goal is reached or passed", () => {
    expect(goalProgress([...history, w("3", "2026-11-05", 79.5)], 80)).toEqual({ pct: 100, remaining: 0, reached: true })
  })
  it("does not go negative when moving away from the goal", () => {
    expect(goalProgress([w("1", "2026-08-01", 90), w("2", "2026-11-01", 92)], 80)?.pct).toBe(0)
  })
  it("is null without a goal or without entries", () => {
    expect(goalProgress(history, null)).toBeNull()
    expect(goalProgress([], 80)).toBeNull()
  })
})

describe("formatting and stepping", () => {
  it("formats kilos", () => {
    expect(kgText(80)).toBe("80,0 kg")
    expect(kgPlain(80)).toBe("80")
    expect(kgPlain(80.5)).toBe("80,5")
    expect(signedKg(-2.4)).toBe("−2,4")
    expect(signedKg(1.2)).toBe("+1,2")
    expect(signedKg(0)).toBe("0")
  })
  it("steps by 0,1 kg without float drift", () => {
    expect(stepKg(80, 1)).toBe(80.1)
    expect(stepKg(80.3, -1)).toBe(80.2)
    expect(stepKg(0.7 + 0.1 + 79.2, 1)).toBeCloseTo(80.1, 5)
  })
  it("parses a decimal comma and validates the range", () => {
    expect(parseKg("80,5")).toBe(80.5)
    expect(parseKg("80.5")).toBe(80.5)
    expect(parseKg("")).toBeNull()
    expect(parseKg("abc")).toBeNull()
    expect(validKg(80)).toBe(true)
    expect(validKg(10)).toBe(false)
    expect(validKg(null)).toBe(false)
  })
})

describe("recentFoods and searchFoods", () => {
  const food = (id: string, name: string): FoodRow => ({ id, user_id: null, name, serving_label: "100 g", kcal: 100, protein_g: 1, carbs_g: 1, fat_g: 1 })
  const foods = [food("a", "Arroz branco"), food("b", "Pão francês"), food("c", "Maçã")]
  const item = (id: string, log_date: string, food_id: string): MealItemRow => ({ id, log_date, meal: "lunch", food_id, servings: 1 })
  it("lists each food once, newest day first", () => {
    const items = [item("1", "2026-11-01", "a"), item("2", "2026-11-08", "b"), item("3", "2026-11-08", "c"), item("4", "2026-11-02", "a")]
    expect(recentFoods(items, foods).map((f) => f.id)).toEqual(["c", "b", "a"])
    expect(recentFoods(items, foods, 2)).toHaveLength(2)
  })
  it("ignores unknown foods", () => {
    expect(recentFoods([item("1", "2026-11-01", "zzz")], foods)).toEqual([])
  })
  it("searches ignoring case and accents, every word", () => {
    expect(searchFoods(foods, "PAO").map((f) => f.id)).toEqual(["b"])
    expect(searchFoods(foods, "maca").map((f) => f.id)).toEqual(["c"])
    expect(searchFoods(foods, "arroz bran").map((f) => f.id)).toEqual(["a"])
    expect(searchFoods(foods, "").length).toBe(3)
    expect(searchFoods(foods, "xyz")).toEqual([])
  })
})
