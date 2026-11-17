import { describe, expect, it } from "vitest"

import nextConfig from "../../next.config"

async function policy() {
  const rules = await nextConfig.headers!()
  const all = rules.find((r) => r.source === "/:path*")!
  return all.headers.find((h) => h.key === "Permissions-Policy")!.value
}

describe("Permissions-Policy", () => {
  it("allows the microphone for our own origin only (voice dictation in the assistant)", async () => {
    const value = await policy()
    expect(value).toMatch(/(^|, )microphone=\(self\)(,|$)/)
    // never open to everyone or to other origins
    expect(value).not.toMatch(/microphone=\(\)/)
    expect(value).not.toMatch(/microphone=\*/)
    expect(value).not.toMatch(/microphone=\([^)]*https?:/)
  })
  it("keeps everything else restricted", async () => {
    const value = await policy()
    for (const feature of ["camera", "geolocation", "payment", "usb"]) expect(value).toContain(`${feature}=()`)
    expect(value).toContain("interest-cohort=()")
  })
  it("the other security headers are unchanged", async () => {
    const rules = await nextConfig.headers!()
    const keys = rules.find((r) => r.source === "/:path*")!.headers.map((h) => h.key)
    expect(keys).toEqual(expect.arrayContaining(["X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy"]))
  })
})
