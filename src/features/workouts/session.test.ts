import { describe, expect, it } from "vitest"

import { clock, doneVolume, estimatedMinutes, formatVolume, lastVolume, nextPendingSet, parseNumber, planLetter, restAfterSet, restLabel, type SetDraft } from "./session"
import type { SetLogRow, WorkoutSessionRow } from "./types"

const draft = (reps: string, load: string, done: boolean): SetDraft => ({ reps, load, done })

describe("estimatedMinutes", () => {
  it("adds ~45 s per set plus the rest after each set", () => {
    // 4 x (45 + 90) = 540 s, 3 x (45 + 60) = 315 s -> 855 s = 14.25 min
    expect(estimatedMinutes([{ sets: 4, rest_seconds: 90 }, { sets: 3, rest_seconds: 60 }])).toBe(14)
    expect(estimatedMinutes([])).toBe(0)
    expect(estimatedMinutes([{ sets: 2, rest_seconds: -5 }])).toBe(2) // a negative rest counts as none
  })
})

describe("doneVolume (the running volume)", () => {
  it("only counts checked sets and understands the decimal comma", () => {
    expect(doneVolume([draft("8", "72,5", true), draft("8", "72,5", false), draft("10", "20", true)])).toBe(8 * 72.5 + 200)
    expect(doneVolume([draft("", "", true), draft("abc", "10", true)])).toBe(0)
    expect(parseNumber(" 12,5 ")).toBe(12.5)
    expect(parseNumber("-3")).toBe(0)
  })
})

describe("nextPendingSet", () => {
  const items = [{ id: "a" }, { id: "b" }]
  it("returns the first unchecked set of the first exercise that still has one", () => {
    const drafts: Record<string, SetDraft[]> = { a: [draft("8", "10", true), draft("8", "10", true)], b: [draft("8", "10", true), draft("8", "10", false)] }
    expect(nextPendingSet(items, (i) => drafts[i.id])).toEqual({ item: items[1], index: 1 })
    drafts.a[1].done = false
    expect(nextPendingSet(items, (i) => drafts[i.id])).toEqual({ item: items[0], index: 1 })
  })
  it("is null when everything is checked", () => {
    expect(nextPendingSet(items, () => [draft("1", "1", true)])).toBeNull()
    expect(nextPendingSet([], () => [])).toBeNull()
  })
})

describe("restAfterSet (rest-time selection)", () => {
  it("uses the exercise's own rest, none after the last set or without a rest", () => {
    expect(restAfterSet(90, false)).toBe(90)
    expect(restAfterSet(90, true)).toBe(0)
    expect(restAfterSet(0, false)).toBe(0)
    expect(restAfterSet(59.6, false)).toBe(60)
  })
})

describe("lastVolume", () => {
  const session = (id: string, day: string, plan = "p1", completed = true): WorkoutSessionRow => ({ id, user_id: "u", plan_id: plan, performed_on: day, duration_min: null, completed })
  const set = (sessionId: string, reps: number, load: number): SetLogRow => ({ id: `${sessionId}-${reps}`, session_id: sessionId, exercise_id: "e", set_index: 1, reps, load_kg: load })
  it("is the volume of the latest completed session of the same plan before the day", () => {
    const sessions = [session("s1", "2026-11-02"), session("s2", "2026-11-05"), session("s3", "2026-11-09"), session("s4", "2026-11-07", "p2"), session("s5", "2026-11-08", "p1", false)]
    const sets = [set("s1", 10, 100), set("s2", 10, 200), set("s3", 10, 999), set("s4", 10, 50), set("s5", 10, 70)]
    expect(lastVolume(sessions, sets, "p1", "2026-11-09")).toBe(2000)
    expect(lastVolume(sessions, sets, "p1", "2026-11-02")).toBeNull()
  })
})

describe("labels", () => {
  it("planLetter, formatVolume, restLabel and clock", () => {
    expect(planLetter([{ id: "x" }, { id: "y" }], "y")).toBe("B")
    expect(planLetter([{ id: "x" }], "nope")).toBe("")
    expect(formatVolume(850)).toBe("850 kg")
    expect(formatVolume(4200)).toBe("4,2 t")
    expect(restLabel(90)).toBe("1:30")
    expect(clock(75)).toBe("01:15")
  })
})
