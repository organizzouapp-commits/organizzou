import { describe, expect, it } from "vitest"

import { createLimiter } from "./rate-limit"

describe("createLimiter", () => {
  it("allows up to max inside the window, then says when to come back", () => {
    const limiter = createLimiter({ max: 3, windowMs: 1000 })
    expect(limiter.hit("a", 0).ok).toBe(true)
    expect(limiter.hit("a", 100).ok).toBe(true)
    expect(limiter.hit("a", 200).ok).toBe(true)
    const blocked = limiter.hit("a", 300)
    expect(blocked).toEqual({ ok: false, retryAfterMs: 700 })
  })
  it("lets attempts through again once the window passed, and keeps keys apart", () => {
    const limiter = createLimiter({ max: 1, windowMs: 1000 })
    expect(limiter.hit("a", 0).ok).toBe(true)
    expect(limiter.hit("b", 0).ok).toBe(true)
    expect(limiter.hit("a", 500).ok).toBe(false)
    expect(limiter.hit("a", 1001).ok).toBe(true)
  })
})
