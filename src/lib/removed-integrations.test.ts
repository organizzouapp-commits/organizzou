import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * WhatsApp and Open Finance were dropped from the product on 2026-11-03 (docs/REMOVAL-WHATSAPP-OPENFINANCE.md). Nothing under src/ may
 * mention them again. The archived docs, the removal note and supabase/pending-drops/ live outside src/, so they need no allowlist entry.
 */
const SRC = join(__dirname, "..")
const FORBIDDEN = /whatsapp|open[ _-]?finance/i
const ALLOWED = new Set<string>([join("lib", "removed-integrations.test.ts")])

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return walk(path)
    return /\.(ts|tsx|css|json|md|mdx)$/.test(name) ? [path] : []
  })
}

describe("removed integrations", () => {
  it("src/ never mentions WhatsApp or Open Finance", () => {
    const offenders = walk(SRC)
      .filter((file) => !ALLOWED.has(relative(SRC, file).split(sep).join(sep)))
      .filter((file) => FORBIDDEN.test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file))
    expect(offenders).toEqual([])
  })

  it("there is no /api/whatsapp route", () => {
    expect(() => statSync(join(SRC, "app", "api", "whatsapp"))).toThrow()
  })
})
