import { describe, expect, it } from "vitest"

import { checkinStreak, dailyPoints, formatDiff, formatMood, insightsProgress, labelIndices, lineSegments, moodAverage, moodLabelStep, moodText, nextMood, periodEntries, sleepAverage, sleepAxisMax, sleepText, spreadIndices, visibleEntries } from "./stats"
import type { Mood } from "./types"

const TODAY = "2026-11-09"
const e = (entry_date: string, mood: Mood, sleep_hours: number | null = null) => ({ entry_date, mood, sleep_hours })

describe("periodEntries and moodAverage", () => {
  const entries = [e("2026-11-09", 5), e("2026-11-03", 3), e("2026-10-20", 2), e("2026-08-01", 1), e("2026-11-10", 5)]
  it("keeps the last N days, oldest first, nothing from the future", () => {
    expect(periodEntries(entries, TODAY, 7).map((x) => x.entry_date)).toEqual(["2026-11-03", "2026-11-09"])
    expect(periodEntries(entries, TODAY, 30).map((x) => x.entry_date)).toEqual(["2026-10-20", "2026-11-03", "2026-11-09"])
    expect(periodEntries(entries, TODAY, 90)).toHaveLength(3)
  })
  it("includes exactly N days: the day N-1 days ago is in, the one before is out", () => {
    expect(periodEntries([e("2026-11-03", 3), e("2026-11-02", 3)], TODAY, 7).map((x) => x.entry_date)).toEqual(["2026-11-03"])
  })
  it("averages the mood over the period, null without check-ins", () => {
    expect(moodAverage(periodEntries(entries, TODAY, 30))).toBe(3.3)
    expect(moodAverage([])).toBeNull()
  })
})

describe("sleepAverage", () => {
  it("averages the nights that have sleep and compares with the goal, capped at 100%", () => {
    expect(sleepAverage([e("a", 3, 6), e("b", 3, 8), e("c", 3, null), e("d", 3, 0)], 7.5)).toEqual({ average: 7, percent: 93 })
    expect(sleepAverage([e("a", 3, 9)], 7.5)).toEqual({ average: 9, percent: 100 })
  })
  it("is empty without sleep data or without a goal", () => {
    expect(sleepAverage([e("a", 3, null)], 7.5)).toEqual({ average: null, percent: 0 })
    expect(sleepAverage([e("a", 3, 8)], 0)).toEqual({ average: 8, percent: 0 })
  })
})

describe("checkinStreak", () => {
  const days = ["2026-11-09", "2026-11-08", "2026-11-07", "2026-11-04", "2026-11-03", "2026-11-02", "2026-11-01", "2026-10-31"].map((d) => e(d, 3))
  it("counts the run ending today and the record", () => {
    expect(checkinStreak(days, TODAY)).toEqual({ current: 3, record: 5 })
  })
  it("keeps the run alive while today is still empty, and resets after a missed day", () => {
    expect(checkinStreak([e("2026-11-08", 3), e("2026-11-07", 3)], TODAY).current).toBe(2)
    expect(checkinStreak([e("2026-11-06", 3)], TODAY).current).toBe(0)
    expect(checkinStreak([], TODAY)).toEqual({ current: 0, record: 0 })
  })
})

describe("chart data", () => {
  const points = dailyPoints([e("2026-11-09", 4, 7), e("2026-11-08", 5, 0), e("2026-11-06", 2, 6.5), e("2026-11-05", 3, null)], TODAY, 7)
  it("has one point per day, with nulls for missing days and for sleep that was not informed", () => {
    expect(points).toHaveLength(7)
    expect(points[0].day).toBe("2026-11-03")
    expect(points[6]).toEqual({ day: TODAY, mood: 4, sleep: 7 })
    expect(points[5]).toEqual({ day: "2026-11-08", mood: 5, sleep: null })
    expect(points[2]).toEqual({ day: "2026-11-05", mood: 3, sleep: null })
    expect(points[3]).toEqual({ day: "2026-11-06", mood: 2, sleep: 6.5 })
    expect(points[4].mood).toBeNull() // 07/11 has no check-in
  })
  it("breaks the line at days without a check-in", () => {
    const runs = lineSegments(points)
    expect(runs.map((r) => r.map((p) => p.index))).toEqual([[2, 3], [5, 6]]) // 05–06/11, a gap on 07/11, then 08–09/11
  })
  it("never connects across a gap and keeps every point", () => {
    const gap = lineSegments(dailyPoints([e("2026-11-09", 4), e("2026-11-08", 3), e("2026-11-05", 5), e("2026-11-04", 2)], TODAY, 7))
    expect(gap.map((r) => r.map((p) => p.index))).toEqual([[1, 2], [5, 6]])
    expect(gap.flat()).toHaveLength(4)
    expect(lineSegments(dailyPoints([], TODAY, 7))).toEqual([])
  })
  it("labels every Nth day counted back from the last, which is always labelled", () => {
    expect(labelIndices(30, 5)).toEqual([4, 9, 14, 19, 24, 29])
    expect(labelIndices(7, 1)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(moodLabelStep(7)).toBe(1)
    expect(moodLabelStep(30)).toBe(5)
    expect(moodLabelStep(90)).toBe(15)
  })
  it("spreads four sleep labels from the start to the end", () => {
    expect(spreadIndices(30)).toEqual([0, 10, 19, 29])
    expect(spreadIndices(7)).toEqual([0, 2, 4, 6])
    expect(spreadIndices(1)).toEqual([0])
    expect(spreadIndices(2)).toEqual([0, 1])
  })
  it("picks the sleep axis top: 10 h, or the next multiple of 5", () => {
    expect(sleepAxisMax([6, 8.5, null])).toBe(10)
    expect(sleepAxisMax([11, 7])).toBe(15)
    expect(sleepAxisMax([])).toBe(10)
  })
})

describe("texts", () => {
  it("formats the difference with a sign and a decimal comma", () => {
    expect(formatDiff(4, 3.1)).toBe("+0,9")
    expect(formatDiff(3, 3.4)).toBe("−0,4")
    expect(formatDiff(3.5, 3.5)).toBe("0,0")
    expect(formatDiff(null, 3)).toBeNull()
    expect(formatDiff(3, null)).toBeNull()
  })
  it("formats moods and sleep", () => {
    expect(formatMood(4)).toBe("4,0")
    expect(formatMood(3.5)).toBe("3,5")
    expect(formatMood(null)).toBe("—")
    expect(moodText(4)).toBe("Bem (4)")
    expect(sleepText(7)).toBe("7 h")
    expect(sleepText(7.5)).toBe("7,5 h")
  })
})

describe("insights rule", () => {
  it("needs 14 check-ins", () => {
    expect(insightsProgress(6)).toEqual({ enough: false, missing: 8, total: 14 })
    expect(insightsProgress(14)).toEqual({ enough: true, missing: 0, total: 14 })
    expect(insightsProgress(20).missing).toBe(0)
    expect(insightsProgress(0).missing).toBe(14)
  })
})

describe("visibleEntries", () => {
  const list = Array.from({ length: 20 }, (_, i) => e(`2026-10-${String(i + 1).padStart(2, "0")}`, 3))
  it("shows the newest first, the initial amount, then 8 more each time", () => {
    const first = visibleEntries(list, 8, 8, 0)
    expect(first.items).toHaveLength(8)
    expect(first.items[0].entry_date).toBe("2026-10-20")
    expect(first).toMatchObject({ hasMore: true, remaining: 12 })
    expect(visibleEntries(list, 8, 8, 1)).toMatchObject({ hasMore: true, remaining: 4 })
    expect(visibleEntries(list, 8, 8, 2)).toMatchObject({ hasMore: false, remaining: 0 })
    expect(visibleEntries(list, 6, 8, 0).items).toHaveLength(6)
  })
  it("handles short and empty lists", () => {
    expect(visibleEntries(list.slice(0, 3), 8, 8, 0)).toMatchObject({ hasMore: false, remaining: 0 })
    expect(visibleEntries([], 8, 8, 0).items).toEqual([])
  })
})

describe("nextMood", () => {
  it("moves with the arrow keys, wrapping around", () => {
    expect(nextMood(3, "ArrowRight")).toBe(4)
    expect(nextMood(5, "ArrowRight")).toBe(1)
    expect(nextMood(1, "ArrowLeft")).toBe(5)
    expect(nextMood(3, "ArrowUp")).toBe(2)
    expect(nextMood(null, "ArrowRight")).toBe(4)
    expect(nextMood(2, "Home")).toBe(1)
    expect(nextMood(2, "End")).toBe(5)
    expect(nextMood(2, "a")).toBeNull()
  })
})

describe("label placement", () => {
  it("takes the first spot that touches no data", async () => {
    const { pickLabelX } = await import("./stats")
    const obstacles = [{ x1: 30, x2: 40, y1: 80, y2: 100 }]
    expect(pickLabelX([36, 120, 200], 60, 82, 98, obstacles)).toBe(120)
    expect(pickLabelX([36, 120], 60, 10, 20, obstacles)).toBe(36) // the data is below the label: the first spot is free
  })
  it("falls back to the spot with the fewest hits when every one is taken", async () => {
    const { pickLabelX } = await import("./stats")
    const obstacles = [{ x1: 0, x2: 100, y1: 0, y2: 100 }, { x1: 0, x2: 50, y1: 0, y2: 100 }]
    expect(pickLabelX([10, 60], 20, 10, 20, obstacles)).toBe(60)
  })
  it("samples a line into boxes along its length", async () => {
    const { sampleLine } = await import("./stats")
    const boxes = sampleLine([{ x: 0, y: 0 }, { x: 40, y: 20 }])
    expect(boxes.length).toBeGreaterThan(5)
    expect(boxes[0]).toEqual({ x1: -4, x2: 4, y1: -4, y2: 4 })
    expect(boxes.every((b) => b.x1 >= -4 && b.x2 <= 44)).toBe(true)
  })
})

describe("label spot above or below the line", () => {
  it("prefers above, then below, then the least crowded", async () => {
    const { pickLabelSpot } = await import("./stats")
    const above = { x1: 0, x2: 100, y1: 70, y2: 90 } // blocks the space above a line at y = 100 for x 0..100
    expect(pickLabelSpot([10], 50, 100, [])).toEqual({ x: 10, side: "above" })
    expect(pickLabelSpot([10], 50, 100, [above])).toEqual({ x: 10, side: "below" })
    const both = [above, { x1: 0, x2: 100, y1: 105, y2: 120 }]
    expect(pickLabelSpot([10, 150], 50, 100, both)).toEqual({ x: 150, side: "above" })
  })
})
