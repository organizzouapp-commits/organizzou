import { describe, expect, it } from "vitest"

import { canSendCode, cleanCode, codeEmail, codeProblem, isCompleteCode, MAX_ATTEMPTS, maskEmail, SEND_WINDOW_MS } from "./two-factor"

describe("code text", () => {
  it("keeps six digits from a paste", () => {
    expect(cleanCode("123 456")).toBe("123456")
    expect(cleanCode("12-34-56-78")).toBe("123456")
    expect(isCompleteCode("12345")).toBe(false)
    expect(isCompleteCode("123456")).toBe(true)
  })
  it("masks the e-mail", () => {
    expect(maskEmail("patrick.toledo@gmail.com")).toBe("p***@gmail.com")
    expect(maskEmail("sem-arroba")).toBe("***")
  })
})

describe("sending limit", () => {
  it("allows 3 codes per 15 minutes", () => {
    const now = 10_000_000
    expect(canSendCode([now - 1000, now - 2000], now)).toEqual({ ok: true })
    const blocked = canSendCode([now - 1000, now - 2000, now - 3000], now)
    expect(blocked.ok).toBe(false)
    expect(blocked).toEqual({ ok: false, retryAfterSeconds: Math.ceil((SEND_WINDOW_MS - 3000) / 1000) })
  })
  it("forgets old codes", () => {
    const now = 10_000_000
    expect(canSendCode([now - SEND_WINDOW_MS - 1, now - SEND_WINDOW_MS - 2, now - SEND_WINDOW_MS - 3], now)).toEqual({ ok: true })
  })
})

describe("codeProblem", () => {
  const now = Date.parse("2026-11-12T12:00:00Z")
  const live = { expires_at: "2026-11-12T12:05:00Z", attempts: 0, consumed_at: null }
  it("says why a code is no good, and nothing for a live one", () => {
    expect(codeProblem(live, now)).toBeNull()
    expect(codeProblem(null, now)).toBe("none")
    expect(codeProblem({ ...live, consumed_at: "2026-11-12T11:59:00Z" }, now)).toBe("used")
    expect(codeProblem({ ...live, expires_at: "2026-11-12T11:59:00Z" }, now)).toBe("expired")
    expect(codeProblem({ ...live, attempts: MAX_ATTEMPTS }, now)).toBe("locked")
    expect(codeProblem({ ...live, attempts: MAX_ATTEMPTS - 1 }, now)).toBeNull()
  })
})

describe("codeEmail", () => {
  it("carries the code, the lifetime and the warning, with no link", () => {
    const mail = codeEmail("123456", "login")
    expect(mail.subject).toContain("123456")
    expect(mail.text).toContain("10 minutos")
    expect(mail.text).toContain("troque a sua senha")
    expect(mail.text).not.toMatch(/https?:/)
  })
})
