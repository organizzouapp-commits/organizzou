import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import { devBypassEnabled } from "./bypass"

/**
 * PROTOTYPE_BYPASS_AUTH skips the login and unlocks the dev_admin / dev_plan cookies. In production none of that may
 * ever work, even if someone sets the variable by mistake in the Vercel dashboard.
 */
describe("dev bypass is inert in production", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("is on only in development with the variable set to 1", () => {
    expect(devBypassEnabled({ NODE_ENV: "development", PROTOTYPE_BYPASS_AUTH: "1" })).toBe(true)
    expect(devBypassEnabled({ NODE_ENV: "test", PROTOTYPE_BYPASS_AUTH: "1" })).toBe(true)
    expect(devBypassEnabled({ NODE_ENV: "development" })).toBe(false)
    expect(devBypassEnabled({ NODE_ENV: "development", PROTOTYPE_BYPASS_AUTH: "true" })).toBe(false)
    expect(devBypassEnabled({ PROTOTYPE_BYPASS_AUTH: "0" })).toBe(false)
  })

  it("is off when NODE_ENV is production, variable set or not", () => {
    expect(devBypassEnabled({ NODE_ENV: "production", PROTOTYPE_BYPASS_AUTH: "1" })).toBe(false)
    expect(devBypassEnabled({ NODE_ENV: "production" })).toBe(false)
  })

  it("is off when VERCEL_ENV is production, even if NODE_ENV says development", () => {
    expect(devBypassEnabled({ NODE_ENV: "development", VERCEL_ENV: "production", PROTOTYPE_BYPASS_AUTH: "1" })).toBe(false)
    expect(devBypassEnabled({ VERCEL_ENV: "production", PROTOTYPE_BYPASS_AUTH: "1" })).toBe(false)
  })

  it("the exported flag read from the real environment follows the same rule", async () => {
    vi.stubEnv("PROTOTYPE_BYPASS_AUTH", "1")

    vi.stubEnv("NODE_ENV", "production")
    vi.resetModules()
    expect((await import("./bypass")).bypassAuth).toBe(false)

    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("VERCEL_ENV", "production")
    vi.resetModules()
    expect((await import("./bypass")).bypassAuth).toBe(false)

    vi.stubEnv("VERCEL_ENV", "")
    vi.resetModules()
    expect((await import("./bypass")).bypassAuth).toBe(true)
  })

  it("the dev cookies are only honored in files that check bypassAuth, and the flag has a single definition", () => {
    const root = join(__dirname, "..", "..")
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]))
    const files = walk(root).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f))
    for (const file of files) {
      const text = readFileSync(file, "utf8")
      if (/["'](dev_admin|dev_plan)["']/.test(text)) {
        expect(/\bbypassAuth\b/.test(text), `${relative(root, file)} reads a dev cookie without checking bypassAuth`).toBe(true)
      }
      if (/process\.env\.PROTOTYPE_BYPASS_AUTH|env\.PROTOTYPE_BYPASS_AUTH/.test(text)) {
        expect(relative(root, file).split(sep).join("/"), "PROTOTYPE_BYPASS_AUTH must only be read in bypass.ts").toBe("lib/supabase/bypass.ts")
      }
    }
  })
})
