import { describe, expect, it } from "vitest"

import { defaultPrefs } from "@/features/settings/notification-prefs"

import { atLocal, deferQuiet, dueNow, EMPTY_PLANNER_DATA, inQuiet, localDay, planNotifications } from "./planner"

const TZ = "America/Sao_Paulo"
const prefs = defaultPrefs()
/** The same choices with the daily summary off, so a test sees only the event it is about. */
const noSummary = { ...prefs, events: { ...prefs.events, summary: { app: false, email: false } } }
const quiet = { enabled: true, from: "22:00", to: "07:00" }

describe("local time", () => {
  it("reads the day and builds moments in the person's zone", () => {
    expect(localDay(new Date("2026-11-12T01:00:00Z"), TZ)).toBe("2026-11-11")
    expect(atLocal("2026-11-12", "08:00", TZ).toISOString()).toBe("2026-11-12T11:00:00.000Z")
  })
})

describe("quiet hours", () => {
  it("knows when a moment is inside, across midnight", () => {
    expect(inQuiet(atLocal("2026-11-12", "23:00", TZ), quiet, TZ)).toBe(true)
    expect(inQuiet(atLocal("2026-11-12", "06:30", TZ), quiet, TZ)).toBe(true)
    expect(inQuiet(atLocal("2026-11-12", "12:00", TZ), quiet, TZ)).toBe(false)
    expect(inQuiet(atLocal("2026-11-12", "23:00", TZ), { ...quiet, enabled: false }, TZ)).toBe(false)
  })
  it("defers to the end of the quiet hours instead of dropping", () => {
    expect(deferQuiet(atLocal("2026-11-12", "23:00", TZ), quiet, TZ).toISOString()).toBe(atLocal("2026-11-13", "07:00", TZ).toISOString())
    expect(deferQuiet(atLocal("2026-11-12", "03:00", TZ), quiet, TZ).toISOString()).toBe(atLocal("2026-11-12", "07:00", TZ).toISOString())
    const noon = atLocal("2026-11-12", "12:00", TZ)
    expect(deferQuiet(noon, quiet, TZ)).toBe(noon)
  })
})

describe("planNotifications", () => {
  const now = new Date("2026-11-12T11:02:00Z") // 08:02 in São Paulo
  const plan = (data: Partial<typeof EMPTY_PLANNER_DATA>, p = noSummary) => planNotifications({ now, timeZone: TZ, prefs: p, data: { ...EMPTY_PLANNER_DATA, ...data } })

  it("a reminder goes out at its moment", () => {
    const planned = plan({ reminders: [{ id: "r1", title: "Pagar luz", remind_at: "2026-11-12T11:00:00Z", status: "pending" }] })
    expect(dueNow(planned, now, 5 * 60_000).map((p) => p.targetId)).toEqual(["r1"])
    expect(dueNow(planned, new Date("2026-11-12T11:30:00Z"), 5 * 60_000)).toHaveLength(0)
  })
  it("done reminders and switched-off events stay quiet", () => {
    expect(plan({ reminders: [{ id: "r1", title: "x", remind_at: "2026-11-12T11:00:00Z", status: "done" }] })).toHaveLength(0)
    const off = { ...noSummary, events: { ...noSummary.events, tasks: { app: false, email: false } } }
    expect(plan({ tasks: [{ id: "t", title: "Entrega", due_at: "2026-11-12T20:00:00Z", completed_at: null }] }, off)).toHaveLength(0)
  })
  it("a task warns on its day and one hour before", () => {
    const planned = plan({ tasks: [{ id: "t", title: "Entrega", due_at: "2026-11-12T20:00:00Z", completed_at: null }] })
    expect(planned.map((p) => p.targetId).sort()).toEqual(["t:day", "t:hour"])
    expect(dueNow(planned, now, 5 * 60_000).map((p) => p.targetId)).toEqual(["t:day"])
  })
  it("an unpaid bill warns 3 days before and on the day; a paid one never", () => {
    const bill = { id: "b", name: "Internet", amount_cents: 10000, due_day: 15, last_paid_month: null, active: true }
    expect(plan({ bills: [bill] }).map((p) => p.targetId).sort()).toEqual(["b:2026-11:d0", "b:2026-11:d3"])
    expect(plan({ bills: [{ ...bill, last_paid_month: "2026-11" }] })).toHaveLength(0)
  })
  it("the morning summary is deferred out of the quiet hours when needed", () => {
    const early = planNotifications({ now: new Date("2026-11-12T11:00:00Z"), timeZone: TZ, prefs: { ...prefs, quiet: { enabled: true, from: "22:00", to: "08:00" } }, data: EMPTY_PLANNER_DATA })
    const morning = early.find((p) => p.targetId.endsWith(":morning"))
    expect(morning?.at.toISOString()).toBe(atLocal("2026-11-12", "08:00", TZ).toISOString())
    expect(morning?.bucket).toBe(atLocal("2026-11-12", "07:30", TZ).toISOString())
  })
  it("has a weekly review only on Sundays", () => {
    const sunday = planNotifications({ now: new Date("2026-11-15T12:00:00Z"), timeZone: TZ, prefs, data: EMPTY_PLANNER_DATA })
    expect(sunday.some((p) => p.targetId.endsWith(":week"))).toBe(true)
    expect(planNotifications({ now, timeZone: TZ, prefs, data: EMPTY_PLANNER_DATA }).some((p) => p.targetId.endsWith(":week"))).toBe(false)
  })
})
