import { describe, expect, it } from "vitest"

import { goalStart, monthlyNeeded, monthsToGo, parseGoalMeta, periodLabel, validateGoalDates, withOpening } from "./goal-schedule"

describe("dates", () => {
  it("falls back to the creation day when there is no start", () => {
    expect(goalStart({ created_at: "2026-03-05T10:00:00Z" })).toBe("2026-03-05")
    expect(goalStart({ created_at: "2026-03-05T10:00:00Z" }, { startDate: "2026-04-01" })).toBe("2026-04-01")
  })
  it("requires the end to come after the start", () => {
    expect(validateGoalDates("2026-03-01", "2027-01-01")).toEqual({ start: null, end: null })
    expect(validateGoalDates("2026-03-01", "")).toEqual({ start: null, end: null })
    expect(validateGoalDates("2026-03-01", "2026-03-01").end).toMatch(/depois da data de início/)
    expect(validateGoalDates("2026-03-01", "2026-02-01").end).not.toBeNull()
    expect(validateGoalDates("", "2027-01-01").start).not.toBeNull()
  })
  it("labels the period", () => {
    expect(periodLabel("2026-03-01", "2027-01-01")).toBe("De mar/2026 até jan/2027")
    expect(periodLabel(null, "2027-01-01")).toBe("Até jan/2027")
    expect(periodLabel("2026-03-01", null)).toBe("Sem prazo")
  })
})

describe("projection over the time still ahead", () => {
  it("counts from today when the goal already started", () => {
    // 2026-11-10 -> 2027-01-10 is 61 days = 3 months (ceil of 61/30)
    expect(monthsToGo("2026-11-10", "2026-03-01", "2027-01-10")).toBe(3)
    expect(monthlyNeeded(300000, "2026-11-10", "2026-03-01", "2027-01-10")).toBe(100000)
  })
  it("counts from the start when it is still to come", () => {
    // start 2027-01-01 -> end 2027-04-01 is 90 days = 3 months, even though today is earlier
    expect(monthsToGo("2026-11-10", "2027-01-01", "2027-04-01")).toBe(3)
  })
  it("never divides by less than one month and needs nothing once reached", () => {
    expect(monthsToGo("2026-11-10", "2026-03-01", "2026-11-12")).toBe(1)
    expect(monthlyNeeded(0, "2026-11-10", "2026-03-01", "2027-01-10")).toBe(0)
  })
})

describe("opening balance", () => {
  it("moves only the opening entry when it is edited", () => {
    expect(withOpening(0, 0, 429841)).toBe(429841)
    // 4.298,41 opening + 500,00 saved later; opening corrected to 4.000,00
    expect(withOpening(479841, 429841, 400000)).toBe(450000)
    expect(withOpening(1000, 5000, 0)).toBe(0)
  })
})

describe("parseGoalMeta", () => {
  it("keeps valid entries", () => {
    expect(parseGoalMeta({ a: { startDate: "2026-03-01", openingCents: 429841 }, b: { startDate: "x", openingCents: -5 }, c: 3 })).toEqual({ a: { startDate: "2026-03-01", openingCents: 429841 } })
  })
})
