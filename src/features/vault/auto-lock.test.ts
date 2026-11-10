import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createLockTimer, lockDelayMs, locksOnHide } from "./auto-lock"

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

  it("activity moves the deadline, but at most once a second", () => {
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
