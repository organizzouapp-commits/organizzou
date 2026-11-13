import { describe, expect, it } from "vitest"

import { lastSeenText, orderSessions, placeFromHeaders, sessionLabel } from "./sessions"

describe("labels and places", () => {
  it("names the device from the user agent", () => {
    expect(sessionLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1")).toBe("Safari no iPhone")
  })
  it("builds the place from free headers and tolerates junk", () => {
    expect(placeFromHeaders("S%C3%A3o%20Paulo", "br")).toBe("São Paulo, BR")
    expect(placeFromHeaders(null, "BR")).toBe("BR")
    expect(placeFromHeaders("%E0%A4%A", null)).toBeNull()
    expect(placeFromHeaders(undefined, undefined)).toBeNull()
  })
})

describe("lastSeenText", () => {
  const now = Date.parse("2026-11-12T12:00:00Z")
  it("reads like a person", () => {
    expect(lastSeenText("2026-11-12T11:59:30Z", now)).toBe("agora")
    expect(lastSeenText("2026-11-12T11:50:00Z", now)).toBe("há 10 minutos")
    expect(lastSeenText("2026-11-12T10:00:00Z", now)).toBe("há 2 horas")
    expect(lastSeenText("2026-11-12T11:00:00Z", now)).toBe("há 1 hora")
    expect(lastSeenText("2026-11-09T12:00:00Z", now)).toBe("há 3 dias")
  })
})

describe("orderSessions", () => {
  it("puts this device first, then the freshest", () => {
    const base = { label: "x", place: null, createdAt: "2026-11-01T00:00:00Z" }
    const ordered = orderSessions([
      { ...base, id: "old", lastSeenAt: "2026-11-10T00:00:00Z", current: false },
      { ...base, id: "here", lastSeenAt: "2026-11-01T00:00:00Z", current: true },
      { ...base, id: "new", lastSeenAt: "2026-11-12T00:00:00Z", current: false },
    ])
    expect(ordered.map((s) => s.id)).toEqual(["here", "new", "old"])
  })
})
