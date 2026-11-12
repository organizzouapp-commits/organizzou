import { describe, expect, it } from "vitest"

import { deviceLabel, pushSupport, subscriptionSchema, urlBase64ToUint8Array } from "./push"

describe("deviceLabel", () => {
  it("names browser and system", () => {
    expect(deviceLabel("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36")).toBe("Chrome no Android")
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1")).toBe("Safari no iPhone")
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36 Edg/120")).toBe("Edge no Windows")
    expect(deviceLabel("")).toBe("Este aparelho")
  })
})

describe("urlBase64ToUint8Array", () => {
  it("decodes base64url", () => {
    expect(Array.from(urlBase64ToUint8Array("AQID"))).toEqual([1, 2, 3])
    expect(Array.from(urlBase64ToUint8Array("-_8"))).toEqual([251, 255])
  })
})

describe("pushSupport", () => {
  const base = { hasApis: true, permission: "default" as const, userAgent: "Chrome", standalone: false }
  it("separates the cases the screen explains", () => {
    expect(pushSupport(base)).toBe("supported")
    expect(pushSupport({ ...base, permission: "denied" })).toBe("denied")
    expect(pushSupport({ ...base, hasApis: false })).toBe("unsupported")
    expect(pushSupport({ ...base, hasApis: false, userAgent: "iPhone Safari" })).toBe("ios-needs-install")
    expect(pushSupport({ ...base, hasApis: false, userAgent: "iPhone Safari", standalone: true })).toBe("unsupported")
  })
})

describe("subscriptionSchema", () => {
  it("accepts a https endpoint with keys and refuses the rest", () => {
    const ok = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "B".repeat(60), auth: "a".repeat(22) } }
    expect(subscriptionSchema.safeParse(ok).success).toBe(true)
    expect(subscriptionSchema.safeParse({ ...ok, endpoint: "http://x.com/a" }).success).toBe(false)
    expect(subscriptionSchema.safeParse({ ...ok, keys: { p256dh: "x", auth: "y" } }).success).toBe(false)
  })
})
