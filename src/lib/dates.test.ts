import { describe, expect, it } from "vitest"

import { dayDiff, dayKey, formatDue, greeting, isOverdue, splitDue, toDueIso } from "./dates"

const TZ = "America/Sao_Paulo"
// 2026-03-10 15:00 in São Paulo (UTC-3)
const NOW = new Date("2026-03-10T18:00:00Z")

describe("dayKey / dayDiff", () => {
  it("uses the user's timezone for day boundaries", () => {
    // 01:00 UTC on the 11th is still the 10th in São Paulo
    expect(dayKey("2026-03-11T01:00:00Z", TZ)).toBe("2026-03-10")
    expect(dayDiff("2026-03-11T01:00:00Z", NOW, TZ)).toBe(0)
    expect(dayDiff("2026-03-12T12:00:00Z", NOW, TZ)).toBe(2)
  })
})

describe("isOverdue", () => {
  it("compares the exact instant when the task has a time", () => {
    expect(isOverdue({ due_at: "2026-03-10T17:00:00Z", due_has_time: true }, NOW, TZ)).toBe(true)
    expect(isOverdue({ due_at: "2026-03-10T19:00:00Z", due_has_time: true }, NOW, TZ)).toBe(false)
  })

  it("only counts date-only tasks as overdue after the day has passed", () => {
    expect(isOverdue({ due_at: "2026-03-10T15:00:00Z", due_has_time: false }, NOW, TZ)).toBe(false)
    expect(isOverdue({ due_at: "2026-03-09T15:00:00Z", due_has_time: false }, NOW, TZ)).toBe(true)
    expect(isOverdue({ due_at: null, due_has_time: false }, NOW, TZ)).toBe(false)
  })
})

describe("formatDue", () => {
  it("returns friendly pt-BR labels", () => {
    expect(formatDue({ due_at: "2026-03-10T15:00:00Z", due_has_time: false }, NOW, TZ)).toBe("Hoje")
    expect(formatDue({ due_at: "2026-03-11T15:00:00Z", due_has_time: false }, NOW, TZ)).toBe("Amanhã")
    expect(formatDue({ due_at: "2026-03-09T15:00:00Z", due_has_time: false }, NOW, TZ)).toBe("Ontem")
    expect(formatDue({ due_at: "2026-03-10T20:30:00Z", due_has_time: true }, NOW, TZ)).toBe("Hoje · 17:30")
    expect(formatDue({ due_at: "2026-03-25T15:00:00Z", due_has_time: false }, NOW, TZ)).toBe("25 mar")
  })
})

describe("toDueIso / splitDue", () => {
  it("round-trips a day and time through the timezone", () => {
    const iso = toDueIso("2026-03-12", "17:00", TZ)
    expect(iso).toBe("2026-03-12T20:00:00.000Z")
    expect(splitDue(iso, true, TZ)).toEqual({ day: "2026-03-12", time: "17:00" })
  })

  it("stores date-only tasks at noon and hides the time", () => {
    const iso = toDueIso("2026-03-12", null, TZ)
    expect(splitDue(iso, false, TZ)).toEqual({ day: "2026-03-12", time: null })
  })
})

describe("greeting", () => {
  it("changes with the hour in the user's timezone", () => {
    expect(greeting(new Date("2026-03-10T12:00:00Z"), TZ)).toBe("Bom dia")
    expect(greeting(NOW, TZ)).toBe("Boa tarde")
    expect(greeting(new Date("2026-03-10T23:00:00Z"), TZ)).toBe("Boa noite")
  })
})
