import { describe, expect, it } from "vitest"

import { averagePerWeek, isNewRecord, loadSeries, loadSummary, niceAxis, periodStart, periodWeeks, plannedPerWeek, recordGain, recordRows, recordsInMonth, sessionsInPeriod, volumeDelta, weeklyBuckets } from "./evolution"
import type { SetLogRow, WorkoutSessionRow } from "./types"

// 2026-11-11 is a Wednesday; its week starts on Monday 2026-11-09.
const TODAY = "2026-11-11"
const session = (id: string, day: string, completed = true): WorkoutSessionRow => ({ id, user_id: "u", plan_id: "p", performed_on: day, duration_min: null, completed })
const set = (session_id: string, exercise_id: string, load_kg: number, reps: number, i = 1): SetLogRow => ({ id: `${session_id}-${exercise_id}-${i}`, session_id, exercise_id, set_index: i, reps, load_kg })

describe("period", () => {
  it("maps the selector to weeks and starts on the Monday of the first week", () => {
    expect([periodWeeks("4w"), periodWeeks("12w"), periodWeeks("6m")]).toEqual([4, 12, 26])
    expect(periodStart(TODAY, 1)).toBe("2026-11-09")
    expect(periodStart(TODAY, 4)).toBe("2026-10-19")
  })
  it("filters completed sessions to the period and to today", () => {
    const sessions = [session("a", "2026-10-18"), session("b", "2026-10-19"), session("c", "2026-11-10"), session("d", "2026-11-12"), session("e", "2026-11-05", false)]
    expect(sessionsInPeriod(sessions, TODAY, 4).map((s) => s.id)).toEqual(["b", "c"])
  })
})

describe("weeklyBuckets and volumeDelta", () => {
  const sessions = [session("s1", "2026-10-28"), session("s2", "2026-11-03"), session("s3", "2026-11-10")]
  const sets = [set("s1", "e", 100, 10), set("s2", "e", 100, 10), set("s2", "e", 50, 10), set("s3", "e", 100, 15)]
  it("sums load x reps per Monday week, the last bucket is the current week", () => {
    const buckets = weeklyBuckets(sets, sessions, TODAY, 4)
    expect(buckets.map((b) => [b.start, b.volume, b.sessions])).toEqual([["2026-10-26", 1000, 1], ["2026-11-02", 1500, 1], ["2026-11-09", 1500, 1]])
  })
  it("drops the weeks before the first workout and returns nothing without data", () => {
    expect(weeklyBuckets(sets, sessions, TODAY, 12)).toHaveLength(3)
    expect(weeklyBuckets([], [], TODAY, 4)).toEqual([])
  })
  it("compares the current week with the previous one (null when there is nothing to compare)", () => {
    expect(volumeDelta([{ volume: 1000 }, { volume: 1120 }])).toBe(12)
    expect(volumeDelta([{ volume: 2000 }, { volume: 1000 }])).toBe(-50)
    expect(volumeDelta([{ volume: 0 }, { volume: 1000 }])).toBeNull()
    expect(volumeDelta([{ volume: 1000 }])).toBeNull()
  })
})

describe("frequency", () => {
  it("counts planned workouts per week and the average", () => {
    expect(plannedPerWeek([{ weekdays: [1, 3, 5] }, { weekdays: [2, 2] }])).toBe(4)
    expect(plannedPerWeek([])).toBe(0)
    expect(averagePerWeek(10, 4)).toBe(2.5)
    expect(averagePerWeek(3, 0)).toBe(0)
  })
})

describe("records", () => {
  const sessions = [session("s1", "2026-10-01"), session("s2", "2026-10-15"), session("s3", "2026-11-09")]
  const sets = [set("s1", "e", 80, 8), set("s2", "e", 80, 8), set("s3", "e", 82.5, 8), set("s1", "z", 20, 10), set("s3", "z", 20, 12)]
  it("keeps the best set per exercise with the record it replaced, newest first", () => {
    const rows = recordRows(sets, sessions)
    expect(rows.map((r) => r.exerciseId)).toEqual(["e", "z"]) // same day: the bigger estimated 1RM first
    const e = rows.find((r) => r.exerciseId === "e")!
    expect(e).toMatchObject({ loadKg: 82.5, reps: 8, on: "2026-11-09", previous: { loadKg: 80, reps: 8 } })
    expect(recordGain(e)).toBe("+2,5 kg")
    const z = rows.find((r) => r.exerciseId === "z")!
    expect(recordGain(z)).toBe("+2 reps") // same load, more repetitions
    expect(recordGain({ loadKg: 50, reps: 5, previous: null })).toBeNull()
  })
  it("ignores sets of sessions that were not completed", () => {
    expect(recordRows([set("x", "e", 200, 10)], [session("x", "2026-11-01", false)])).toEqual([])
  })
  it("flags records of the last 7 days and counts the ones of the month", () => {
    expect(isNewRecord({ on: "2026-11-05" }, TODAY)).toBe(true)
    expect(isNewRecord({ on: "2026-11-04" }, TODAY)).toBe(false)
    expect(isNewRecord({ on: "2026-11-12" }, TODAY)).toBe(false)
    expect(recordsInMonth(recordRows(sets, sessions), TODAY)).toBe(2)
  })
})

describe("load of one exercise", () => {
  const sessions = [session("s1", "2026-09-07"), session("s2", "2026-10-26"), session("s3", "2026-11-09")]
  const sets = [set("s1", "e", 60, 10), set("s2", "e", 70, 8), set("s2", "e", 72.5, 6, 2), set("s3", "e", 77.5, 8), set("s3", "other", 5, 5)]
  it("takes the heaviest set of each session inside the period", () => {
    expect(loadSeries("e", sets, sessions, TODAY, 4)).toEqual([{ day: "2026-10-26", load: 72.5, reps: 6 }, { day: "2026-11-09", load: 77.5, reps: 8 }])
    expect(loadSeries("e", sets, sessions, TODAY, 12)).toHaveLength(3)
    expect(loadSeries("nope", sets, sessions, TODAY, 12)).toEqual([])
  })
  it("summarises the difference between the first and the last load", () => {
    expect(loadSummary(loadSeries("e", sets, sessions, TODAY, 12))).toBe("+17,5 kg em 9 semanas")
    expect(loadSummary([{ day: "2026-11-01", load: 50, reps: 5 }, { day: "2026-11-08", load: 45, reps: 5 }])).toBe("−5 kg em 1 semana")
    expect(loadSummary([{ day: "2026-11-01", load: 50, reps: 5 }])).toBe("1 registro no período")
    expect(loadSummary([])).toBe("Sem registros no período")
  })
})

describe("niceAxis", () => {
  it("covers the values with round ticks", () => {
    const axis = niceAxis([60, 77.5])
    expect(axis.min).toBeLessThanOrEqual(60)
    expect(axis.max).toBeGreaterThanOrEqual(77.5)
    expect(axis.ticks.length).toBeLessThanOrEqual(5)
    const zero = niceAxis([1.2, 4.2], { zero: true })
    expect(zero.min).toBe(0)
    expect(zero.max).toBeGreaterThanOrEqual(4.2)
  })
  it("never collapses to a single value", () => {
    const axis = niceAxis([50])
    expect(axis.max).toBeGreaterThan(axis.min)
  })
})
