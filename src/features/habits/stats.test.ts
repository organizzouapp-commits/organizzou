import { describe, expect, it } from "vitest"

import { bestAndWorstWeekday, bestStreakOf, habitStats, insightsFor, monthCheckins, scheduledIn, weekdayStats, weeklyRates, weeksFor, fourWeekCells, averageRate, bestStreak, blockStarts, completionLevel, dayRecord, dayStrip, habitDayKind, monthCells, windowRate, consistency, consistencyDelta, currentStreak, dailyRates, dayCompletion, dayState, isDone, isScheduled, overallConsistency, recordStreak, shiftDay, topStreaks, weekStrip } from "./stats"
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

describe("Rotina > Estatísticas helpers", () => {
  const a = habit({ id: "a", name: "A" })
  const b = habit({ id: "b", name: "B" })
  const logsFor = (id: string, from: number, to: number) => Array.from({ length: to - from }, (_, i) => log(id, shiftDay(TODAY, -(from + i))))

  it("weeksFor follows the period and scheduledIn counts only the period", () => {
    expect([7, 30, 90].map(weeksFor)).toEqual([4, 8, 12])
    expect(scheduledIn(a, TODAY, 7)).toBe(7)
    expect(scheduledIn(habit({ weekdays: [1] }), TODAY, 14)).toBe(2)
  })

  it("period filtering: a log outside the period does not count", () => {
    const logs = logsFor("a", 7, 14) // only the week BEFORE the last 7 days
    expect(overallConsistency([a], logs, TODAY, 7)).toBe(0)
    expect(overallConsistency([a], logs, TODAY, 14)).toBe(50)
  })

  it("weekdayStats: per-weekday % and best / hardest weekday (ties: the earlier one, Monday first)", () => {
    // Only Tuesdays (weekday 2) are done in the last 14 days.
    const logs = [log("a", "2026-03-10"), log("a", "2026-03-03")]
    const stats = weekdayStats([a], logs, TODAY, 14)
    expect(stats[2]).toMatchObject({ done: 2, total: 2, rate: 100 })
    expect(stats[3]).toMatchObject({ done: 0, total: 2, rate: 0 })
    const { best, worst } = bestAndWorstWeekday(stats)!
    expect(best.weekday).toBe(2)
    expect(worst.weekday).toBe(1) // 0% ties: Monday comes first
    expect(bestAndWorstWeekday(weekdayStats([], [], TODAY, 14))).toBeNull()
  })

  it("weeklyRates: rolling blocks ending today, the last is the current week, empty leading weeks are dropped", () => {
    const logs = logsFor("a", 0, 7) // the current week fully done
    const weeks = weeklyRates([a], logs, TODAY, 4)
    expect(weeks).toHaveLength(4)
    expect(weeks[3]).toEqual({ start: "2026-03-04", end: TODAY, rate: 100 })
    expect(weeks[2].rate).toBe(0)
    expect(weeklyRates([habit({ weekdays: [] })], [], TODAY, 4)).toEqual([])
  })

  it("habitStats: delta against the previous period, best first, paused last", () => {
    const logs = [...logsFor("a", 0, 7), ...logsFor("a", 7, 10), ...logsFor("b", 0, 2)]
    const stats = habitStats([b, habit({ id: "p", name: "P", paused: true }), a], logs, TODAY, 7)
    expect(stats.map((s) => s.habit.id)).toEqual(["a", "b", "p"])
    expect(stats[0]).toMatchObject({ rate: 100, previous: 43, delta: 57 })
    expect(stats[1].delta).toBe(29)
  })

  it("insightsFor applies the three rules in order, skips the ones that do not apply and caps at three", () => {
    const logs = [...logsFor("a", 0, 7), ...logsFor("b", 0, 2)]
    const insights = insightsFor([a, b], logs, TODAY, 7)
    expect(insights.map((i) => i.kind)).toEqual(["weekday", "improved", "below"])
    expect(insights[0].action).toBe("Ajustar dias")
    expect(insights[1].title).toBe("A subiu 100 pts")
    expect(insights[2]).toMatchObject({ title: "B está abaixo de 60%", action: "Editar hábito", habitId: "b" })
    // Everything is done and stable: nothing to say.
    const all = [...logsFor("a", 0, 14), ...logsFor("b", 0, 14)]
    expect(insightsFor([a, b], all, TODAY, 7)).toEqual([])
    expect(insightsFor([], [], TODAY, 7)).toEqual([])
  })

  it("bestStreakOf and monthCheckins", () => {
    const logs = [...logsFor("a", 0, 5), log("b", "2026-02-27")]
    expect(bestStreakOf([a, b], logs, TODAY, 30)).toMatchObject({ days: 5 })
    expect(bestStreakOf([a], [], TODAY, 30)).toBeNull()
    expect(monthCheckins(logs, TODAY)).toBe(5)
  })
})
