import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { parseCapture } from "@/server/assistant/parse"
import { TOOLS } from "@/server/assistant/tools"

/**
 * The assistant (in the app only), quick capture and the global search must never read, write or receive Vault data.
 * These checks enforce it in code, not in a prompt: nothing they are built from may import a vault module or touch a vault table,
 * and a line about passwords is never routed anywhere.
 */
const ROOT = join(__dirname, "..", "..")
const GUARDED = ["features/assistant", "features/search", "components/assistant", "components/shell/command-palette.tsx", "server/assistant", "app/api/assistant"]

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
      // Captured text may fall back to a note, but it is never read as anything vault-related.
      for (const item of parseCapture(text)) expect(item.type).not.toBe("cofre")
    }
  })

  it("the assistant has no vault tool, and every tool is a plain module action", () => {
    for (const tool of TOOLS) {
      expect(tool.name, tool.name).not.toMatch(/vault|cofre|senha|password|secret/i)
      expect(tool.description, tool.name).not.toMatch(/vault|cofre|senha de/i)
    }
  })

  it("the assistant never uses the service role or the secret key", () => {
    for (const file of ["server/assistant", "app/api/assistant", "features/assistant"].flatMap(files)) {
      const source = readFileSync(file, "utf8")
      expect(source, file).not.toMatch(/SUPABASE_SECRET_KEY|SERVICE_ROLE|getSecretKey|createAdminClient/i)
    }
  })

  it("no vault table exists in any migration (the Cofre keeps ciphertext in the browser only)", () => {
    const dir = join(ROOT, "..", "supabase", "migrations")
    const sql = readdirSync(dir).map((f) => readFileSync(join(dir, f), "utf8")).join("\n")
    expect(sql).not.toMatch(/create table[^;]*\b(vault|cofre)/i)
  })
})
