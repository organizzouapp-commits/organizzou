import { describe, expect, it } from "vitest"

import { accuracyByDay, averageAccuracy, deckStates, intervalLabel, nextDueDate, reviewDays, reviewRecord, reviewStreak, type ReviewLogEntry } from "./review"
import type { Rating } from "./spaced-repetition"

const TODAY = "2026-11-09"
let n = 0
const log = (reviewed_on: string, rating: Rating): ReviewLogEntry => ({ id: `e${n++}`, card_id: "c", deck_id: "d", reviewed_on, rating })

describe("accuracyByDay", () => {
  const entries = [log(TODAY, "good"), log(TODAY, "easy"), log(TODAY, "again"), log("2026-11-08", "again"), log("2026-11-05", "good"), log("2026-10-01", "good")]
  const days = accuracyByDay(entries, TODAY)
  it("has one entry per day of the window, oldest first, ending today", () => {
    expect(days).toHaveLength(7)
    expect(days[0].day).toBe("2026-11-03")
    expect(days[6].day).toBe(TODAY)
  })
  it("counts a review as correct unless it was Errei", () => {
    expect(days[6]).toMatchObject({ reviews: 3, correct: 2, rate: 67 })
    expect(days[5]).toMatchObject({ reviews: 1, correct: 0, rate: 0 })
  })
  it("is null for days without reviews and ignores days outside the window", () => {
    expect(days[3].rate).toBeNull() // 2026-11-06
    expect(days.reduce((sum, d) => sum + d.reviews, 0)).toBe(5)
  })
  it("averages over all answers of the window", () => {
    expect(averageAccuracy(days)).toBe(60) // 3 correct of 5
    expect(averageAccuracy(accuracyByDay([], TODAY))).toBeNull()
  })
})

describe("review streak and record", () => {
  const entries = [log(TODAY, "good"), log("2026-11-08", "good"), log("2026-11-07", "again"), log("2026-11-04", "good"), log("2026-11-03", "good"), log("2026-11-02", "good"), log("2026-11-01", "good")]
  it("lists the days with a review", () => expect(reviewDays(entries).size).toBe(7))
  it("counts consecutive days ending today", () => expect(reviewStreak(entries, TODAY)).toBe(3))
  it("is alive while today is empty, zero after a missed day", () => {
    expect(reviewStreak([log("2026-11-08", "good")], TODAY)).toBe(1)
    expect(reviewStreak([log("2026-11-06", "good")], TODAY)).toBe(0)
  })
  it("finds the record", () => {
    expect(reviewRecord(entries)).toBe(4)
    expect(reviewRecord([])).toBe(0)
  })
})

describe("deckStates", () => {
  it("splits cards into novos, aprendendo and dominados", () => {
    const cards = [
      { repetitions: 0, interval_days: 0 },
      { repetitions: 0, interval_days: 0 },
      { repetitions: 0, interval_days: 1 }, // failed once: still learning
      { repetitions: 2, interval_days: 3 },
      { repetitions: 4, interval_days: 20 },
      { repetitions: 5, interval_days: 21 },
      { repetitions: 7, interval_days: 90 },
    ]
    expect(deckStates(cards)).toEqual({ novos: 2, aprendendo: 3, dominados: 2 })
    expect(deckStates([])).toEqual({ novos: 0, aprendendo: 0, dominados: 0 })
  })
})

describe("nextDueDate", () => {
  it("is the earliest day after today", () => {
    expect(nextDueDate([{ due_on: "2026-11-20" }, { due_on: "2026-11-12" }, { due_on: "2026-11-01" }, { due_on: TODAY }], TODAY)).toBe("2026-11-12")
  })
  it("is null when nothing is scheduled later", () => {
    expect(nextDueDate([{ due_on: "2026-11-01" }], TODAY)).toBeNull()
    expect(nextDueDate([], TODAY)).toBeNull()
  })
})

describe("intervalLabel", () => {
  it("formats the next interval", () => {
    expect(intervalLabel(0)).toBe("< 1 min")
    expect(intervalLabel(1)).toBe("1 dia")
    expect(intervalLabel(4)).toBe("4 dias")
    expect(intervalLabel(29)).toBe("29 dias")
    expect(intervalLabel(30)).toBe("1 mês")
    expect(intervalLabel(75)).toBe("3 meses")
    expect(intervalLabel(365)).toBe("1 ano")
    expect(intervalLabel(800)).toBe("2 anos")
  })
})
