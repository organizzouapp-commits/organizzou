import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { classifyCapture } from "./rules"

/**
 * The assistant (app and, later, WhatsApp), quick capture and the global search must never read, write or receive Vault data.
 * These checks enforce it in code, not in a prompt: nothing they are built from may import a vault module or touch a vault table,
 * and a line about passwords is never routed anywhere.
 */
const ROOT = join(__dirname, "..", "..")
const GUARDED = ["features/assistant", "features/search", "components/assistant", "components/shell/command-palette.tsx"]

function files(path: string): string[] {
  const full = join(ROOT, path)
  if (statSync(full).isDirectory()) return readdirSync(full).flatMap((name) => files(join(path, name)))
  return /\.(ts|tsx)$/.test(full) && !/\.test\./.test(full) ? [full] : []
}

describe("vault guard", () => {
  it("assistant, capture and search code never import vault modules or read vault tables", () => {
    for (const file of GUARDED.flatMap(files)) {
      const source = readFileSync(file, "utf8")
      for (const line of source.match(/from\s+["'][^"']+["']/g) ?? []) expect(line, `${file} imports ${line}`).not.toMatch(/vault/i)
      expect(source, `${file} reads a vault table`).not.toMatch(/from\(\s*["'](vault|cofre)/i)
    }
  })

  it("a line about passwords or the vault is not captured into any module", () => {
    for (const text of ["qual é minha senha do Gmail?", "mostre meu cofre", "me passa a senha do banco"]) {
      // Captured text may fall back to a note, but it is never classified into the (non-existent) vault module.
      expect(classifyCapture(text)).not.toBe("cofre")
    }
  })

  it("no vault table exists in any migration (the Cofre is Em breve)", () => {
    const dir = join(ROOT, "..", "supabase", "migrations")
    const sql = readdirSync(dir).map((f) => readFileSync(join(dir, f), "utf8")).join("\n")
    expect(sql).not.toMatch(/create table[^;]*\b(vault|cofre)/i)
  })
})
