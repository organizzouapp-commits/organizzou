import { describe, expect, it } from "vitest"

import { SPLASH_IDLE, shouldHardNavigate, splashDue, splashReduce } from "./splash-machine"

const T = 1_000_000
const WAIT = { minMs: 2600, maxMs: 8000 }

describe("splash state machine", () => {
  it("idle -> pending -> ready -> dismissed", () => {
    let s = splashReduce(SPLASH_IDLE, "pending", T)
    expect(s).toEqual({ phase: "pending", pendingAt: T })
    s = splashReduce(s, "ready", T + 500)
    expect(s.phase).toBe("ready")
    s = splashReduce(s, "dismissed", T + 3000)
    expect(s.phase).toBe("dismissed")
  })

  it("ready before anything is pending changes nothing (the shell mounted first)", () => {
    expect(splashReduce(SPLASH_IDLE, "ready", T)).toEqual(SPLASH_IDLE)
  })

  it("a new login starts over from any phase", () => {
    const old = splashReduce(splashReduce(SPLASH_IDLE, "pending", T), "ready", T + 1)
    expect(splashReduce(old, "pending", T + 9000)).toEqual({ phase: "pending", pendingAt: T + 9000 })
  })

  it("waits while pending, and while ready but inside the minimum display time", () => {
    const pending = splashReduce(SPLASH_IDLE, "pending", T)
    expect(splashDue(pending, T + 3000, WAIT)).toBe("wait")
    const ready = splashReduce(pending, "ready", T + 300)
    expect(splashDue(ready, T + 1000, WAIT)).toBe("wait")
  })

  it("leaves once ready AND the minimum time is over", () => {
    const ready = splashReduce(splashReduce(SPLASH_IDLE, "pending", T), "ready", T + 300)
    expect(splashDue(ready, T + 2600, WAIT)).toBe("dismiss")
    // The dashboard was ready long after the intro: leaves at once.
    const late = splashReduce(splashReduce(SPLASH_IDLE, "pending", T), "ready", T + 5000)
    expect(splashDue(late, T + 5000, WAIT)).toBe("dismiss")
  })

  it("gives up at the hard limit even if the page never says it is ready", () => {
    const pending = splashReduce(SPLASH_IDLE, "pending", T)
    expect(splashDue(pending, T + 7999, WAIT)).toBe("wait")
    expect(splashDue(pending, T + 8000, WAIT)).toBe("timeout")
  })

  it("reduced motion: the minimum is the short one", () => {
    const ready = splashReduce(splashReduce(SPLASH_IDLE, "pending", T), "ready", T + 100)
    expect(splashDue(ready, T + 600, { minMs: 600, maxMs: 8000 })).toBe("dismiss")
  })

  it("is idle when nothing is going on or it is over", () => {
    expect(splashDue(SPLASH_IDLE, T, WAIT)).toBe("idle")
    expect(splashDue({ phase: "dismissed", pendingAt: T }, T + 100, WAIT)).toBe("idle")
  })
})

describe("shouldHardNavigate", () => {
  it("not before 3 s, not when already there, only when the client navigation went nowhere", () => {
    expect(shouldHardNavigate(T + 2000, T, "/login", "/dashboard")).toBe(false)
    expect(shouldHardNavigate(T + 3000, T, "/login", "/dashboard")).toBe(true)
    expect(shouldHardNavigate(T + 3500, T, "/dashboard", "/dashboard")).toBe(false)
    expect(shouldHardNavigate(T + 3500, T, "/dashboard/tarefas", "/dashboard")).toBe(false)
    expect(shouldHardNavigate(T + 3500, null, "/login", "/dashboard")).toBe(false)
  })
})
