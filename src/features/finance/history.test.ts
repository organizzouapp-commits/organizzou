import { describe, expect, it } from "vitest"

import { balanceHistory } from "./history"
import type { AccountRow, TransactionRow } from "./types"

const account = (id: string, opening: number, created: string): AccountRow => ({ id, user_id: "u", name: id, institution: id, opening_balance_cents: opening, created_at: `${created}-01T00:00:00Z`, updated_at: `${created}-01T00:00:00Z` })
const tx = (account_id: string, kind: "in" | "out", cents: number, day: string): TransactionRow => ({ id: `${account_id}-${day}-${cents}`, user_id: "u", account_id, category_id: null, kind, amount_cents: cents, occurred_on: day, method: null, description: "x", source: "manual", created_at: "", updated_at: "" })

describe("balanceHistory", () => {
  const a = account("a", 1000, "2026-06")
  const b = account("b", 0, "2026-09")
  const rows = [tx("a", "in", 500, "2026-07-10"), tx("a", "out", 200, "2026-09-02"), tx("b", "in", 4000, "2026-10-05"), tx("a", "out", 3000, "2026-11-01")]

  it("is opening plus lançamentos up to the end of each month", () => {
    const h = balanceHistory([a, b], rows, "2026-11", 6)
    expect(h.map((m) => m.month)).toEqual(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"])
    expect(h.map((m) => m.parts[0].value)).toEqual([1000, 1500, 1500, 1300, 1300, -1700])
    expect(h.map((m) => m.parts[1].value)).toEqual([0, 0, 0, 0, 4000, 4000])
    expect(h.map((m) => m.total)).toEqual([1000, 1500, 1500, 1300, 5300, 2300])
  })

  it("keeps a negative account negative and its total consistent", () => {
    const last = balanceHistory([a, b], rows, "2026-11").at(-1)!
    expect(last.parts.find((p) => p.id === "a")!.value).toBeLessThan(0)
    expect(last.parts.reduce((s, p) => s + p.value, 0)).toBe(last.total)
  })

  it("leaves out the months before the first account existed", () => {
    const h = balanceHistory([account("n", 500, "2026-11")], [], "2026-11", 6)
    expect(h).toHaveLength(1)
    expect(h[0].total).toBe(500)
  })

  it("drops archived accounts when the caller does not pass them", () => {
    expect(balanceHistory([a], rows, "2026-11").at(-1)!.parts).toHaveLength(1)
  })
})
