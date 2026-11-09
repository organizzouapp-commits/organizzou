import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * The Cofre is client-side only and the assistant must never reach it. These checks read the source tree: they fail when a vault module is
 * imported by server or assistant code, when vault code starts talking to the network, logging, or sending anything to analytics, and when
 * a secret could land in storage other than the encrypted IndexedDB store.
 */
const SRC = join(__dirname, "..", "..")

function files(path: string, pattern = /\.(ts|tsx)$/): string[] {
  const full = join(SRC, path)
  if (!statSync(full, { throwIfNoEntry: false })) return []
  if (statSync(full).isDirectory()) return readdirSync(full).flatMap((name) => files(join(path, name), pattern))
  return pattern.test(full) && !/\.test\./.test(full) ? [full] : []
}
const rel = (file: string) => relative(SRC, file).split("\\").join("/")
/** The source without comments, so a sentence in a comment never trips a code check. */
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")
const importsOf = (source: string) => [...source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((m) => m[1])

const VAULT_CODE = [...files("features/vault"), ...files("components/vault")]
const isVaultImport = (path: string) => /(^|\/)(features|components)\/vault(\/|$)/.test(path) || /^\.\.?\/.*vault/.test(path)

describe("vault code stays out of the assistant and the server", () => {
  it("no assistant, search, API, server or server-action code imports a vault module", () => {
    const guarded = [
      ...files("features/assistant"),
      ...files("features/search"),
      ...files("components/assistant"),
      ...files("server"),
      ...files("app/api"),
      ...files("features").filter((f) => /actions\.ts$/.test(f)),
      ...files("lib/admin"),
    ]
    expect(guarded.length).toBeGreaterThan(5)
    for (const file of guarded) for (const path of importsOf(readFileSync(file, "utf8"))) expect(isVaultImport(path), `${rel(file)} imports ${path}`).toBe(false)
  })

  it("only the Cofre page and the sign-out dialog (which locks it) import vault code outside the vault folders", () => {
    const outside = files("").filter((f) => !/^(features|components)\/vault\//.test(rel(f)))
    const importers = outside.filter((f) => importsOf(readFileSync(f, "utf8")).some(isVaultImport)).map(rel).sort()
    expect(importers).toEqual(["app/(app)/dashboard/cofre/page.tsx", "components/shell/sign-out-dialog.tsx"])
  })

  it("the assistant context and tools carry no vault field names", () => {
    for (const file of [...files("server/assistant"), ...files("features/assistant")]) {
      const source = readFileSync(file, "utf8")
      expect(source, rel(file)).not.toMatch(/\b(vault_items|VaultItem|masterPassword|master_password|cvv)\b/)
    }
  })

  it("the Cofre page passes only the account id to the screen", () => {
    const page = readFileSync(join(SRC, "app", "(app)", "dashboard", "cofre", "page.tsx"), "utf8")
    expect(page).toMatch(/<CofreScreen userId=\{userId\} \/>/)
    expect(importsOf(page).filter(isVaultImport)).toEqual(["@/components/vault/cofre-screen"])
  })
})

describe("vault code is client-side only", () => {
  it("has no server directive, no server-only imports and no route handlers", () => {
    expect(VAULT_CODE.length).toBeGreaterThan(10)
    for (const file of VAULT_CODE) {
      const source = readFileSync(file, "utf8")
      expect(source, rel(file)).not.toMatch(/["']use server["']/)
      for (const path of importsOf(source)) {
        expect(path, `${rel(file)} imports ${path}`).not.toMatch(/^(server-only|next\/headers|next\/server)$|^@\/server|^@\/lib\/supabase\/(server|admin|session|proxy)|^@\/lib\/admin|features\/persist|^@\/features\/.*actions/)
      }
    }
    expect(files("app/api").filter((f) => /vault|cofre/i.test(rel(f)))).toEqual([])
  })

  it("never makes a network request, logs, or reports to analytics", () => {
    for (const file of VAULT_CODE) {
      const source = code(readFileSync(file, "utf8"))
      expect(source, `${rel(file)} talks to the network`).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/)
      expect(source, `${rel(file)} logs`).not.toMatch(/console\.(log|info|warn|error|debug|trace)/)
      expect(source, `${rel(file)} reports`).not.toMatch(/posthog|sentry|analytics|gtag|va\.track|@vercel\/analytics|captureException/i)
      expect(source, `${rel(file)} puts something in the URL`).not.toMatch(/router\.(push|replace)|location\.(href|search|hash)\s*=|history\.(push|replace)State/)
    }
  })

  it("the only place with the browser's session is the auth listener that locks the vault", () => {
    const withSupabase = VAULT_CODE.filter((f) => /supabase/.test(readFileSync(f, "utf8"))).map(rel)
    expect(withSupabase).toEqual(["features/vault/session.ts"])
  })

  it("keys and secrets are never written to web storage: only the auto-lock choice is", () => {
    const withStorage = VAULT_CODE.filter((f) => /localStorage|sessionStorage|document\.cookie/.test(readFileSync(f, "utf8"))).map(rel)
    expect(withStorage).toEqual(["features/vault/session.ts"])
    const session = readFileSync(join(SRC, "features", "vault", "session.ts"), "utf8")
    expect([...session.matchAll(/localStorage\.setItem\(([^,]+),/g)].map((m) => m[1].trim())).toEqual(["SETTINGS_KEY"])
    expect(session).toMatch(/JSON\.stringify\(\{ autoLock: value \}\)/)
    expect(session).not.toMatch(/sessionStorage|document\.cookie/)
  })

  it("the browser-only modules are marked as client code", () => {
    for (const file of files("components/vault", /\.tsx$/)) expect(readFileSync(file, "utf8").trimStart().startsWith('"use client"'), `${rel(file)} needs "use client"`).toBe(true)
    expect(readFileSync(join(SRC, "features", "vault", "session.ts"), "utf8")).toMatch(/import "client-only"/)
  })

  it("sensitive inputs ask the browser not to remember or autofill them", () => {
    for (const file of files("components/vault")) {
      const source = readFileSync(file, "utf8")
      expect(source, `${rel(file)} lets the browser remember a password`).not.toMatch(/autoComplete=["'](current-password|username|email|on)["']/)
    }
    const kit = readFileSync(join(SRC, "components", "vault", "vault-kit.tsx"), "utf8")
    expect(kit).toMatch(/autoComplete=\{autoComplete\}/)
    expect(kit).toMatch(/autoComplete = "off"/)
  })
})
