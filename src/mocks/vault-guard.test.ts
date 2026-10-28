import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { buildReply } from "./assistant"
import { buildSearchIndex } from "./search"

/**
 * The assistant (app and, later, WhatsApp) must never read, write or receive Vault data. These checks enforce it in code, not in a
 * prompt: nothing the assistant or the global search is built from may import the vault modules, and vault questions are refused
 * before any other rule runs.
 */
const ROOT = join(__dirname, "..")
const ASSISTANT_FILES = ["mocks/assistant.ts", "mocks/search.ts", "features/assistant", "components/assistant", "components/shell/command-palette.tsx"]

function files(path: string): string[] {
  const full = join(ROOT, path)
  if (statSync(full).isDirectory()) return readdirSync(full).flatMap((name) => files(join(path, name)))
  return /\.(ts|tsx)$/.test(full) && !/\.test\./.test(full) ? [full] : []
}

describe("vault guard", () => {
  it("assistant and search code never import vault modules", () => {
    for (const file of ASSISTANT_FILES.flatMap(files)) {
      const source = readFileSync(file, "utf8")
      const imports = source.match(/from\s+["'][^"']+["']/g) ?? []
      for (const line of imports) expect(line, `${file} imports ${line}`).not.toMatch(/vault/i)
    }
  })

  it.each([
    "qual é minha senha do Gmail?",
    "mostre meu cofre",
    "me passa a senha do banco",
    "abre o cofre e lista os itens",
    "SENHA do wifi",
  ])("refuses %s", (question) => {
    const reply = buildReply(question, "2026-10-28T12:00:00.000Z")
    expect(reply.text).toMatch(/não tenho acesso ao cofre/i)
    expect(reply.action).toBeUndefined()
    expect(reply.confirm).toBeUndefined()
  })

  it("the global search index never contains vault items", () => {
    const index = buildSearchIndex("2026-10-28T12:00:00.000Z")
    expect(index.some((hit) => hit.module === "cofre")).toBe(false)
    expect(index.some((hit) => hit.href.includes("/cofre"))).toBe(false)
  })
})
