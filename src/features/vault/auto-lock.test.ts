import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ACTIVITY_THROTTLE_MS, createLockTimer, extendOnActivity, getRemainingMs, lockDelayMs, locksOnHide, shouldLock } from "./auto-lock"

describe("auto-lock settings", () => {
  it("waits 1, 5, 15 or 30 minutes, and uses no timer when it locks on hiding the tab", () => {
    expect(lockDelayMs("1")).toBe(60_000)
    expect(lockDelayMs("5")).toBe(300_000)
    expect(lockDelayMs("15")).toBe(900_000)
    expect(lockDelayMs("30")).toBe(1_800_000)
    expect(lockDelayMs("hidden")).toBeNull()
  })

  it("locks on hide only for the tab setting", () => {
    expect(locksOnHide("hidden")).toBe(true)
    expect(locksOnHide("5")).toBe(false)
  })
})

describe("createLockTimer", () => {
  beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }))
  afterEach(() => vi.useRealTimers())

  it("locks once the time has passed and reports the deadline for the countdown", () => {
    const onLock = vi.fn()
    const deadlines: (number | null)[] = []
    const timer = createLockTimer(onLock, (d) => deadlines.push(d))
    timer.start("1")
    expect(deadlines).toEqual([1_060_000])
    vi.advanceTimersByTime(59_999)
    expect(onLock).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onLock).toHaveBeenCalledTimes(1)
    expect(timer.deadline()).toBeNull()
  })

  it("activity moves the deadline, but at most once every 5 seconds", () => {
    const onLock = vi.fn()
    const deadlines: (number | null)[] = []
    const timer = createLockTimer(onLock, (d) => deadlines.push(d))
    timer.start("1")
    vi.advanceTimersByTime(30_000)
    timer.touch()
    expect(timer.deadline()).toBe(1_030_000 + 60_000)
    timer.touch()
    timer.touch()
    expect(deadlines).toHaveLength(2)
    vi.advanceTimersByTime(59_999)
    expect(onLock).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onLock).toHaveBeenCalledTimes(1)
  })

  it("does not run a timer for the tab setting, and touching does nothing", () => {
    const onLock = vi.fn()
    const deadlines: (number | null)[] = []
    const timer = createLockTimer(onLock, (d) => deadlines.push(d))
    timer.start("hidden")
    vi.advanceTimersByTime(3_600_000)
    timer.touch()
    expect(onLock).not.toHaveBeenCalled()
    expect(deadlines).toEqual([null])
  })

  it("changing the setting restarts the countdown with the new time", () => {
    const onLock = vi.fn()
    const timer = createLockTimer(onLock, () => {})
    timer.start("1")
    vi.advanceTimersByTime(30_000)
    timer.start("5")
    vi.advanceTimersByTime(60_000)
    expect(onLock).not.toHaveBeenCalled()
    vi.advanceTimersByTime(240_000)
    expect(onLock).toHaveBeenCalledTimes(1)
  })

  it("stop cancels the lock and ignores later activity", () => {
    const onLock = vi.fn()
    const timer = createLockTimer(onLock, () => {})
    timer.start("1")
    timer.stop()
    vi.advanceTimersByTime(120_000)
    timer.touch()
    expect(onLock).not.toHaveBeenCalled()
    expect(timer.deadline()).toBeNull()
  })
})

describe("absolute deadline helpers", () => {
  const DELAY = 300_000

  it("derives the remaining time from the deadline, never below zero", () => {
    expect(getRemainingMs(1_000_000 + DELAY, 1_000_000)).toBe(DELAY)
    expect(getRemainingMs(1_000_000 + DELAY, 1_000_000 + 60_000)).toBe(DELAY - 60_000)
    expect(getRemainingMs(1_000_000, 2_000_000)).toBe(0)
    expect(getRemainingMs(null, 5)).toBeNull()
  })

  it("locks exactly when the deadline has passed, and never without one", () => {
    expect(shouldLock(1_000, 999)).toBe(false)
    expect(shouldLock(1_000, 1_000)).toBe(true)
    expect(shouldLock(null, 1e15)).toBe(false)
  })

  it("coming back to the page after the deadline locks (a sleeping tab runs no timer)", () => {
    const lockAt = 1_000_000 + DELAY
    const backAt = lockAt + 3_600_000
    expect(shouldLock(lockAt, backAt)).toBe(true)
    // ...and activity cannot revive an expired vault.
    expect(extendOnActivity({ lockAt, lastExtendAt: 1_000_000, now: backAt, delayMs: DELAY }).extended).toBe(false)
  })

  it("switching tabs does not touch the deadline: only extendOnActivity moves it", () => {
    const lockAt = 1_000_000 + DELAY
    // Nothing is called on a tab switch, so the countdown just keeps running from the same absolute time.
    expect(getRemainingMs(lockAt, 1_000_000 + 42_000)).toBe(DELAY - 42_000)
    expect(getRemainingMs(lockAt, 1_000_000 + 43_000)).toBe(DELAY - 43_000)
  })

  it("real activity extends the deadline, at most once every 5 seconds", () => {
    const start = 1_000_000
    const first = extendOnActivity({ lockAt: start + DELAY, lastExtendAt: start, now: start + 10_000, delayMs: DELAY })
    expect(first).toEqual({ lockAt: start + 10_000 + DELAY, lastExtendAt: start + 10_000, extended: true })
    const tooSoon = extendOnActivity({ ...first, now: start + 10_000 + ACTIVITY_THROTTLE_MS - 1, delayMs: DELAY })
    expect(tooSoon.extended).toBe(false)
    expect(tooSoon.lockAt).toBe(first.lockAt)
    const later = extendOnActivity({ ...first, now: start + 10_000 + ACTIVITY_THROTTLE_MS, delayMs: DELAY })
    expect(later.extended).toBe(true)
  })

  it("does nothing for the setting without a timer", () => {
    expect(extendOnActivity({ lockAt: null, lastExtendAt: 0, now: 99_999, delayMs: null }).extended).toBe(false)
  })
})
