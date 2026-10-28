"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BanknoteIcon,
  CheckIcon,
  CarIcon,
  CircleAlertIcon,
  CircleDollarSignIcon,
  ClapperboardIcon,
  EllipsisIcon,
  HeartPulseIcon,
  HouseIcon,
  LandmarkIcon,
  PencilIcon,
  PlusIcon,
  RepeatIcon,
  SearchIcon,
  ShoppingCartIcon,
  TagIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UtensilsIcon,
  type LucideIcon,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { EmptyState } from "@/components/organizzou/EmptyState"
import { UpgradeHint } from "@/components/organizzou/UpgradeHint"
import { bentoCardClass, BentoCard, KpiCard } from "@/components/organizzou/Bento"
import { SplitLayout, StatRow } from "@/components/organizzou/layout"
import { Stat } from "@/components/organizzou/Stat"
import { SwipeRow } from "@/components/organizzou/SwipeRow"
import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { PageHeader, SectionTitle } from "@/components/organizzou/PageHeader"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { guessCategory } from "@/mocks/assistant"
import {
  accountBalance,
  billStatus,
  monthlyFixedTotal,
  monthlySeries,
  monthOf,
  spendByCategory,
  totalBalance,
  totals,
} from "@/features/finance/stats"
import type { FinancialGoalRow, RecurringBillRow, TransactionKind, TransactionRow } from "@/features/finance/types"
import { formatBRL, formatSignedBRL, parseBRL } from "@/lib/money"
import { cn } from "@/lib/utils"
import {
  buildMockBills,
  buildMockGoals,
  buildMockTransactions,
  mockAccounts,
  mockCategories,
} from "@/mocks/finance"
import { dayOf, mockId } from "@/mocks/time"

const USER = "00000000-0000-4000-8000-000000000001"

const chartConfig = {
  income: { label: "Entradas", color: "var(--chart-1)" },
  expense: { label: "Saídas", color: "var(--chart-4)" },
} satisfies ChartConfig

const BANKS = ["Nubank", "Itaú", "Bradesco", "Banco do Brasil", "Santander", "Inter", "Caixa", "C6 Bank"]

function categoryName(id: string | null) {
  return mockCategories.find((c) => c.id === id)?.name ?? "Sem categoria"
}

function accountName(id: string) {
  return mockAccounts.find((a) => a.id === id)?.name ?? ""
}

function dayLabel(day: string, today: string) {
  if (day === today) return "Hoje"
  const diff = Math.round((parseISO(today).getTime() - parseISO(day).getTime()) / 86_400_000)
  if (diff === 1) return "Ontem"
  return format(parseISO(day), "EEEE, d 'de' MMMM", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase())
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Moradia: HouseIcon,
  Mercado: ShoppingCartIcon,
  Restaurantes: UtensilsIcon,
  Transporte: CarIcon,
  Saúde: HeartPulseIcon,
  Lazer: ClapperboardIcon,
  Assinaturas: RepeatIcon,
  Salário: BanknoteIcon,
  "Renda extra": CircleDollarSignIcon,
}

/** Icon of a category (the icon identifies it: categories have no color of their own). */
function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = CATEGORY_ICONS[name] ?? TagIcon
  return <Icon aria-hidden strokeWidth={1.75} className={className} />
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-[14px] outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
        on ? "border-transparent bg-highlight font-medium text-highlight-foreground" : "border-border hover:bg-accent"
      )}
    >
      {children}
    </button>
  )
}

/** Progress ring: the arc is Tinta/Papel (foreground), never a thin Lima line. */
function ProgressRing({ value, label }: { value: number; label: string }) {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <div role="img" aria-label={`${label}: ${Math.round(value)}%`} className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-foreground" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <span className="tabular absolute inset-0 flex items-center justify-center text-[13px] font-semibold">{Math.round(value)}%</span>
    </div>
  )
}

export function FinancasScreen({ nowIso }: { nowIso: string }) {
  const today = dayOf(nowIso)
  const month = monthOf(today)
  const [transactions, setTransactions] = useState<TransactionRow[]>(() => buildMockTransactions(nowIso))
  const [bills, setBills] = useState<RecurringBillRow[]>(() => buildMockBills(nowIso))
  const [goals, setGoals] = useState<FinancialGoalRow[]>(() => buildMockGoals(nowIso))
  const [newTransaction, setNewTransaction] = useState(false)
  const [newBill, setNewBill] = useState(false)
  const [bankOpen, setBankOpen] = useState(false)
  const [goalToFund, setGoalToFund] = useState<FinancialGoalRow | null>(null)
  const [query, setQuery] = useState("")
  const [kindFilter, setKindFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [quick, setQuick] = useState("")
  const [editing, setEditing] = useState<TransactionRow | null>(null)
  const [toDelete, setToDelete] = useState<TransactionRow | null>(null)
  const [newGoal, setNewGoal] = useState(false)

  const month_totals = totals(transactions, month)
  const balance = totalBalance(mockAccounts, transactions)
  const categories = spendByCategory(mockCategories, transactions, month)
  const budget = mockCategories.reduce((sum, c) => sum + (c.monthly_limit_cents ?? 0), 0)
  const spentInBudget = categories.filter((c) => c.limit).reduce((sum, c) => sum + c.spent, 0)
  const series = monthlySeries(transactions, month, 6).map((s) => ({
    ...s,
    label: format(parseISO(`${s.month}-01`), "MMM", { locale: ptBR }),
  }))
  const billViews = bills.filter((b) => b.active).map((b) => billStatus(b, today)).sort((a, b) => a.dueOn.localeCompare(b.dueOn))
  const attention = billViews.filter((v) => v.status === "soon" || v.status === "overdue")

  const filtered = transactions.filter((t) => {
    if (kindFilter !== "all" && t.kind !== kindFilter) return false
    if (categoryFilter !== "all" && t.category_id !== categoryFilter) return false
    if (query.trim() && !t.description.toLowerCase().includes(query.trim().toLowerCase())) return false
    return true
  })
  const groups = filtered.reduce<Map<string, TransactionRow[]>>((map, t) => {
    const list = map.get(t.occurred_on) ?? []
    list.push(t)
    map.set(t.occurred_on, list)
    return map
  }, new Map())

  const filteredTotals = filtered.reduce((acc, t) => ({ ...acc, [t.kind]: acc[t.kind] + t.amount_cents }), { in: 0, out: 0 })
  const paidCount = billViews.filter((v) => v.status === "paid").length
  const pendingCount = billViews.length - paidCount

  function addTransaction(row: TransactionRow) {
    const exists = transactions.some((t) => t.id === row.id)
    setTransactions((current) => (exists ? current.map((t) => (t.id === row.id ? row : t)) : [row, ...current]).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)))
    toast.success(exists ? "Lançamento atualizado." : row.kind === "out" ? "Gasto registrado." : "Entrada registrada.")
  }

  /** "mercado 45,90" is a gasto; "+ salário 5000" is an entrada. Returns false when it cannot be read. */
  function quickAdd(text: string) {
    const income = text.trim().startsWith("+")
    const match = text.replace(/^\+/, "").trim().match(/^(.*?)\s*(?:R\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*$/)
    const cents = match ? parseBRL(match[2]) : null
    const description = match?.[1].trim()
    if (!cents || !description) return false
    const name = income ? "Salário" : guessCategory(description)
    addTransaction({
      id: mockId("tx"),
      user_id: USER,
      account_id: mockAccounts[0].id,
      category_id: mockCategories.find((c) => c.name === name)?.id ?? mockCategories[0].id,
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

  function removeTransaction() {
    const row = toDelete
    setToDelete(null)
    if (!row) return
    setTransactions((current) => current.filter((t) => t.id !== row.id))
    toast("Lançamento excluído.")
  }

  function payBill(bill: RecurringBillRow) {
    setBills((current) => current.map((b) => (b.id === bill.id ? { ...b, last_paid_month: month } : b)))
    addTransaction({
      id: mockId("tx"),
      user_id: USER,
      account_id: mockAccounts[0].id,
      category_id: bill.category_id,
      kind: "out",
      amount_cents: bill.amount_cents,
      occurred_on: today,
      method: "Pix",
      description: bill.name,
      source: "manual",
      created_at: nowIso,
      updated_at: nowIso,
    })
  }

  usePrimaryAction("Novo lançamento", () => setNewTransaction(true))

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        actions={
          <Button variant="outline" onClick={() => setBankOpen(true)}>
            <LandmarkIcon strokeWidth={1.75} /> Conectar banco
          </Button>
        }
      />

      <Tabs defaultValue="visao">
        <TabsList>
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="fixas">Contas fixas</TabsTrigger>
          <TabsTrigger value="metas">Metas</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------ overview */}
        <TabsContent value="visao" className="pt-5">
          <div className="flex flex-col gap-5">
            <StatRow min={200}>
              <KpiCard tone="highlight" label="Saldo total" value={formatBRL(balance)} support={`${mockAccounts.length} contas`} />
              <KpiCard label="Entradas do mês" value={formatBRL(month_totals.income)} trend="up" support="+ recebido" />
              <KpiCard label="Saídas do mês" value={formatBRL(month_totals.expense)} trend="down" support="− gasto" />
              <KpiCard
                label="Sobra do mês"
                value={formatBRL(Math.abs(month_totals.surplus))}
                trend={month_totals.surplus >= 0 ? "up" : "down"}
                support={month_totals.surplus >= 0 ? "no azul" : "acima da renda"}
              />
            </StatRow>

            <SplitLayout
              aside={
                <>
                  <BentoCard title="Evolução nos últimos 6 meses">
                    <ChartContainer config={chartConfig} className="aspect-[16/10] w-full">
                      <BarChart data={series} margin={{ left: 4, right: 4 }}>
                        <CartesianGrid vertical={false} strokeOpacity={0.5} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => (v >= 100000 ? `${(v / 100000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : `${v / 100}`)} />
                        <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => `${name === "income" ? "Entradas" : "Saídas"}: ${formatBRL(Number(value))}`} />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="income" fill="var(--color-income)" radius={6} />
                        <Bar dataKey="expense" fill="var(--color-expense)" radius={6} />
                      </BarChart>
                    </ChartContainer>
                  </BentoCard>
                  <BentoCard title="Contas e bancos">
                    <div>
                      {mockAccounts.map((account) => (
                        <div key={account.id} className="flex min-h-14 items-center gap-4 border-b border-border py-3 last:border-b-0">
                          {account.institution === "Dinheiro" ? (
                            <BanknoteIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
                          ) : (
                            <LandmarkIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
                          )}
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-[15px] leading-6">{account.name}</span>
                          </div>
                          <span className="tabular text-[15px]">{formatBRL(accountBalance(account, transactions))}</span>
                        </div>
                      ))}
                    </div>
                  </BentoCard>
                </>
              }
            >
              <div className="flex flex-col gap-5">
                {attention.length > 0 ? (
                  <BentoCard title="Contas para ficar de olho">
                    <div>
                      {attention.map(({ bill, status, daysLeft }) => (
                        <div key={bill.id} className="flex min-h-14 items-center gap-4 border-b border-border py-3 last:border-b-0">
                          <TriangleAlertIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-[15px] leading-6">{bill.name}</span>
                            <span className="text-[13px] leading-5 text-muted-foreground">
                              {status === "overdue" ? `Venceu há ${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? "dia" : "dias"}` : daysLeft === 0 ? "Vence hoje" : `Vence em ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`}
                            </span>
                          </div>
                          <span className="tabular text-[15px]">{formatBRL(bill.amount_cents)}</span>
                          <Button variant="outline" size="sm" onClick={() => payBill(bill)}>
                            Pagar
                          </Button>
                        </div>
                      ))}
                    </div>
                  </BentoCard>
                ) : null}

                <BentoCard title="Orçamento do mês" bodyClassName="flex flex-col gap-3">
                  <div className="tabular flex justify-between text-[15px] leading-6">
                    <span>
                      {formatBRL(spentInBudget)} <span className="text-muted-foreground">de {formatBRL(budget)}</span>
                    </span>
                    <span className="text-muted-foreground">{budget === 0 ? 0 : Math.round((spentInBudget / budget) * 100)}%</span>
                  </div>
                  <Progress value={budget === 0 ? 0 : Math.min(100, (spentInBudget / budget) * 100)} aria-label="Orçamento usado" />
                  <p className="text-[13px] leading-5 text-muted-foreground">
                    {spentInBudget <= budget ? `Restam ${formatBRL(budget - spentInBudget)} até o fim do mês.` : `Você passou ${formatBRL(spentInBudget - budget)} do orçamento.`}
                  </p>
                </BentoCard>

                <BentoCard title="Onde estou gastando" bodyClassName="flex flex-col gap-4">
                  {categories.map(({ category, spent, limit, ratio }) => (
                    <div key={category.id} className="flex flex-col gap-2">
                      <div className="flex items-baseline justify-between gap-3 text-[15px] leading-6">
                        <span className="flex items-center gap-2">
                          <CategoryIcon name={category.name} className="size-4 text-muted-foreground" />
                          {category.name}
                          {ratio !== null && ratio >= 1 ? (
                            <span className="inline-flex items-center gap-1 text-[13px] leading-5 font-medium">
                              <CircleAlertIcon aria-hidden strokeWidth={1.75} className="size-3.5" /> Acima do limite
                            </span>
                          ) : ratio !== null && ratio >= 0.85 ? (
                            <span className="inline-flex items-center gap-1 text-[13px] leading-5 text-muted-foreground">
                              <TriangleAlertIcon aria-hidden strokeWidth={1.75} className="size-3.5" /> Perto do limite
                            </span>
                          ) : null}
                        </span>
                        <span className="tabular text-[13px] leading-5 text-muted-foreground">
                          {formatBRL(spent)}
                          {limit ? ` de ${formatBRL(limit)}` : ""}
                        </span>
                      </div>
                      <Progress value={ratio === null ? 0 : Math.min(100, ratio * 100)} aria-label={`Gasto em ${category.name}`} />
                    </div>
                  ))}
                </BentoCard>
              </div>
            </SplitLayout>
          </div>
        </TabsContent>

        {/* --------------------------------------------------- transactions */}
        <TabsContent value="lancamentos" className="pt-5">
          <SplitLayout
            aside={
              <>
                <BentoCard title="Resumo da lista">
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Stat size="xs" label="Entradas" value={formatBRL(filteredTotals.in)} trend="up" />
                      <Stat size="xs" label="Saídas" value={formatBRL(filteredTotals.out)} trend="down" />
                    </div>
                    <p className="text-[13px] leading-5 text-muted-foreground">
                      {filtered.length} {filtered.length === 1 ? "lançamento" : "lançamentos"} com os filtros atuais.
                    </p>
                  </div>
                </BentoCard>
                <BentoCard title="Maiores categorias do mês" bodyClassName="flex flex-col">
                  {categories
                    .filter((c) => c.spent > 0)
                    .sort((x, y) => y.spent - x.spent)
                    .slice(0, 5)
                    .map(({ category, spent }) => (
                      <div key={category.id} className="flex min-h-11 items-center gap-3 border-b border-border last:border-b-0">
                        <CategoryIcon name={category.name} className="size-4 text-muted-foreground" />
                        <span className="flex-1 truncate text-[15px]">{category.name}</span>
                        <span className="tabular text-[13px] text-muted-foreground">{formatBRL(spent)}</span>
                      </div>
                    ))}
                </BentoCard>
              </>
            }
          >
            <BentoCard bodyClassName="flex flex-col gap-5">
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (quickAdd(quick)) setQuick("")
                  else toast("Escreva a descrição e o valor, por exemplo: mercado 45,90")
                }}
              >
                <Input
                  value={quick}
                  onChange={(e) => setQuick(e.target.value)}
                  aria-label="Adicionar lançamento rápido"
                  placeholder='Adicionar rápido: "mercado 45,90" (ou "+ salário 5000")'
                  className="h-11"
                />
                <Button type="submit" disabled={!quick.trim()}>
                  <PlusIcon strokeWidth={1.75} /> Adicionar
                </Button>
              </form>

              <div className="flex flex-col gap-3">
                <div className="relative min-w-0 md:max-w-80">
                  <SearchIcon aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar lançamentos" aria-label="Buscar lançamentos" className="pl-9" />
                </div>
                <div role="group" aria-label="Filtrar por tipo e categoria" className="no-scrollbar flex gap-2 overflow-x-auto">
                  {[
                    { id: "all", label: "Todos", set: () => setKindFilter("all"), on: kindFilter === "all" },
                    { id: "in", label: "Entradas", set: () => setKindFilter(kindFilter === "in" ? "all" : "in"), on: kindFilter === "in" },
                    { id: "out", label: "Saídas", set: () => setKindFilter(kindFilter === "out" ? "all" : "out"), on: kindFilter === "out" },
                  ].map((chip) => (
                    <FilterChip key={chip.id} on={chip.on} onClick={chip.set}>
                      {chip.label}
                    </FilterChip>
                  ))}
                  <span aria-hidden className="mx-1 w-px shrink-0 self-stretch bg-border" />
                  {mockCategories.map((c) => (
                    <FilterChip key={c.id} on={categoryFilter === c.id} onClick={() => setCategoryFilter(categoryFilter === c.id ? "all" : c.id)}>
                      {c.name}
                    </FilterChip>
                  ))}
                </div>
              </div>

              {filtered.length === 0 ? (
                <EmptyState icon={SearchIcon} title="Nenhum lançamento encontrado" description="Ajuste a busca ou os filtros." />
              ) : (
                <div className="@container">
                  <div className="gap-x-10 @min-[860px]:columns-2">
                    {[...groups.entries()].map(([day, rows]) => {
                      const net = rows.reduce((sum, t) => sum + (t.kind === "in" ? t.amount_cents : -t.amount_cents), 0)
                      return (
                        <section key={day} className="mb-8 break-inside-avoid">
                          <div className="mb-1 flex items-baseline justify-between gap-3">
                            <SectionTitle>{dayLabel(day, today)}</SectionTitle>
                            <span className="tabular text-[13px] leading-5 text-muted-foreground">{formatSignedBRL(Math.abs(net), net >= 0 ? "in" : "out")}</span>
                          </div>
                          {rows.map((t) => (
                            <SwipeRow key={t.id} rightLabel="Editar" onSwipeRight={() => setEditing(t)} onSwipeLeft={() => setToDelete(t)}>
                              <div className="flex min-h-14 items-center gap-3 border-b border-border bg-card py-2.5 last:border-b-0">
                                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border">
                                  <CategoryIcon name={categoryName(t.category_id)} className="size-[18px]" />
                                </span>
                                <div className="flex min-w-0 flex-1 flex-col">
                                  <span className="truncate text-[15px] leading-6">{t.description}</span>
                                  <span className="truncate text-[13px] leading-5 text-muted-foreground">
                                    {categoryName(t.category_id)} · {accountName(t.account_id)}
                                  </span>
                                </div>
                                {t.source === "open_finance" ? <Badge variant="outline" className="hidden sm:inline-flex">Importado</Badge> : null}
                                <span className="tabular shrink-0 text-[15px] font-medium">{formatSignedBRL(t.amount_cents, t.kind)}</span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${t.description}`}>
                                      <EllipsisIcon strokeWidth={1.75} />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => setEditing(t)}>
                                      <PencilIcon strokeWidth={1.75} /> Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(t)}>
                                      <Trash2Icon strokeWidth={1.75} /> Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </SwipeRow>
                          ))}
                        </section>
                      )
                    })}
                  </div>
                </div>
              )}
            </BentoCard>
          </SplitLayout>
        </TabsContent>

        {/* ------------------------------------------------------- bills */}
        <TabsContent value="fixas" className="pt-5">
          <SplitLayout
            asideFirst
            aside={
              <>
                <section aria-label="Total fixo por mês" className={cn(bentoCardClass("highlight"), "flex flex-col gap-3 p-5")}>
                  <span className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-highlight-foreground/70 uppercase">Total fixo por mês</span>
                  <span className="tabular text-[30px] leading-9 font-semibold tracking-[-0.02em] whitespace-nowrap">{formatBRL(monthlyFixedTotal(bills))}</span>
                  <span className="tabular flex items-center gap-4 text-[13px] leading-5 text-highlight-foreground/80">
                    <span className="inline-flex items-center gap-1">
                      <CheckIcon aria-hidden strokeWidth={1.75} className="size-3.5" /> {paidCount} {paidCount === 1 ? "paga" : "pagas"}
                    </span>
                    <span>
                      {pendingCount} {pendingCount === 1 ? "pendente" : "pendentes"}
                    </span>
                  </span>
                </section>
                <BentoCard title="Próximos vencimentos" bodyClassName="flex flex-col">
                  {billViews
                    .filter((v) => v.status !== "paid")
                    .slice(0, 4)
                    .map(({ bill, daysLeft, status }) => (
                      <div key={bill.id} className="flex min-h-11 items-center gap-3 border-b border-border last:border-b-0">
                        <span className="flex-1 truncate text-[15px]">{bill.name}</span>
                        <span className="tabular text-[13px] text-muted-foreground">{status === "overdue" ? "Atrasada" : daysLeft === 0 ? "Hoje" : `Em ${daysLeft} d`}</span>
                      </div>
                    ))}
                </BentoCard>
              </>
            }
          >
            <BentoCard
              title="Contas fixas"
              actions={
                <Button variant="outline" size="sm" onClick={() => setNewBill(true)}>
                  <PlusIcon strokeWidth={1.75} /> Nova conta fixa
                </Button>
              }
            >
              <div>
                {billViews.map(({ bill, status, daysLeft }) => (
                  <div key={bill.id} className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-3 last:border-b-0">
                    <div className="tabular flex w-12 shrink-0 flex-col items-center text-[13px] leading-4 text-muted-foreground">
                      <span className="text-[11px] tracking-[0.12em] uppercase">dia</span>
                      <span className="text-[17px] font-semibold text-foreground">{bill.due_day}</span>
                    </div>
                    <div className="flex min-w-0 flex-1 basis-40 flex-col">
                      <span className="truncate text-[15px] leading-6">{bill.name}</span>
                      <span className="text-[13px] leading-5 text-muted-foreground">{categoryName(bill.category_id)}</span>
                    </div>
                    <span className="tabular text-[15px]">{formatBRL(bill.amount_cents)}</span>
                    {status === "paid" ? (
                      <Badge variant="secondary" className="h-8 px-3">
                        <CheckIcon /> Pago
                      </Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        {status === "overdue" ? (
                          <span className="inline-flex items-center gap-1 text-[13px] leading-5 font-medium">
                            <CircleAlertIcon aria-hidden strokeWidth={1.75} className="size-4" /> Atrasada
                          </span>
                        ) : status === "soon" ? (
                          <Badge variant="highlight">{daysLeft === 0 ? "Hoje" : `Em ${daysLeft} d`}</Badge>
                        ) : (
                          <span className="text-[13px] leading-5 text-muted-foreground">Pendente</span>
                        )}
                        <Button variant="outline" size="sm" onClick={() => payBill(bill)}>
                          Pagar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </BentoCard>
          </SplitLayout>
        </TabsContent>

        {/* ------------------------------------------------------- goals */}
        <TabsContent value="metas" className="pt-5">
          <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))" }}>
            {goals.map((goal) => {
              const ratio = Math.min(100, (goal.current_cents / goal.target_cents) * 100)
              const remaining = Math.max(0, goal.target_cents - goal.current_cents)
              const monthsLeft = goal.deadline ? Math.max(1, Math.ceil((parseISO(goal.deadline).getTime() - parseISO(today).getTime()) / (30 * 86_400_000))) : null
              return (
                <section key={goal.id} aria-label={goal.name} className={cn(bentoCardClass(), "flex flex-col gap-4")}>
                  <div className="flex items-center gap-4">
                    <ProgressRing value={ratio} label={`Progresso de ${goal.name}`} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[17px] leading-6 font-semibold">{goal.name}</span>
                      <span className="tabular text-[13px] leading-5 text-muted-foreground">
                        {formatBRL(goal.current_cents)} de {formatBRL(goal.target_cents)}
                      </span>
                      {goal.deadline ? <span className="text-[13px] leading-5 text-muted-foreground">Até {format(parseISO(goal.deadline), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span> : null}
                    </div>
                  </div>
                  <p className="min-h-10 text-[13px] leading-5 text-muted-foreground">
                    {remaining === 0
                      ? "Meta alcançada."
                      : monthsLeft
                        ? `Guardando ${formatBRL(Math.ceil(remaining / monthsLeft))} por mês você chega em ${format(parseISO(goal.deadline as string), "MMM 'de' yyyy", { locale: ptBR })}.`
                        : `Faltam ${formatBRL(remaining)}.`}
                  </p>
                  <Button variant="outline" className="self-start" onClick={() => setGoalToFund(goal)}>
                    <PlusIcon strokeWidth={1.75} /> Guardar
                  </Button>
                </section>
              )
            })}
            <button
              type="button"
              onClick={() => setNewGoal(true)}
              className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-[24px] border border-dashed border-border p-6 text-[15px] text-muted-foreground outline-none transition-colors duration-[400ms] hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
            >
              <PlusIcon aria-hidden strokeWidth={1.75} className="size-6" />
              Nova meta
            </button>
          </div>
        </TabsContent>
      </Tabs>

      <TransactionDialog open={newTransaction} onOpenChange={setNewTransaction} today={today} nowIso={nowIso} onCreate={addTransaction} />
      <TransactionDialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} today={today} nowIso={nowIso} onCreate={addTransaction} row={editing} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir este lançamento?"
        description={toDelete ? `“${toDelete.description}” (${formatBRL(toDelete.amount_cents)}) será apagado. Essa ação não pode ser desfeita.` : ""}
        onConfirm={removeTransaction}
      />
      <NewGoalDialog
        open={newGoal}
        onOpenChange={setNewGoal}
        onCreate={(goal) => {
          setGoals((current) => [...current, goal])
          toast.success("Meta criada.")
        }}
        nowIso={nowIso}
      />
      <BillDialog
        open={newBill}
        onOpenChange={setNewBill}
        onCreate={(bill) => {
          setBills((current) => [...current, bill])
          toast.success("Conta fixa criada.")
        }}
        nowIso={nowIso}
      />
      <GoalFundDialog
        goal={goalToFund}
        onClose={() => setGoalToFund(null)}
        onFund={(goal, cents) => {
          setGoals((current) => current.map((g) => (g.id === goal.id ? { ...g, current_cents: g.current_cents + cents } : g)))
          toast.success(`${formatBRL(cents)} guardados em ${goal.name}.`)
        }}
      />
      <Dialog open={bankOpen} onOpenChange={setBankOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar banco</DialogTitle>
            <DialogDescription>
              A importação pelo Open Finance ainda não está disponível, então nenhum banco pode ser conectado por enquanto. Quando abrir, o Organizzou só vai ler os dados e nunca vai guardar a senha do seu banco.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col">
            {BANKS.map((bank) => (
              <div key={bank} className="flex min-h-12 items-center gap-3 border-b border-border py-2 last:border-b-0">
                <LandmarkIcon aria-hidden strokeWidth={1.75} className="size-5 text-muted-foreground" />
                <span className="flex-1 text-[15px]">{bank}</span>
                <Button variant="outline" size="sm" disabled>
                  Em breve
                </Button>
              </div>
            ))}
            <UpgradeHint limit="banks" used={0} when="always" className="mt-4" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ------------------------------------------------------------- dialogs

function TransactionDialog({
  open,
  onOpenChange,
  today,
  nowIso,
  onCreate,
  row,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  today: string
  nowIso: string
  onCreate: (row: TransactionRow) => void
  row?: TransactionRow | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? <TransactionForm key={row?.id ?? "new"} today={today} nowIso={nowIso} onCreate={onCreate} onClose={() => onOpenChange(false)} row={row} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function TransactionForm({
  today,
  nowIso,
  onCreate,
  onClose,
  row,
}: {
  today: string
  nowIso: string
  onCreate: (row: TransactionRow) => void
  onClose: () => void
  row?: TransactionRow | null
}) {
  const [kind, setKind] = useState<TransactionKind>(row?.kind ?? "out")
  const [amount, setAmount] = useState(row ? (row.amount_cents / 100).toFixed(2).replace(".", ",") : "")
  const [description, setDescription] = useState(row?.description ?? "")
  const [category, setCategory] = useState(row?.category_id ?? mockCategories[1].id)
  const [account, setAccount] = useState(row?.account_id ?? mockAccounts[0].id)
  const [date, setDate] = useState(row?.occurred_on ?? today)
  const cents = parseBRL(amount)
  const valid = Boolean(cents && cents > 0 && description.trim())
  const options = mockCategories.filter((c) => (kind === "in" ? ["Salário", "Renda extra"].includes(c.name) : !["Salário", "Renda extra"].includes(c.name)))

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid || !cents) return
        onCreate({
          ...(row ?? {}),
          id: row?.id ?? mockId("tx"),
          user_id: USER,
          account_id: account,
          category_id: category,
          kind,
          amount_cents: cents,
          occurred_on: date,
          method: null,
          description: description.trim(),
          source: "manual",
          created_at: nowIso,
          updated_at: nowIso,
        })
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>{row ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
        <DialogDescription className="sr-only">Registre uma entrada ou um gasto.</DialogDescription>
      </DialogHeader>
      <ToggleGroup
        type="single"
        variant="outline"
        value={kind}
        onValueChange={(v) => {
          if (!v) return
          setKind(v as TransactionKind)
          const first = mockCategories.find((c) => (v === "in" ? ["Salário", "Renda extra"].includes(c.name) : !["Salário", "Renda extra"].includes(c.name)))
          if (first) setCategory(first.id)
        }}
        className="justify-start"
      >
        <ToggleGroupItem value="out">
          <ArrowDownRightIcon strokeWidth={1.75} /> Gasto
        </ToggleGroupItem>
        <ToggleGroupItem value="in">
          <ArrowUpRightIcon strokeWidth={1.75} /> Entrada
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tx-amount">Valor</Label>
          <Input id="tx-amount" autoFocus inputMode="decimal" placeholder="R$ 0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tx-date">Data</Label>
          <Input id="tx-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="tx-desc">Descrição</Label>
        <Input id="tx-desc" value={description} maxLength={80} placeholder="Ex.: Mercado do bairro" onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tx-category">Categoria</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="tx-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tx-account">Conta</Label>
          <Select value={account} onValueChange={setAccount}>
            <SelectTrigger id="tx-account" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mockAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!valid}>
          Salvar
        </Button>
      </DialogFooter>
    </form>
  )
}

function BillDialog({
  open,
  onOpenChange,
  onCreate,
  nowIso,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (bill: RecurringBillRow) => void
  nowIso: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open ? <BillForm nowIso={nowIso} onCreate={onCreate} onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  )
}

function BillForm({ nowIso, onCreate, onClose }: { nowIso: string; onCreate: (bill: RecurringBillRow) => void; onClose: () => void }) {
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [day, setDay] = useState("10")
  const cents = parseBRL(amount)
  const dueDay = Math.min(28, Math.max(1, Number(day) || 1))

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!cents || !name.trim()) return
        onCreate({
          id: mockId("bill"),
          user_id: USER,
          name: name.trim(),
          amount_cents: cents,
          due_day: dueDay,
          category_id: mockCategories[6].id,
          active: true,
          last_paid_month: null,
          created_at: nowIso,
          updated_at: nowIso,
        })
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>Nova conta fixa</DialogTitle>
        <DialogDescription className="sr-only">Cadastre uma conta ou assinatura mensal.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="bill-name">Nome</Label>
        <Input id="bill-name" autoFocus value={name} maxLength={60} placeholder="Ex.: Disney+" onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="bill-amount">Valor</Label>
          <Input id="bill-amount" inputMode="decimal" placeholder="R$ 0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bill-day">Vence no dia</Label>
          <Input id="bill-day" type="number" min={1} max={28} value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!cents || !name.trim()}>
          Criar conta fixa
        </Button>
      </DialogFooter>
    </form>
  )
}

function GoalFundDialog({
  goal,
  onClose,
  onFund,
}: {
  goal: FinancialGoalRow | null
  onClose: () => void
  onFund: (goal: FinancialGoalRow, cents: number) => void
}) {
  const [amount, setAmount] = useState("")
  const cents = parseBRL(amount)

  return (
    <Dialog
      open={Boolean(goal)}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
          setAmount("")
        }
      }}
    >
      <DialogContent>
        {goal ? (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (!cents || cents <= 0) return
              onFund(goal, cents)
              setAmount("")
              onClose()
            }}
          >
            <DialogHeader>
              <DialogTitle>Guardar para “{goal.name}”</DialogTitle>
              <DialogDescription>
                Faltam {formatBRL(Math.max(0, goal.target_cents - goal.current_cents))} para chegar lá.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fund-amount">Valor</Label>
              <Input id="fund-amount" autoFocus inputMode="decimal" placeholder="R$ 0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!cents}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function NewGoalDialog({ open, onOpenChange, onCreate, nowIso }: { open: boolean; onOpenChange: (open: boolean) => void; onCreate: (goal: FinancialGoalRow) => void; nowIso: string }) {
  const [name, setName] = useState("")
  const [target, setTarget] = useState("")
  const [deadline, setDeadline] = useState("")
  const cents = parseBRL(target)
  const valid = Boolean(name.trim() && cents && cents > 0)

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value)
        if (!value) {
          setName("")
          setTarget("")
          setDeadline("")
        }
      }}
    >
      <DialogContent>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid || !cents) return
            onCreate({ id: mockId("goal"), user_id: USER, name: name.trim(), target_cents: cents, current_cents: 0, deadline: deadline || null, created_at: nowIso, updated_at: nowIso })
            onOpenChange(false)
            setName("")
            setTarget("")
            setDeadline("")
          }}
        >
          <DialogHeader>
            <DialogTitle>Nova meta</DialogTitle>
            <DialogDescription className="sr-only">Crie uma meta de economia.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="goal-name">Nome</Label>
            <Input id="goal-name" autoFocus value={name} maxLength={60} placeholder="Ex.: Viagem de fim de ano" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="goal-target">Valor da meta</Label>
              <Input id="goal-target" inputMode="decimal" placeholder="R$ 0,00" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="goal-deadline">Prazo (opcional)</Label>
              <Input id="goal-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valid}>
              Criar meta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
