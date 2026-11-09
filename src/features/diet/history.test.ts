import { describe, expect, it } from "vitest"

import { averageKcal, averageWaterMl, dailyEntries, dayStatus, daysOnGoal, goalPercent, labelStep, mealInsight, mealShares, niceAxis, periodDays } from "./history"
import type { FoodRow, MealItemRow } from "./types"

const TODAY = "2026-11-09"
const food = (id: string, kcal: number): FoodRow => ({ id, user_id: null, name: id, serving_label: "100 g", kcal, protein_g: 10, carbs_g: 20, fat_g: 5 })
const FOODS = [food("a", 500), food("b", 1000)]
const item = (id: string, log_date: string | undefined, meal: MealItemRow["meal"], food_id: string, servings = 1): MealItemRow => ({ id, log_date, meal, food_id, servings })

describe("periodDays", () => {
  it("lists n days, oldest first, ending on today", () => {
    const days = periodDays(TODAY, 15)
    expect(days).toHaveLength(15)
    expect(days[0]).toBe("2026-10-26")
    expect(days[14]).toBe(TODAY)
  })
})

describe("dailyEntries", () => {
  const items = [item("1", TODAY, "lunch", "a"), item("2", TODAY, "dinner", "b", 0.5), item("3", "2026-11-07", "lunch", "b"), item("4", "2026-09-01", "lunch", "b"), item("5", undefined, "snack", "a")]
  const entries = dailyEntries(items, FOODS, TODAY, 15)

  it("has one entry per day and sums the macros of each", () => {
    expect(entries).toHaveLength(15)
    const today = entries[14]
    expect(today.logged).toBe(true)
    expect(today.kcal).toBe(500 + 500 + 500) // a + b×0.5 + the undated row, which belongs to today
    expect(today.protein).toBe(10 + 5 + 10)
  })

  it("filters by the period: a day outside the window is ignored", () => {
    expect(entries.some((e) => e.day === "2026-09-01")).toBe(false)
    expect(dailyEntries(items, FOODS, TODAY, 90).find((e) => e.day === "2026-09-01")?.kcal).toBe(1000)
  })

  it("marks days with nothing logged", () => {
    expect(entries[13]).toMatchObject({ day: "2026-11-08", logged: false, kcal: 0 })
  })
})

describe("averageKcal", () => {
  it("divides by the days that have entries, not by the whole period", () => {
    const entries = dailyEntries([item("1", TODAY, "lunch", "a"), item("2", "2026-11-07", "lunch", "b")], FOODS, TODAY, 15)
    expect(averageKcal(entries)).toBe(750)
  })
  it("is zero with nothing logged", () => {
    expect(averageKcal(dailyEntries([], FOODS, TODAY, 15))).toBe(0)
  })
})

describe("goalPercent", () => {
  it("is the average over the goal", () => {
    expect(goalPercent(1391, 2000)).toBe(70)
    expect(goalPercent(2200, 2000)).toBe(110)
    expect(goalPercent(100, 0)).toBe(0)
  })
})

describe("dayStatus", () => {
  it("is on the goal within ±10%, both ends included", () => {
    expect(dayStatus(1800, 2000)).toBe("on")
    expect(dayStatus(2200, 2000)).toBe("on")
    expect(dayStatus(2000, 2000)).toBe("on")
  })
  it("is below or above outside it", () => {
    expect(dayStatus(1799, 2000)).toBe("under")
    expect(dayStatus(2201, 2000)).toBe("over")
    expect(dayStatus(0, 2000)).toBe("under")
  })
})

describe("daysOnGoal", () => {
  it("counts the days on the goal out of the days with entries", () => {
    const items = [item("1", TODAY, "lunch", "b", 2), item("2", "2026-11-08", "lunch", "a"), item("3", "2026-11-07", "lunch", "b", 2.1)]
    // today 2000 (on), yesterday 500 (under), 2 days ago 2100 (on)
    expect(daysOnGoal(dailyEntries(items, FOODS, TODAY, 15), 2000)).toEqual({ hit: 2, logged: 3 })
  })
})

describe("mealShares", () => {
  const items = [item("1", TODAY, "lunch", "b"), item("2", TODAY, "breakfast", "a"), item("3", "2026-11-08", "lunch", "b"), item("4", "2026-11-08", "dinner", "a")]
  const shares = mealShares(items, FOODS, TODAY, 15)
  it("averages the kcal of each meal over the days with entries", () => {
    expect(shares.find((s) => s.meal === "lunch")?.kcal).toBe(1000)
    expect(shares.find((s) => s.meal === "breakfast")?.kcal).toBe(250)
    expect(shares.find((s) => s.meal === "snack")?.kcal).toBe(0)
  })
  it("shares add up to 100", () => {
    expect(shares.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(100)
    expect(shares.find((s) => s.meal === "lunch")?.share).toBeCloseTo(66.67, 1)
  })
  it("is all zero with nothing logged", () => {
    expect(mealShares([], FOODS, TODAY, 15).every((s) => s.share === 0 && s.kcal === 0)).toBe(true)
  })
})

describe("mealInsight", () => {
  it("is shown when one meal holds more than 35%", () => {
    const shares = mealShares([item("1", TODAY, "lunch", "b"), item("2", TODAY, "breakfast", "a"), item("3", TODAY, "dinner", "a")], FOODS, TODAY, 15)
    expect(mealInsight(shares)).toBe("Almoço concentra 50% das calorias. Que tal levar parte para o lanche?")
  })
  it("is hidden when the day is balanced or empty", () => {
    const balanced = mealShares([item("1", TODAY, "breakfast", "a"), item("2", TODAY, "lunch", "a"), item("3", TODAY, "snack", "a"), item("4", TODAY, "dinner", "a")], FOODS, TODAY, 15)
    expect(mealInsight(balanced)).toBeNull()
    expect(mealInsight(mealShares([], FOODS, TODAY, 15))).toBeNull()
  })
})

describe("averageWaterMl", () => {
  it("averages over the days that have water, inside the period", () => {
    const rows = [
      { log_date: TODAY, ml: 1000 },
      { log_date: TODAY, ml: 1000 },
      { log_date: "2026-11-08", ml: 1500 },
      { log_date: "2026-01-01", ml: 9000 },
    ]
    expect(averageWaterMl(rows, TODAY, 15)).toBe(1750)
    expect(averageWaterMl([], TODAY, 15)).toBe(0)
  })
})

describe("chart helpers", () => {
  it("niceAxis tops out above the data with round ticks", () => {
    expect(niceAxis(2300)).toEqual({ max: 2500, ticks: [0, 500, 1000, 1500, 2000, 2500] })
    expect(niceAxis(0).max).toBeGreaterThan(0)
  })
  it("labelStep thins the labels for longer periods and phones", () => {
    expect(labelStep(15, false)).toBe(2)
    expect(labelStep(15, true)).toBe(3)
    expect(labelStep(90, false)).toBeGreaterThan(labelStep(30, false))
  })
})
