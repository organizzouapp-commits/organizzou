import { describe, expect, it } from "vitest"

import type { HabitLogRow, HabitRow } from "@/features/habits/types"

import { computeLinked, EMPTY_SOURCES, isLinkedComplete, linkProgressRatio, parseLinkedGoals, weekStart, type GoalSources, type LinkedGoalMeta } from "./linked"

const TODAY = "2026-11-18" // a Wednesday
const meta = (spec: LinkedGoalMeta["spec"], startDate = "2026-01-01"): LinkedGoalMeta => ({ spec, startDate, endDate: null })
const src = (over: Partial<GoalSources>): GoalSources => ({ ...EMPTY_SOURCES, ...over })

const habit = (over: Partial<HabitRow> = {}): HabitRow => ({ id: "h1", user_id: "u", name: "Ler", type: "fixed", target_qty: null, unit: null, weekdays: [0, 1, 2, 3, 4, 5, 6], deadline: null, paused: false, created_at: "2026-01-01T00:00:00Z", updated_at: "", ...over })
const log = (day: string, habit_id = "h1"): HabitLogRow => ({ id: day, user_id: "u", habit_id, log_date: day, qty: 1, created_at: "", updated_at: "" })

describe("calendar", () => {
  it("weeks start on Monday", () => {
    expect(weekStart("2026-11-18")).toBe("2026-11-16")
    expect(weekStart("2026-11-16")).toBe("2026-11-16")
    expect(weekStart("2026-11-22")).toBe("2026-11-16")
  })
})

describe("Finanças", () => {
  it("a saving goal reads the Finanças goal (not a copy)", () => {
    const rows = computeLinked(meta({ kind: "finance_saving", goalId: "g" }), src({ financeGoals: [{ id: "g", name: "Reserva", target_cents: 1_000_000, current_cents: 429_841, deadline: null }] }), TODAY)
    expect(rows[0]).toMatchObject({ done: 429_841, total: 1_000_000, unit: "R$", href: "/dashboard/financas" })
    expect(isLinkedComplete(rows)).toBe(false)
    expect(computeLinked(meta({ kind: "finance_saving", goalId: "g" }), src({ financeGoals: [{ id: "g", name: "Reserva", target_cents: 100, current_cents: 500, deadline: null }] }), TODAY)[0].done).toBe(100)
  })
  it("a removed Finanças goal is flagged, not silently zero", () => {
    expect(computeLinked(meta({ kind: "finance_saving", goalId: "x" }), src({}), TODAY)[0].broken).toBe(true)
  })
  it("a spending limit counts this month's spending and never completes by filling up", () => {
    const rows = computeLinked(meta({ kind: "finance_limit", categoryId: "c", limitCents: 50_000 }), src({ categories: [{ id: "c", name: "Mercado", monthly_limit_cents: null }], transactions: [{ category_id: "c", kind: "out", amount_cents: 30_000, occurred_on: "2026-11-05" }, { category_id: "c", kind: "out", amount_cents: 99_999, occurred_on: "2026-10-30" }, { category_id: "c", kind: "in", amount_cents: 1, occurred_on: "2026-11-06" }] }), TODAY)
    expect(rows[0]).toMatchObject({ done: 30_000, total: 50_000, inverse: true })
    expect(isLinkedComplete(rows)).toBe(false)
  })
})

describe("Hábitos", () => {
  const logs = ["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18"].map((d) => log(d))
  it("counts days in a row", () => {
    expect(computeLinked(meta({ kind: "habit", habitId: "h1", mode: "streak", target: 7 }), src({ habits: [habit()], habitLogs: logs }), TODAY)[0]).toMatchObject({ done: 5, total: 7, unit: "dias" })
  })
  it("counts the times this week (Monday to today)", () => {
    expect(computeLinked(meta({ kind: "habit", habitId: "h1", mode: "week_times", target: 4 }), src({ habits: [habit()], habitLogs: logs }), TODAY)[0]).toMatchObject({ done: 3, total: 4 })
  })
  it("reads the completion of the month so far", () => {
    const row = computeLinked(meta({ kind: "habit", habitId: "h1", mode: "month_pct", target: 80 }), src({ habits: [habit()], habitLogs: logs }), TODAY)[0]
    expect(row).toMatchObject({ total: 80, unit: "%" })
    expect(row.done).toBe(Math.round((5 / 18) * 100))
  })
  it("flags a deleted habit", () => {
    expect(computeLinked(meta({ kind: "habit", habitId: "zzz", mode: "streak", target: 7 }), src({}), TODAY)[0].broken).toBe(true)
  })
  it("only counts what happened after the goal started", () => {
    expect(computeLinked(meta({ kind: "habit", habitId: "h1", mode: "week_times", target: 4 }, "2026-11-17"), src({ habits: [habit()], habitLogs: logs }), TODAY)[0].done).toBe(2)
  })
})

describe("Estudos", () => {
  const sessions = [
    { subject_id: "a", studied_on: "2026-11-17", minutes: 90 },
    { subject_id: "b", studied_on: "2026-11-18", minutes: 30 },
    { subject_id: "a", studied_on: "2026-11-02", minutes: 60 },
  ]
  it("sums hours of a subject in the period", () => {
    expect(computeLinked(meta({ kind: "study_hours", subjectId: "a", period: "week", hours: 5 }), src({ subjects: [{ id: "a", name: "Direito" }], studySessions: sessions }), TODAY)[0]).toMatchObject({ done: 1.5, total: 5, unit: "h" })
    expect(computeLinked(meta({ kind: "study_hours", subjectId: "a", period: "month", hours: 5 }), src({ subjects: [{ id: "a", name: "Direito" }], studySessions: sessions }), TODAY)[0].done).toBe(2.5)
    expect(computeLinked(meta({ kind: "study_hours", subjectId: null, period: "week", hours: 5 }), src({ studySessions: sessions }), TODAY)[0].done).toBe(2)
  })
  it("counts reviewed flashcards", () => {
    expect(computeLinked(meta({ kind: "study_cards", period: "week", count: 50 }), src({ reviews: [{ reviewed_on: "2026-11-17" }, { reviewed_on: "2026-11-18" }, { reviewed_on: "2026-11-02" }] }), TODAY)[0].done).toBe(2)
  })
})

describe("Treinos", () => {
  it("counts completed workouts per week and tracks a personal record", () => {
    const sessions = [{ id: "s1", performed_on: "2026-11-16", completed: true }, { id: "s2", performed_on: "2026-11-17", completed: false }, { id: "s3", performed_on: "2026-11-10", completed: true }]
    expect(computeLinked(meta({ kind: "workout_count", period: "week", count: 4 }), src({ workoutSessions: sessions }), TODAY)[0]).toMatchObject({ done: 1, total: 4 })
    const pr = computeLinked(meta({ kind: "workout_pr", exerciseId: "e", targetKg: 100 }), src({ exercises: [{ id: "e", name: "Supino" }], setLogs: [{ exercise_id: "e", load_kg: 80, session_id: "s1" }, { exercise_id: "e", load_kg: 90, session_id: "s3" }, { exercise_id: "x", load_kg: 200, session_id: "s1" }] }), TODAY)
    expect(pr[0]).toMatchObject({ done: 90, total: 100, unit: "kg" })
  })
})

describe("Dieta e peso", () => {
  it("measures weight loss and weight gain toward the target", () => {
    const weights = [{ log_date: "2026-10-01", weight_kg: 90 }, { log_date: "2026-11-15", weight_kg: 85 }]
    const loss = computeLinked(meta({ kind: "weight", startKg: 90, targetKg: 80 }), src({ weights }), TODAY)[0]
    expect(loss).toMatchObject({ done: 5, total: 10, unit: "kg" })
    const gain = computeLinked(meta({ kind: "weight", startKg: 70, targetKg: 80 }), src({ weights: [{ log_date: "2026-11-15", weight_kg: 75 }] }), TODAY)[0]
    expect(gain).toMatchObject({ done: 5, total: 10 })
    expect(computeLinked(meta({ kind: "weight", startKg: 90, targetKg: 80 }), src({ weights: [{ log_date: "2026-11-15", weight_kg: 95 }] }), TODAY)[0].done).toBe(0)
  })
  it("counts the days of the week inside the calorie goal (±10%)", () => {
    const row = computeLinked(meta({ kind: "calories_days", daysPerWeek: 5 }), src({ dietGoalKcal: 2000, mealKcalByDay: { "2026-11-16": 2050, "2026-11-17": 2500, "2026-11-18": 1850 } }), TODAY)[0]
    expect(row).toMatchObject({ done: 2, total: 5 })
  })
})

describe("Tarefas", () => {
  it("completes when every task of the list is done", () => {
    const tasks = [{ id: "1", completed_at: "x", board_id: "b", list_id: "l", tagIds: [] }, { id: "2", completed_at: null, board_id: "b", list_id: "l", tagIds: [] }, { id: "3", completed_at: "x", board_id: "b", list_id: "other", tagIds: ["t"] }]
    const base = src({ tasks, lists: [{ id: "l", name: "A fazer" }], tags: [{ id: "t", name: "Urgente" }] })
    const rows = computeLinked(meta({ kind: "tasks", scope: "list", scopeId: "l" }), base, TODAY)
    expect(rows[0]).toMatchObject({ done: 1, total: 2 })
    expect(isLinkedComplete(rows)).toBe(false)
    const done = computeLinked(meta({ kind: "tasks", scope: "tag", scopeId: "t" }), base, TODAY)
    expect(isLinkedComplete(done)).toBe(true)
    expect(linkProgressRatio(done[0])).toBe(1)
  })
})

describe("completion", () => {
  it("never completes with nothing to measure", () => {
    expect(isLinkedComplete([])).toBe(false)
    expect(isLinkedComplete(computeLinked(meta({ kind: "habit", habitId: "gone", mode: "streak", target: 3 }), src({}), TODAY))).toBe(false)
  })
})

describe("storage", () => {
  it("keeps valid links and drops the rest", () => {
    const parsed = parseLinkedGoals({
      a: { spec: { kind: "habit", habitId: "h", mode: "streak", target: 7 }, startDate: "2026-11-01", endDate: "2026-12-31" },
      b: { spec: { kind: "habit", habitId: "h", mode: "weird", target: 7 }, startDate: "2026-11-01" },
      c: { spec: { kind: "weight", targetKg: 80, startKg: 90 }, startDate: "nope" },
      d: 5,
    })
    expect(Object.keys(parsed)).toEqual(["a"])
    expect(parsed.a.endDate).toBe("2026-12-31")
  })
})
