"use client"

import { useCallback, useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { SearchIcon, SlidersHorizontalIcon } from "lucide-react"
import { toast } from "sonner"

import { LabelColorsProvider, useLabelColorsStore } from "@/components/tasks/label-colors-context"
import { PillTabs } from "@/components/tasks/pill-tabs"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useIsMobile } from "@/hooks/use-mobile"
import { GOAL_ICON_KEYS, localGoalIconRepo, type GoalIconKey } from "@/features/finance/goal-icons"
import { monthOf, shiftMonth } from "@/features/finance/stats"
import type { AccountRow, CategoryRow, FinancialGoalRow, RecurringBillRow, TransactionRow } from "@/features/finance/types"
import { usePersistedRows } from "@/features/persist/use-persisted-rows"
import type { TableName } from "@/features/persist/registry"
import { guessCategory } from "@/server/assistant/parse"
import { formatBRL, parseBRL } from "@/lib/money"
import { dayOf, newId } from "@/lib/sp-time"
import { cn } from "@/lib/utils"

import { BillsAside, BillsHero, BillsMain } from "./bills"
import { FinanceProvider, type Filters, type Finance, type FinanceInitial, type TabId } from "./context"
import { AccountDialog, BillDialog, FundDialog, GoalDialog, LimitsDialog, TransactionDialog } from "./dialogs"
import { GoalsHero, GoalsMain, NextDeadline } from "./goals"
import { AccountsCard, BudgetCard, EvolutionCard, KpiRow, SpendingList, WatchList } from "./overview"
import { MonthToolbar } from "./parts"
import { FiltersSheet, TransactionTiles, TransactionsAside, TransactionsMain } from "./transactions"

export type { FinanceInitial } from "./context"

const USER = "00000000-0000-4000-8000-000000000001"

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

function TwoCol({ main, side, sideFirst = false }: { main: React.ReactNode; side: React.ReactNode; sideFirst?: boolean }) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_376px] lg:items-start">
      <div className={cn("flex min-w-0 flex-col gap-5", sideFirst && "order-2 lg:order-1")}>{main}</div>
      <aside className={cn("flex min-w-0 flex-col gap-4 lg:sticky lg:top-0", sideFirst && "order-1 lg:order-2")}>{side}</aside>
    </div>
  )
}

function FinanceBody({ nowIso, initial, memory }: { nowIso: string; initial: FinanceInitial; memory: boolean }) {
  const isMobile = useIsMobile()
  const today = dayOf(nowIso)
  const [tab, setTab] = useState<TabId>("visao")
  const [month, setMonth] = useState(monthOf(today))
  const [filters, setFiltersState] = useState<Filters>({ kind: "all", category: "all", query: "" })
  const [accounts, setAccounts] = useRows<AccountRow>("finance_accounts", initial.accounts, memory)
  const [categories, setCategories] = useRows<CategoryRow>("finance_categories", initial.categories, memory)
  const [transactions, setTransactions] = useRows<TransactionRow>("finance_transactions", initial.transactions, memory)
  const [bills, setBills] = useRows<RecurringBillRow>("finance_bills", initial.bills, memory)
  const [goals, setGoals] = useRows<FinancialGoalRow>("finance_goals", initial.goals, memory)
  const [goalIcons, setGoalIcons] = useState<Record<string, GoalIconKey>>({})
  const [txDialog, setTxDialog] = useState<{ row: TransactionRow | null } | null>(null)
  const [billDialog, setBillDialog] = useState<{ row: RecurringBillRow | null } | null>(null)
  const [goalDialog, setGoalDialog] = useState<{ row: FinancialGoalRow | null } | null>(null)
  const [fundGoal, setFundGoal] = useState<FinancialGoalRow | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [limitsOpen, setLimitsOpen] = useState(false)
  const [filterSheet, setFilterSheet] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    // localStorage only exists in the browser; read after mount so server and client render the same.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGoalIcons(localGoalIconRepo.load())
  }, [])

  const setFilters = useCallback((next: Partial<Filters>) => setFiltersState((current) => ({ ...current, ...next })), [])
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Sem categoria"
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? ""

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
  function saveBill(row: RecurringBillRow) {
    const exists = bills.some((b) => b.id === row.id)
    setBills((current) => (exists ? current.map((b) => (b.id === row.id ? row : b)) : [...current, row]))
    if (exists) toast("Conta fixa atualizada.")
    else undoable("Conta fixa criada.", () => setBills((current) => current.filter((b) => b.id !== row.id)))
  }

  function payBill(bill: RecurringBillRow) {
    if (!accounts[0]) {
      toast.error("Crie uma conta antes de pagar uma conta.")
      return
    }
    const previous = bill.last_paid_month
    const txId = newId()
    setBills((current) => current.map((b) => (b.id === bill.id ? { ...b, last_paid_month: month } : b)))
    setTransactions((current) =>
      [
        {
          id: txId,
          user_id: USER,
          account_id: accounts[0].id,
          category_id: bill.category_id,
          kind: "out" as const,
          amount_cents: bill.amount_cents,
          occurred_on: today,
          method: "Pix",
          description: bill.name,
          source: "manual" as const,
          created_at: nowIso,
          updated_at: nowIso,
        },
        ...current,
      ].sort(byDayDesc)
    )
    undoable(`${bill.name} paga.`, () => {
      setBills((current) => current.map((b) => (b.id === bill.id ? { ...b, last_paid_month: previous } : b)))
      setTransactions((current) => current.filter((t) => t.id !== txId))
    })
  }

  function removeBill(bill: RecurringBillRow) {
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
    undoable(`${formatBRL(cents)} guardados em ${goal.name}.`, () => setGoals((current) => current.map((g) => (g.id === goal.id ? { ...g, current_cents: Math.max(0, g.current_cents - cents) } : g))))
  }

  function removeGoal(goal: FinancialGoalRow) {
    setGoals((current) => current.filter((g) => g.id !== goal.id))
    undoable("Meta excluída.", () => setGoals((current) => [...current, goal]))
  }

  // ------------------------------------------------- accounts and limits
  function saveAccount(row: AccountRow) {
    setAccounts((current) => [...current, row])
    undoable("Conta adicionada.", () => setAccounts((current) => current.filter((a) => a.id !== row.id)))
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
    categories,
    transactions,
    bills,
    goals,
    goalIcons,
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
    removeBill,
    editBill: (row) => setBillDialog({ row }),
    openNewBill: () => setBillDialog({ row: null }),
    fundGoal: setFundGoal,
    saveGoalFunds,
    saveGoal,
    removeGoal,
    editGoal: (row) => setGoalDialog({ row }),
    openNewGoal: () => setGoalDialog({ row: null }),
    saveAccount,
    saveLimits,
    openNewAccount: () => setAccountOpen(true),
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
            <section aria-label="Finanças" data-testid="financas-header-block" className="flex flex-col gap-3 rounded-[20px] border border-border bg-card p-3">
              <div className="flex h-11 items-center gap-2">
                {searchOpen && tab === "lancamentos" ? (
                  <>
                    <Input autoFocus type="search" value={filters.query} onChange={(e) => setFilters({ query: e.target.value })} aria-label="Buscar lançamentos" placeholder="Buscar lançamentos" className="h-11 min-w-0 flex-1 rounded-full" />
                    <Button variant="ghost" className="h-11" onClick={() => (setFilters({ query: "" }), setSearchOpen(false))}>
                      Fechar
                    </Button>
                  </>
                ) : (
                  <>
                    <h2 className="min-w-0 flex-1 truncate text-[18px] leading-7 font-semibold">Finanças</h2>
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
              {tabs}
            </section>
            {usesMonth ? <div className="px-1">{toolbar}</div> : null}
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {tabs}
            {usesMonth ? <div className="ml-auto">{toolbar}</div> : null}
          </div>
        )}

        {tab === "visao" ? (
          <>
            <KpiRow />
            <TwoCol
              main={
                <>
                  <WatchList />
                  <BudgetCard />
                  {isMobile ? <SpendingList /> : null}
                </>
              }
              side={
                <>
                  <EvolutionCard />
                  <AccountsCard />
                </>
              }
            />
          </>
        ) : null}

        {tab === "lancamentos" ? (
          <>
            {isMobile ? <TransactionTiles /> : null}
            <TwoCol main={<TransactionsMain />} side={isMobile ? null : <TransactionsAside />} />
          </>
        ) : null}

        {tab === "fixas" ? <TwoCol sideFirst={isMobile} main={<BillsMain />} side={isMobile ? <BillsHero /> : <BillsAside />} /> : null}

        {tab === "metas" ? <TwoCol sideFirst={isMobile} main={<GoalsMain />} side={isMobile ? <GoalsHero /> : (<><GoalsHero /><NextDeadline /></>)} /> : null}
      </div>

      <TransactionDialog open={Boolean(txDialog)} onOpenChange={(open) => !open && setTxDialog(null)} row={txDialog?.row ?? null} />
      <BillDialog open={Boolean(billDialog)} onOpenChange={(open) => !open && setBillDialog(null)} row={billDialog?.row ?? null} />
      <GoalDialog open={Boolean(goalDialog)} onOpenChange={(open) => !open && setGoalDialog(null)} row={goalDialog?.row ?? null} />
      <FundDialog goal={fundGoal} onClose={() => setFundGoal(null)} />
      <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
      <LimitsDialog open={limitsOpen} onOpenChange={setLimitsOpen} />
      <FiltersSheet open={filterSheet} onOpenChange={setFilterSheet} />
    </FinanceProvider>
  )
}
