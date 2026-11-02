import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { TABLES } from "@/features/persist/registry"

/**
 * No database needed: reads every migration and checks, for each table in `public` that has a `user_id` column, that row level
 * security is switched on and that its policies only ever compare with the signed-in person (`auth.uid()`). The behavior itself
 * (a second user really cannot read, change or delete the first user's rows) is proven by supabase/tests/rls_and_provisioning.sql.
 */
const dir = join(process.cwd(), "supabase", "migrations")
const sql = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(dir, f), "utf8"))
  .join("\n")

/** Tables created in `public` with a user_id column. */
const withUserId = [...sql.matchAll(/create table (?:if not exists )?public\.(\w+)\s*\(([\s\S]*?)\n\);/g)].filter((m) => /\buser_id\b/.test(m[2])).map((m) => m[1])

/** Tables the migrations enable RLS on: explicit `alter table`, or the loops that enable it for a list of names. */
const rlsOn = new Set<string>([...sql.matchAll(/alter table public\.(\w+) enable row level security/g)].map((m) => m[1]))
for (const loop of sql.matchAll(/foreach t in array array\[([\s\S]*?)\] loop([\s\S]*?)end loop;/g)) {
  if (/enable row level security/.test(loop[2])) for (const name of loop[1].matchAll(/'(\w+)'/g)) rlsOn.add(name[1])
}

describe("row level security", () => {
  it("finds the tables (the parser is not silently matching nothing)", () => {
    expect(withUserId.length).toBeGreaterThan(40)
    expect(withUserId).toEqual(expect.arrayContaining(["tasks", "habits", "finance_transactions", "notes", "journal_entries"]))
  })

  it("every table with a user_id column has RLS enabled", () => {
    const missing = withUserId.filter((table) => !rlsOn.has(table))
    expect(missing).toEqual([])
  })

  it("every policy is scoped to the signed-in user, never open to everyone", () => {
    const policies = [...sql.matchAll(/create policy[\s\S]*?;/g)].map((m) => m[0])
    const open = policies.filter((p) => /using \(\s*true\s*\)|with check \(\s*true\s*\)/i.test(p))
    expect(open).toEqual([])
    // The generated policies (format strings in the loops) all compare with auth.uid().
    const generated = [...sql.matchAll(/format\('create policy %I on public\.%I[^']*'/g)].map((m) => m[0])
    expect(generated.length).toBeGreaterThan(0)
    for (const policy of generated) expect(policy).toMatch(/auth\.uid\(\)|user_id is null or user_id/)
  })

  it("the shared catalogs are read-only for people: only rows with user_id null are readable besides their own", () => {
    expect(sql).toMatch(/foods_select_catalog_or_own|%I on public\.%I for select to authenticated using \(user_id is null or user_id = \(select auth\.uid\(\)\)\)/)
    // No insert policy lets a person create a catalog row (user_id null).
    expect(sql).not.toMatch(/on public\.(foods|exercises)[^;]*for insert[^;]*with check \(user_id is null/)
  })

  it("every table the screens save to exists in a migration, so a save can never target a missing table", () => {
    const created = new Set([...sql.matchAll(/create table (?:if not exists )?public\.(\w+)/g)].map((m) => m[1]))
    const missing = Object.keys(TABLES).filter((table) => !created.has(table))
    expect(missing).toEqual([])
  })

  it("the save registry only lists columns that exist on the table", () => {
    for (const [table, config] of Object.entries(TABLES)) {
      const block = sql.match(new RegExp(`create table (?:if not exists )?public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`))?.[1] ?? ""
      for (const column of Object.keys(config.columns)) expect(block, `${table}.${column}`).toMatch(new RegExp(`^\\s*${column}\\s`, "m"))
    }
  })
})
