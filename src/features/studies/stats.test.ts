import { describe, expect, it } from "vitest"

import { averagePerDay, bestDay, bestStreak, currentStreak, dailyGoal, deadlineChip, durationParts, durationText, minutesByDay, nextDeadlines, percentOf, pomodoroCycle, stripState, studiedDays, weekOf } from "./stats"

const TODAY = "2026-11-09" // a Monday
const s = (studied_on: string, minutes: number) => ({ studied_on, minutes })

describe("durationParts / durationText", () => {
  it("formats minutes, hours and both", () => {
    expect(durationText(48)).toBe("48 min")
    expect(durationText(180)).toBe("3 h")
    expect(durationText(345)).toBe("5 h 45 min")
    expect(durationText(0)).toBe("0 min")
  })
  it("marks the units so they can be dimmed", () => {
    expect(durationParts(345)).toEqual([{ text: "5" }, { text: " h ", unit: true }, { text: "45" }, { text: " min", unit: true }])
    expect(durationParts(48).filter((p) => p.unit).map((p) => p.text)).toEqual([" min"])
  })
})

describe("streaks", () => {
  const days = studiedDays([s("2026-11-09", 30), s("2026-11-08", 20), s("2026-11-07", 5), s("2026-11-05", 40), s("2026-11-04", 0)])
  it("ignores sessions of 0 minutes", () => expect(days.has("2026-11-04")).toBe(false))
  it("counts consecutive days ending today", () => expect(currentStreak(days, TODAY)).toBe(3))
  it("keeps the streak alive while today is still empty", () => {
    expect(currentStreak(studiedDays([s("2026-11-08", 20), s("2026-11-07", 20)]), TODAY)).toBe(2)
  })
  it("is zero after a whole missed day", () => {
    expect(currentStreak(studiedDays([s("2026-11-06", 20)]), TODAY)).toBe(0)
    expect(currentStreak(new Set(), TODAY)).toBe(0)
  })
  it("finds the record, across month boundaries", () => {
    const long = studiedDays([s("2026-10-29", 10), s("2026-10-30", 10), s("2026-10-31", 10), s("2026-11-01", 10), s("2026-11-02", 10), s("2026-11-09", 10)])
    expect(bestStreak(long)).toBe(5)
    expect(bestStreak(new Set())).toBe(0)
  })
})

describe("week helpers", () => {
  const week = minutesByDay([s("2026-11-09", 48), s("2026-11-09", 12), s("2026-11-10", 120), s("2026-11-12", 120), s("2026-11-02", 999)], "2026-11-09")
  it("lists the seven days of the week", () => {
    expect(weekOf("2026-11-09")).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"])
  })
  it("sums each day and ignores other weeks", () => {
    expect(week.map((d) => d.minutes)).toEqual([60, 120, 0, 120, 0, 0, 0])
  })
  it("finds the best day (earliest wins a tie)", () => {
    expect(bestDay(week)).toEqual({ day: "2026-11-10", minutes: 120 })
    expect(bestDay(minutesByDay([], "2026-11-09"))).toBeNull()
  })
  it("averages over the days elapsed so far", () => {
    expect(averagePerDay(week, "2026-11-09")).toBe(60)
    expect(averagePerDay(week, "2026-11-12")).toBe(75)
    expect(averagePerDay(week, "2026-11-15")).toBe(43)
    expect(averagePerDay(week, "2026-11-01")).toBe(0)
  })
})

describe("goals", () => {
  it("computes the percentage of the weekly goal, uncapped", () => {
    expect(percentOf(345, 1320)).toBe(26)
    expect(percentOf(1500, 1320)).toBe(114)
    expect(percentOf(10, 0)).toBe(0)
  })
  it("derives the daily goal from the weekly one (nearest 30 min)", () => {
    expect(dailyGoal(1320)).toBe(180)
    expect(dailyGoal(60)).toBe(30)
    expect(dailyGoal(0)).toBe(0)
  })
})

describe("strip and cycle", () => {
  const studied = new Set(["2026-11-09", "2026-11-07"])
  it("gives each day a state", () => {
    expect(stripState("2026-11-07", "2026-11-09", studied)).toBe("done")
    expect(stripState("2026-11-08", "2026-11-09", studied)).toBe("missed")
    expect(stripState("2026-11-09", "2026-11-09", new Set())).toBe("today")
    expect(stripState("2026-11-10", "2026-11-09", studied)).toBe("future")
  })
  it("tracks the pomodoro cycle of 4", () => {
    expect(pomodoroCycle(0)).toEqual({ done: 0, cycle: 1 })
    expect(pomodoroCycle(1)).toEqual({ done: 1, cycle: 2 })
    expect(pomodoroCycle(3)).toEqual({ done: 3, cycle: 4 })
    expect(pomodoroCycle(4)).toEqual({ done: 0, cycle: 1 })
  })
})

describe("deadlines", () => {
  it("counts the days left and is solid at 3 days or less", () => {
    expect(deadlineChip("2026-11-09", TODAY)).toEqual({ left: 0, text: "Hoje", solid: true })
    expect(deadlineChip("2026-11-10", TODAY)).toEqual({ left: 1, text: "1 dia", solid: true })
    expect(deadlineChip("2026-11-12", TODAY)).toEqual({ left: 3, text: "3 dias", solid: true })
    expect(deadlineChip("2026-11-13", TODAY)).toEqual({ left: 4, text: "4 dias", solid: false })
  })
  it("lists the next ones from today, soonest first, past ones out", () => {
    const list = [{ due_on: "2026-12-01" }, { due_on: "2026-11-01" }, { due_on: "2026-11-09" }, { due_on: "2026-11-20" }, { due_on: "2026-11-15" }]
    expect(nextDeadlines(list, TODAY).map((d) => d.due_on)).toEqual(["2026-11-09", "2026-11-15", "2026-11-20"])
    expect(nextDeadlines(list, TODAY, 1)).toHaveLength(1)
  })
})
