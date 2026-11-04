"use client"

import { createContext, useContext } from "react"

import type { GoalHistory } from "@/features/finance/goal-history"
import type { GoalIconKey } from "@/features/finance/goal-icons"
import type { AccountRow, CategoryRow, FinancialGoalRow, RecurringBillRow, TransactionKind, TransactionRow } from "@/features/finance/types"

export type FinanceInitial = { accounts: AccountRow[]; categories: CategoryRow[]; transactions: TransactionRow[]; bills: RecurringBillRow[]; goals: FinancialGoalRow[] }

export type TabId = "visao" | "lancamentos" | "fixas" | "metas"

export type Filters = { kind: "all" | TransactionKind; category: string; query: string }

/** Everything the four tabs share: the rows, the month on show, and the actions (each one that changes data offers Desfazer). */
export type Finance = {
  nowIso: string
  today: string
  /** "yyyy-MM" on show (the toolbar). */
  month: string
  isMobile: boolean
  accounts: AccountRow[]
  categories: CategoryRow[]
  transactions: TransactionRow[]
  bills: RecurringBillRow[]
  goals: FinancialGoalRow[]
  goalIcons: Record<string, GoalIconKey>
  goalHistory: GoalHistory
  filters: Filters
  setFilters: (next: Partial<Filters>) => void
  categoryName: (id: string | null) => string
  accountName: (id: string) => string
  goTab: (tab: TabId) => void
  // transactions
  saveTransaction: (row: TransactionRow) => void
  quickAdd: (text: string) => boolean
  removeTransaction: (row: TransactionRow) => void
  editTransaction: (row: TransactionRow) => void
  openNewTransaction: () => void
  // categories
  createCategory: (name: string) => string
  renameCategory: (id: string, name: string) => void
  deleteCategory: (id: string) => void
  categoryUsage: (id: string) => number
  // bills
  saveBill: (row: RecurringBillRow) => void
  payBill: (bill: RecurringBillRow) => void
  removeBill: (bill: RecurringBillRow) => void
  editBill: (bill: RecurringBillRow) => void
  openNewBill: () => void
  // goals
  /** Opens the "Guardar" dialog. */
  fundGoal: (goal: FinancialGoalRow) => void
  saveGoalFunds: (goal: FinancialGoalRow, cents: number) => void
  saveGoal: (row: FinancialGoalRow, icon: GoalIconKey) => void
  removeGoal: (goal: FinancialGoalRow) => void
  editGoal: (goal: FinancialGoalRow) => void
  openNewGoal: () => void
  // accounts and limits
  saveAccount: (row: AccountRow) => void
  saveLimits: (limits: Record<string, number | null>) => void
  openNewAccount: () => void
  /** Moving money between accounts is not built yet; the Transferir pill says so. */
  openTransfer: () => void
  openLimits: () => void
}

const FinanceContext = createContext<Finance | null>(null)
export const FinanceProvider = FinanceContext.Provider

export function useFinance(): Finance {
  const value = useContext(FinanceContext)
  if (!value) throw new Error("useFinance outside FinanceProvider")
  return value
}
