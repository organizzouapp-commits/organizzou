import { describe, expect, it } from "vitest"

import { expandEvent, layoutDay, parseRule } from "./recurrence"
import type { AgendaItem, EventRow } from "./types"

const TZ = "America/Sao_Paulo"
const stamp = { created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }

function event(overrides: Partial<EventRow>): EventRow {
  return {
    id: "e1",
    user_id: "u",
    title: "Reunião",
    // Monday 2026-03-02 10:00 in São Paulo
    starts_at: "2026-03-02T13:00:00Z",
    ends_at: "2026-03-02T14:00:00Z",
    all_day: false,
    description: null,
    location: null,
    category: null,
    swatch: "neutro",
    rrule: null,
    reminder_offsets: [],
    ...stamp,
    ...overrides,
  }
}

const range = (from: string, to: string) => [new Date(from), new Date(to)] as const

describe("parseRule", () => {
  it("parses frequency and weekdays", () => {
    expect(parseRule("FREQ=WEEKLY;BYDAY=MO,TH")).toEqual({ freq: "WEEKLY", byDay: [1, 4] })
    expect(parseRule(null)).toBeNull()
    expect(parseRule("FREQ=SECONDLY")).toBeNull()
  })
})

describe("expandEvent", () => {
  it("returns a single occurrence inside the range", () => {
    const [from, to] = range("2026-03-01T00:00:00Z", "2026-03-08T00:00:00Z")
    expect(expandEvent(event({}), from, to, TZ)).toHaveLength(1)
    const [lateFrom, lateTo] = range("2026-03-10T00:00:00Z", "2026-03-17T00:00:00Z")
    expect(expandEvent(event({}), lateFrom, lateTo, TZ)).toHaveLength(0)
  })

  it("expands weekly rules on the chosen weekdays, keeping the local hour", () => {
    const [from, to] = range("2026-03-09T03:00:00Z", "2026-03-16T03:00:00Z")
    const items = expandEvent(event({ rrule: "FREQ=WEEKLY;BYDAY=MO,TH" }), from, to, TZ)
    expect(items.map((i) => i.start.toISOString())).toEqual(["2026-03-09T13:00:00.000Z", "2026-03-12T13:00:00.000Z"])
    expect(items[0].end.getTime() - items[0].start.getTime()).toBe(3_600_000)
  })

  it("does not repeat before the first occurrence", () => {
    const [from, to] = range("2026-02-01T00:00:00Z", "2026-03-01T00:00:00Z")
    expect(expandEvent(event({ rrule: "FREQ=DAILY" }), from, to, TZ)).toHaveLength(0)
  })

  it("expands monthly and yearly rules", () => {
    const [from, to] = range("2026-04-01T00:00:00Z", "2026-06-01T00:00:00Z")
    expect(expandEvent(event({ rrule: "FREQ=MONTHLY" }), from, to, TZ)).toHaveLength(2)
    const [yFrom, yTo] = range("2027-03-01T03:00:00Z", "2027-03-10T03:00:00Z")
    expect(expandEvent(event({ rrule: "FREQ=YEARLY" }), yFrom, yTo, TZ)).toHaveLength(1)
  })
})

describe("layoutDay", () => {
  const item = (key: string, start: string, end: string): AgendaItem => ({
    key,
    kind: "event",
    id: key,
    title: key,
    start: new Date(start),
    end: new Date(end),
    allDay: false,
    swatch: "neutro",
    editable: true,
  })

  it("places overlapping items in separate columns", () => {
    const placed = layoutDay([
      item("a", "2026-03-09T13:00:00Z", "2026-03-09T15:00:00Z"),
      item("b", "2026-03-09T14:00:00Z", "2026-03-09T15:00:00Z"),
      item("c", "2026-03-09T17:00:00Z", "2026-03-09T18:00:00Z"),
    ])
    const byKey = Object.fromEntries(placed.map((p) => [p.item.key, p]))
    expect(byKey.a.columns).toBe(2)
    expect(byKey.b.column).toBe(1)
    expect(byKey.c.columns).toBe(1)
  })
})
