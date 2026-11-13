import { describe, expect, it } from "vitest"

import { buildReportEmail, REPORT_MAX, safeRoute, validateReport, withinRateLimit } from "./report"

describe("validateReport", () => {
  it("needs 10 to 2000 characters after trimming", () => {
    expect(validateReport("curto").ok).toBe(false)
    expect(validateReport("   123456789   ").ok).toBe(false)
    expect(validateReport("1234567890")).toEqual({ ok: true, text: "1234567890" })
    expect(validateReport("x".repeat(REPORT_MAX + 1)).ok).toBe(false)
  })
})

describe("withinRateLimit", () => {
  const now = 10_000_000
  it("allows up to 5 per hour", () => {
    expect(withinRateLimit([now - 1000, now - 2000, now - 3000, now - 4000], now)).toBe(true)
    expect(withinRateLimit([now - 1000, now - 2000, now - 3000, now - 4000, now - 5000], now)).toBe(false)
  })
  it("forgets sends older than the window", () => {
    expect(withinRateLimit(Array.from({ length: 9 }, () => now - 2 * 3_600_000), now)).toBe(true)
  })
})

describe("buildReportEmail", () => {
  it("carries the message and the context, without query strings", () => {
    expect(safeRoute("/dashboard/ajuda?token=abc#x")).toBe("/dashboard/ajuda")
    const mail = buildReportEmail("Algo quebrou na agenda", { name: "Ana", email: "ana@x.com", route: "/dashboard/agenda?a=1", version: "abc1234", userAgent: "UA", at: new Date("2026-11-12T10:00:00Z") })
    expect(mail.subject).toContain("ana@x.com")
    expect(mail.body).toContain("Algo quebrou na agenda")
    expect(mail.body).toContain("/dashboard/agenda")
    expect(mail.body).not.toContain("a=1")
    expect(mail.body).toContain("2026-11-12T10:00:00.000Z")
  })
})
