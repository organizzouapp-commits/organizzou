import { describe, expect, it } from "vitest"

import { average, moodInsights } from "./insights"
import type { JournalDay, Mood } from "./types"

const day = (mood: Mood, sleep: number | null, trained: boolean, studied: number): JournalDay => ({
  id: String(Math.random()),
  user_id: "u",
  entry_date: "2026-03-01",
  mood,
  text: "",
  sleep_hours: sleep,
  created_at: "",
  updated_at: "",
  trained,
  studied_min: studied,
})

describe("moodInsights", () => {
  const days = [day(5, 8, true, 90), day(4, 7, true, 30), day(2, 5, false, 0), day(3, 6, false, 120)]

  it("compares average mood with and without each signal", () => {
    const [sleep, workout, study] = moodInsights(days)
    expect(sleep).toMatchObject({ withAvg: 4.5, withoutAvg: 2.5, withCount: 2, withoutCount: 2 })
    expect(workout).toMatchObject({ withAvg: 4.5, withoutAvg: 2.5 })
    expect(study).toMatchObject({ withAvg: 4, withoutAvg: 3 })
  })

  it("returns null averages when a group is empty", () => {
    expect(average([])).toBeNull()
    expect(moodInsights([day(3, null, false, 0)])[0].withAvg).toBeNull()
  })
})
