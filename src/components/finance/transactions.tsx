"use client"

import { useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowDownRightIcon, ArrowUpRightIcon, ListIcon, PlusIcon, SearchIcon } from "lucide-react"
import { toast } from "sonner"

import { Collapse, GroupHeader } from "@/components/organizzou/Group"
import { ManageablePicker } from "@/components/tasks/manageable-picker"
import { PillTabs, dashedPillClass } from "@/components/tasks/pill-tabs"
import { AddTaskPill } from "@/components/tasks/quick-add"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { spendByCategory } from "@/features/finance/stats"
import type { TransactionRow } from "@/features/finance/types"
import { formatBRL } from "@/lib/money"
import { cn } from "@/lib/utils"

import { useFinance } from "./context"
import { CardHeader, CardStack, CategoryCircle, EmptyBlock, FinanceListItem, MoneyText, ProgressBar, StatTile, SUMMARY_CARD, useCategoryColor } from "./parts"

const KIND_ITEMS = [
  { id: "all", label: "Todos" },
  { id: "in", label: "Entradas" },
  { id: "out", label: "Saídas" },
]

export function KindPills() {
  const f = useFinance()
  return <PillTabs kind="toggles" ariaLabel="Filtrar por tipo" items={KIND_ITEMS} isOn={(i) => f.filters.kind === i.id} onSelect={(i) => f.setFilters({ kind: i.id as "all" | "in" | "out" })} />
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

/** The scrolling row of category pills; the last one is the dashed "+ Categoria" that opens the picker. */
export function CategoryPills({ onMore }: { onMore: () => void }) {
  const f = useFinance()
  return (
    <PillTabs
      soft
      kind="toggles"
      className="h-12 pb-2.5"
      ariaLabel="Filtrar por categoria"
      items={f.categories.map((c) => ({ id: c.id, label: c.name }))}
      isOn={(i) => f.filters.category === i.id}
      onSelect={(i) => f.setFilters({ category: f.filters.category === i.id ? "all" : i.id })}
      trailing={
        <button type="button" onClick={onMore} className={dashedPillClass}>
          <PlusIcon aria-hidden strokeWidth={1.75} className="size-3.5" /> Categoria
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

function sums(rows: TransactionRow[]) {
  return rows.reduce((acc, t) => ({ ...acc, [t.kind]: acc[t.kind] + t.amount_cents }), { in: 0, out: 0 })
}

export function TransactionsMain() {
  const f = useFinance()
  const [picker, setPicker] = useState(false)
  const [saved, setDay] = useDayToggles()
  const rows = useVisibleTransactions()
  const groups = [...rows.reduce<Map<string, TransactionRow[]>>((map, t) => map.set(t.occurred_on, [...(map.get(t.occurred_on) ?? []), t]), new Map()).entries()].sort((a, b) => b[0].localeCompare(a[0]))
  const currentMonth = f.today.slice(0, 7)

  return (
    <div className="flex flex-col gap-4" data-testid="transactions-main">
      <AddTaskPill
        label="Adicionar lançamento… ex.: mercado 45,90 ou + salário 5000"
        inputLabel="Adicionar lançamento rápido"
        placeholder="mercado 45,90  ou  + salário 5000"
        onAdd={async (text) => {
          if (f.quickAdd(text)) return true
          toast("Escreva a descrição e o valor, por exemplo: mercado 45,90")
          return false
        }}
      />
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <KindPills />
          {f.isMobile ? null : (
            <div className="relative ml-auto w-full max-w-72">
              <SearchIcon aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" value={f.filters.query} onChange={(e) => f.setFilters({ query: e.target.value })} placeholder="Buscar lançamentos" aria-label="Buscar lançamentos" className="h-9 rounded-full pl-9" />
            </div>
          )}
        </div>
        {f.isMobile ? null : <CategoryPills onMore={() => setPicker(true)} />}
      </div>

      {rows.length === 0 ? (
        <EmptyBlock icon={ListIcon} title="Nenhum lançamento encontrado" description="Ajuste a busca ou os filtros." action={<Button variant="outline" onClick={f.openNewTransaction}><PlusIcon strokeWidth={1.75} /> Novo lançamento</Button>} />
      ) : (
        <div className="flex flex-col">
          {groups.map(([day, list]) => {
            const open = saved[day] ?? day.slice(0, 7) === currentMonth
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
      <CategoryPickerSheet open={picker} onOpenChange={setPicker} />
    </div>
  )
}

/** Phones: three compact tiles under the month toolbar. */
export function TransactionTiles() {
  const rows = useVisibleTransactions()
  const s = sums(rows)
  return (
    <div data-testid="transaction-tiles" className="grid grid-cols-3 gap-2">
      <StatTile compact icon={ArrowUpRightIcon} label="Entradas">
        <MoneyText cents={s.in} />
      </StatTile>
      <StatTile compact icon={ArrowDownRightIcon} label="Saídas">
        <MoneyText cents={s.out} />
      </StatTile>
      <StatTile compact icon={ListIcon} label="Registros">
        {rows.length}
      </StatTile>
    </div>
  )
}

function BarRow({ id, name, spent, max }: { id: string; name: string; spent: number; max: number }) {
  const color = useCategoryColor(id)
  return (
    <div data-top-category={id} className="flex flex-col gap-1.5 py-1.5">
      <div className="flex items-center gap-3">
        <CategoryCircle id={id} name={name} size="sm" />
        <span className="min-w-0 flex-1 truncate text-[15px] leading-6">{name}</span>
        <span className="tabular shrink-0 text-[13px] leading-5 text-muted-foreground">{formatBRL(spent)}</span>
      </div>
      <ProgressBar thin value={max === 0 ? 0 : (spent / max) * 100} color={color} label={`Gasto em ${name}`} />
    </div>
  )
}

/** Desktop side column. */
export function TransactionsAside() {
  const f = useFinance()
  const rows = useVisibleTransactions()
  const s = sums(rows)
  const top = spendByCategory(f.categories, f.transactions, f.month)
    .filter((c) => c.spent > 0)
    .slice(0, 5)
  return (
    <>
      <section aria-label="Resumo da lista" className={cn(SUMMARY_CARD, "flex flex-col gap-4 p-5")}>
        <CardHeader title="Resumo da lista" />
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <span className="text-[13px] leading-5 text-muted-foreground">Entradas</span>
            <MoneyText cents={s.in} className="text-[17px] leading-7 font-semibold" />
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] leading-5 text-muted-foreground">Saídas</span>
            <MoneyText cents={s.out} className="text-[17px] leading-7 font-semibold" />
          </div>
        </div>
        <p className="text-[13px] leading-5 text-muted-foreground">
          {rows.length} {rows.length === 1 ? "lançamento" : "lançamentos"} com os filtros atuais.
        </p>
      </section>
      <section aria-label="Maiores categorias do mês" className={cn(SUMMARY_CARD, "flex flex-col gap-2 p-5")}>
        <CardHeader
          title="Maiores categorias do mês"
          actions={
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => f.goTab("visao")}>
              Ver todas
            </Button>
          }
        />
        {top.length === 0 ? <p className="text-[13px] leading-5 text-muted-foreground">Nenhum gasto neste mês.</p> : null}
        {top.map(({ category, spent }) => (
          <BarRow key={category.id} id={category.id} name={category.name} spent={spent} max={top[0].spent} />
        ))}
      </section>
    </>
  )
}
