import { describe, expect, it } from "vitest"

import { goalHoursText, weeklyGoalMinutes } from "./subject-form"
import { parseSubjectMeta, setArchived } from "./subject-meta"

describe("subject meta", () => {
  it("keeps only string ids, once each", () => {
    expect(parseSubjectMeta({ archived: ["a", 1, "a", "b"] })).toEqual({ archived: ["a", "b"] })
    expect(parseSubjectMeta(null)).toEqual({ archived: [] })
    expect(parseSubjectMeta({ archived: "x" })).toEqual({ archived: [] })
  })

  it("archives and restores", () => {
    const one = setArchived({ archived: [] }, "a", true)
    expect(one).toEqual({ archived: ["a"] })
    expect(setArchived(one, "a", true)).toEqual({ archived: ["a"] })
    expect(setArchived(one, "a", false)).toEqual({ archived: [] })
  })
})

describe("weekly goal hours", () => {
  it("turns hours into minutes", () => {
    expect(weeklyGoalMinutes("4")).toBe(240)
    expect(weeklyGoalMinutes("2,5")).toBe(150)
    expect(weeklyGoalMinutes("0")).toBe(0)
    expect(weeklyGoalMinutes("9999")).toBe(168 * 60)
  })
  it("refuses blank and junk", () => {
    for (const bad of ["", " ", "abc", "-1", "1,2,3"]) expect(weeklyGoalMinutes(bad)).toBeNull()
  })
  it("writes minutes back as hours", () => {
    expect(goalHoursText(150)).toBe("2,5")
    expect(goalHoursText(240)).toBe("4")
    expect(goalHoursText(0)).toBe("0")
  })
})
