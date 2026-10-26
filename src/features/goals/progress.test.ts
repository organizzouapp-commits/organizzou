import { describe, expect, it } from "vitest"

import { goalProgress, linkRatio } from "./progress"
import type { GoalLinkRow, GoalMilestoneRow } from "./types"

const link = (done: number, total: number): GoalLinkRow => ({ id: "l", goal_id: "g", module: "estudos", label: "x", done, total, unit: "h" })
const milestone = (done: boolean): GoalMilestoneRow => ({ id: "m", goal_id: "g", title: "x", done })

describe("goal progress", () => {
  it("caps each link at 100% and ignores empty totals", () => {
    expect(linkRatio(link(150, 100))).toBe(1)
    expect(linkRatio(link(5, 0))).toBe(0)
  })

  it("averages links and counts milestones as one more source", () => {
    expect(goalProgress([link(50, 100), link(100, 100)], [])).toBe(75)
    expect(goalProgress([link(50, 100)], [milestone(true), milestone(false)])).toBe(50)
    expect(goalProgress([], [])).toBe(0)
  })
})
