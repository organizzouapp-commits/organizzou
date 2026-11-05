import { beforeEach, describe, expect, it } from "vitest"

import { splash } from "./splash-store"

describe("splash store is order-independent", () => {
  beforeEach(() => {
    splash.markShellGone()
    splash.markDismissed()
  })

  it("pending -> ready", () => {
    splash.markPending()
    expect(splash.state().phase).toBe("pending")
    splash.markReady()
    expect(splash.state().phase).toBe("ready")
  })

  it("ready -> pending: the pending resolves at once, ready is never lost", () => {
    splash.markReady()
    splash.markPending()
    expect(splash.state().phase).toBe("ready")
  })

  it("a shell that went away does not resolve the next login", () => {
    splash.markReady()
    splash.markShellGone()
    splash.markPending()
    expect(splash.state().phase).toBe("pending")
  })

  it("duplicate ready keeps ready", () => {
    splash.markPending()
    splash.markReady()
    splash.markReady()
    expect(splash.state().phase).toBe("ready")
  })
})
