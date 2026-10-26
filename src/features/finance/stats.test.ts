import { describe, expect, it } from "vitest"

import { accountBalance, billStatus, monthlySeries, spendByCategory, totals } from "./stats"
import type { AccountRow, CategoryRow, RecurringBillRow, TransactionRow } from "./types"

const stamp = { created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }

const account: AccountRow = { id: "a1", user_id: "u", name: "Conta", institution: "Banco", opening_balance_cents: 100_000, ...stamp }
const mercado: CategoryRow = { id: "c1", user_id: "u", name: "Mercado", monthly_limit_cents: 100_000, ...stamp }

function tx(overrides: Partial<TransactionRow>): TransactionRow {
  return {
    id: Math.random().toString(),
    user_id: "u",
    account_id: "a1",
    category_id: null,
    kind: "out",
    amount_cents: 1000,
    occurred_on: "2026-03-10",
    method: null,
    description: "x",
    source: "manual",
    ...stamp,
    ...overrides,
  }
}

const list = [
  tx({ kind: "in", amount_cents: 780_000, occurred_on: "2026-03-05" }),
  tx({ category_id: "c1", amount_cents: 45_000 }),
  tx({ category_id: "c1", amount_cents: 60_000, occurred_on: "2026-03-12" }),
  tx({ amount_cents: 20_000, occurred_on: "2026-02-20" }),
]

describe("totals / balance", () => {
  it("sums income, expense and surplus for one month", () => {
    expect(totals(list, "2026-03")).toEqual({ income: 780_000, expense: 105_000, surplus: 675_000 })
  })

  it("adds the opening balance to the movements", () => {
    expect(accountBalance(account, list)).toBe(100_000 + 780_000 - 105_000 - 20_000)
  })
})

describe("spendByCategory", () => {
  it("reports the ratio against the monthly limit", () => {
    const [row] = spendByCategory([mercado], list, "2026-03")
    expect(row.spent).toBe(105_000)
    expect(row.ratio).toBeCloseTo(1.05)
  })
})

describe("billStatus", () => {
  const bill: RecurringBillRow = {
    id: "b1",
    user_id: "u",
    name: "Internet",
    amount_cents: 11_990,
    due_day: 15,
    category_id: null,
    active: true,
    last_paid_month: null,
    ...stamp,
  }

  it("marks bills as upcoming, soon, overdue or paid", () => {
    expect(billStatus(bill, "2026-03-01").status).toBe("upcoming")
    expect(billStatus(bill, "2026-03-12").status).toBe("soon")
    expect(billStatus(bill, "2026-03-16").status).toBe("overdue")
    expect(billStatus({ ...bill, last_paid_month: "2026-03" }, "2026-03-16").status).toBe("paid")
    expect(billStatus(bill, "2026-03-12").daysLeft).toBe(3)
  })
})

describe("monthlySeries", () => {
  it("returns consecutive months ending at the given one", () => {
    const series = monthlySeries(list, "2026-03", 3)
    expect(series.map((s) => s.month)).toEqual(["2026-01", "2026-02", "2026-03"])
    expect(series[1].expense).toBe(20_000)
  })
})
