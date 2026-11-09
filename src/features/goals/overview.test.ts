import { describe, expect, it } from "vitest"

import { averageProgress, cappedPercent, deadlineChips, formatDeadline, goalDaysLeft, leftLabel, linkText, milestoneChip, milestoneTotals, nextDeadlineGoal, sortGoals } from "./overview"
import type { GoalLinkRow, GoalMilestoneRow } from "./types"

const TODAY = "2026-11-09"
const link = (done: number, total: number, unit = "tarefas"): GoalLinkRow => ({ id: "l", goal_id: "g", module: "tarefas", label: "x", done, total, unit })
const ms = (done: boolean): GoalMilestoneRow => ({ id: "m", goal_id: "g", title: "x", done })
const goal = (id: string, deadline: string | null, created_at = "2026-10-01T10:00:00Z", links: GoalLinkRow[] = [], milestones: GoalMilestoneRow[] = []) => ({ id, deadline, created_at, links, milestones })

describe("goalDaysLeft", () => {
  it("counts whole days, negative when past, null without a deadline", () => {
    expect(goalDaysLeft("2026-11-12", TODAY)).toBe(3)
    expect(goalDaysLeft(TODAY, TODAY)).toBe(0)
    expect(goalDaysLeft("2026-11-08", TODAY)).toBe(-1)
    expect(goalDaysLeft("2027-01-01", "2026-12-31")).toBe(1)
    expect(goalDaysLeft(null, TODAY)).toBeNull()
  })
  it("does not depend on the device timezone", () => {
    const original = process.env.TZ
    for (const tz of ["America/Sao_Paulo", "UTC", "Pacific/Auckland"]) {
      process.env.TZ = tz
      expect(goalDaysLeft("2026-12-15", TODAY)).toBe(36)
    }
    process.env.TZ = original
  })
})

describe("averageProgress", () => {
  it("averages the progress of each goal (links and milestones)", () => {
    const goals = [goal("a", null, "x", [link(50, 100)]), goal("b", null, "x", [link(100, 100)]), goal("c", null, "x", [], [ms(true), ms(false)])]
    expect(averageProgress(goals)).toBe(67) // (50 + 100 + 50) / 3
  })
  it("is 0 without goals", () => expect(averageProgress([])).toBe(0))
})

describe("milestoneTotals", () => {
  it("counts done and total across goals", () => {
    expect(milestoneTotals([goal("a", null, "x", [], [ms(true), ms(true), ms(false)]), goal("b", null, "x", [], [ms(true), ms(false)]), goal("c", null)])).toEqual({ done: 3, total: 5 })
    expect(milestoneTotals([])).toEqual({ done: 0, total: 0 })
  })
})

describe("sortGoals and nextDeadlineGoal", () => {
  const goals = [goal("none-new", null, "2026-10-05T00:00:00Z"), goal("late", "2026-12-20"), goal("soon", "2026-11-12"), goal("none-old", null, "2026-09-01T00:00:00Z"), goal("past", "2026-11-01"), goal("same-b", "2026-11-12", "2026-10-02T00:00:00Z"), goal("same-a", "2026-11-12", "2026-10-02T00:00:00Z")]
  it("puts the nearest deadline first, then the goals without one", () => {
    expect(sortGoals(goals).map((g) => g.id)).toEqual(["past", "soon", "same-a", "same-b", "late", "none-old", "none-new"])
  })
  it("is deterministic whatever the input order", () => {
    expect(sortGoals([...goals].reverse()).map((g) => g.id)).toEqual(sortGoals(goals).map((g) => g.id))
  })
  it("does not change its input", () => {
    const copy = [...goals]
    sortGoals(goals)
    expect(goals).toEqual(copy)
  })
  it("finds the next deadline that has not passed", () => {
    expect(nextDeadlineGoal(goals, TODAY)).toMatchObject({ goal: { id: "soon" }, left: 3 })
    expect(nextDeadlineGoal([goal("a", "2026-11-09")], TODAY)).toMatchObject({ left: 0 })
    expect(nextDeadlineGoal([goal("a", "2026-11-01"), goal("b", null)], TODAY)).toBeNull()
    expect(nextDeadlineGoal([], TODAY)).toBeNull()
  })
})

describe("card texts", () => {
  it("formats the deadline and the days left", () => {
    expect(formatDeadline("2026-12-15")).toBe("15 de dez 2026")
    expect(leftLabel(36)).toBe("faltam 36 dias")
    expect(leftLabel(1)).toBe("falta 1 dia")
    expect(leftLabel(0)).toBe("vence hoje")
    expect(leftLabel(-2)).toBe("prazo vencido")
  })
  it("builds the chips, none without a deadline", () => {
    expect(deadlineChips("2026-12-15", TODAY, true)).toEqual(["faltam 36 dias", "até 15 de dez 2026"])
    expect(deadlineChips("2026-12-15", TODAY, false)).toEqual(["até 15 de dez 2026"])
    expect(deadlineChips(null, TODAY, true)).toEqual([])
  })
  it("caps the percentage but keeps the real values in the text", () => {
    expect(cappedPercent(17, 12)).toBe(100)
    expect(cappedPercent(6, 12)).toBe(50)
    expect(cappedPercent(0, 12)).toBe(0)
    expect(cappedPercent(5, 0)).toBe(0)
    expect(linkText(link(17, 12))).toBe("17 de 12 tarefas")
    expect(linkText(link(1200, 5000, "R$"))).toBe("R$ 1.200 de R$ 5.000")
    expect(linkText(link(5, 50, "h"))).toBe("5 de 50 h")
  })
  it("builds the milestones chip", () => expect(milestoneChip(2, 3)).toBe("2 de 3"))
})
