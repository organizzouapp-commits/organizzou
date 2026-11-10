import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CLIPBOARD_CLEAR_MS, clearClipboardNow, copySecret } from "./clipboard"

function fakeClipboard(initial = "", denyRead = false) {
  let value = initial
  return {
    get value() {
      return value
    },
    set value(v: string) {
      value = v
    },
    writeText: vi.fn(async (text: string) => {
      value = text
    }),
    readText: vi.fn(async () => {
      if (denyRead) throw new Error("denied")
      return value
    }),
  }
}

describe("copySecret", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    clearClipboardNow()
    vi.useRealTimers()
  })

  it("clears the clipboard after 30 seconds", async () => {
    const clip = fakeClipboard()
    await copySecret("segredo", { clipboard: clip })
    expect(clip.value).toBe("segredo")
    await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS - 1)
    expect(clip.value).toBe("segredo")
    await vi.advanceTimersByTimeAsync(2)
    expect(clip.value).toBe("")
  })

  it("leaves the clipboard alone when the person copied something else in the meantime", async () => {
    const clip = fakeClipboard()
    await copySecret("segredo", { clipboard: clip })
    clip.value = "outra coisa"
    await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS + 10)
    expect(clip.value).toBe("outra coisa")
  })

  it("leaves the clipboard alone when the browser does not let the page read it (the value cannot be confirmed)", async () => {
    const clip = fakeClipboard("", true)
    await copySecret("segredo", { clipboard: clip })
    await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS + 10)
    expect(clip.value).toBe("segredo")
  })

  it("clears at once when asked (the vault locked)", async () => {
    const clip = fakeClipboard()
    await copySecret("segredo", { clipboard: clip })
    clearClipboardNow()
    await vi.advanceTimersByTimeAsync(0)
    expect(clip.value).toBe("")
  })

  it("a newer copy replaces the pending clear of the older one", async () => {
    const clip = fakeClipboard()
    await copySecret("um", { clipboard: clip })
    await vi.advanceTimersByTimeAsync(20_000)
    await copySecret("dois", { clipboard: clip })
    await vi.advanceTimersByTimeAsync(20_000)
    expect(clip.value).toBe("dois") // the first timer would have fired by now
    await vi.advanceTimersByTimeAsync(11_000)
    expect(clip.value).toBe("")
  })
})
