import { describe, expect, it } from "vitest"

import { defaultStep, formatDecimal, fromMl, isWaterHabit, looksLikeWater, parseDecimal, stepOf, toMl, unitKind } from "./steps"
import type { HabitRow } from "./types"
import { adjustWater, setWater, waterGoalMlOf, waterOf, withWaterLogs, type WaterLog } from "./water"

const habit = (over: Partial<HabitRow> = {}): HabitRow => ({ id: "h1", user_id: "u", name: "Beber água", type: "goal", target_qty: 3.5, unit: "L", weekdays: [0, 1, 2, 3, 4, 5, 6], deadline: null, paused: false, created_at: "", updated_at: "", ...over })
let n = 0
const newId = () => `id${++n}`

describe("units and steps", () => {
  it("knows the unit kinds and their default step", () => {
    expect(unitKind("litros")).toBe("liter")
    expect(unitKind("L")).toBe("liter")
    expect(unitKind("copos")).toBe("cup")
    expect(unitKind("minutos")).toBe("minute")
    expect(unitKind("páginas")).toBe("other")
    expect([defaultStep("L"), defaultStep("ml"), defaultStep("copos"), defaultStep("min"), defaultStep("páginas")]).toEqual([0.25, 250, 1, 5, 1])
  })
  it("uses the typed step when valid", () => {
    expect(stepOf({ unit: "L" }, 0.5)).toBe(0.5)
    expect(stepOf({ unit: "L" }, null)).toBe(0.25)
    expect(stepOf({ unit: "L" }, 0)).toBe(0.25)
  })
  it("keeps decimals typed with a comma", () => {
    expect(parseDecimal("3,5")).toBe(3.5)
    expect(parseDecimal("0,25")).toBe(0.25)
    expect(parseDecimal("abc")).toBeNull()
    expect(parseDecimal("0")).toBeNull()
    expect(formatDecimal(3.5)).toBe("3,5")
    expect(formatDecimal(1.25)).toBe("1,25")
  })
  it("suggests the water link by name or unit", () => {
    expect(looksLikeWater("Beber água", "vezes")).toBe(true)
    expect(looksLikeWater("Ler", "páginas")).toBe(false)
    expect(looksLikeWater("Ler", "ml")).toBe(true)
  })
})

describe("water conversion", () => {
  it("converts both ways", () => {
    expect(toMl(3.5, "L")).toBe(3500)
    expect(toMl(2, "copos")).toBe(500)
    expect(toMl(750, "ml")).toBe(750)
    expect(fromMl(1250, "L")).toBe(1.25)
    expect(fromMl(500, "copos")).toBe(2)
  })
})

describe("one source for the daily water", () => {
  it("a 3,5 L habit makes the water goal 3500 ml", () => {
    expect(isWaterHabit(habit())).toBe(true)
    expect(waterGoalMlOf(habit())).toBe(3500)
    expect(isWaterHabit(habit({ unit: "páginas" }))).toBe(false)
  })
  it('"+250 ml" in Dieta and the habit "+" (0,25 L) move the same log', () => {
    let water: WaterLog[] = []
    water = adjustWater(water, "2026-11-16", 250, newId)
    expect(waterOf(water, "2026-11-16")).toBe(250)
    water = adjustWater(water, "2026-11-16", toMl(defaultStep("L"), "L"), newId)
    expect(waterOf(water, "2026-11-16")).toBe(500)
    const logs = withWaterLogs([habit()], [], water)
    expect(logs).toHaveLength(1)
    expect(logs[0].qty).toBe(0.5)
  })
  it("decrement takes the most recent entries back and never goes below zero", () => {
    let water: WaterLog[] = [
      { id: "a", log_date: "d", ml: 250 },
      { id: "b", log_date: "d", ml: 250 },
      { id: "c", log_date: "other", ml: 999 },
    ]
    water = adjustWater(water, "d", -300, newId)
    expect(waterOf(water, "d")).toBe(200)
    expect(waterOf(water, "other")).toBe(999)
    expect(waterOf(adjustWater(water, "d", -5000, newId), "d")).toBe(0)
  })
  it("typing an exact amount sets the day's total", () => {
    expect(waterOf(setWater([{ id: "a", log_date: "d", ml: 800 }], "d", 1250, newId), "d")).toBe(1250)
    expect(waterOf(setWater([{ id: "a", log_date: "d", ml: 800 }], "d", 300, newId), "d")).toBe(300)
  })
  it("leaves the logs of other habits alone", () => {
    const other = habit({ id: "h2", name: "Ler", unit: "páginas" })
    const log = { id: "l", user_id: "u", habit_id: "h2", log_date: "d", qty: 10, created_at: "", updated_at: "" }
    expect(withWaterLogs([habit(), other], [log], [{ id: "w", log_date: "d", ml: 1000 }]).find((l) => l.habit_id === "h2")).toEqual(log)
  })
})
