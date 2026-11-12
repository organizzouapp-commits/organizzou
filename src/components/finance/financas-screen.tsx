"use client"

import { useCallback, useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowLeftRightIcon, LayoutGridIcon, RepeatIcon, SearchIcon, SlidersHorizontalIcon, TargetIcon } from "lucide-react"
import { toast } from "sonner"

import { LabelColorsProvider, useLabelColorsStore } from "@/components/tasks/label-colors-context"
import { PillTabs } from "@/components/tasks/pill-tabs"
import { ViewTabs, type ViewTab } from "@/components/tasks/view-tabs"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useIsMobile } from "@/hooks/use-mobile"
import { GOAL_ICON_KEYS, localGoalIconRepo, type GoalIconKey } from "@/features/finance/goal-icons"
import { localGoalHistoryRepo, type GoalHistory } from "@/features/finance/goal-history"
import { localAccountMetaRepo, orderAccounts, type AccountLayout, type AccountMeta } from "@/features/finance/account-meta"
import { featureFirst, localGoalLayoutRepo } from "@/features/finance/goal-layout"
import { findBillPayment, monthOf, reopenedLastPaid, shiftMonth } from "@/features/finance/stats"
import { installmentLabel, installmentView, localBillMetaRepo, removeInstallments, setInstallmentAmount, setInstallmentPaid, type BillMetaMap, type InstallmentMeta, type Scope } from "@/features/finance/installments"
import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import type { AccountRow, CategoryRow, FinancialGoalRow, RecurringBillRow, TransactionRow } from "@/features/finance/types"
import { usePersistedRows } from "@/features/persist/use-persisted-rows"
import type { TableName } from "@/features/persist/registry"
import { guessCategory } from "@/server/assistant/parse"
import { formatBRL, parseBRL } from "@/lib/money"
import { dayOf, newId } from "@/lib/sp-time"
import { cn } from "@/lib/utils"

import { BillsTab } from "./bills"
import { FinanceProvider, type Filters, type Finance, type FinanceInitial, type TabId } from "./context"
import { AccountManager, DeleteAccountDialog } from "./accounts"
import { AccountDialog, BillDialog, FundDialog, GoalDialog, LimitsDialog, ScopeSheet, TransactionDialog } from "./dialogs"
import { GoalsDesktop, GoalsMobile } from "./goals"
import { OverviewDesktop, OverviewMobile } from "./overview"
import { MonthToolbar } from "./parts"
import { FiltersSheet, TransactionsFilterRow, TransactionsMain, TransactionsSide, TransactionsTop } from "./transactions"

export type { FinanceInitial } from "./context"

const USER = "00000000-0000-4000-8000-000000000001"

const MOBILE_TABS: ViewTab<TabId>[] = [
  { id: "visao", label: "Geral", icon: LayoutGridIcon },
  { id: "lancamentos", label: "Lançamentos", icon: ArrowLeftRightIcon },
  { id: "fixas", label: "Fixas", icon: RepeatIcon },
  { id: "metas", label: "Metas", icon: TargetIcon },
]

const TABS: { id: TabId; label: string; short: string }[] = [
  { id: "visao", label: "Visão geral", short: "Geral" },
  { id: "lancamentos", label: "Lançamentos", short: "Lançamentos" },
  { id: "fixas", label: "Contas fixas", short: "Fixas" },
  { id: "metas", label: "Metas", short: "Metas" },
]

/** `usePersistedRows`, or plain state when `memory` is on (the dev fixture has no session to save with). */
function useRows<T extends { id: string }>(table: TableName, initial: T[], memory: boolean) {
  const saved = usePersistedRows<T>(table, initial)
  const local = useState<T[]>(initial)
  return memory ? local : saved
}

const byDayDesc = (a: TransactionRow, b: TransactionRow) => b.occurred_on.localeCompare(a.occurred_on)

/** Every change that can be undone says so with a visible "Desfazer" (8 s). */
function undoable(message: string, undo: () => void) {
  toast(message, { duration: 8000, action: { label: "Desfazer", onClick: undo } })
}

export function FinancasScreen({ nowIso, initial, memory = false }: { nowIso: string; initial: FinanceInitial; /** Keep every row in memory instead of saving it (the dev fixture). */ memory?: boolean }) {
  const labelColors = useLabelColorsStore()
  return (
    <LabelColorsProvider value={labelColors}>
      <FinanceBody nowIso={nowIso} initial={initial} memory={memory} />
    </LabelColorsProvider>
  )
}

function FinanceBody({ nowIso, initial, memory }: { nowIso: string; initial: FinanceInitial; memory: boolean }) {
  const isMobile = useIsMobile()
  const today = dayOf(nowIso)
  const [tab, setTab] = useState<TabId>("visao")
  const [month, setMonth] = useState(monthOf(today))
  const [filters, setFiltersState] = useState<Filters>({ kind: "all", category: "all", query: "", sort: "date-desc" })
  const [allAccounts, setAccounts] = useRows<AccountRow>("finance_accounts", initial.accounts, memory)
  const [accountLayout, setAccountLayout] = useState<AccountLayout>({ meta: {}, order: [] })
  const [categories, setCategories] = useRows<CategoryRow>("finance_categories", initial.categories, memory)
  const [transactions, setTransactions] = useRows<TransactionRow>("finance_transactions", initial.transactions, memory)
  const [bills, setBills] = useRows<RecurringBillRow>("finance_bills", initial.bills, memory)
  const [goals, setGoals] = useRows<FinancialGoalRow>("finance_goals", initial.goals, memory)
  const [goalIcons, setGoalIcons] = useState<Record<string, GoalIconKey>>({})
  const [goalHistory, setGoalHistory] = useState<GoalHistory>({})
  const [goalOrder, setGoalOrderState] = useState<string[]>([])
  const [txDialog, setTxDialog] = useState<{ row: TransactionRow | null } | null>(null)
  const [billDialog, setBillDialog] = useState<{ row: RecurringBillRow | null } | null>(null)
  const [reopening, setReopening] = useState<RecurringBillRow | null>(null)
  const [billMeta, setBillMeta] = useState<BillMetaMap>({})
  const [seriesAsk, setSeriesAsk] = useState<RecurringBillRow | null>(null)
  const [goalDialog, setGoalDialog] = useState<{ row: FinancialGoalRow | null } | null>(null)
  const [fundGoal, setFundGoal] = useState<FinancialGoalRow | null>(null)
  const [accountDialog, setAccountDialog] = useState<{ row: AccountRow | null } | null>(null)
  const [managerOpen, setManagerOpen] = useState(false)
  const [deleteAccountTarget, setDeleteAccountTarget] = useState<AccountRow | null>(null)
  const [limitsOpen, setLimitsOpen] = useState(false)
  const [filterSheet, setFilterSheet] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    // localStorage only exists in the browser; read after mount so server and client render the same.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGoalIcons(localGoalIconRepo.load())
    setGoalHistory(localGoalHistoryRepo.load())
    setGoalOrderState(localGoalLayoutRepo.load())
    setAccountLayout(localAccountMetaRepo.load())
    setBillMeta(localBillMetaRepo.load())
  }, [])

  const setFilters = useCallback((next: Partial<Filters>) => setFiltersState((current) => ({ ...current, ...next })), [])
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Sem categoria"
  const accounts = orderAccounts(allAccounts, accountLayout.order).filter((a) => !accountLayout.meta[a.id]?.archived)
  const accountName = (id: string) => allAccounts.find((a) => a.id === id)?.name ?? ""

  // ---------------------------------------------------------- transactions
  function saveTransaction(row: TransactionRow) {
    const exists = transactions.some((t) => t.id === row.id)
    setTransactions((current) => (exists ? current.map((t) => (t.id === row.id ? row : t)) : [row, ...current]).sort(byDayDesc))
    if (exists) toast("Lançamento atualizado.")
    else undoable(row.kind === "out" ? "Gasto registrado." : "Entrada registrada.", () => setTransactions((current) => current.filter((t) => t.id !== row.id)))
  }

  /** "mercado 45,90" is a saída; "+ salário 5000" is an entrada. Returns false when it cannot be read. */
  function quickAdd(text: string) {
    const income = text.trim().startsWith("+")
    const match = text.replace(/^\+/, "").trim().match(/^(.*?)\s*(?:R\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*$/)
    const cents = match ? parseBRL(match[2]) : null
    const description = match?.[1].trim()
    if (!cents || !description) return false
    if (!accounts[0]) {
      toast.error("Crie uma conta antes de registrar lançamentos.")
      return false
    }
    const name = income ? "Salário" : guessCategory(description)
    saveTransaction({
      id: newId(),
      user_id: USER,
      account_id: accounts[0].id,
      category_id: categories.find((c) => c.name === name)?.id ?? categories[0]?.id ?? null,
      kind: income ? "in" : "out",
      amount_cents: cents,
      occurred_on: today,
      method: null,
      description: description.charAt(0).toUpperCase() + description.slice(1),
      source: "manual",
      created_at: nowIso,
      updated_at: nowIso,
    })
    return true
  }

  function removeTransaction(row: TransactionRow) {
    setTransactions((current) => current.filter((t) => t.id !== row.id))
    undoable("Lançamento excluído.", () => setTransactions((current) => [row, ...current].sort(byDayDesc)))
  }

  // ------------------------------------------------------------ categories
  function createCategory(name: string) {
    const id = newId()
    setCategories((current) => [...current, { id, user_id: USER, name, monthly_limit_cents: null, created_at: nowIso, updated_at: nowIso }])
    return id
  }
  const renameCategory = (id: string, name: string) => setCategories((current) => current.map((c) => (c.id === id ? { ...c, name: name.trim() || c.name } : c)))
  function deleteCategory(id: string) {
    // The rows that used it come first, so nothing points at a category that is gone.
    setTransactions((current) => (current.some((t) => t.category_id === id) ? current.map((t) => (t.category_id === id ? { ...t, category_id: null } : t)) : current))
    setBills((current) => (current.some((b) => b.category_id === id) ? current.map((b) => (b.category_id === id ? { ...b, category_id: null } : b)) : current))
    setCategories((current) => current.filter((c) => c.id !== id))
    setFilters({ category: filters.category === id ? "all" : filters.category })
  }
  const categoryUsage = (id: string) => transactions.filter((t) => t.category_id === id).length

  // ----------------------------------------------------------------- bills
  // The installment series (Parcelada) of each bill: kept on this device until the installment columns exist (see installments.ts).
  function changeBillMeta(update: (map: BillMetaMap) => BillMetaMap) {
    setBillMeta((current) => {
      const next = update(current)
      localBillMetaRepo.save(next)
      return next
    })
  }

  function saveBill(row: RecurringBillRow, series?: InstallmentMeta) {
    const exists = bills.some((b) => b.id === row.id)
    setBills((current) => (exists ? current.map((b) => (b.id === row.id ? row : b)) : [...current, row]))
    if (series) changeBillMeta((map) => ({ ...map, [row.id]: series }))
    if (exists) toast("Conta fixa atualizada.")
    else
      undoable(series ? "Conta parcelada criada." : "Conta fixa criada.", () => {
        setBills((current) => current.filter((b) => b.id !== row.id))
        if (series) changeBillMeta((map) => Object.fromEntries(Object.entries(map).filter(([id]) => id !== row.id)))
      })
  }

  /** Editing one installment's amount: only this one, this and the next ones, or the whole series. Name and category belong to the series. */
  function saveInstallmentEdit(bill: RecurringBillRow, patch: { name: string; category_id: string | null; cents: number }, scope: Scope) {
    const series = billMeta[bill.id]
    if (!series) return
    const result = setInstallmentAmount(series, month, scope, patch.cents)
    const before = { bill, series }
    setBills((current) => current.map((b) => (b.id === bill.id ? { ...b, name: patch.name, category_id: patch.category_id, amount_cents: result.billCents ?? b.amount_cents, updated_at: new Date().toISOString() } : b)))
    changeBillMeta((map) => ({ ...map, [bill.id]: result.meta }))
    undoable("Parcela atualizada.", () => {
      setBills((current) => current.map((b) => (b.id === bill.id ? before.bill : b)))
      changeBillMeta((map) => ({ ...map, [bill.id]: before.series }))
    })
  }

  function payBill(bill: RecurringBillRow) {
    if (!accounts[0]) {
      toast.error("Crie uma conta antes de pagar uma conta.")
      return
    }
    const series = billMeta[bill.id]
    const view = series ? installmentView(bill, series, month, today) : null
    const amount = view?.bill.amount_cents ?? bill.amount_cents
    const description = view ? `${bill.name} (${installmentLabel(view.installment.index, view.installment.total).toLowerCase()})` : bill.name
    const previous = bill.last_paid_month
    const txId = newId()
    if (series) changeBillMeta((map) => ({ ...map, [bill.id]: setInstallmentPaid(series, month, true) }))
    else setBills((current) => current.map((b) => (b.id === bill.id ? { ...b, last_paid_month: month } : b)))
    setTransactions((current) =>
      [
        {
          id: txId,
          user_id: USER,
          account_id: accounts[0].id,
          category_id: bill.category_id,
          kind: "out" as const,
          amount_cents: amount,
          occurred_on: today,
          method: "Pix",
          description,
          source: "manual" as const,
          created_at: nowIso,
          updated_at: nowIso,
        },
        ...current,
      ].sort(byDayDesc)
    )
    undoable(`${bill.name} paga.`, () => {
      if (series) changeBillMeta((map) => ({ ...map, [bill.id]: series }))
      else setBills((current) => current.map((b) => (b.id === bill.id ? { ...b, last_paid_month: previous } : b)))
      setTransactions((current) => current.filter((t) => t.id !== txId))
    })
  }

  /** Reverts this month's payment: the bill goes back to unpaid (or overdue) and its lançamento is removed, so balances and totals follow. */
  function reopenBill(bill: RecurringBillRow) {
    const series = billMeta[bill.id]
    const view = series ? installmentView(bill, series, month, today) : null
    const found = { ...bill, amount_cents: view?.bill.amount_cents ?? bill.amount_cents, name: view ? `${bill.name} (${installmentLabel(view.installment.index, view.installment.total).toLowerCase()})` : bill.name }
    const payment = findBillPayment(transactions, found, monthOf(today)) ?? findBillPayment(transactions, found, month)
    const previous = bill.last_paid_month
    if (series) changeBillMeta((map) => ({ ...map, [bill.id]: setInstallmentPaid(series, month, false) }))
    else setBills((current) => current.map((b) => (b.id === bill.id ? { ...b, last_paid_month: reopenedLastPaid(month) } : b)))
    if (payment) setTransactions((current) => current.filter((t) => t.id !== payment.id))
    undoable(`${bill.name} reaberta.`, () => {
      if (series) changeBillMeta((map) => ({ ...map, [bill.id]: series }))
      else setBills((current) => current.map((b) => (b.id === bill.id ? { ...b, last_paid_month: previous } : b)))
      if (payment) setTransactions((current) => [payment, ...current].sort(byDayDesc))
    })
  }

  /** Deleting a bill: an installment series asks first which installments go; a monthly bill goes at once (with Desfazer). */
  function removeBill(bill: RecurringBillRow, scope?: Scope) {
    const series = billMeta[bill.id]
    if (series && !scope) return setSeriesAsk(bill)
    if (series && scope) {
      const next = removeInstallments(series, month, scope)
      if (next) {
        changeBillMeta((map) => ({ ...map, [bill.id]: next }))
        return undoable(scope === "this" ? "Parcela removida." : "Parcelas removidas.", () => changeBillMeta((map) => ({ ...map, [bill.id]: series })))
      }
    }
    setBills((current) => current.filter((b) => b.id !== bill.id))
    undoable("Conta fixa excluída.", () => setBills((current) => [...current, bill]))
  }

  // ----------------------------------------------------------------- goals
  function saveGoal(row: FinancialGoalRow, icon: GoalIconKey) {
    const exists = goals.some((g) => g.id === row.id)
    setGoals((current) => (exists ? current.map((g) => (g.id === row.id ? row : g)) : [...current, row]))
    setGoalIcons((current) => {
      const next = { ...current, [row.id]: GOAL_ICON_KEYS.includes(icon) ? icon : "piggy" }
      localGoalIconRepo.save(next)
      return next
    })
    if (exists) toast("Meta atualizada.")
    else undoable("Meta criada.", () => setGoals((current) => current.filter((g) => g.id !== row.id)))
  }

  function saveGoalFunds(goal: FinancialGoalRow, cents: number) {
    setGoals((current) => current.map((g) => (g.id === goal.id ? { ...g, current_cents: g.current_cents + cents } : g)))
    const change = (update: (list: GoalHistory[string]) => GoalHistory[string]) =>
      setGoalHistory((current) => {
        const next = { ...current, [goal.id]: update(current[goal.id] ?? []) }
        localGoalHistoryRepo.save(next)
        return next
      })
    change((list) => [...list, { day: today, cents }])
    undoable(`${formatBRL(cents)} guardados em ${goal.name}.`, () => {
      setGoals((current) => current.map((g) => (g.id === goal.id ? { ...g, current_cents: Math.max(0, g.current_cents - cents) } : g)))
      change((list) => list.slice(0, -1))
    })
  }

  function setGoalOrder(ids: string[]) {
    setGoalOrderState(ids)
    localGoalLayoutRepo.save(ids)
  }

  /** "Destacar": the goal goes to the front, which is the featured slot. */
  function featureGoal(goal: FinancialGoalRow, currentOrder: string[]) {
    const previous = goalOrder
    setGoalOrder(featureFirst(currentOrder, goal.id))
    undoable(`${goal.name} agora é a meta em destaque.`, () => setGoalOrder(previous))
  }

  function removeGoal(goal: FinancialGoalRow) {
    setGoals((current) => current.filter((g) => g.id !== goal.id))
    undoable("Meta excluída.", () => setGoals((current) => [...current, goal]))
  }

  // ------------------------------------------------- accounts and limits
  function changeLayout(update: (layout: AccountLayout) => AccountLayout) {
    setAccountLayout((current) => {
      const next = update(current)
      localAccountMetaRepo.save(next)
      return next
    })
  }

  function saveAccount(row: AccountRow, meta: AccountMeta) {
    const previous = allAccounts.find((a) => a.id === row.id)
    const previousMeta = accountLayout.meta[row.id]
    setAccounts((current) => (previous ? current.map((a) => (a.id === row.id ? row : a)) : [...current, row]))
    changeLayout((layout) => ({ ...layout, meta: { ...layout.meta, [row.id]: meta } }))
    if (previous) {
      undoable("Conta atualizada.", () => {
        setAccounts((current) => current.map((a) => (a.id === row.id ? previous : a)))
        changeLayout((layout) => ({ ...layout, meta: { ...layout.meta, [row.id]: previousMeta ?? {} } }))
      })
    } else undoable("Conta adicionada.", () => setAccounts((current) => current.filter((a) => a.id !== row.id)))
  }

  function renameAccount(row: AccountRow, name: string) {
    const next = name.trim()
    if (!next || next === row.name) return
    setAccounts((current) => current.map((a) => (a.id === row.id ? { ...a, name: next, updated_at: nowIso } : a)))
    undoable("Conta renomeada.", () => setAccounts((current) => current.map((a) => (a.id === row.id ? row : a))))
  }

  function setAccountArchived(row: AccountRow, archived: boolean) {
    changeLayout((layout) => ({ ...layout, meta: { ...layout.meta, [row.id]: { ...layout.meta[row.id], archived } } }))
    undoable(archived ? `${row.name} arquivada.` : `${row.name} reativada.`, () => changeLayout((layout) => ({ ...layout, meta: { ...layout.meta, [row.id]: { ...layout.meta[row.id], archived: !archived } } })))
  }

  function reorderAccounts(ids: string[]) {
    changeLayout((layout) => ({ ...layout, order: ids }))
  }

  const accountTxCount = (id: string) => transactions.filter((t) => t.account_id === id).length

  function deleteAccount(row: AccountRow, how: { kind: "plain" } | { kind: "move"; to: string } | { kind: "cascade" }) {
    const mine = transactions.filter((t) => t.account_id === row.id)
    const meta = accountLayout.meta[row.id]
    const order = accountLayout.order
    if (how.kind === "move") setTransactions((current) => current.map((t) => (t.account_id === row.id ? { ...t, account_id: how.to } : t)))
    if (how.kind === "cascade") setTransactions((current) => current.filter((t) => t.account_id !== row.id))
    setAccounts((current) => current.filter((a) => a.id !== row.id))
    changeLayout((layout) => {
      const rest = { ...layout.meta }
      delete rest[row.id]
      return { meta: rest, order: layout.order.filter((id) => id !== row.id) }
    })
    const message = how.kind === "cascade" ? `${row.name} e ${mine.length} ${mine.length === 1 ? "lançamento excluídos" : "lançamentos excluídos"}.` : `${row.name} excluída.`
    undoable(message, () => {
      setAccounts((current) => [...current, row])
      if (how.kind === "cascade") setTransactions((current) => [...mine, ...current].sort(byDayDesc))
      if (how.kind === "move") setTransactions((current) => current.map((t) => (mine.some((m) => m.id === t.id) ? { ...t, account_id: row.id } : t)))
      changeLayout((layout) => ({ meta: meta ? { ...layout.meta, [row.id]: meta } : layout.meta, order }))
    })
  }

  function saveLimits(limits: Record<string, number | null>) {
    setCategories((current) => current.map((c) => (c.id in limits ? { ...c, monthly_limit_cents: limits[c.id] } : c)))
    toast("Limites atualizados.")
  }

  const finance: Finance = {
    nowIso,
    today,
    month,
    isMobile,
    accounts,
    allAccounts,
    accountMeta: accountLayout.meta,
    accountOrder: accountLayout.order,
    categories,
    transactions,
    bills,
    goals,
    goalIcons,
    goalHistory,
    goalOrder,
    filters,
    setFilters,
    categoryName,
    accountName,
    goTab: setTab,
    saveTransaction,
    quickAdd,
    removeTransaction,
    editTransaction: (row) => setTxDialog({ row }),
    openNewTransaction: () => setTxDialog({ row: null }),
    createCategory,
    renameCategory,
    deleteCategory,
    categoryUsage,
    saveBill,
    payBill,
    billMeta,
    saveInstallmentEdit,
    reopenBill: setReopening,
    removeBill,
    editBill: (row) => setBillDialog({ row }),
    openNewBill: () => setBillDialog({ row: null }),
    fundGoal: setFundGoal,
    saveGoalFunds,
    saveGoal,
    removeGoal,
    editGoal: (row) => setGoalDialog({ row }),
    setGoalOrder,
    featureGoal,
    openNewGoal: () => setGoalDialog({ row: null }),
    saveAccount,
    renameAccount,
    setAccountArchived,
    reorderAccounts,
    accountTxCount,
    deleteAccount,
    editAccount: (row) => setAccountDialog({ row }),
    askDeleteAccount: setDeleteAccountTarget,
    openAccountManager: () => setManagerOpen(true),
    saveLimits,
    openNewAccount: () => setAccountDialog({ row: null }),
    openLimits: () => setLimitsOpen(true),
  }

  usePrimaryAction(tab === "fixas" ? "Nova conta fixa" : tab === "metas" ? "Nova meta" : "Novo lançamento", () => {
    if (tab === "fixas") setBillDialog({ row: null })
    else if (tab === "metas") setGoalDialog({ row: null })
    else setTxDialog({ row: null })
  })

  const usesMonth = tab !== "metas"
  const monthTitle = format(parseISO(`${month}-01`), "MMMM 'de' yyyy", { locale: ptBR })
  const toolbar = <MonthToolbar title={monthTitle} onToday={() => setMonth(monthOf(today))} onShift={(d) => setMonth((m) => shiftMonth(m, d))} />
  const activeFilters = (filters.kind !== "all" ? 1 : 0) + (filters.category !== "all" ? 1 : 0)
  const tabItems = TABS.map((t) => ({ id: t.id, label: isMobile ? t.short : t.label }))

  const tabs = (
    <PillTabs
      equal={isMobile}
      className={isMobile ? "grid-cols-[1fr_1.7fr_1fr_1fr]" : "w-fit max-w-full"}
      ariaLabel="Finanças"
      items={tabItems}
      value={tab}
      onSelect={(item) => setTab(item.id as TabId)}
    />
  )

  return (
    <FinanceProvider value={finance}>
      <div className={cn("flex min-w-0 flex-col gap-4", isMobile && "pb-24")} data-testid="financas" data-tab={tab}>
        {isMobile ? (
          <>
            <section aria-label="Finanças" data-testid="financas-header-block" className="mt-3 flex flex-col gap-2 rounded-[20px] border border-border bg-card p-3">
              <div className="flex h-9 items-center gap-2">
                {searchOpen && tab === "lancamentos" ? (
                  <>
                    <Input autoFocus type="search" value={filters.query} onChange={(e) => setFilters({ query: e.target.value })} aria-label="Buscar lançamentos" placeholder="Buscar lançamentos" className="h-9 min-w-0 flex-1 rounded-full" />
                    <Button variant="ghost" className="h-9" onClick={() => (setFilters({ query: "" }), setSearchOpen(false))}>
                      Fechar
                    </Button>
                  </>
                ) : (
                  <>
                    <h2 className="min-w-0 flex-1 truncate text-[18px] leading-6 font-semibold">Finanças</h2>
                    {tab === "lancamentos" ? (
                      <>
                        <Button variant="outline" size="icon" aria-label="Buscar lançamentos" className="relative size-9 after:absolute after:-inset-1" onClick={() => setSearchOpen(true)}>
                          <SearchIcon strokeWidth={1.75} />
                        </Button>
                        <Button variant="outline" size="icon" aria-label={activeFilters > 0 ? `Filtros, ${activeFilters} ativos` : "Filtros"} data-testid="finance-filter" className="relative size-9 after:absolute after:-inset-1" onClick={() => setFilterSheet(true)}>
                          <SlidersHorizontalIcon strokeWidth={1.75} />
                          {activeFilters > 0 ? <span className="tabular absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-highlight text-[10px] font-semibold text-highlight-foreground">{activeFilters}</span> : null}
                        </Button>
                      </>
                    ) : null}
                  </>
                )}
              </div>
              <ViewTabs tabs={MOBILE_TABS} value={tab} onChange={setTab} ariaLabel="Finanças" isMobile columns={4} weighted dataAttr="data-finance-tab" />
              {tab === "lancamentos" ? <TransactionsFilterRow /> : null}
            </section>
            {usesMonth ? <div className="px-1">{toolbar}</div> : null}
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {tabs}
            {usesMonth ? <div className="ml-auto">{toolbar}</div> : null}
          </div>
        )}

        {tab === "visao" ? (isMobile ? <OverviewMobile /> : <OverviewDesktop />) : null}

        {tab === "lancamentos" ? (
          isMobile ? (
            <>
              <TransactionsTop />
              <TransactionsMain />
            </>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-8 xl:grid-cols-12">
              <div className="min-w-0 lg:col-span-5 xl:col-span-8">
                <TransactionsMain />
              </div>
              <aside className="flex min-w-0 flex-col gap-4 lg:col-span-3 xl:col-span-4">
                <TransactionsSide />
              </aside>
            </div>
          )
        ) : null}

        {tab === "fixas" ? <BillsTab /> : null}

        {tab === "metas" ? isMobile ? <GoalsMobile /> : <GoalsDesktop /> : null}
      </div>

      <TransactionDialog open={Boolean(txDialog)} onOpenChange={(open) => !open && setTxDialog(null)} row={txDialog?.row ?? null} />
      <ConfirmDialog
        open={Boolean(reopening)}
        onOpenChange={(open) => !open && setReopening(null)}
        title="Reabrir esta conta?"
        description={reopening ? `“${reopening.name}” volta para “a pagar” e o lançamento do pagamento é removido, então o saldo e os totais do mês voltam como estavam antes de pagar.` : ""}
        confirmLabel="Reabrir conta"
        onConfirm={() => {
          const bill = reopening
          setReopening(null)
          if (bill) reopenBill(bill)
        }}
      />
      <ScopeSheet
        open={Boolean(seriesAsk)}
        title="Excluir qual parcela?"
        description="Esta conta é parcelada: escolha o que sai da série."
        onCancel={() => setSeriesAsk(null)}
        onPick={(scope) => {
          const target = seriesAsk
          setSeriesAsk(null)
          if (target) removeBill(target, scope)
        }}
      />
      <BillDialog open={Boolean(billDialog)} onOpenChange={(open) => !open && setBillDialog(null)} row={billDialog?.row ?? null} />
      <GoalDialog open={Boolean(goalDialog)} onOpenChange={(open) => !open && setGoalDialog(null)} row={goalDialog?.row ?? null} />
      <FundDialog goal={fundGoal} onClose={() => setFundGoal(null)} />
      <AccountDialog open={Boolean(accountDialog)} onOpenChange={(open) => !open && setAccountDialog(null)} row={accountDialog?.row ?? null} />
      <AccountManager open={managerOpen} onOpenChange={setManagerOpen} />
      <DeleteAccountDialog row={deleteAccountTarget} onClose={() => setDeleteAccountTarget(null)} />
      <LimitsDialog open={limitsOpen} onOpenChange={setLimitsOpen} />
      <FiltersSheet open={filterSheet} onOpenChange={setFilterSheet} />
    </FinanceProvider>
  )
}
