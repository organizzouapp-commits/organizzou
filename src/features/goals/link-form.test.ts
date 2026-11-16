import { describe, expect, it } from "vitest"

import { blankFields, buildLink, fieldsOf, validateDates, type Fields } from "./link-form"

const f = (group: Parameters<typeof blankFields>[0], over: Partial<Fields>): Fields => ({ ...blankFields(group), ...over })

describe("buildLink", () => {
  it("a free goal has no link", () => {
    expect(buildLink("free", blankFields("free"), "Meta", "id")).toBeNull()
  })
  it("Finanças: an existing goal links to it, a new one is created once and linked, a limit needs a category and an amount", () => {
    expect(buildLink("finance", f("finance", { sub: "existing", refId: "g1" }), "x", "new")?.spec).toEqual({ kind: "finance_saving", goalId: "g1" })
    expect(buildLink("finance", f("finance", { sub: "existing" }), "x", "new")).toBeNull()
    const created = buildLink("finance", f("finance", { sub: "new", cents: 1_000_000 }), "Reserva", "fin-1")
    expect(created).toEqual({ spec: { kind: "finance_saving", goalId: "fin-1" }, newFinance: { name: "Reserva", targetCents: 1_000_000 } })
    expect(buildLink("finance", f("finance", { sub: "limit", refId: "c", cents: 50_000 }), "x", "n")?.spec).toEqual({ kind: "finance_limit", categoryId: "c", limitCents: 50_000 })
    expect(buildLink("finance", f("finance", { sub: "limit", refId: "c" }), "x", "n")).toBeNull()
  })
  it("Hábitos: reads decimals with a comma and caps percentages and weekly times", () => {
    expect(buildLink("habit", f("habit", { refId: "h", mode: "streak", amount: "21" }), "x", "n")?.spec).toEqual({ kind: "habit", habitId: "h", mode: "streak", target: 21 })
    expect(buildLink("habit", f("habit", { refId: "h", mode: "month_pct", amount: "150" }), "x", "n")?.spec).toMatchObject({ target: 100 })
    expect(buildLink("habit", f("habit", { refId: "h", mode: "week_times", amount: "9" }), "x", "n")?.spec).toMatchObject({ target: 7 })
    expect(buildLink("habit", f("habit", { mode: "streak", amount: "21" }), "x", "n")).toBeNull()
  })
  it("Estudos, Treinos, Dieta, Tarefas", () => {
    expect(buildLink("study", f("study", { sub: "hours", refId: "s", period: "month", amount: "12,5" }), "x", "n")?.spec).toEqual({ kind: "study_hours", subjectId: "s", period: "month", hours: 12.5 })
    expect(buildLink("study", f("study", { sub: "cards", amount: "100" }), "x", "n")?.spec).toEqual({ kind: "study_cards", period: "week", count: 100 })
    expect(buildLink("workout", f("workout", { sub: "count", amount: "3" }), "x", "n")?.spec).toEqual({ kind: "workout_count", period: "week", count: 3 })
    expect(buildLink("workout", f("workout", { sub: "pr", refId: "e", amount: "100" }), "x", "n")?.spec).toEqual({ kind: "workout_pr", exerciseId: "e", targetKg: 100 })
    expect(buildLink("workout", f("workout", { sub: "pr", amount: "100" }), "x", "n")).toBeNull()
    expect(buildLink("diet", f("diet", { sub: "weight", amount: "75,5", startKg: "82" }), "x", "n")?.spec).toEqual({ kind: "weight", targetKg: 75.5, startKg: 82 })
    expect(buildLink("diet", f("diet", { sub: "weight", amount: "82", startKg: "82" }), "x", "n")).toBeNull()
    expect(buildLink("diet", f("diet", { sub: "calories", amount: "5" }), "x", "n")?.spec).toEqual({ kind: "calories_days", daysPerWeek: 5 })
    expect(buildLink("diet", f("diet", { sub: "calories", amount: "9" }), "x", "n")).toBeNull()
    expect(buildLink("tasks", f("tasks", { sub: "list", refId: "l" }), "x", "n")?.spec).toEqual({ kind: "tasks", scope: "list", scopeId: "l" })
  })
})

describe("fieldsOf", () => {
  it("round-trips a link into the form and back", () => {
    const spec = { kind: "study_hours", subjectId: "s", period: "month", hours: 12.5 } as const
    const { group, fields } = fieldsOf(spec)
    expect(group).toBe("study")
    expect(buildLink(group, fields, "x", "n")?.spec).toEqual(spec)
    const weight = { kind: "weight", targetKg: 75.5, startKg: 82 } as const
    const back = fieldsOf(weight)
    expect(buildLink(back.group, back.fields, "x", "n")?.spec).toEqual(weight)
  })
})

describe("validateDates", () => {
  it("needs a start, and an end after it", () => {
    expect(validateDates("2026-11-16", "2027-01-31")).toEqual({ start: null, end: null })
    expect(validateDates("2026-11-16", "")).toEqual({ start: null, end: null })
    expect(validateDates("", "2027-01-31").start).not.toBeNull()
    expect(validateDates("2026-11-16", "2026-11-16").end).toMatch(/depois da data de início/)
  })
})
