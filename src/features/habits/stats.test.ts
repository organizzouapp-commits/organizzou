import { describe, expect, it } from "vitest"

import { fourWeekCells, averageRate, bestStreak, blockStarts, completionLevel, dayRecord, dayStrip, habitDayKind, monthCells, windowRate, consistency, consistencyDelta, currentStreak, dailyRates, dayCompletion, dayState, isDone, isScheduled, overallConsistency, recordStreak, shiftDay, topStreaks, weekStrip } from "./stats"
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

describe("Rotina > Hoje helpers", () => {
  const water = habit({ id: "w", name: "Água" })
  const weekdaysOnly = habit({ id: "d", name: "Treino", weekdays: [1, 2, 3, 4, 5] })

  it("dayState: done, missed, pending (only the selected day) and off", () => {
    const logs = [log("w", "2026-03-10"), log("w", "2026-03-08")]
    expect(dayState(water, logs, "2026-03-10", TODAY)).toBe("done")
    expect(dayState(water, logs, "2026-03-09", TODAY)).toBe("missed")
    expect(dayState(water, [], TODAY, TODAY)).toBe("pending")
    // 2026-03-08 is a Sunday: not scheduled for a weekday-only habit.
    expect(dayState(weekdaysOnly, [], "2026-03-08", TODAY)).toBe("off")
  })

  it("weekStrip is 7 days ending on the selected day, oldest first", () => {
    const strip = weekStrip(water, [log("w", "2026-03-10")], TODAY)
    expect(strip.map((s) => s.day)).toEqual(["2026-03-04", "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10"])
    expect(strip[6].state).toBe("done")
    expect(strip[5].state).toBe("missed")
  })

  it("overallConsistency counts scheduled check-ins of every habit together, ignoring paused ones", () => {
    const logs = [log("w", "2026-03-10"), log("w", "2026-03-09")]
    // 30 days x 1 habit = 30 scheduled, 2 done.
    expect(overallConsistency([water], logs, TODAY)).toBe(7)
    expect(overallConsistency([habit({ paused: true })], logs, TODAY)).toBe(0)
    expect(overallConsistency([], [], TODAY)).toBe(0)
  })

  it("consistencyDelta compares the last 30 days with the 30 before", () => {
    const recent = Array.from({ length: 15 }, (_, i) => log("w", shiftDay(TODAY, -i)))
    expect(consistencyDelta([water], recent, TODAY)).toBe(50)
    const older = Array.from({ length: 30 }, (_, i) => log("w", shiftDay(TODAY, -30 - i)))
    expect(consistencyDelta([water], older, TODAY)).toBe(-100)
  })

  it("dailyRates has one value per day and carries the last rate over days with nothing scheduled", () => {
    const rates = dailyRates([weekdaysOnly], [log("d", "2026-03-06")], TODAY, 7)
    expect(rates).toHaveLength(7)
    // 03-04 Wed (missed 0), 03-05 Thu (0), 03-06 Fri (100), 03-07 Sat/03-08 Sun (carry 100), 03-09 Mon (0), 03-10 Tue (0)
    expect(rates).toEqual([0, 0, 100, 100, 100, 0, 0])
  })

  it("recordStreak looks further back than bestStreak and topStreaks ranks by current streak", () => {
    const old = Array.from({ length: 5 }, (_, i) => log("w", shiftDay(TODAY, -200 - i)))
    expect(recordStreak(water, old, TODAY)).toBe(5)
    expect(bestStreak(water, old, TODAY)).toBe(0)
    const logs = [log("w", "2026-03-10"), log("w", "2026-03-09"), log("d", "2026-03-10")]
    const top = topStreaks([weekdaysOnly, water, habit({ id: "z", name: "Zero" })], logs, TODAY)
    expect(top.map((t) => [t.habit.id, t.streak])).toEqual([["w", 2], ["d", 1]])
  })
})

describe("Rotina > Histórico helpers", () => {
  const a = habit({ id: "a", name: "A" })
  const b = habit({ id: "b", name: "B" })
  const c = habit({ id: "c", name: "C", paused: true })
  const sat = habit({ id: "s", name: "Sáb", weekdays: [6] })

  it("dayRecord counts done over scheduled and ignores paused habits", () => {
    expect(dayRecord([a, b, c], [log("a", "2026-03-09")], "2026-03-09")).toEqual({ day: "2026-03-09", done: 1, total: 2, rate: 0.5 })
    // 2026-03-08 is a Sunday: the Saturday-only habit is not scheduled, so there is nothing to count.
    expect(dayRecord([sat], [], "2026-03-08").rate).toBeNull()
  })

  it("completionLevel follows the shades: 100 / 67-99 / 50-66 / 1-49 / 0", () => {
    expect([1, 0.99, 0.67, 0.66, 0.5, 0.49, 0.01, 0, null].map(completionLevel)).toEqual([4, 3, 3, 2, 2, 1, 1, 0, 0])
    // 2 of 3 rounds to 67%.
    expect(completionLevel(2 / 3)).toBe(3)
  })

  it("habitDayKind: done, missed in the past, open today and later, off when not scheduled", () => {
    const logs = [log("a", "2026-03-09")]
    expect(habitDayKind(a, logs, "2026-03-09", TODAY)).toBe("done")
    expect(habitDayKind(a, logs, "2026-03-08", TODAY)).toBe("missed")
    expect(habitDayKind(a, logs, TODAY, TODAY)).toBe("open")
    expect(habitDayKind(a, logs, "2026-03-12", TODAY)).toBe("open")
    expect(habitDayKind(sat, [], "2026-03-08", TODAY)).toBe("off")
  })

  it("monthCells returns whole Sunday-first weeks and flags the days of the month", () => {
    const cells = monthCells("2026-11")
    expect(cells.length % 7).toBe(0)
    expect(cells[0].day).toBe("2026-11-01") // a Sunday
    expect(cells[cells.length - 1].day).toBe("2026-12-05")
    expect(cells.filter((x) => x.inMonth)).toHaveLength(30)
    const march = monthCells("2026-03")
    expect(march[0]).toEqual({ day: "2026-03-01", inMonth: true })
    expect(monthCells("2026-02").some((x) => !x.inMonth)).toBe(false)
  })

  it("blockStarts are the first days of the four 7-day blocks ending on the last day", () => {
    expect(blockStarts("2026-11-09")).toEqual(["2026-10-13", "2026-10-20", "2026-10-27", "2026-11-03"])
  })

  it("dayStrip(28) and windowRate/averageRate aggregate the last 28 days", () => {
    const logs = Array.from({ length: 14 }, (_, i) => log("a", shiftDay(TODAY, -i)))
    const strip = dayStrip(a, logs, TODAY, 28)
    expect(strip).toHaveLength(28)
    expect(strip[27].state).toBe("done")
    expect(strip[0].state).toBe("missed")
    expect(windowRate(a, logs, TODAY)).toBe(50)
    expect(averageRate([a, b, c], logs, TODAY)).toBe(25)
    expect(averageRate([], [], TODAY)).toBe(0)
  })
})

describe("fourWeekCells", () => {
  it("is 28 days from a Sunday, ending with the Saturday of the current week", () => {
    // 2026-03-10 is a Tuesday: the current week is 03-08 (Sun) .. 03-14 (Sat).
    const cells = fourWeekCells("2026-03-10")
    expect(cells).toHaveLength(28)
    expect(cells[0].day).toBe("2026-02-15")
    expect(cells[27].day).toBe("2026-03-14")
  })
})
