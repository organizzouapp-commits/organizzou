import { describe, expect, it } from "vitest"

import { estimatedOneRepMax, loadProgress, personalRecords, volume, weeklyVolume } from "./stats"
import type { SetLogRow, WorkoutSessionRow } from "./types"

const session = (id: string, day: string, completed = true): WorkoutSessionRow => ({
  id,
  user_id: "u",
  plan_id: "p",
  performed_on: day,
  duration_min: 60,
  completed,
})
const set = (sessionId: string, exerciseId: string, reps: number, load: number, index = 1): SetLogRow => ({
  id: `${sessionId}-${exerciseId}-${index}`,
  session_id: sessionId,
  exercise_id: exerciseId,
  set_index: index,
  reps,
  load_kg: load,
})

describe("volume / 1RM", () => {
  it("multiplies reps by load", () => {
    expect(volume([set("s", "e", 10, 60), set("s", "e", 8, 65)])).toBe(1120)
  })

  it("estimates the one-rep max with Epley", () => {
    expect(estimatedOneRepMax(100, 1)).toBe(100)
    expect(estimatedOneRepMax(80, 10)).toBe(106.7)
  })
})

describe("personalRecords / loadProgress", () => {
  const sessions = [session("a", "2026-03-02"), session("b", "2026-03-09"), session("c", "2026-03-16", false)]
  const sets = [set("a", "supino", 10, 60), set("b", "supino", 8, 70), set("b", "supino", 10, 65, 2), set("c", "supino", 5, 100)]

  it("picks the best set per exercise by estimated 1RM", () => {
    const [record] = personalRecords(sets, sessions)
    expect(record.loadKg).toBe(100)
  })

  it("reports the heaviest load per completed session", () => {
    expect(loadProgress("supino", sets, sessions)).toEqual([
      { day: "2026-03-02", load: 60 },
      { day: "2026-03-09", load: 70 },
    ])
  })
})

describe("weeklyVolume", () => {
  it("groups completed sessions by week starting on Monday", () => {
    const sessions = [session("a", "2026-03-02"), session("b", "2026-03-09")]
    const sets = [set("a", "e", 10, 50), set("b", "e", 10, 60)]
    const result = weeklyVolume(sets, sessions, "2026-03-10", 2)
    expect(result.map((r) => r.volume)).toEqual([500, 600])
    expect(result.map((r) => r.sessions)).toEqual([1, 1])
  })
})
