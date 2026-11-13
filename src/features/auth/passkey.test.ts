import { describe, expect, it } from "vitest"

import { challengeAlive, defaultPasskeyName, fromBase64Url, toBase64Url, userHandle, webauthnConfig } from "./passkey"

describe("webauthnConfig", () => {
  it("defaults to localhost in development and the Vercel host in production", () => {
    expect(webauthnConfig({ NODE_ENV: "development" })).toEqual({ rpID: "localhost", origins: ["http://localhost:3000", "http://localhost:3100"] })
    expect(webauthnConfig({ NODE_ENV: "production" })).toEqual({ rpID: "organizzou.vercel.app", origins: ["https://organizzou.vercel.app"] })
  })
  it("takes the id and the origins from the environment", () => {
    expect(webauthnConfig({ NODE_ENV: "production", WEBAUTHN_RP_ID: "organizzouapp.com", WEBAUTHN_ORIGIN: "https://organizzouapp.com/, https://www.organizzouapp.com" })).toEqual({ rpID: "organizzouapp.com", origins: ["https://organizzouapp.com", "https://www.organizzouapp.com"] })
  })
})

describe("challenges", () => {
  const now = Date.parse("2026-11-12T12:00:00Z")
  it("lives until it expires or is used", () => {
    expect(challengeAlive({ expires_at: "2026-11-12T12:04:00Z", consumed_at: null }, now)).toBe(true)
    expect(challengeAlive({ expires_at: "2026-11-12T11:59:00Z", consumed_at: null }, now)).toBe(false)
    expect(challengeAlive({ expires_at: "2026-11-12T12:04:00Z", consumed_at: "2026-11-12T12:01:00Z" }, now)).toBe(false)
    expect(challengeAlive(null, now)).toBe(false)
  })
})

describe("bytes and names", () => {
  it("round-trips base64url and builds an opaque user handle", () => {
    const bytes = new Uint8Array([251, 255, 0, 1])
    expect(Array.from(fromBase64Url(toBase64Url(bytes)))).toEqual([251, 255, 0, 1])
    expect(new TextDecoder().decode(userHandle("abc-123"))).toBe("abc-123")
  })
  it("names a passkey after the device and the first name", () => {
    expect(defaultPasskeyName("Safari no iPhone", "Patrick Toledo")).toBe("iPhone de Patrick")
    expect(defaultPasskeyName("Chrome no Windows", "")).toBe("Windows")
    expect(defaultPasskeyName("", "")).toBe("Passkey")
  })
})
