import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"

import { describe, expect, it } from "vitest"

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), "utf8")

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return walk(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : []
  })
}

describe("billing configuration and secrets", () => {
  it(".env.example names the four variables, all empty", () => {
    const env = read(".env.example")
    for (const name of ["ASAAS_API_KEY", "ASAAS_ENV", "ASAAS_WEBHOOK_TOKEN", "ASAAS_BASE_URL"]) expect(env).toMatch(new RegExp(`^${name}=$`, "m"))
  })
  it("the Asaas variables are read only on the server (never NEXT_PUBLIC, never in a client component)", () => {
    const offenders = walk(join(ROOT, "src"))
      .filter((file) => /ASAAS_/.test(readFileSync(file, "utf8")))
      .map((file) => relative(ROOT, file).split(sep).join("/"))
    // the client, the webhook route and the env reader: nothing under components/, hooks/ or any "use client" file
    for (const file of offenders) {
      expect(file.startsWith("src/components/"), file).toBe(false)
      expect(readFileSync(join(ROOT, file), "utf8"), file).not.toMatch(/^["']use client["']/m)
    }
    expect(offenders.length).toBeGreaterThan(0)
    expect(read(".env.example")).not.toMatch(/NEXT_PUBLIC_ASAAS/)
  })
  it("no key or token is written in the code or the docs", () => {
    const all = [...walk(join(ROOT, "src")).map((f) => readFileSync(f, "utf8")), read("README.md"), read(".env.example")].join("\n")
    expect(all).not.toMatch(/\$aact_[A-Za-z0-9]{10,}/) // the shape of an Asaas API key
  })
  it("the billing code never reads the vault or hands anything to the assistant", () => {
    const billing = walk(join(ROOT, "src/lib/billing")).concat(walk(join(ROOT, "src/app/api/billing")), walk(join(ROOT, "src/app/api/webhooks")))
    for (const file of billing) {
      const text = readFileSync(file, "utf8")
      expect(text, file).not.toMatch(/vault|server\/assistant|anthropic/i)
    }
  })
  it("the README documents the webhook address and the header, and lists the migrations", () => {
    const readme = read("README.md")
    expect(readme).toContain("https://organizzou.com/api/webhooks/asaas")
    expect(readme).toContain("asaas-access-token")
    expect(readme).toContain("20261118000001_billing.sql")
    expect(readme).toContain("20261118000003_admin_billing.sql")
  })
  it("the security headers are still in place", () => {
    const config = read("next.config.ts")
    for (const header of ["X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]) expect(config).toContain(header)
    expect(config).toContain("camera=()")
  })
})
