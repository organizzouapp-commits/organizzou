"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BanknoteIcon,
  CheckIcon,
  CircleAlertIcon,
  LandmarkIcon,
  PlusIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { EmptyState } from "@/components/organizzou/EmptyState"
import { UpgradeHint } from "@/components/organizzou/UpgradeHint"
import { Bento, BentoCard, KpiCard } from "@/components/organizzou/Bento"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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
  // Open Finance is not built yet (docs/INTEGRATIONS-STATUS.md): no bank is ever shown as connected.
  const connected: string[] = []
  const [query, setQuery] = useState("")
  const [kindFilter, setKindFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")

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

  function addTransaction(row: TransactionRow) {
    setTransactions((current) => [row, ...current].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)))
    toast.success(row.kind === "out" ? "Gasto registrado." : "Entrada registrada.")
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
          <Bento>
          <KpiCard tone="highlight" label="Saldo total" value={formatBRL(balance)} support={`${mockAccounts.length} contas`} className="col-span-12 @min-[560px]:col-span-6 @min-[1040px]:col-span-3" />
          <KpiCard label="Entradas do mês" value={formatBRL(month_totals.income)} trend="up" support="+ recebido" className="col-span-6 @min-[1040px]:col-span-3" />
          <KpiCard label="Saídas do mês" value={formatBRL(month_totals.expense)} trend="down" support="− gasto" className="col-span-6 @min-[1040px]:col-span-3" />
          <KpiCard
            label="Sobra do mês"
            value={formatBRL(Math.abs(month_totals.surplus))}
            trend={month_totals.surplus >= 0 ? "up" : "down"}
            support={month_totals.surplus >= 0 ? "no azul" : "acima da renda"}
            className="col-span-12 @min-[560px]:col-span-6 @min-[1040px]:col-span-3"
          />

          {attention.length > 0 ? (
            <BentoCard title="Contas para ficar de olho" className="col-span-12 @min-[900px]:col-span-7">
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

          <BentoCard title="Orçamento do mês" className={cn("col-span-12", attention.length > 0 ? "@min-[900px]:col-span-5" : "@min-[900px]:col-span-12")} bodyClassName="flex flex-col gap-3">
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

          <BentoCard title="Onde estou gastando" className="col-span-12 @min-[900px]:col-span-7" bodyClassName="flex flex-col gap-4">
            {categories.map(({ category, spent, limit, ratio }) => (
              <div key={category.id} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3 text-[15px] leading-6">
                  <span className="flex items-center gap-2">
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

          <BentoCard title="Evolução nos últimos 6 meses" className="col-span-12 @min-[900px]:col-span-5">
            <ChartContainer config={chartConfig} className="aspect-[16/10] w-full">
              <BarChart data={series} margin={{ left: 4, right: 4 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.5} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => (v >= 100000 ? `${(v / 100000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : `${v / 100}`)} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatBRL(Number(value))} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="income" fill="var(--color-income)" radius={6} />
                <Bar dataKey="expense" fill="var(--color-expense)" radius={6} />
              </BarChart>
            </ChartContainer>
          </BentoCard>

          <BentoCard title="Contas e bancos" className="col-span-12">
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
                    {connected.includes(account.institution) ? (
                      <span className="text-[13px] leading-5 text-muted-foreground">Sincronizado pelo Open Finance</span>
                    ) : null}
                  </div>
                  <span className="tabular text-[15px]">{formatBRL(accountBalance(account, transactions))}</span>
                </div>
              ))}
            </div>
          </BentoCard>
          </Bento>
        </TabsContent>

        {/* --------------------------------------------------- transactions */}
        <TabsContent value="lancamentos" className="pt-5">
          <Bento>
          <BentoCard className="col-span-12" bodyClassName="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-48 md:max-w-80">
              <SearchIcon aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar lançamentos" aria-label="Buscar lançamentos" className="pl-9" />
            </div>
            <ToggleGroup type="single" variant="outline" value={kindFilter} onValueChange={(v) => setKindFilter(v || "all")}>
              <ToggleGroupItem value="all">Todos</ToggleGroupItem>
              <ToggleGroupItem value="in">Entradas</ToggleGroupItem>
              <ToggleGroupItem value="out">Saídas</ToggleGroupItem>
            </ToggleGroup>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger aria-label="Categoria" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {mockCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={SearchIcon} title="Nenhum lançamento encontrado" description="Ajuste a busca ou os filtros." />
          ) : (
            <div className="flex flex-col gap-8">
              {[...groups.entries()].map(([day, rows]) => (
                <section key={day} className="flex flex-col">
                  <SectionTitle className="mb-1">{dayLabel(day, today)}</SectionTitle>
                  {rows.map((t) => {
                    const Icon = t.kind === "in" ? ArrowUpRightIcon : ArrowDownRightIcon
                    return (
                      <div key={t.id} className="flex min-h-14 items-center gap-4 border-b border-border py-3 last:border-b-0">
                        <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[15px] leading-6">{t.description}</span>
                          <span className="truncate text-[13px] leading-5 text-muted-foreground">
                            {categoryName(t.category_id)} · {accountName(t.account_id)}
                          </span>
                        </div>
                        {t.source === "open_finance" ? <Badge variant="outline" className="hidden sm:inline-flex">Importado</Badge> : null}
                        <span className="tabular shrink-0 text-[15px] font-medium">{formatSignedBRL(t.amount_cents, t.kind)}</span>
                      </div>
                    )
                  })}
                </section>
              ))}
            </div>
          )}
          </BentoCard>
          </Bento>
        </TabsContent>

        {/* ------------------------------------------------------- bills */}
        <TabsContent value="fixas" className="pt-5">
          <Bento>
          <KpiCard tone="highlight" label="Total fixo por mês" value={formatBRL(monthlyFixedTotal(bills))} support={`${bills.filter((b) => b.active).length} contas e assinaturas`} className="col-span-12 @min-[1000px]:col-span-4" />
          <BentoCard
            title="Contas fixas"
            className="col-span-12 @min-[900px]:col-span-8"
            actions={
              <Button variant="outline" size="sm" onClick={() => setNewBill(true)}>
                <PlusIcon strokeWidth={1.75} /> Nova conta fixa
              </Button>
            }
          >
          <div>
            {billViews.map(({ bill, status, daysLeft }) => (
              <div key={bill.id} className="flex min-h-14 items-center gap-4 border-b border-border py-3 last:border-b-0">
                <div className="tabular flex w-12 shrink-0 flex-col items-center text-[13px] leading-4 text-muted-foreground">
                  <span className="text-[11px] tracking-[0.12em] uppercase">dia</span>
                  <span className="text-[17px] font-semibold text-foreground">{bill.due_day}</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] leading-6">{bill.name}</span>
                  <span className="text-[13px] leading-5 text-muted-foreground">{categoryName(bill.category_id)}</span>
                </div>
                <span className="tabular text-[15px]">{formatBRL(bill.amount_cents)}</span>
                {status === "paid" ? (
                  <Badge variant="secondary">
                    <CheckIcon /> Paga
                  </Badge>
                ) : (
                  <div className="flex items-center gap-2">
                    {status === "overdue" ? (
                      <Badge variant="destructive">
                        <CircleAlertIcon /> Atrasada
                      </Badge>
                    ) : status === "soon" ? (
                      <Badge variant="highlight">{daysLeft === 0 ? "Hoje" : `Em ${daysLeft} d`}</Badge>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => payBill(bill)}>
                      Pagar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          </BentoCard>
          </Bento>
        </TabsContent>

        {/* ------------------------------------------------------- goals */}
        <TabsContent value="metas" className="pt-5">
          <Bento>
          {goals.map((goal) => {
            const ratio = Math.min(100, (goal.current_cents / goal.target_cents) * 100)
            return (
              <BentoCard key={goal.id} className="col-span-12 @min-[1000px]:col-span-4" bodyClassName="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-[17px] leading-6 font-semibold">{goal.name}</span>
                    {goal.deadline ? (
                      <span className="text-[13px] leading-5 text-muted-foreground">
                        Até {format(parseISO(goal.deadline), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </span>
                    ) : null}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setGoalToFund(goal)}>
                    <PlusIcon strokeWidth={1.75} /> Guardar
                  </Button>
                </div>
                <Progress value={ratio} aria-label={`Progresso de ${goal.name}`} />
                <div className="tabular flex justify-between text-[13px] leading-5">
                  <span>{formatBRL(goal.current_cents)}</span>
                  <span className="text-muted-foreground">
                    {Math.round(ratio)}% de {formatBRL(goal.target_cents)}
                  </span>
                </div>
              </BentoCard>
            )
          })}
          </Bento>
        </TabsContent>
      </Tabs>

      <TransactionDialog open={newTransaction} onOpenChange={setNewTransaction} today={today} nowIso={nowIso} onCreate={addTransaction} />
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  today: string
  nowIso: string
  onCreate: (row: TransactionRow) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? <TransactionForm today={today} nowIso={nowIso} onCreate={onCreate} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function TransactionForm({
  today,
  nowIso,
  onCreate,
  onClose,
}: {
  today: string
  nowIso: string
  onCreate: (row: TransactionRow) => void
  onClose: () => void
}) {
  const [kind, setKind] = useState<TransactionKind>("out")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState(mockCategories[1].id)
  const [account, setAccount] = useState(mockAccounts[0].id)
  const [date, setDate] = useState(today)
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
          id: mockId("tx"),
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
        <DialogTitle>Novo lançamento</DialogTitle>
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
