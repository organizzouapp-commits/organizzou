import { describe, expect, it } from "vitest"

import { cookieDomainFor } from "./consent"

describe("cookieDomainFor", () => {
  it("uses the configured domain only when the current host is that domain or inside it", () => {
    expect(cookieDomainFor("organizzou.com", ".organizzou.com")).toBe(".organizzou.com")
    expect(cookieDomainFor("www.organizzou.com", ".organizzou.com")).toBe(".organizzou.com")
    expect(cookieDomainFor("app.organizzou.com", "organizzou.com")).toBe("organizzou.com")
  })
  it("ignores a leftover value for another site, so the browser never drops the cookie (host-only instead)", () => {
    expect(cookieDomainFor("organizzou.com", ".organizzouapp.com")).toBeUndefined()
    expect(cookieDomainFor("organizzou.vercel.app", ".organizzou.com")).toBeUndefined()
    expect(cookieDomainFor("evilorganizzou.com", ".organizzou.com")).toBeUndefined()
  })
  it("no domain configured (localhost, previews): host-only", () => {
    expect(cookieDomainFor("localhost", undefined)).toBeUndefined()
    expect(cookieDomainFor("localhost", "  ")).toBeUndefined()
  })
})
