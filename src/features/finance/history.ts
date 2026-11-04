import type { AccountRow, TransactionRow } from "./types"

export type BalancePart = { id: string; name: string; value: number }
export type BalanceMonth = { month: string; total: number; parts: BalancePart[] }

const monthOf = (iso: string) => iso.slice(0, 7)

/** "yyyy-MM" shifted by `delta` months. */
function shift(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number)
  const index = y * 12 + (m - 1) + delta
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`
}

/**
 * Month-end balance of every account for the `count` months ending at `endMonth`, from what already exists: the opening balance plus
 * every lançamento up to the end of that month. An account that did not exist yet (created later and with no lançamentos before) counts
 * as 0. Months before the first account existed are left out, so a new user gets fewer rows (the caller says "Sem histórico suficiente
 * ainda" under two). Pass only the accounts in use: archived ones are not part of the total.
 */
export function balanceHistory(accounts: AccountRow[], transactions: TransactionRow[], endMonth: string, count = 6): BalanceMonth[] {
  const months = Array.from({ length: count }, (_, i) => shift(endMonth, i - (count - 1)))
  const rows = months.map((month) => {
    const parts = accounts.map((account) => {
      const mine = transactions.filter((t) => t.account_id === account.id && monthOf(t.occurred_on) <= month)
      const existed = monthOf(account.created_at) <= month || mine.length > 0
      const value = existed ? mine.reduce((sum, t) => sum + (t.kind === "in" ? t.amount_cents : -t.amount_cents), account.opening_balance_cents) : 0
      return { id: account.id, name: account.name, value, existed }
    })
    return { month, total: parts.reduce((sum, p) => sum + p.value, 0), parts, any: parts.some((p) => p.existed) }
  })
  return rows.filter((r) => r.any).map(({ month, total, parts }) => ({ month, total, parts: parts.map(({ id, name, value }) => ({ id, name, value })) }))
}
