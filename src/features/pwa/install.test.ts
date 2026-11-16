import { describe, expect, it } from "vitest"

import { DISMISS_DAYS, installPlatform, isIosDevice, nextVisitCount, shouldShowInstallBanner } from "./install"

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"
const CHROME = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36"

describe("installPlatform", () => {
  it("uses the install event when the browser fired it, the how-to on iOS, nothing elsewhere", () => {
    expect(installPlatform({ userAgent: CHROME, hasPromptEvent: true })).toBe("prompt")
    expect(installPlatform({ userAgent: IPHONE, hasPromptEvent: false })).toBe("ios")
    expect(installPlatform({ userAgent: CHROME, hasPromptEvent: false })).toBe("other")
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari", 5)).toBe(true)
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari", 0)).toBe(false)
  })
})

describe("shouldShowInstallBanner", () => {
  const now = Date.parse("2026-11-16T12:00:00Z")
  const base = { visits: 2, dismissedAt: null, standalone: false, platform: "prompt" as const, now }
  it("shows from the second visit", () => {
    expect(shouldShowInstallBanner({ ...base, visits: 1 })).toBe(false)
    expect(shouldShowInstallBanner(base)).toBe(true)
    expect(shouldShowInstallBanner({ ...base, platform: "ios" })).toBe(true)
  })
  it("never when installed or when no install path exists", () => {
    expect(shouldShowInstallBanner({ ...base, standalone: true })).toBe(false)
    expect(shouldShowInstallBanner({ ...base, platform: "other" })).toBe(false)
  })
  it("rests for 30 days after being dismissed", () => {
    expect(shouldShowInstallBanner({ ...base, dismissedAt: now - 5 * 86_400_000 })).toBe(false)
    expect(shouldShowInstallBanner({ ...base, dismissedAt: now - (DISMISS_DAYS + 1) * 86_400_000 })).toBe(true)
  })
})

describe("nextVisitCount", () => {
  it("counts once per session", () => {
    expect(nextVisitCount(1, false)).toBe(2)
    expect(nextVisitCount(2, true)).toBe(2)
  })
})
