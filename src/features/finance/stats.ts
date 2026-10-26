import { addMonths, format, parseISO } from "date-fns"

import type { AccountRow, CategoryRow, RecurringBillRow, TransactionRow } from "./types"

export function monthOf(day: string) {
  return day.slice(0, 7)
}

export function shiftMonth(month: string, offset: number) {
  return format(addMonths(parseISO(`${month}-01`), offset), "yyyy-MM")
}

export function totals(transactions: TransactionRow[], month: string) {
  let income = 0
  let expense = 0
  for (const t of transactions) {
    if (monthOf(t.occurred_on) !== month) continue
    if (t.kind === "in") income += t.amount_cents
    else expense += t.amount_cents
  }
  return { income, expense, surplus: income - expense }
}

export function accountBalance(account: AccountRow, transactions: TransactionRow[]) {
  return transactions
    .filter((t) => t.account_id === account.id)
    .reduce((sum, t) => sum + (t.kind === "in" ? t.amount_cents : -t.amount_cents), account.opening_balance_cents)
}

export function totalBalance(accounts: AccountRow[], transactions: TransactionRow[]) {
  return accounts.reduce((sum, account) => sum + accountBalance(account, transactions), 0)
}

export type CategorySpend = { category: CategoryRow; spent: number; limit: number | null; ratio: number | null }

/** Spending per category in a month, biggest first. `ratio` is spent/limit (can exceed 1). */
export function spendByCategory(categories: CategoryRow[], transactions: TransactionRow[], month: string): CategorySpend[] {
  return categories
    .map((category) => {
      const spent = transactions
        .filter((t) => t.kind === "out" && t.category_id === category.id && monthOf(t.occurred_on) === month)
        .reduce((sum, t) => sum + t.amount_cents, 0)
      const limit = category.monthly_limit_cents
      return { category, spent, limit, ratio: limit ? spent / limit : null }
    })
    .filter((row) => row.spent > 0 || row.limit)
    .sort((a, b) => b.spent - a.spent)
}

export type BillStatus = "paid" | "overdue" | "soon" | "upcoming"

export type BillView = { bill: RecurringBillRow; status: BillStatus; daysLeft: number; dueOn: string }

/** Where a recurring bill stands in the current month. */
export function billStatus(bill: RecurringBillRow, today: string): BillView {
  const month = monthOf(today)
  const dueOn = `${month}-${String(bill.due_day).padStart(2, "0")}`
  const daysLeft = Math.round((parseISO(dueOn).getTime() - parseISO(today).getTime()) / 86_400_000)
  let status: BillStatus = "upcoming"
  if (bill.last_paid_month === month) status = "paid"
  else if (daysLeft < 0) status = "overdue"
  else if (daysLeft <= 5) status = "soon"
  return { bill, status, daysLeft, dueOn }
}

export function monthlyFixedTotal(bills: RecurringBillRow[]) {
  return bills.filter((b) => b.active).reduce((sum, b) => sum + b.amount_cents, 0)
}

/** Last `count` months ending at `month`, each with income, expense and surplus. */
export function monthlySeries(transactions: TransactionRow[], month: string, count = 6) {
  return Array.from({ length: count }, (_, index) => {
    const key = shiftMonth(month, index - (count - 1))
    return { month: key, ...totals(transactions, key) }
  })
}
