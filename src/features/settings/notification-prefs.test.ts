import { describe, expect, it } from "vitest"

import { EVENT_KEYS, HOURS, MINUTES, NOTIFICATION_EVENTS, createLocalNotificationPrefsRepo, defaultPrefs, joinTime, parseNotificationPrefs, snapMinute, splitTime } from "./notification-prefs"

const memory = () => {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
}

describe("defaults", () => {
  it("has the eight events with the starting choices, e-mail off", () => {
    expect(NOTIFICATION_EVENTS.map((e) => e.key)).toEqual([...EVENT_KEYS])
    const prefs = defaultPrefs()
    expect(prefs.events.tasks).toEqual({ app: true, email: false })
    expect(prefs.events.meals).toEqual({ app: false, email: false })
    expect(Object.values(prefs.events).every((p) => !p.email)).toBe(true)
    expect(prefs.quiet).toEqual({ enabled: true, from: "22:00", to: "07:00" })
  })
})

describe("parseNotificationPrefs", () => {
  it("keeps valid values and fills the rest", () => {
    const prefs = parseNotificationPrefs({ events: { tasks: { app: false } }, quiet: { enabled: false, from: "23:30" } })
    expect(prefs.events.tasks).toEqual({ app: false, email: false })
    expect(prefs.events.agenda).toEqual({ app: true, email: false })
    expect(prefs.quiet).toEqual({ enabled: false, from: "23:30", to: "07:00" })
  })

  it("ignores garbage instead of breaking", () => {
    for (const bad of [null, undefined, 3, "x", [], { events: 5, quiet: "x" }, { quiet: { from: "25:99", to: 7 } }]) expect(parseNotificationPrefs(bad)).toEqual(defaultPrefs())
  })
})

describe("the local repository", () => {
  it("remembers a choice and gives it back", () => {
    const repo = createLocalNotificationPrefsRepo(memory())
    const prefs = repo.load()
    prefs.events.habits.app = false
    prefs.quiet.to = "06:45"
    repo.save(prefs)
    expect(repo.load().events.habits.app).toBe(false)
    expect(repo.load().quiet.to).toBe("06:45")
  })

  it("falls back to the defaults for broken stored text, and survives a storage that throws", () => {
    const broken = { getItem: () => "{not json", setItem: () => undefined }
    expect(createLocalNotificationPrefsRepo(broken).load()).toEqual(defaultPrefs())
    const throwing = {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
    }
    const repo = createLocalNotificationPrefsRepo(throwing)
    expect(repo.load()).toEqual(defaultPrefs())
    expect(() => repo.save(defaultPrefs())).not.toThrow()
  })
})

describe("time helpers", () => {
  it("offers 24 hours and four 15-minute steps", () => {
    expect(HOURS).toHaveLength(24)
    expect(MINUTES).toEqual([0, 15, 30, 45])
  })

  it("splits and joins HH:MM", () => {
    expect(splitTime("07:15")).toEqual({ hour: 7, minute: 15 })
    expect(joinTime(7, 5)).toBe("07:05")
    expect(splitTime("nope")).toEqual({ hour: 0, minute: 0 })
  })

  it("snaps a minute down to its 15-minute step", () => {
    expect([0, 7, 15, 29, 30, 44, 45, 59].map(snapMinute)).toEqual([0, 0, 15, 15, 30, 30, 45, 45])
  })
})
