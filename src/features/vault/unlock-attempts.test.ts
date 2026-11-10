import { beforeEach, describe, expect, it } from "vitest"

import { recordUnlockFailure, resetUnlockFailures, unlockBlockedUntil, unlockDelayMs } from "./unlock-attempts"

describe("unlockDelayMs", () => {
  it("is zero for the first four wrong tries, then grows and stops at a minute", () => {
    expect([0, 1, 2, 3, 4].map(unlockDelayMs)).toEqual([0, 0, 0, 0, 0])
    expect([5, 6, 7, 8].map(unlockDelayMs)).toEqual([2000, 4000, 8000, 16000])
    expect(unlockDelayMs(9)).toBe(32000)
    expect(unlockDelayMs(10)).toBe(60000)
    expect(unlockDelayMs(50)).toBe(60000)
  })
})

describe("recordUnlockFailure", () => {
  beforeEach(resetUnlockFailures)

  it("only blocks from the fifth wrong try on, and a success (reset) clears it", () => {
    for (let i = 1; i <= 4; i += 1) expect(recordUnlockFailure(1000)).toBe(1000)
    expect(recordUnlockFailure(1000)).toBe(3000)
    expect(recordUnlockFailure(1000)).toBe(5000)
    expect(unlockBlockedUntil()).toBe(5000)
    resetUnlockFailures()
    expect(unlockBlockedUntil()).toBe(0)
    expect(recordUnlockFailure(1000)).toBe(1000)
  })
})
