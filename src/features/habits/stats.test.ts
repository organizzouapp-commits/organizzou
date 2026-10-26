import { describe, expect, it } from "vitest"

import { bestStreak, consistency, currentStreak, dayCompletion, isDone, isScheduled } from "./stats"
import type { HabitLogRow, HabitRow } from "./types"

const stamp = { created_at: "2026-03-01T00:00:00Z", updated_at: "2026-03-01T00:00:00Z" }

function habit(overrides: Partial<HabitRow>): HabitRow {
  return {
    id: "h1",
    user_id: "u",
    name: "Meditar",
    type: "fixed",
    target_qty: null,
    unit: null,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    deadline: null,
    paused: false,
    ...stamp,
    ...overrides,
  }
}

function log(habitId: string, day: string, qty = 1): HabitLogRow {
  return { id: `${habitId}-${day}`, user_id: "u", habit_id: habitId, log_date: day, qty, ...stamp }
}

// 2026-03-10 is a Tuesday
const TODAY = "2026-03-10"

describe("isDone / isScheduled", () => {
  it("needs the target quantity for goal habits", () => {
    const reading = habit({ type: "goal", target_qty: 20, unit: "páginas" })
    expect(isDone(reading, [log("h1", TODAY, 12)], TODAY)).toBe(false)
    expect(isDone(reading, [log("h1", TODAY, 20)], TODAY)).toBe(true)
  })

  it("respects the weekday schedule", () => {
    const weekdays = habit({ weekdays: [1, 2, 3, 4, 5] })
    expect(isScheduled(weekdays, TODAY)).toBe(true)
    expect(isScheduled(weekdays, "2026-03-08")).toBe(false) // Sunday
  })
})

describe("streaks", () => {
  it("counts consecutive days and tolerates a pending today", () => {
    const h = habit({})
    const logs = [log("h1", "2026-03-09"), log("h1", "2026-03-08"), log("h1", "2026-03-07"), log("h1", "2026-03-05")]
    expect(currentStreak(h, logs, TODAY)).toBe(3)
    expect(currentStreak(h, [...logs, log("h1", TODAY)], TODAY)).toBe(4)
  })

  it("skips days the habit is not scheduled", () => {
    const h = habit({ weekdays: [1, 2, 3, 4, 5] })
    // Friday 6th and Monday 9th done, weekend skipped
    const logs = [log("h1", "2026-03-09"), log("h1", "2026-03-06")]
    expect(currentStreak(h, logs, TODAY)).toBe(2)
  })

  it("finds the best streak in the lookback window", () => {
    const h = habit({})
    const logs = ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-07"].map((d) => log("h1", d))
    expect(bestStreak(h, logs, TODAY, 20)).toBe(4)
  })
})

describe("consistency / dayCompletion", () => {
  it("computes the completion rate over a window", () => {
    const h = habit({})
    const logs = ["2026-03-10", "2026-03-09", "2026-03-08", "2026-03-07", "2026-03-06"].map((d) => log("h1", d))
    expect(consistency(h, logs, TODAY, 10)).toBe(50)
  })

  it("ignores paused habits and returns null on empty days", () => {
    const active = habit({ id: "a" })
    const paused = habit({ id: "b", paused: true })
    expect(dayCompletion([active, paused], [log("a", TODAY)], TODAY)).toBe(1)
    expect(dayCompletion([habit({ weekdays: [1] })], [], "2026-03-08")).toBeNull()
  })
})
