import { describe, expect, it } from "vitest"

import { daysUntil, isDue, review } from "./spaced-repetition"
import type { FlashcardRow } from "./types"

const card: FlashcardRow = {
  id: "c1",
  deck_id: "d1",
  front: "Pergunta",
  back: "Resposta",
  ease: 2.5,
  interval_days: 0,
  repetitions: 0,
  due_on: "2026-03-10",
}

describe("review", () => {
  it("schedules the first good review for tomorrow, then 3 days, then by ease", () => {
    const first = review(card, "good", "2026-03-10")
    expect(first.interval_days).toBe(1)
    expect(first.due_on).toBe("2026-03-11")
    const second = review(first, "good", "2026-03-11")
    expect(second.interval_days).toBe(3)
    const third = review(second, "good", "2026-03-14")
    expect(third.interval_days).toBe(Math.round(3 * second.ease))
  })

  it("resets progress and lowers ease when the answer was wrong", () => {
    const learned = { ...card, repetitions: 4, interval_days: 20 }
    const result = review(learned, "again", "2026-03-10")
    expect(result.repetitions).toBe(0)
    expect(result.interval_days).toBe(1)
    expect(result.ease).toBeLessThan(2.5)
  })

  it("never lets ease fall below 1.3 and rewards easy answers with longer gaps", () => {
    let hard = { ...card, ease: 1.35 }
    for (let i = 0; i < 5; i += 1) hard = review(hard, "again", "2026-03-10")
    expect(hard.ease).toBeGreaterThanOrEqual(1.3)
    const good = review({ ...card, repetitions: 2, interval_days: 3 }, "good", "2026-03-10")
    const easy = review({ ...card, repetitions: 2, interval_days: 3 }, "easy", "2026-03-10")
    expect(easy.interval_days).toBeGreaterThan(good.interval_days)
  })
})

describe("isDue / daysUntil", () => {
  it("marks cards due on or before today", () => {
    expect(isDue(card, "2026-03-10")).toBe(true)
    expect(isDue({ ...card, due_on: "2026-03-11" }, "2026-03-10")).toBe(false)
  })

  it("counts calendar days", () => {
    expect(daysUntil("2026-03-20", "2026-03-10")).toBe(10)
  })
})
