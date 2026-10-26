// Mirrors the planned finance tables (docs/PLAN-PHASE-0.md §4.1). Money is always integer cents.
export type AccountRow = {
  id: string
  user_id: string
  name: string
  institution: string
  opening_balance_cents: number
  created_at: string
  updated_at: string
}

export type CategoryRow = {
  id: string
  user_id: string
  name: string
  monthly_limit_cents: number | null
  created_at: string
  updated_at: string
}

export type TransactionKind = "in" | "out"
export type TransactionSource = "manual" | "open_finance"

export type TransactionRow = {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  kind: TransactionKind
  amount_cents: number
  /** "yyyy-MM-dd" */
  occurred_on: string
  method: string | null
  description: string
  source: TransactionSource
  created_at: string
  updated_at: string
}

export type RecurringBillRow = {
  id: string
  user_id: string
  name: string
  amount_cents: number
  /** Day of the month, 1–28. */
  due_day: number
  category_id: string | null
  active: boolean
  /** "yyyy-MM" of the last month paid. */
  last_paid_month: string | null
  created_at: string
  updated_at: string
}

export type FinancialGoalRow = {
  id: string
  user_id: string
  name: string
  target_cents: number
  current_cents: number
  deadline: string | null
  created_at: string
  updated_at: string
}
