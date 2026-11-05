import { describe, expect, it } from "vitest"

import { splashResume } from "./splash-resume"

const NOW = 1_800_000_000_000

describe("splashResume", () => {
  it("shows nothing without a cookie", () => {
    expect(splashResume(NOW, null, null)).toEqual({ show: false, elapsed: 0, final: false })
  })

  it("ignores garbage and timestamps from the future", () => {
    expect(splashResume(NOW, Number.NaN, null).show).toBe(false)
    expect(splashResume(NOW, NOW + 60_000, null).show).toBe(false)
    expect(splashResume(NOW, 0, null).show).toBe(false)
  })

  it("expires after 20 s", () => {
    expect(splashResume(NOW, NOW - 25_000, null).show).toBe(false)
    expect(splashResume(NOW, NOW - 19_000, null).show).toBe(true)
  })

  it("resumes in the middle of the intro: the elapsed time is what has already played", () => {
    const r = splashResume(NOW, NOW - 900, null)
    expect(r.show).toBe(true)
    expect(r.elapsed).toBe(900)
    expect(r.final).toBe(false)
  })

  it("after the intro it is the final static state, elapsed clamped to the intro length", () => {
    const r = splashResume(NOW, NOW - 8_000, null)
    expect(r).toEqual({ show: true, elapsed: 2600, final: true })
  })

  it("counts the window from the return when the callback wrote one (a long stay on Google's page)", () => {
    const r = splashResume(NOW, NOW - 90_000, NOW - 1_200)
    expect(r.show).toBe(true)
    expect(r.final).toBe(true)
    expect(r.elapsed).toBe(2600)
    expect(splashResume(NOW, NOW - 90_000, NOW - 25_000).show).toBe(false)
  })

  it("is monotonic across documents: a later load never shows less elapsed than an earlier one", () => {
    const start = NOW - 5_000
    let last = -1
    for (const t of [0, 300, 900, 1500, 2599, 2601, 4000]) {
      const r = splashResume(start + t, start, null)
      expect(r.elapsed).toBeGreaterThanOrEqual(last)
      last = r.elapsed
    }
  })
})
