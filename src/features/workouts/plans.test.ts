import { describe, expect, it } from "vitest"

import { addWeekday, formatLoad, lastLoad, planTotals, removeWeekday, reorderExercises, sortWeekdays, toggleWeekday } from "./plans"
import type { SetLogRow, WorkoutSessionRow } from "./types"

describe("weekdays of a workout", () => {
  it("adds a day once and keeps Monday first", () => {
    expect(addWeekday([3], 1)).toEqual([1, 3])
    expect(addWeekday([1, 3], 3)).toEqual([1, 3])
    expect(addWeekday([6], 0)).toEqual([6, 0]) // Sunday goes last
    expect(sortWeekdays([0, 5, 1])).toEqual([1, 5, 0])
  })
  it("removes a day and leaves the others", () => {
    expect(removeWeekday([1, 3, 5], 3)).toEqual([1, 5])
    expect(removeWeekday([1], 2)).toEqual([1])
    expect(removeWeekday([1], 1)).toEqual([])
  })
  it("toggle adds when missing and removes when present", () => {
    expect(toggleWeekday([1], 4)).toEqual([1, 4])
    expect(toggleWeekday([1, 4], 4)).toEqual([1])
  })
})

describe("reorderExercises", () => {
  const row = (id: string, plan_id: string, position: number) => ({ id, plan_id, position })
  const rows = [row("a", "p1", 1), row("b", "p1", 2), row("c", "p1", 3), row("z", "p2", 1)]
  it("moves an exercise to the place of another and renumbers from 1", () => {
    const next = reorderExercises(rows, "p1", "a", "c")
    expect(next.filter((r) => r.plan_id === "p1").sort((x, y) => x.position - y.position).map((r) => r.id)).toEqual(["b", "c", "a"])
    expect(next.find((r) => r.id === "a")!.position).toBe(3)
  })
  it("moves up as well, and leaves other workouts alone", () => {
    const next = reorderExercises(rows, "p1", "c", "a")
    expect(next.filter((r) => r.plan_id === "p1").sort((x, y) => x.position - y.position).map((r) => r.id)).toEqual(["c", "a", "b"])
    expect(next.find((r) => r.id === "z")).toEqual(row("z", "p2", 1))
  })
  it("changes nothing for the same place or unknown ids", () => {
    expect(reorderExercises(rows, "p1", "a", "a")).toBe(rows)
    expect(reorderExercises(rows, "p1", "a", "nope")).toBe(rows)
    expect(reorderExercises(rows, "p2", "a", "z")).toBe(rows) // 'a' is not in p2
  })
  it("heals positions that were not consecutive", () => {
    const messy = [row("a", "p", 5), row("b", "p", 9)]
    expect(reorderExercises(messy, "p", "b", "a").map((r) => [r.id, r.position])).toEqual([["a", 2], ["b", 1]])
  })
})

describe("planTotals", () => {
  it("counts exercises and sets and estimates minutes like the Hoje tab", () => {
    // 4 x (45 + 90) + 3 x (45 + 60) = 855 s -> 14 min
    expect(planTotals([{ sets: 4, rest_seconds: 90 }, { sets: 3, rest_seconds: 60 }])).toEqual({ exercises: 2, sets: 7, minutes: 14 })
    expect(planTotals([])).toEqual({ exercises: 0, sets: 0, minutes: 0 })
  })
})

describe("lastLoad", () => {
  const session = (id: string, day: string, completed = true): WorkoutSessionRow => ({ id, user_id: "u", plan_id: "p", performed_on: day, duration_min: null, completed })
  const set = (session_id: string, exercise_id: string, load_kg: number, i = 1): SetLogRow => ({ id: `${session_id}-${exercise_id}-${i}`, session_id, exercise_id, set_index: i, reps: 8, load_kg })
  it("is the heaviest set of the latest completed session with the exercise", () => {
    const sessions = [session("s1", "2026-11-02"), session("s2", "2026-11-05"), session("s3", "2026-11-08", false)]
    const sets = [set("s1", "e", 60), set("s2", "e", 70, 1), set("s2", "e", 72.5, 2), set("s3", "e", 100), set("s2", "other", 5)]
    expect(lastLoad("e", sets, sessions)).toBe(72.5)
    expect(lastLoad("never", sets, sessions)).toBeNull()
  })
  it("formats the load in pt-BR or nothing", () => {
    expect(formatLoad(72.5)).toBe("72,5 kg")
    expect(formatLoad(80)).toBe("80 kg")
    expect(formatLoad(null)).toBeNull()
    expect(formatLoad(0)).toBeNull()
  })
})
