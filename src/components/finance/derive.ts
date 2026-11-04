import { billStatusIn, monthlyFixedTotal, shiftMonth, spendByCategory, totalBalance, totals, type BillView } from "@/features/finance/stats"

import type { Finance } from "./context"

/** Every derived number the bento screens share, computed once per render from the rows (nothing new is stored). */
export function derive(f: Finance) {
  const month = totals(f.transactions, f.month)
  const previous = totals(f.transactions, shiftMonth(f.month, -1))
  const balance = totalBalance(f.accounts, f.transactions)
  const categories = spendByCategory(f.categories, f.transactions, f.month)
  const budget = f.categories.reduce((sum, c) => sum + (c.monthly_limit_cents ?? 0), 0)
  const spentInBudget = categories.filter((c) => c.limit).reduce((sum, c) => sum + c.spent, 0)
  const views: BillView[] = f.bills
    .filter((b) => b.active)
    .map((b) => billStatusIn(b, f.month, f.today))
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
  const paid = views.filter((v) => v.status === "paid")
  const overdue = views.filter((v) => v.status === "overdue")
  const toPay = views.filter((v) => v.status === "soon" || v.status === "upcoming")
  const sum = (list: BillView[]) => list.reduce((s, v) => s + v.bill.amount_cents, 0)
  const watch = views.filter((v) => v.status === "soon" || v.status === "overdue")
  return {
    month,
    previous,
    balance,
    categories,
    budget,
    spentInBudget,
    budgetPct: budget === 0 ? 0 : (spentInBudget / budget) * 100,
    views,
    paid,
    overdue,
    toPay,
    watch,
    fixedTotal: monthlyFixedTotal(f.bills),
    paidTotal: sum(paid),
    overdueTotal: sum(overdue),
    toPayTotal: sum(toPay) + sum(overdue),
    unpaidCount: views.length - paid.length,
  }
}

export type Derived = ReturnType<typeof derive>

/** "+12% vs mês anterior" (or a count when there was nothing last month). */
export function variation(now: number, before: number): string | null {
  if (before <= 0) return null
  const pct = Math.round(((now - before) / before) * 100)
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct)}% vs mês anterior`
}
