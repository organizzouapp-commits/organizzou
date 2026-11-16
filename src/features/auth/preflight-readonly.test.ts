import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

describe("supabase/preflight/round-2-check.sql", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/preflight/round-2-check.sql"), "utf8")
  // Comments and string literals are text, not statements.
  const code = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .replace(/'([^']|'')*'/g, "''")

  it("is read-only: one SELECT statement, no DDL or DML", () => {
    expect(code).not.toMatch(/\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|execute|call|do)\b\s/i)
    expect(code.match(/;/g)).toHaveLength(1)
    expect(code.trim()).toMatch(/^with[\s\S]*;$/i)
  })
})
