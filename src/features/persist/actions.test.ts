import { beforeEach, describe, expect, it, vi } from "vitest"

// A stand-in for the database: records every upsert, and can behave like a database without the columns of a prepared migration.
const db = { applied: true, upserts: [] as Record<string, unknown>[][], failWith: null as null | { code: string; message: string } }

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "u1" } } }) },
    from: () => ({
      delete: () => ({ in: async () => ({ error: null }) }),
      upsert: async (rows: Record<string, unknown>[]) => {
        db.upserts.push(rows)
        if (db.failWith) return { error: db.failWith }
        const hasNew = rows.some((row) => "kind" in row || "start_date" in row || "installment_total" in row)
        if (!db.applied && hasNew) return { error: { code: "PGRST204", message: "Could not find the 'kind' column of 'life_goals' in the schema cache" } }
        return { error: null }
      },
    }),
  }),
}))

import { persistRows } from "./actions"

const ID = "7b9f1c2e-1111-4222-8333-444455556666"
const goal = { id: ID, title: "Correr", description: null, deadline: null, status: "active" as const }
const linked = { ...goal, kind: "linked" as const, link_type: "workout_count", link_id: null, params: { kind: "workout_count", period: "week", count: 3 }, start_date: "2026-11-02", end_date: null }

beforeEach(() => {
  db.applied = true
  db.upserts = []
  db.failWith = null
})

describe("persistRows and prepared migrations", () => {
  it("migration applied: the link columns are saved in the database", async () => {
    const result = await persistRows({ table: "life_goals", upserts: [linked], deletes: [] })
    expect(result).toEqual({ ok: true })
    expect(db.upserts).toHaveLength(1)
    expect(db.upserts[0][0]).toMatchObject({ kind: "linked", link_type: "workout_count", start_date: "2026-11-02", user_id: "u1" })
  })

  it("migration NOT applied: saves again without the new columns and reports it, so the device keeps the link", async () => {
    db.applied = false
    const result = await persistRows({ table: "life_goals", upserts: [linked], deletes: [] })
    expect(result).toEqual({ ok: true, degraded: true })
    expect(db.upserts).toHaveLength(2)
    expect(db.upserts[1][0]).not.toHaveProperty("kind")
    expect(db.upserts[1][0]).not.toHaveProperty("params")
    expect(db.upserts[1][0]).toMatchObject({ id: ID, title: "Correr", user_id: "u1" })
  })

  it("a goal without the new fields saves normally either way", async () => {
    db.applied = false
    expect(await persistRows({ table: "life_goals", upserts: [goal], deletes: [] })).toEqual({ ok: true })
    expect(db.upserts).toHaveLength(1)
  })

  it("other new columns of prepared migrations are accepted and degrade the same way (goal start, installments)", async () => {
    db.applied = false
    const bill = { id: ID, name: "Sofá", amount_cents: 10000, due_day: 5, category_id: null, active: true, last_paid_month: null, installment_total: 10, installment_first_month: "2026-11", installment_first_day: 5, installment_paid: [], installment_skipped: [], installment_amounts: {}, series_id: null }
    expect(await persistRows({ table: "finance_bills", upserts: [bill], deletes: [] })).toEqual({ ok: true, degraded: true })
    const finance = { id: ID, name: "Viagem", target_cents: 100000, current_cents: 0, deadline: "2027-01-01", start_date: "2026-11-01", opening_cents: 0 }
    expect(await persistRows({ table: "finance_goals", upserts: [finance], deletes: [] })).toEqual({ ok: true, degraded: true })
  })

  it("a real error is not hidden by the retry and never shows raw database text", async () => {
    db.failWith = { code: "XX000", message: "internal detail" }
    expect(await persistRows({ table: "life_goals", upserts: [linked], deletes: [] })).toEqual({ ok: false, error: "Não foi possível salvar." })
    expect(db.upserts).toHaveLength(1)
  })

  it("rejects unknown values for the new columns", async () => {
    const result = await persistRows({ table: "life_goals", upserts: [{ ...linked, kind: "other" }], deletes: [] })
    expect(result.ok).toBe(false)
    expect(db.upserts).toHaveLength(0)
  })
})
