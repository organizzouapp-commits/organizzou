"use client"

import { useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowUpRightIcon, ListIcon, PencilIcon, PlusIcon, ScaleIcon, SlidersHorizontalIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Collapse, GroupHeader } from "@/components/organizzou/Group"
import { ManageablePicker } from "@/components/tasks/manageable-picker"
import { PillTabs, dashedPillClass, pillClass } from "@/components/tasks/pill-tabs"
import { AddTaskPill } from "@/components/tasks/quick-add"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { ExpandingSearch, ToolbarSort } from "@/components/tasks/toolbar-controls"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { TransactionRow } from "@/features/finance/types"
import { formatBRL } from "@/lib/money"
import { cn } from "@/lib/utils"

import { useFinance, type TxSort } from "./context"
import { FinanceDeck, type FinanceSlide } from "./finance-deck"
import { IncomeStat, SurplusStat } from "./overview"
import { ScrollRow } from "./scroll-row"
import { BentoCard, BentoStat, CategoryDonut, SegmentedPills } from "./bento"
import { derive, variation } from "./derive"
import { CardStack, CategoryCircle, EmptyBlock, FinanceListItem, HeroCard, MoneyText } from "./parts"

const KIND_ITEMS = [
  { id: "all", label: "Todos" },
  { id: "in", label: "Entradas" },
  { id: "out", label: "Saídas" },
]

const SORT_OPTIONS: { id: TxSort; label: string }[] = [
  { id: "date-desc", label: "Data" },
  { id: "date-asc", label: "Data (antigas)" },
  { id: "amount-desc", label: "Maior valor" },
  { id: "amount-asc", label: "Menor valor" },
]

/** Counts for the pills: kinds over the month's rows that match the search, categories over those that also match the kind. */
function useTxCounts() {
  const f = useFinance()
  const q = f.filters.query.trim().toLowerCase()
  const base = f.transactions.filter((t) => t.occurred_on.slice(0, 7) === f.month).filter((t) => (q ? t.description.toLowerCase().includes(q) : true))
  const byKind = base.filter((t) => (f.filters.kind === "all" ? true : t.kind === f.filters.kind))
  const categories = new Map<string, number>()
  for (const t of byKind) if (t.category_id) categories.set(t.category_id, (categories.get(t.category_id) ?? 0) + 1)
  return { all: base.length, in: base.filter((t) => t.kind === "in").length, out: base.filter((t) => t.kind === "out").length, categories }
}

export function KindPills({ className }: { className?: string }) {
  const f = useFinance()
  const counts = useTxCounts()
  const items = KIND_ITEMS.map((i) => ({ ...i, count: counts[i.id as "all" | "in" | "out"] })) as { id: "all" | "in" | "out"; label: string; count: number }[]
  return <SegmentedPills ariaLabel="Filtrar por tipo" items={items} value={f.filters.kind} onChange={(kind) => f.setFilters({ kind })} className={className} />
}

/** The picker of categories (ManageablePicker with "Gerenciar" / "+ Adicionar"), as a dialog on desktop and a sheet on phones. */
export function CategoryPickerSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const f = useFinance()
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Categorias" description="Escolha uma categoria para filtrar, ou gerencie as suas.">
      <ManageablePicker
        noun="categoria"
        kind="category"
        unit={["lançamento", "lançamentos"]}
        deleteNote="Eles ficam sem categoria."
        items={f.categories.map((c) => ({ id: c.id, label: c.name }))}
        selected={f.filters.category === "all" ? [] : [f.filters.category]}
        fixed={{ id: "all", label: "Todas as categorias" }}
        onSelect={(id) => {
          f.setFilters({ category: id === f.filters.category ? "all" : id })
          onOpenChange(false)
        }}
        onCreate={(name) => f.createCategory(name)}
        onRename={(id, name) => f.renameCategory(id, name)}
        onDelete={f.deleteCategory}
        usage={f.categoryUsage}
      />
    </ResponsiveSheet>
  )
}

/** The row of category pills (filled neutral, counts, Lima when on) ending in the dashed "Editar" pill that opens the picker. */
export function CategoryPills({ onMore, className }: { onMore: () => void; className?: string }) {
  const f = useFinance()
  const counts = useTxCounts()
  return (
    <PillTabs
      soft
      kind="toggles"
      className={cn("h-12 pb-2.5", className)}
      ariaLabel="Filtrar por categoria"
      items={f.categories.map((c) => ({ id: c.id, label: c.name, count: counts.categories.get(c.id) ?? 0 }))}
      isOn={(i) => f.filters.category === i.id}
      onSelect={(i) => f.setFilters({ category: f.filters.category === i.id ? "all" : i.id })}
      trailing={
        <button type="button" aria-label="Editar categorias" data-edit-categories onClick={onMore} className={dashedPillClass}>
          <PencilIcon aria-hidden strokeWidth={1.75} className="size-4" /> Editar
        </button>
      }
    />
  )
}

/** Phones: the filter circle of the header card opens this sheet with the same filters. */
export function FiltersSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const f = useFinance()
  const [picker, setPicker] = useState(false)
  const active = (f.filters.kind !== "all" ? 1 : 0) + (f.filters.category !== "all" ? 1 : 0)
  return (
    <>
      <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Filtros">
        <div className="flex flex-col gap-4 pb-2">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] leading-5 font-medium text-muted-foreground">Tipo</span>
            <KindPills />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] leading-5 font-medium text-muted-foreground">Categoria</span>
            <CategoryPills onMore={() => setPicker(true)} />
          </div>
          <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-border bg-popover px-4 pt-3">
            <Button variant="outline" className="h-11 flex-1" disabled={active === 0} onClick={() => f.setFilters({ kind: "all", category: "all" })}>
              Limpar
            </Button>
            <Button className="h-11 flex-1" onClick={() => onOpenChange(false)}>
              Ver lançamentos
            </Button>
          </div>
        </div>
      </ResponsiveSheet>
      <CategoryPickerSheet open={picker} onOpenChange={setPicker} />
    </>
  )
}

function dayLabel(day: string, today: string) {
  const diff = Math.round((parseISO(today).getTime() - parseISO(day).getTime()) / 86_400_000)
  const weekday = format(parseISO(day), "EEEE", { locale: ptBR }).split("-")[0]
  const date = `${weekday}, ${format(parseISO(day), "d MMM", { locale: ptBR }).replace(".", "")}`
  if (diff === 0) return `Hoje · ${date}`
  if (diff === 1) return `Ontem · ${date}`
  return date.charAt(0).toUpperCase() + date.slice(1)
}

const DAYS_KEY = "organizzou:financas-days"

/** Which days the person opened or closed, for the session (sessionStorage; read after mount so the server render matches). */
function useDayToggles() {
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  useEffect(() => {
    try {
      // sessionStorage only exists in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSaved(JSON.parse(sessionStorage.getItem(DAYS_KEY) ?? "{}") as Record<string, boolean>)
    } catch {
      // Private mode: the choice just does not survive the visit.
    }
  }, [])
  const set = (day: string, open: boolean) =>
    setSaved((current) => {
      const next = { ...current, [day]: open }
      try {
        sessionStorage.setItem(DAYS_KEY, JSON.stringify(next))
      } catch {
        // Same as above.
      }
      return next
    })
  return [saved, set] as const
}

export function useVisibleTransactions() {
  const f = useFinance()
  const q = f.filters.query.trim().toLowerCase()
  return f.transactions
    .filter((t) => t.occurred_on.slice(0, 7) === f.month)
    .filter((t) => (f.filters.kind === "all" ? true : t.kind === f.filters.kind))
    .filter((t) => (f.filters.category === "all" ? true : t.category_id === f.filters.category))
    .filter((t) => (q ? t.description.toLowerCase().includes(q) : true))
}

function sortRows(rows: TransactionRow[], sort: TxSort) {
  const byAmount = sort === "amount-desc" ? (a: TransactionRow, b: TransactionRow) => b.amount_cents - a.amount_cents : sort === "amount-asc" ? (a: TransactionRow, b: TransactionRow) => a.amount_cents - b.amount_cents : null
  return byAmount ? [...rows].sort(byAmount) : rows
}

/** Filtros popover (desktop): the kind and the category, with "Limpar". */
function FiltersPopover() {
  const f = useFinance()
  const active = (f.filters.kind !== "all" ? 1 : 0) + (f.filters.category !== "all" ? 1 : 0)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" data-testid="finance-filters" className="h-10 shrink-0 rounded-full px-4">
          <SlidersHorizontalIcon strokeWidth={1.75} /> Filtros
          {active > 0 ? <Badge variant="highlight">{active}</Badge> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Tipo</Label>
            <KindPills />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="filter-category">Categoria</Label>
            <Select value={f.filters.category} onValueChange={(category) => f.setFilters({ category })}>
              <SelectTrigger id="filter-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {f.categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" className="h-11 w-fit rounded-full" disabled={active === 0} onClick={() => f.setFilters({ kind: "all", category: "all" })}>
            <XIcon strokeWidth={1.75} /> Limpar filtros
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function EditCategoriesButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" aria-label="Editar categorias" data-edit-categories onClick={onClick} className={dashedPillClass}>
      <PencilIcon aria-hidden strokeWidth={1.75} className="size-4" /> Editar
    </button>
  )
}

/** The category pills in a scrollable row; with `pinnedEdit` the dashed Editar pill stays outside the scroller, at its end. */
function CategoryScroller({ onMore, pinnedEdit, className }: { onMore: () => void; pinnedEdit: boolean; className?: string }) {
  const f = useFinance()
  const counts = useTxCounts()
  return (
    <ScrollRow className={className} pinned={pinnedEdit ? <EditCategoriesButton onClick={onMore} /> : undefined}>
      <PillTabs
        kind="toggles"
        className="h-9 pr-1"
        ariaLabel="Filtrar por categoria"
        items={f.categories.map((c) => ({ id: c.id, label: c.name, count: counts.categories.get(c.id) ?? 0 }))}
        isOn={(i) => f.filters.category === i.id}
        onSelect={(i) => f.setFilters({ category: f.filters.category === i.id ? "all" : i.id })}
        trailing={pinnedEdit ? undefined : <EditCategoriesButton onClick={onMore} />}
      />
    </ScrollRow>
  )
}

/** Desktop: ONE solid card like the Tarefas toolbar. Row 1 the quick add; row 2 the kinds, a divider, the scrolling category pills and the search, Filtros and Ordem. Below 760px of card the pills take a line of their own. */
function TransactionsToolbar() {
  const f = useFinance()
  const [picker, setPicker] = useState(false)
  return (
    <div data-testid="transactions-toolbar" className="@container flex flex-col gap-3 rounded-[20px] border border-border bg-card p-4 md:p-5">
      <QuickAdd />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <KindPills />
        <span aria-hidden className="hidden h-5 w-px shrink-0 bg-border @[760px]:block" />
        <CategoryScroller pinnedEdit onMore={() => setPicker(true)} className="order-last w-full @[760px]:order-none @[760px]:w-auto @[760px]:flex-1" />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ExpandingSearch value={f.filters.query} onChange={(query) => f.setFilters({ query })} label="Buscar lançamentos" />
          <FiltersPopover />
          <ToolbarSort value={f.filters.sort} onChange={(sort) => f.setFilters({ sort })} options={SORT_OPTIONS} className="h-10 rounded-full" />
        </div>
      </div>
      <CategoryPickerSheet open={picker} onOpenChange={setPicker} />
    </div>
  )
}

/**
 * Phones: row 3 of the header card, like the Tarefas chips ("Todas 8 | A fazer 3"): Todos | Entradas | Saídas, then the categories with their
 * counts and the dashed Editar, all filled neutral pills (Lima when on) in ONE row that scrolls sideways by touch: no scrollbar, no chevrons.
 */
export function TransactionsFilterRow() {
  const f = useFinance()
  const counts = useTxCounts()
  const [picker, setPicker] = useState(false)
  return (
    <div data-testid="filter-row">
      <div data-pill-row role="group" aria-label="Filtros de lançamentos" className="no-scrollbar flex h-9 snap-x items-center gap-2 overflow-x-auto">
        <div role="group" aria-label="Filtrar por tipo" className="flex shrink-0 gap-2">
          {KIND_ITEMS.map((k) => {
            const on = f.filters.kind === k.id
            return (
              <button key={k.id} type="button" aria-pressed={on} data-pill data-pill-active={on} onClick={() => f.setFilters({ kind: k.id as "all" | "in" | "out" })} className={pillClass(on)}>
                {k.label}
                <span className={cn("tabular", on ? "opacity-70" : "")}>{counts[k.id as "all" | "in" | "out"]}</span>
              </button>
            )
          })}
        </div>
        <span aria-hidden className="h-5 w-px shrink-0 bg-border" />
        <div role="group" aria-label="Filtrar por categoria" className="flex shrink-0 gap-2">
          {f.categories.map((c) => {
            const on = f.filters.category === c.id
            return (
              <button key={c.id} type="button" aria-pressed={on} data-pill data-pill-active={on} onClick={() => f.setFilters({ category: on ? "all" : c.id })} className={pillClass(on)}>
                {c.name}
                <span className={cn("tabular", on ? "opacity-70" : "")}>{counts.categories.get(c.id) ?? 0}</span>
              </button>
            )
          })}
          <EditCategoriesButton onClick={() => setPicker(true)} />
        </div>
      </div>
      <CategoryPickerSheet open={picker} onOpenChange={setPicker} />
    </div>
  )
}

function QuickAdd() {
  const f = useFinance()
  return (
    <AddTaskPill
      label={f.isMobile ? "Adicionar… ex.: mercado 45,90" : "Adicionar lançamento… ex.: mercado 45,90 ou + salário 5000"}
      inputLabel="Adicionar lançamento rápido"
      placeholder="mercado 45,90  ou  + salário 5000"
      onAdd={async (text) => {
        if (f.quickAdd(text)) return true
        toast("Escreva a descrição e o valor, por exemplo: mercado 45,90")
        return false
      }}
    />
  )
}

export function TransactionsMain() {
  const f = useFinance()
  const [saved, setDay] = useDayToggles()
  const rows = useVisibleTransactions()
  const days = [...rows.reduce<Map<string, TransactionRow[]>>((map, t) => map.set(t.occurred_on, [...(map.get(t.occurred_on) ?? []), t]), new Map()).entries()].sort((a, b) => (f.filters.sort === "date-asc" ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0])))
  const groups = days.map(([day, list]) => [day, sortRows(list, f.filters.sort)] as const)
  // The most recent day starts open and the others closed; what the person toggles is remembered for the session.
  const latest = days.reduce((max, [day]) => (day > max ? day : max), "")

  return (
    <div className="flex flex-col gap-4" data-testid="transactions-main">
      {f.isMobile ? <QuickAdd /> : <TransactionsToolbar />}

      {rows.length === 0 ? (
        <EmptyBlock icon={ListIcon} title="Nenhum lançamento encontrado" description="Ajuste a busca ou os filtros." action={<Button variant="outline" onClick={f.openNewTransaction}><PlusIcon strokeWidth={1.75} /> Novo lançamento</Button>} />
      ) : (
        <div className="flex flex-col">
          {groups.map(([day, list]) => {
            const open = saved[day] ?? day === latest
            const net = list.reduce((sum, t) => sum + (t.kind === "in" ? t.amount_cents : -t.amount_cents), 0)
            return (
              <section key={day} data-day-group={day} aria-label={dayLabel(day, f.today)} className="flex flex-col">
                <div className="flex items-center justify-between gap-3">
                  <GroupHeader label={dayLabel(day, f.today)} open={open} onToggle={() => setDay(day, !open)} />
                  <MoneyText cents={net} tone="value" className="text-[13px] leading-5 text-muted-foreground" />
                </div>
                <Collapse open={open}>
                  <CardStack>
                    {list.map((t) => (
                      <FinanceListItem
                        key={t.id}
                        data-transaction={t.id}
                        leading={<CategoryCircle id={t.category_id} name={f.categoryName(t.category_id)} />}
                        title={t.description}
                        subtitle={`${f.categoryName(t.category_id)} · ${f.accountName(t.account_id)}`}
                        amount={<MoneyText cents={t.amount_cents} tone={t.kind === "in" ? "in" : "out"} />}
                        onOpen={() => f.editTransaction(t)}
                        onEdit={() => f.editTransaction(t)}
                        onDelete={() => f.removeTransaction(t)}
                        swipe={f.isMobile ? { onLeft: () => f.removeTransaction(t) } : undefined}
                      />
                    ))}
                  </CardStack>
                </Collapse>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** The right column (desktop) / the top (phones): Saídas do mês against the budget, Entradas and Saldo do mês, and the donut by category. */
export function SpendHero() {
  const f = useFinance()
  const d = derive(f)
  const pct = d.budget === 0 ? 0 : (d.month.expense / d.budget) * 100
  return (
    <HeroCard
      label="Saídas do mês"
      value={<MoneyText cents={d.month.expense} dimDecimals />}
      progress={{ value: pct, label: "Saídas do mês contra o orçamento" }}
      captions={["R$ 0", d.budget ? `limite R$ ${Math.round(d.budget / 100).toLocaleString("pt-BR")}` : "sem limite"]}
      support={d.budget ? `${Math.round(pct)}% do orçamento de ${formatBRL(d.budget)}` : "Defina limites para acompanhar o orçamento"}
      onArrow={f.openLimits}
      arrowLabel="Editar limites do orçamento"
    />
  )
}

export function TransactionStats({ compact = false }: { compact?: boolean }) {
  const f = useFinance()
  const d = derive(f)
  return (
    <div data-testid="transaction-tiles" className="grid grid-cols-2 gap-3 md:gap-4">
      <BentoStat compact={compact} label="Entradas" icon={ArrowUpRightIcon} chip={variation(d.month.income, d.previous.income) ?? "este mês"}>
        <MoneyText cents={d.month.income} dimDecimals />
      </BentoStat>
      <BentoStat compact={compact} label="Saldo do mês" icon={ScaleIcon} chip="entradas − saídas">
        <MoneyText cents={d.month.surplus} tone="value" dimDecimals />
      </BentoStat>
    </div>
  )
}

function SpendDonut() {
  const f = useFinance()
  const d = derive(f)
  const counts = new Map<string, number>()
  for (const t of f.transactions) if (t.kind === "out" && t.occurred_on.slice(0, 7) === f.month && t.category_id) counts.set(t.category_id, (counts.get(t.category_id) ?? 0) + 1)
  const segments = d.categories.filter((c) => c.spent > 0).map((c) => ({ id: c.category.id, name: c.category.name, value: c.spent, count: counts.get(c.category.id) ?? 0 }))
  return (
    <BentoCard title="Por categoria" data-testid="category-card" onArrow={() => f.goTab("visao")} arrowLabel="Ver na visão geral">
      <CategoryDonut segments={segments} label="Saídas por categoria" />
    </BentoCard>
  )
}

/** Desktop side column. */
export function TransactionsSide() {
  return (
    <>
      <SpendHero />
      <TransactionStats />
      <SpendDonut />
    </>
  )
}

/** Phones: Saídas do mês, Entradas and Saldo do mês as the card deck, then Por categoria as a normal card. */
export function TransactionsTop() {
  const slides: FinanceSlide[] = [
    { id: "saidas", hero: true, node: <SpendHero /> },
    { id: "entradas", node: <IncomeStat /> },
    { id: "saldo-mes", node: <SurplusStat /> },
  ]
  return (
    <div className="flex flex-col gap-3">
      <FinanceDeck slides={slides} initialHeight={300} />
      <SpendDonut />
    </div>
  )
}
