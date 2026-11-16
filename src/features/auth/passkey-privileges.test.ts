import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8")

describe("passkey_credentials: who may change which column", () => {
  const sql = read("supabase/migrations/20261112000007_passkeys.sql")

  it("the migration grants the browser role UPDATE on device_label only", () => {
    expect(sql).toMatch(/revoke update on public\.passkey_credentials from public, anon, authenticated;/)
    const grants = [...sql.matchAll(/grant update \(([^)]*)\) on public\.passkey_credentials to authenticated;/g)].map((m) => m[1].trim())
    expect(grants).toEqual(["device_label"])
    expect(sql).not.toMatch(/grant update on public\.passkey_credentials/)
    expect(sql).not.toMatch(/passkey_credentials_update_own" on public\.passkey_credentials for update/)
  })

  it("the app never updates the protected columns with the person's own session", () => {
    const actions = read("src/features/auth/passkey-actions.ts")
    const updates = [...actions.matchAll(/\.update\(\{([^}]*)\}\)/g)].map((m) => m[1].split(":")[0].trim())
    expect(updates).toEqual(["device_label"])
  })

  it("counter, last_used_at and the new rows are written by the route with the secret client", () => {
    const route = read("src/app/api/passkey/[action]/route.ts")
    expect(route).toMatch(/const db = createSecretClient\(\)/)
    expect(route).toMatch(/db\.from\("passkey_credentials"\)\.update\(\{ counter:/)
    expect(route).toMatch(/db\.from\("passkey_credentials"\)\.insert\(/)
    expect(route).not.toMatch(/createClient\(\)[\s\S]{0,200}passkey_credentials/)
  })
})
