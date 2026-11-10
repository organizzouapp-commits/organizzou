import { describe, expect, it } from "vitest"

import { hasYearlyPrice, usageView, yearlySavingCents } from "./plan-usage"
import { PLANS } from "./plans"

describe("usageView", () => {
  it("says Ilimitadas for an unlimited limit and has no bar", () => {
    expect(usageView("pro", "taskBoards", 12)).toEqual({ value: "Ilimitadas", percent: null, limit: null })
    expect(usageView("pro", "taskBoards", null, "Ilimitado").value).toBe("Ilimitado")
  })

  it("shows use against the limit with a percentage", () => {
    const limit = PLANS.free.limits.taskBoards as number
    expect(usageView("free", "taskBoards", 1)).toEqual({ value: `1 / ${limit}`, percent: Math.round((1 / limit) * 100), limit })
    expect(usageView("free", "taskBoards", limit).percent).toBe(100)
  })

  it("caps the bar at 100% when use is above the limit", () => {
    expect(usageView("free", "assistantMessagesPerDay", 9999).percent).toBe(100)
  })

  it("shows only the limit, and no bar, without a counter", () => {
    const limit = PLANS.free.limits.assistantMessagesPerDay as number
    expect(usageView("free", "assistantMessagesPerDay", null)).toEqual({ value: String(limit), percent: null, limit })
  })
})

describe("yearly pricing", () => {
  it("computes the saving from the plan config", () => {
    expect(yearlySavingCents("pro")).toBe(PLANS.pro.price.monthlyCents * 12 - PLANS.pro.price.yearlyCents)
    expect(yearlySavingCents("free")).toBe(0)
  })

  it("only has a yearly price when the config gives one", () => {
    expect(hasYearlyPrice("pro")).toBe(true)
    expect(hasYearlyPrice("free")).toBe(false)
  })
})
