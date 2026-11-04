"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowDownRightIcon, ArrowUpRightIcon, BanknoteIcon, ClockIcon, CircleAlertIcon, LandmarkIcon, PencilIcon, ScaleIcon, TriangleAlertIcon } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { Collapse, GroupHeader } from "@/components/organizzou/Group"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { accountBalance, billStatusIn, monthlySeries, spendByCategory, totalBalance, totals, type CategorySpend } from "@/features/finance/stats"
import { formatBalance, formatBRL } from "@/lib/money"
import { cn } from "@/lib/utils"

import { useFinance } from "./context"
import { AddPill, CardHeader, CardStack, CategoryCircle, FinanceListItem, HeroCard, LIST_CARD, MoneyText, ProgressBar, StatTile, StatusChip, SUMMARY_CARD, useCategoryColor } from "./parts"

const chartConfig = {
  income: { label: "Entradas", color: "var(--chart-1)" },
  expense: { label: "Saídas", color: "var(--chart-4)" },
} satisfies ChartConfig

/** "Venceu há 3 dias" / "Vence hoje" / "Vence em 5 dias". */
export function dueText(daysLeft: number, status: string) {
  if (status === "paid") return "Pago"
  const n = Math.abs(daysLeft)
  if (daysLeft < 0) return `Venceu há ${n} ${n === 1 ? "dia" : "dias"}`
  if (daysLeft === 0) return "Vence hoje"
  return `Vence em ${n} ${n === 1 ? "dia" : "dias"}`
}

/** The four numbers at the top. Saldo do mês is the real signed result (entradas − saídas): it can be negative. */
export function KpiRow() {
  const f = useFinance()
  const month = totals(f.transactions, f.month)
  const balance = totalBalance(f.accounts, f.transactions)
  return (
    <div data-testid="kpi-row" className="grid grid-cols-3 gap-2 md:gap-4 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
      <HeroCard label="Saldo total" value={formatBalance(balance)} support={`${f.accounts.length} ${f.accounts.length === 1 ? "conta" : "contas"}`} className="col-span-3 lg:col-span-1" />
      <StatTile compact={f.isMobile} icon={ArrowUpRightIcon} label="Entradas">
        <MoneyText cents={month.income} />
      </StatTile>
      <StatTile compact={f.isMobile} icon={ArrowDownRightIcon} label="Saídas">
        <MoneyText cents={month.expense} />
      </StatTile>
      <StatTile compact={f.isMobile} icon={ScaleIcon} label="Saldo do mês" helper={f.isMobile ? undefined : "entradas menos saídas"}>
        <MoneyText cents={month.surplus} tone="value" />
      </StatTile>
    </div>
  )
}

/** "Para ficar de olho": bills overdue or due within five days of the month on show. */
export function WatchList() {
  const f = useFinance()
  const [open, setOpen] = useState(true)
  const views = f.bills
    .filter((b) => b.active)
    .map((b) => billStatusIn(b, f.month, f.today))
    .filter((v) => v.status === "soon" || v.status === "overdue")
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
  if (views.length === 0) return null
  return (
    <section aria-label="Para ficar de olho" data-testid="watch-list" className="flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <GroupHeader label="Para ficar de olho" count={views.length} open={open} onToggle={() => setOpen((v) => !v)} />
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => f.goTab("fixas")}>
          Ver todas
        </Button>
      </div>
      <Collapse open={open}>
        <CardStack>
          {views.map(({ bill, status, daysLeft }) => (
            <FinanceListItem
              key={bill.id}
              data-bill={bill.id}
              leading={<span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50">{status === "overdue" ? <TriangleAlertIcon strokeWidth={1.75} className="size-[18px]" /> : <ClockIcon strokeWidth={1.75} className="size-[18px]" />}</span>}
              title={bill.name}
              subtitle={dueText(daysLeft, status)}
              amount={<MoneyText cents={bill.amount_cents} />}
              action={
                <Button size="sm" onClick={() => f.payBill(bill)}>
                  Pagar
                </Button>
              }
              onOpen={() => f.goTab("fixas")}
            />
          ))}
        </CardStack>
      </Collapse>
    </section>
  )
}

function CategoryCard({ row, bordered }: { row: CategorySpend; bordered: boolean }) {
  const { category, spent, limit, ratio } = row
  const color = useCategoryColor(category.id)
  const pct = ratio === null ? 0 : ratio * 100
  return (
    <div data-category-card={category.id} className={cn("flex min-w-0 flex-col gap-2 p-3", bordered ? LIST_CARD : "rounded-[12px] border border-border")}>
      <div className="flex items-center gap-3">
        <CategoryCircle id={category.id} name={category.name} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[15px] leading-6 font-medium">{category.name}</span>
            {ratio !== null && ratio > 1 ? (
              <StatusChip icon={CircleAlertIcon}>Acima do limite</StatusChip>
            ) : ratio !== null && ratio >= 0.9 ? (
              <StatusChip icon={TriangleAlertIcon}>Perto do limite</StatusChip>
            ) : null}
          </span>
          <span className="tabular truncate text-[13px] leading-5 text-muted-foreground">
            {formatBRL(spent)}
            {limit ? ` de ${formatBRL(limit)}` : " gasto"}
          </span>
        </div>
        {ratio !== null ? <span className="tabular shrink-0 text-[13px] leading-5 text-muted-foreground">{Math.round(pct)}%</span> : null}
      </div>
      {ratio !== null ? <ProgressBar thin value={pct} color={color} label={`Gasto em ${category.name}`} /> : null}
    </div>
  )
}

/** "Orçamento do mês" with, on desktop, "Onde estou gastando" inside it as a two-column grid. */
export function BudgetCard() {
  const f = useFinance()
  const categories = spendByCategory(f.categories, f.transactions, f.month)
  const budget = f.categories.reduce((sum, c) => sum + (c.monthly_limit_cents ?? 0), 0)
  const spentInBudget = categories.filter((c) => c.limit).reduce((sum, c) => sum + c.spent, 0)
  const pct = budget === 0 ? 0 : (spentInBudget / budget) * 100
  return (
    <section aria-label="Orçamento do mês" data-testid="budget-card" className={cn(SUMMARY_CARD, "flex flex-col gap-4 p-5")}>
      <CardHeader
        title="Orçamento do mês"
        actions={
          <Button variant="outline" size="sm" className="shrink-0" onClick={f.openLimits}>
            <PencilIcon strokeWidth={1.75} /> Editar limites
          </Button>
        }
      />
      <div className="flex flex-col gap-3">
        <div className="tabular flex items-baseline justify-between gap-3 text-[15px] leading-6">
          <span className="whitespace-nowrap">
            <span className="text-[22px] leading-8 font-semibold">{formatBRL(spentInBudget)}</span> <span className="text-muted-foreground">de {formatBRL(budget)}</span>
          </span>
          <span className="text-muted-foreground">{Math.round(pct)}%</span>
        </div>
        <ProgressBar value={pct} label="Orçamento usado" />
        <p className="text-[13px] leading-5 text-muted-foreground">
          {spentInBudget <= budget ? `Restam ${formatBRL(budget - spentInBudget)} até o fim do mês.` : `Você passou ${formatBRL(spentInBudget - budget)} do orçamento.`}
        </p>
      </div>
      {f.isMobile ? null : (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <h4 className="text-[15px] leading-6 font-semibold">Onde estou gastando</h4>
          {categories.length === 0 ? <p className="text-[13px] leading-5 text-muted-foreground">Nenhum gasto neste mês.</p> : null}
          <div className="grid gap-3 md:grid-cols-2">
            {categories.map((row) => (
              <CategoryCard key={row.category.id} row={row} bordered={false} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/** Phones: "Onde estou gastando" as separate cards (four, then a dashed "Ver todas as categorias"). */
export function SpendingList() {
  const f = useFinance()
  const [all, setAll] = useState(false)
  const categories = spendByCategory(f.categories, f.transactions, f.month)
  const shown = all ? categories : categories.slice(0, 4)
  return (
    <section aria-label="Onde estou gastando" data-testid="spending-list" className="flex flex-col">
      <h3 className="flex h-11 items-center text-[15px] font-semibold">Onde estou gastando</h3>
      <CardStack>
        {shown.map((row) => (
          <CategoryCard key={row.category.id} row={row} bordered />
        ))}
        {categories.length === 0 ? <p className="text-[13px] leading-5 text-muted-foreground">Nenhum gasto neste mês.</p> : null}
        {categories.length > 4 ? <AddPill label={all ? "Mostrar menos" : "Ver todas as categorias"} onClick={() => setAll((v) => !v)} /> : null}
      </CardStack>
    </section>
  )
}

export function EvolutionCard() {
  const f = useFinance()
  const series = monthlySeries(f.transactions, f.month, 6).map((s) => ({ ...s, label: format(parseISO(`${s.month}-01`), "MMM", { locale: ptBR }).replace(".", "") }))
  return (
    <section aria-label="Evolução nos últimos 6 meses" className={cn(SUMMARY_CARD, "flex flex-col gap-3 p-5")}>
      <CardHeader title="Evolução nos últimos 6 meses" />
      <ChartContainer config={chartConfig} className="aspect-auto h-[170px] w-full md:h-[190px]">
        <BarChart data={series} margin={{ left: 4, right: 4 }}>
          <CartesianGrid vertical={false} strokeOpacity={0.5} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => (v >= 100000 ? `${(v / 100000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : `${v / 100}`)} />
          <ChartTooltip content={<ChartTooltipContent className="border-border bg-popover text-popover-foreground" formatter={(value, name) => `${name === "income" ? "Entradas" : "Saídas"}: ${formatBRL(Number(value))}`} />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="income" fill="var(--color-income)" radius={6} />
          <Bar dataKey="expense" fill="var(--color-expense)" radius={6} />
        </BarChart>
      </ChartContainer>
    </section>
  )
}

export function AccountsCard() {
  const f = useFinance()
  return (
    <section aria-label="Contas e bancos" className={cn(SUMMARY_CARD, "flex flex-col gap-3 p-5")}>
      <CardHeader title="Contas e bancos" />
      <div className="flex flex-col gap-2">
        {f.accounts.map((account) => (
          <div key={account.id} data-account={account.id} className={cn(LIST_CARD, "flex min-h-14 items-center gap-3 px-3 py-2")}>
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50">
              {account.institution === "Dinheiro" ? <BanknoteIcon strokeWidth={1.75} className="size-[18px]" /> : <LandmarkIcon strokeWidth={1.75} className="size-[18px]" />}
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px] leading-6">{account.name}</span>
            <MoneyText cents={accountBalance(account, f.transactions)} tone="value" className="text-[15px] font-semibold" />
          </div>
        ))}
        {f.accounts.length === 0 ? <p className="text-[13px] leading-5 text-muted-foreground">Nenhuma conta ainda.</p> : null}
        <AddPill label="Adicionar conta…" onClick={f.openNewAccount} />
      </div>
    </section>
  )
}

