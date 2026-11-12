"use client"

import { createContext, useContext } from "react"

import type { GoalHistory } from "@/features/finance/goal-history"
import type { BillMetaMap, InstallmentMeta, Scope } from "@/features/finance/installments"
import type { AccountMeta } from "@/features/finance/account-meta"
import type { GoalIconKey } from "@/features/finance/goal-icons"
import type { AccountRow, CategoryRow, FinancialGoalRow, RecurringBillRow, TransactionKind, TransactionRow } from "@/features/finance/types"

export type FinanceInitial = { accounts: AccountRow[]; categories: CategoryRow[]; transactions: TransactionRow[]; bills: RecurringBillRow[]; goals: FinancialGoalRow[] }

export type TabId = "visao" | "lancamentos" | "fixas" | "metas"

export type TxSort = "date-desc" | "date-asc" | "amount-desc" | "amount-asc"

export type Filters = { kind: "all" | TransactionKind; category: string; query: string; sort: TxSort }

/** Everything the four tabs share: the rows, the month on show, and the actions (each one that changes data offers Desfazer). */
export type Finance = {
  nowIso: string
  today: string
  /** "yyyy-MM" on show (the toolbar). */
  month: string
  isMobile: boolean
  /** The accounts in use, in the order the person chose: archived ones are left out (pickers, totals, wallets). */
  accounts: AccountRow[]
  /** Every account, archived included (names of old lançamentos, the manager). */
  allAccounts: AccountRow[]
  accountMeta: Record<string, AccountMeta>
  /** Account ids in the order the person chose (empty = creation order). */
  accountOrder: string[]
  categories: CategoryRow[]
  transactions: TransactionRow[]
  bills: RecurringBillRow[]
  goals: FinancialGoalRow[]
  goalIcons: Record<string, GoalIconKey>
  goalHistory: GoalHistory
  /** Goal ids in the chosen order (empty = nearest deadline first); the first goal in progress is the featured one. */
  goalOrder: string[]
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
  /** `series` makes it an installment bill (Parcelada). */
  saveBill: (row: RecurringBillRow, series?: InstallmentMeta) => void
  /** The installment series of each bill, by bill id (a bill without an entry repeats monthly with no end). */
  billMeta: BillMetaMap
  /** Edits one installment's amount for this month only, from this month on, or the whole series; name and category apply to the series. */
  saveInstallmentEdit: (bill: RecurringBillRow, patch: { name: string; category_id: string | null; cents: number }, scope: Scope) => void
  payBill: (bill: RecurringBillRow) => void
  /** Asks to reopen a paid bill (a confirmation first; the payment is reversed and Desfazer is offered). */
  reopenBill: (bill: RecurringBillRow) => void
  removeBill: (bill: RecurringBillRow, scope?: Scope) => void
  editBill: (bill: RecurringBillRow) => void
  openNewBill: () => void
  // goals
  /** Opens the "Guardar" dialog. */
  fundGoal: (goal: FinancialGoalRow) => void
  saveGoalFunds: (goal: FinancialGoalRow, cents: number) => void
  saveGoal: (row: FinancialGoalRow, icon: GoalIconKey) => void
  removeGoal: (goal: FinancialGoalRow) => void
  editGoal: (goal: FinancialGoalRow) => void
  /** Saves the order of the goals in progress (the first becomes the featured one). */
  setGoalOrder: (ids: string[]) => void
  featureGoal: (goal: FinancialGoalRow, currentOrder: string[]) => void
  openNewGoal: () => void
  // accounts and limits
  /** Creates or updates an account together with its kind, icon, color and archived flag. */
  saveAccount: (row: AccountRow, meta: AccountMeta) => void
  renameAccount: (row: AccountRow, name: string) => void
  setAccountArchived: (row: AccountRow, archived: boolean) => void
  reorderAccounts: (ids: string[]) => void
  accountTxCount: (id: string) => number
  /** Deletes an account: with no lançamentos, moving them to `to`, or taking them along (`cascade`). Offers Desfazer. */
  deleteAccount: (row: AccountRow, how: { kind: "plain" } | { kind: "move"; to: string } | { kind: "cascade" }) => void
  editAccount: (row: AccountRow) => void
  askDeleteAccount: (row: AccountRow) => void
  openAccountManager: () => void
  saveLimits: (limits: Record<string, number | null>) => void
  openNewAccount: () => void
  openLimits: () => void
}

const FinanceContext = createContext<Finance | null>(null)
export const FinanceProvider = FinanceContext.Provider

export function useFinance(): Finance {
  const value = useContext(FinanceContext)
  if (!value) throw new Error("useFinance outside FinanceProvider")
  return value
}
