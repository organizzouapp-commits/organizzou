"use client"

import { useState } from "react"
import { format, getDaysInMonth, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckCheckIcon, CheckIcon, CircleAlertIcon, ReceiptIcon, WalletIcon } from "lucide-react"

import { Collapse, GroupHeader } from "@/components/organizzou/Group"
import { Button } from "@/components/ui/button"
import type { BillView } from "@/features/finance/stats"
import { formatBRL } from "@/lib/money"

import { BentoCard, BentoStat, CategoryDonut, MonthTimeline, SegmentedPills } from "./bento"
import { BillMini, dueText } from "./bill-mini"
import { useFinance } from "./context"
import { derive } from "./derive"
import { AddPill, CardStack, DayBadge, EmptyBlock, FinanceListItem, HeroCard, MoneyText, StatusChip } from "./parts"

/** The desktop bill card (series A): badge, name, subtitle, amount, pill, ⋯. */
function BillCard({ view }: { view: BillView }) {
  const f = useFinance()
  const { bill, status, daysLeft } = view
  const paid = status === "paid"
  return (
    <FinanceListItem
      data-bill={bill.id}
      data-status={status}
      leading={<DayBadge day={bill.due_day} />}
      title={bill.name}
      subtitle={`${f.categoryName(bill.category_id)} · ${paid ? "pago" : dueText(daysLeft, status).toLowerCase()}`}
      chip={status === "overdue" ? <StatusChip icon={CircleAlertIcon}>Atrasada</StatusChip> : null}
      amount={<MoneyText cents={bill.amount_cents} />}
      action={
        paid ? (
          <span data-paid-pill className="inline-flex h-9 items-center gap-1 rounded-full bg-muted px-3 text-[13px] leading-5 font-medium text-muted-foreground">
            <CheckIcon aria-hidden strokeWidth={1.75} className="size-3.5" /> Pago
          </span>
        ) : (
          <Button size="sm" onClick={() => f.payBill(bill)}>
            Pagar
          </Button>
        )
      }
      onOpen={() => f.editBill(bill)}
      onEdit={() => f.editBill(bill)}
      onDelete={() => f.removeBill(bill)}
    />
  )
}

function BillGroup({ id, label, views, defaultOpen }: { id: string; label: string; views: BillView[]; defaultOpen: boolean }) {
  const f = useFinance()
  const [open, setOpen] = useState(defaultOpen)
  const total = views.reduce((sum, v) => sum + v.bill.amount_cents, 0)
  if (views.length === 0) return null
  return (
    <section data-group={id} aria-label={label} className="flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <GroupHeader label={label} count={views.length} open={open} onToggle={() => setOpen((v) => !v)} />
        <MoneyText cents={total} className="text-[13px] leading-5 text-muted-foreground" />
      </div>
      <Collapse open={open}>
        <CardStack>
          {views.map((v) => (f.isMobile ? <BillMini key={v.bill.id} view={v} withBadge withMenu withCategory swipe /> : <BillCard key={v.bill.id} view={v} />))}
        </CardStack>
      </Collapse>
    </section>
  )
}

function Stats({ compact }: { compact: boolean }) {
  const f = useFinance()
  const d = derive(f)
  const count = (n: number) => `${n} ${n === 1 ? "conta" : "contas"}`
  return (
    <div data-testid="bill-stats" className={compact ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-3"}>
      <BentoStat compact={compact} label="Pagas" icon={CheckCheckIcon} chip={count(d.paid.length)}>
        <MoneyText cents={d.paidTotal} dimDecimals />
      </BentoStat>
      {compact ? null : (
        <BentoStat label="A pagar" icon={WalletIcon} chip={count(d.toPay.length)}>
          <MoneyText cents={d.toPayTotal - d.overdueTotal} dimDecimals />
        </BentoStat>
      )}
      <BentoStat compact={compact} label="Atrasadas" icon={CircleAlertIcon} chip={count(d.overdue.length)}>
        <MoneyText cents={d.overdueTotal} dimDecimals />
      </BentoStat>
    </div>
  )
}

function Hero() {
  const f = useFinance()
  const d = derive(f)
  const pct = d.fixedTotal === 0 ? 0 : (d.paidTotal / d.fixedTotal) * 100
  const p = d.paid.length
  return (
    <HeroCard
      label="Total fixo por mês"
      value={<MoneyText cents={d.fixedTotal} dimDecimals />}
      progress={{ value: pct, label: "Contas fixas pagas" }}
      support={`${p} ${p === 1 ? "paga" : "pagas"} · ${d.unpaidCount} ${d.unpaidCount === 1 ? "pendente" : "pendentes"} · ${formatBRL(d.paidTotal)} ${p === 1 ? "pago" : "pagos"}`}
      className="h-full justify-between"
    />
  )
}

/** "Linha do mês": the days as chips with a dot where a bill is due. Choosing a day filters the list to it. */
function Timeline({ day, onDay }: { day: number | null; onDay: (day: number | null) => void }) {
  const f = useFinance()
  const d = derive(f)
  const dots: Record<number, number> = {}
  for (const v of d.views) dots[v.bill.due_day] = (dots[v.bill.due_day] ?? 0) + 1
  const monthLabel = format(parseISO(`${f.month}-01`), "MMMM", { locale: ptBR })
  return <MonthTimeline days={getDaysInMonth(parseISO(`${f.month}-01`))} today={f.today.slice(0, 7) === f.month ? Number(f.today.slice(8, 10)) : null} dots={dots} selected={day} onSelect={onDay} monthLabel={monthLabel} />
}

function Lists({ day, onDay }: { day: number | null; onDay: (day: number | null) => void }) {
  const f = useFinance()
  const d = derive(f)
  const views = d.views.filter((v) => day === null || v.bill.due_day === day)
  return (
    <div className="flex flex-col gap-3" data-testid="bills-main">
      <AddPill label="Nova conta fixa…" onClick={f.openNewBill} />
      {d.views.length === 0 ? (
        <EmptyBlock icon={ReceiptIcon} title="Nenhuma conta fixa ainda" description="Cadastre aluguel, internet e assinaturas." />
      ) : views.length === 0 ? (
        <EmptyBlock icon={ReceiptIcon} title={`Nenhuma conta vence no dia ${day}`} action={<Button variant="outline" onClick={() => onDay(null)}>Ver todas as contas</Button>} />
      ) : (
        <div className="flex flex-col">
          <BillGroup id="overdue" label="Atrasadas" views={views.filter((v) => v.status === "overdue")} defaultOpen />
          <BillGroup id="due" label="A pagar" views={views.filter((v) => v.status === "soon" || v.status === "upcoming")} defaultOpen />
          <BillGroup id="paid" label="Pagas" views={views.filter((v) => v.status === "paid")} defaultOpen={false} />
        </div>
      )}
    </div>
  )
}

function ByCategory() {
  const f = useFinance()
  const d = derive(f)
  const sums = new Map<string, { value: number; count: number }>()
  for (const v of d.views) {
    const key = v.bill.category_id ?? "none"
    const current = sums.get(key) ?? { value: 0, count: 0 }
    sums.set(key, { value: current.value + v.bill.amount_cents, count: current.count + 1 })
  }
  const segments = [...sums.entries()].map(([id, { value, count }]) => ({ id, name: f.categoryName(id === "none" ? null : id), value, count })).sort((a, b) => b.value - a.value)
  return (
    <BentoCard title="Fixas por categoria" onArrow={() => f.openNewBill()} arrowLabel="Nova conta fixa">
      <CategoryDonut segments={segments} label="Fixas por categoria" variant="stacked" unit={["conta", "contas"]} />
    </BentoCard>
  )
}

function NextDue() {
  const f = useFinance()
  const d = derive(f)
  const next = d.views.filter((v) => v.status !== "paid").slice(0, 3)
  return (
    <BentoCard title="Próximos vencimentos" onArrow={() => document.querySelector("[data-testid=bills-main]")?.scrollIntoView({ behavior: "smooth", block: "start" })} arrowLabel="Ir para a lista">
      <div className="flex flex-col gap-2">
        {next.length === 0 ? <p className="text-[13px] leading-5 text-muted-foreground">Tudo pago neste mês.</p> : null}
        {next.map(({ bill, daysLeft, status }) => (
          <div key={bill.id} data-next-due className="flex items-center gap-3 py-1">
            <DayBadge day={bill.due_day} className="size-10" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] leading-6">{bill.name}</span>
              <span className="truncate text-[13px] leading-5 text-muted-foreground">{status === "overdue" ? dueText(daysLeft, status) : daysLeft === 0 ? "hoje" : `em ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`}</span>
            </div>
            <MoneyText cents={bill.amount_cents} className="text-[15px] font-semibold" />
          </div>
        ))}
      </div>
    </BentoCard>
  )
}

/** The whole Contas fixas tab, laid out as bento. Desktop 12 columns, 8 from 1024px, one column below; phones as in the boards. */
export function BillsTab() {
  const f = useFinance()
  const [mode, setMode] = useState<"linha" | "lista">("linha")
  const [day, setDay] = useState<number | null>(null)
  const timeline = mode === "linha" ? <Timeline day={day} onDay={setDay} /> : null

  if (f.isMobile) {
    return (
      <div className="flex flex-col gap-3">
        <Hero />
        <Stats compact />
        <BentoCard title="Linha do mês" subtitle={day ? `dia ${day}` : "toque em um dia para filtrar"} data-testid="timeline-card">
          <Timeline day={day} onDay={setDay} />
        </BentoCard>
        <Lists day={day} onDay={setDay} />
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-8 xl:grid-cols-12">
      <div className="md:col-span-2 lg:col-span-8 xl:col-span-4">
        <Hero />
      </div>
      <div className="md:col-span-2 lg:col-span-8 xl:col-span-8">
        <Stats compact={false} />
      </div>
      <div className="md:col-span-2 lg:col-span-8 xl:col-span-12">
        <BentoCard
          title="Linha do mês"
          subtitle={day ? `dia ${day}` : "um ponto marca cada conta que vence"}
          data-testid="timeline-card"
          actions={
            <SegmentedPills
              ariaLabel="Modo de exibição"
              items={[
                { id: "lista", label: "Lista" },
                { id: "linha", label: "Linha" },
              ]}
              value={mode}
              onChange={(v) => (setMode(v), v === "lista" && setDay(null))}
            />
          }
        >
          {timeline}
          {mode === "lista" ? <p className="text-[13px] leading-5 text-muted-foreground">Só a lista está à mostra. Escolha “Linha” para ver os vencimentos por dia.</p> : null}
        </BentoCard>
      </div>
      <div className="md:col-span-2 lg:col-span-8 xl:col-span-8">
        <Lists day={day} onDay={setDay} />
      </div>
      <div className="flex flex-col gap-4 md:col-span-2 lg:col-span-8 xl:col-span-4">
        <ByCategory />
        <NextDue />
      </div>
    </div>
  )
}
