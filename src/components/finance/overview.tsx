"use client"

import { useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowDownRightIcon, ArrowUpRightIcon, CircleAlertIcon, PlusIcon, ReceiptIcon, ScaleIcon, SettingsIcon, TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { balanceHistory } from "@/features/finance/history"
import { monthlySeries } from "@/features/finance/stats"
import { formatBalance, formatBRL, formatReais } from "@/lib/money"
import { cn } from "@/lib/utils"

import { BentoCard, BentoStat, BudgetRing, CashflowChart, SegmentedPills, WalletMiniCard, type CashflowMonth } from "./bento"
import { BillMini } from "./bill-mini"
import { useFinance } from "./context"
import { derive, variation } from "./derive"
import { AccountMenu } from "./accounts"
import { FinanceDeck, type FinanceSlide } from "./finance-deck"
import { BalanceChart } from "./balance-chart"
import { accountIcon, accountIconKey } from "./dialogs"
import { GoalRing, useGoalSets } from "./goals"
import { AddPill, CategoryCircle, EmptyBlock, FinanceListItem, HeroCard, MoneyText, ProgressBar, StatusChip, useCategoryColor } from "./parts"
import { accountBalance } from "@/features/finance/stats"
import type { AccountRow } from "@/features/finance/types"

// ------------------------------------------------------------------ hero and stats

export function BalanceHero({ fill = true }: { fill?: boolean }) {
  const f = useFinance()
  const d = derive(f)
  const history = useMemo(() => balanceHistory(f.accounts, f.transactions, f.month, 6), [f.accounts, f.transactions, f.month])
  return (
    <HeroCard
      label="Saldo total"
      size="lg"
      value={<MoneyText cents={d.balance} tone="value" dimDecimals />}
      support={`${f.accounts.length} ${f.accounts.length === 1 ? "conta" : "contas"} · ${formatBalance(d.month.surplus)} no mês`}
      onArrow={() => f.goTab("lancamentos")}
      arrowLabel="Ver lançamentos"
      className={fill ? "h-full" : undefined}
    >
      <BalanceChart key={f.month} history={history} className="mt-2" />
    </HeroCard>
  )
}

export function IncomeStat({ compact = false, className }: { compact?: boolean; className?: string }) {
  const f = useFinance()
  const d = derive(f)
  return (
    <BentoStat compact={compact} className={className} label="Entradas" icon={ArrowUpRightIcon} chip={variation(d.month.income, d.previous.income) ?? "este mês"}>
      <MoneyText cents={d.month.income} dimDecimals />
    </BentoStat>
  )
}

export function ExpenseStat({ compact = false, className }: { compact?: boolean; className?: string }) {
  const f = useFinance()
  const d = derive(f)
  return (
    <BentoStat compact={compact} className={className} label="Saídas" icon={ArrowDownRightIcon} chip={variation(d.month.expense, d.previous.expense) ?? "este mês"}>
      <MoneyText cents={d.month.expense} dimDecimals />
    </BentoStat>
  )
}

export function SurplusStat({ compact = false, className }: { compact?: boolean; className?: string }) {
  const f = useFinance()
  const d = derive(f)
  return (
    <BentoStat compact={compact} className={className} label="Saldo do mês" icon={ScaleIcon} chip="entradas − saídas">
      <MoneyText cents={d.month.surplus} tone="value" dimDecimals />
    </BentoStat>
  )
}

export function FixedToPayStat({ compact = false, className }: { compact?: boolean; className?: string }) {
  const f = useFinance()
  const d = derive(f)
  return (
    <BentoStat compact={compact} className={className} label="Fixas a pagar" icon={ReceiptIcon} chip={`${d.unpaidCount} ${d.unpaidCount === 1 ? "conta" : "contas"}`}>
      <MoneyText cents={d.toPayTotal} dimDecimals />
    </BentoStat>
  )
}

/** Entradas, Saídas, Saldo do mês (the signed result) and what is still to pay in fixed bills. */
export function StatGrid({ compact = false }: { compact?: boolean }) {
  return (
    <div data-testid="stat-grid" className="grid auto-rows-fr grid-cols-2 gap-3 md:gap-4">
      <IncomeStat compact={compact} />
      <ExpenseStat compact={compact} />
      <SurplusStat compact={compact} />
      <FixedToPayStat compact={compact} />
    </div>
  )
}

// ------------------------------------------------------------------ budget and categories

/** One category: the tinted icon circle, the name with "R$ 414 de R$ 330" muted on the right, and a 6px bar in the category color with the percentage. */
function SpendRow({ row }: { row: ReturnType<typeof derive>["categories"][number] }) {
  const { category, spent, limit, ratio } = row
  const color = useCategoryColor(category.id)
  const pct = ratio === null ? 0 : ratio * 100
  return (
    <div data-category-card={category.id} className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5">
      <CategoryCircle id={category.id} name={category.name} size="lg" className="row-span-2" />
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] leading-6 font-medium">{category.name}</span>
          {ratio !== null && ratio > 1 ? <StatusChip icon={CircleAlertIcon}>Acima</StatusChip> : ratio !== null && ratio >= 0.9 ? <StatusChip icon={TriangleAlertIcon}>Perto</StatusChip> : null}
        </span>
        <span className="tabular shrink-0 text-[13px] leading-5 whitespace-nowrap text-muted-foreground">{limit ? `${formatReais(spent)} de ${formatReais(limit)}` : formatReais(spent)}</span>
      </div>
      <div className="flex items-center gap-3">
        <ProgressBar thin value={ratio === null ? 0 : pct} color={color} label={`Gasto em ${category.name}`} className="h-1.5 flex-1" />
        <span className="tabular w-9 shrink-0 text-right text-[13px] leading-5 text-muted-foreground">{ratio !== null ? `${Math.round(pct)}%` : ""}</span>
      </div>
    </div>
  )
}

/** The budget card: the 128px ring centered with "% usado", then "R$ X de R$ Y" and what is left. `rows` adds that many category rows (phones). */
export function BudgetBento({ rows = 0, fill = true }: { rows?: number; fill?: boolean }) {
  const f = useFinance()
  const d = derive(f)
  return (
    <BentoCard title="Orçamento" onArrow={f.openLimits} arrowLabel="Editar limites" data-testid="budget-card" className={fill ? "h-full" : undefined}>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-1 text-center">
        <BudgetRing value={d.budgetPct} label="Orçamento usado" />
        <div className="flex flex-col gap-0.5">
          <span data-budget-amount className="tabular text-[15px] leading-6 font-semibold">
            {formatBRL(d.spentInBudget)} de {formatBRL(d.budget)}
          </span>
          <span className="tabular text-[13px] leading-5 text-muted-foreground">{d.spentInBudget <= d.budget ? `Restam ${formatBRL(d.budget - d.spentInBudget)}` : `Você passou ${formatBRL(d.spentInBudget - d.budget)}`}</span>
        </div>
      </div>
      {rows > 0 ? (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          {d.categories.slice(0, rows).map((row) => (
            <SpendRow key={row.category.id} row={row} />
          ))}
        </div>
      ) : null}
    </BentoCard>
  )
}

export function SpendingBento() {
  const f = useFinance()
  const d = derive(f)
  return (
    <BentoCard title="Onde estou gastando" onArrow={() => f.goTab("lancamentos")} arrowLabel="Ver lançamentos" data-testid="spending-card" className="h-full">
      <div className="flex flex-col gap-4">
        {d.categories.slice(0, 5).map((row) => (
          <SpendRow key={row.category.id} row={row} />
        ))}
        {d.categories.length === 0 ? <p className="text-[13px] leading-5 text-muted-foreground">Nenhum gasto neste mês.</p> : null}
      </div>
    </BentoCard>
  )
}

// ------------------------------------------------------------------ cash flow

export function CashflowBento() {
  const f = useFinance()
  const [mode, setMode] = useState<"m" | "a">("m")
  const [picked, setPicked] = useState<string | null>(null)
  const year = f.month.slice(0, 4)
  const data: CashflowMonth[] = (mode === "m" ? monthlySeries(f.transactions, f.month, 6) : monthlySeries(f.transactions, `${year}-12`, 12)).map((s) => ({
    key: s.month,
    label: format(parseISO(`${s.month}-01`), "MMM", { locale: ptBR }).replace(".", ""),
    income: s.income,
    expense: s.expense,
  }))
  const byKey = data.findIndex((m) => m.key === (picked ?? f.month))
  const selected = byKey >= 0 ? byKey : Math.max(0, data.map((m) => m.income + m.expense > 0).lastIndexOf(true))
  const m = data[selected]
  return (
    <BentoCard
      title="Fluxo de caixa"
      subtitle={mode === "m" ? "Entradas e saídas dos últimos 6 meses" : `Entradas e saídas de ${year}`}
      data-testid="cashflow-card"
      className="h-full"
      actions={
        <SegmentedPills
          ariaLabel="Período do fluxo de caixa"
          items={[
            { id: "m", label: "Mensal" },
            { id: "a", label: "Anual" },
          ]}
          value={mode}
          onChange={(v) => (setMode(v), setPicked(null))}
        />
      }
    >
      <CashflowChart data={data} selected={selected} onSelect={(i) => setPicked(data[i].key)} ariaLabel={`Fluxo de caixa. ${m ? `${m.label}: entradas ${formatBRL(m.income)}, saídas ${formatBRL(m.expense)}.` : ""} Use as setas para trocar de mês.`} />
      <div className="flex items-center gap-4 text-[12px] leading-4 text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-highlight" /> Entradas
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-foreground/25" /> Saídas
        </span>
      </div>
    </BentoCard>
  )
}

// ------------------------------------------------------------------ bills, wallets, goals, recent

export function WatchBento() {
  const f = useFinance()
  const d = derive(f)
  return (
    <BentoCard title="Para ficar de olho" subtitle={d.watch.length ? `${d.watch.length} ${d.watch.length === 1 ? "conta" : "contas"} perto de vencer` : undefined} onArrow={() => f.goTab("fixas")} arrowLabel="Ver contas fixas" data-testid="watch-list" className="h-full">
      <div className="flex flex-col gap-2">
        {d.watch.map((v) => (
          <BillMini key={v.bill.id} view={v} />
        ))}
        {d.watch.length === 0 ? <EmptyBlock icon={ReceiptIcon} title="Nada vencendo agora" description="As contas que vencem em até 5 dias aparecem aqui." /> : null}
      </div>
    </BentoCard>
  )
}

/** One wallet with everything it needs from the finance context: the account's icon, color, status chip, ⋯ menu and edit on tap. */
function Wallet({ account, className }: { account: AccountRow; className?: string }) {
  const f = useFinance()
  const meta = f.accountMeta[account.id]
  return (
    <WalletMiniCard
      account={account}
      balance={accountBalance(account, f.transactions)}
      icon={accountIcon(accountIconKey(account, meta))}
      swatch={meta?.color}
      chip={meta?.archived ? "Arquivada" : "Ativa"}
      onOpen={() => f.editAccount(account)}
      menu={<AccountMenu account={account} />}
      className={className}
    />
  )
}

const ManageButton = () => {
  const f = useFinance()
  return (
    <Button type="button" variant="outline" size="sm" data-manage-accounts onClick={f.openAccountManager}>
      <SettingsIcon strokeWidth={1.75} /> Gerenciar
    </Button>
  )
}

export function AccountsBento() {
  const f = useFinance()
  return (
    <BentoCard title="Contas e bancos" subtitle={`${f.accounts.length} ${f.accounts.length === 1 ? "conta" : "contas"}`} actions={<ManageButton />} className="h-full" data-testid="accounts-card">
      <div className="grid grid-cols-2 gap-3">
        {f.accounts.slice(0, 4).map((a) => (
          <Wallet key={a.id} account={a} />
        ))}
      </div>
      {f.accounts.length > 4 ? (
        <Button type="button" variant="ghost" size="sm" className="w-fit self-center" onClick={f.openAccountManager}>
          Ver todas as {f.accounts.length} contas
        </Button>
      ) : null}
      <AddPill label="Adicionar conta…" onClick={f.openNewAccount} />
    </BentoCard>
  )
}

/** Phones: the wallets as a card deck (one in front, neighbors behind, "N de M" and dots); the last card is the dashed "Adicionar conta…". */
export function AccountsCarousel() {
  const f = useFinance()
  const slides = [
    ...f.accounts.map((a) => ({ id: a.id, node: <Wallet account={a} className="min-h-[150px]" /> })),
    {
      id: "add",
      node: (
        <button type="button" data-add-task-pill onClick={f.openNewAccount} className="flex min-h-[150px] w-full flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-border p-3 text-[14px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
          <PlusIcon aria-hidden strokeWidth={1.75} className="size-5" />
          Adicionar conta…
        </button>
      ),
    },
  ]
  return (
    <BentoCard title="Contas e bancos" subtitle={`${f.accounts.length} ${f.accounts.length === 1 ? "conta" : "contas"}`} actions={<ManageButton />} data-testid="accounts-card">
      <div data-testid="accounts-carousel">
        <FinanceDeck slides={slides} title={null} label="Contas e bancos" noun="conta" initialHeight={150} widthClass="w-[80%] max-w-[300px]" />
      </div>
    </BentoCard>
  )
}

/** Goals in progress, nearest deadline first. */
export function GoalsBento() {
  const f = useFinance()
  const { open, done } = useGoalSets()
  const goals = open.slice(0, 3)
  return (
    <BentoCard title="Metas" subtitle={`${open.length} em andamento · ${done.length} ${done.length === 1 ? "alcançada" : "alcançadas"}`} onArrow={() => f.goTab("metas")} arrowLabel="Ver metas" data-testid="goals-card" className="h-full">
      <div className="flex flex-col gap-2.5">
        {goals.map((g) => (
          <div key={g.id} data-goal={g.id} className="flex items-center gap-3 rounded-[14px] border border-border p-3">
            <GoalRing goal={g} size={52} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] leading-6 font-medium">{g.name}</span>
              <span className="tabular truncate text-[13px] leading-5 text-muted-foreground">
                {formatBRL(g.current_cents)} de {formatBRL(g.target_cents)}
              </span>
            </div>
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => f.fundGoal(g)}>
              <PlusIcon strokeWidth={1.75} /> Guardar
            </Button>
          </div>
        ))}
        {goals.length === 0 ? <p className="text-[13px] leading-5 text-muted-foreground">Nenhuma meta em andamento.</p> : null}
      </div>
    </BentoCard>
  )
}

/** Phones: the goals as a card deck, one per goal and a last "Ver todas" card. */
export function GoalsCarousel() {
  const f = useFinance()
  const goals = useGoalSets().open
  const slides = [
    ...goals.map((g) => ({
      id: g.id,
      node: (
        <div data-goal={g.id} className="flex min-h-[170px] flex-col gap-2 rounded-[14px] border border-border bg-card p-3">
          <div className="flex items-center gap-3">
            <GoalRing goal={g} size={64} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[15px] leading-6 font-medium">{g.name}</span>
              <span className="tabular text-[12px] leading-4 text-muted-foreground">
                {formatBRL(g.current_cents)} de {formatBRL(g.target_cents)}
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" className="mt-auto w-full" onClick={() => f.fundGoal(g)}>
            <PlusIcon strokeWidth={1.75} /> Guardar
          </Button>
        </div>
      ),
    })),
    {
      id: "all",
      node: (
        <button type="button" onClick={() => f.goTab("metas")} className="flex min-h-[170px] w-full flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-border p-3 text-[14px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
          <ArrowUpRightIcon aria-hidden strokeWidth={1.75} className="size-5" />
          Ver todas
        </button>
      ),
    },
  ]
  return (
    <BentoCard title="Metas" subtitle={`${goals.length} em andamento`} onArrow={() => f.goTab("metas")} arrowLabel="Ver metas" data-testid="goals-card">
      <div data-testid="goals-carousel">
        {goals.length === 0 ? <p className="text-[13px] leading-5 text-muted-foreground">Nenhuma meta em andamento.</p> : <FinanceDeck slides={slides} title={null} label="Metas" noun="meta" initialHeight={170} widthClass="w-[80%] max-w-[300px]" />}
      </div>
    </BentoCard>
  )
}

/** Phones: the last three movements and a pill to all of them. */
export function RecentBento() {
  const f = useFinance()
  const last = [...f.transactions].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)).slice(0, 3)
  return (
    <BentoCard title="Últimas movimentações" data-testid="recent-card">
      <div className="flex flex-col gap-2">
        {last.map((t) => (
          <FinanceListItem
            key={t.id}
            data-transaction={t.id}
            leading={<CategoryCircle id={t.category_id} name={f.categoryName(t.category_id)} />}
            title={t.description}
            subtitle={`${f.categoryName(t.category_id)} · ${f.accountName(t.account_id)}`}
            amount={<MoneyText cents={t.amount_cents} tone={t.kind === "in" ? "in" : "out"} />}
            onOpen={() => f.editTransaction(t)}
          />
        ))}
        <Button variant="outline" className={cn("h-11 w-full")} onClick={() => f.goTab("lancamentos")}>
          Ver todas
        </Button>
      </div>
    </BentoCard>
  )
}

function Cell({ className, children }: { className: string; children: React.ReactNode }) {
  return <div className={cn("min-w-0 [&>*]:h-full", className)}>{children}</div>
}

/** Desktop (12 columns from 1280, 8 from 1024) and tablet (one column of two-up stat grids). */
export function OverviewDesktop() {
  return (
    <div data-testid="overview-grid" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-8 xl:grid-cols-12">
      <Cell className="md:col-span-2 lg:col-span-8 xl:col-span-5">
        <BalanceHero />
      </Cell>
      <Cell className="md:col-span-2 lg:col-span-8 xl:col-span-4">
        <StatGrid />
      </Cell>
      <Cell className="md:col-span-2 lg:col-span-8 xl:col-span-3">
        <BudgetBento />
      </Cell>
      <Cell className="md:col-span-2 lg:col-span-8 xl:col-span-7">
        <CashflowBento key="flow" />
      </Cell>
      <Cell className="md:col-span-2 lg:col-span-8 xl:col-span-5">
        <WatchBento />
      </Cell>
      <Cell className="md:col-span-1 lg:col-span-4 xl:col-span-4">
        <SpendingBento />
      </Cell>
      <Cell className="md:col-span-1 lg:col-span-4 xl:col-span-4">
        <AccountsBento />
      </Cell>
      <Cell className="md:col-span-2 lg:col-span-8 xl:col-span-4">
        <GoalsBento />
      </Cell>
    </div>
  )
}

/** Phones: the highlights as one deck (Saldo total in front with its chart), then the rest of the cards one under the other. */
export function OverviewMobile() {
  const slides: FinanceSlide[] = [
    { id: "saldo", hero: true, node: <BalanceHero fill={false} /> },
    { id: "entradas", node: <IncomeStat /> },
    { id: "saidas", node: <ExpenseStat /> },
    { id: "saldo-mes", node: <SurplusStat /> },
    { id: "fixas", node: <FixedToPayStat /> },
    { id: "orcamento", node: <BudgetBento fill={false} /> },
  ]
  return (
    <div data-testid="overview-grid" className="flex flex-col gap-3">
      <FinanceDeck slides={slides} initialHeight={430} />
      <AccountsCarousel />
      <SpendingBento />
      <CashflowBento />
      <WatchBento />
      <GoalsCarousel />
      <RecentBento />
    </div>
  )
}
