"use client"

import { useState } from "react"
import { CheckIcon, CircleAlertIcon, ReceiptIcon } from "lucide-react"

import { Collapse, GroupHeader } from "@/components/organizzou/Group"
import { Button } from "@/components/ui/button"
import { billStatusIn, monthlyFixedTotal, type BillView } from "@/features/finance/stats"
import { formatBRL } from "@/lib/money"
import { cn } from "@/lib/utils"

import { useFinance } from "./context"
import { dueText } from "./overview"
import { AddPill, CardHeader, CardStack, DayBadge, EmptyBlock, FinanceListItem, HeroCard, MoneyText, ProgressBar, StatusChip, SUMMARY_CARD } from "./parts"

function useBillViews() {
  const f = useFinance()
  return f.bills
    .filter((b) => b.active)
    .map((b) => billStatusIn(b, f.month, f.today))
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
}

function BillCard({ view }: { view: BillView }) {
  const f = useFinance()
  const { bill, status, daysLeft } = view
  const paid = status === "paid"
  return (
    <FinanceListItem
      data-bill={bill.id}
      data-status={status}
      stacked={f.isMobile}
      leading={<DayBadge day={bill.due_day} />}
      title={bill.name}
      subtitle={`${f.categoryName(bill.category_id)} · ${paid ? "pago" : dueText(daysLeft, status).toLowerCase()}`}
      chip={status === "overdue" && !f.isMobile ? <StatusChip icon={CircleAlertIcon}>Atrasada</StatusChip> : null}
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
      swipe={f.isMobile ? { onRight: paid ? undefined : () => f.payBill(bill), rightLabel: "Pagar", onLeft: () => f.removeBill(bill) } : undefined}
    />
  )
}

function BillGroup({ id, label, views, defaultOpen }: { id: string; label: string; views: BillView[]; defaultOpen: boolean }) {
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
          {views.map((v) => (
            <BillCard key={v.bill.id} view={v} />
          ))}
        </CardStack>
      </Collapse>
    </section>
  )
}

/** Total fixo por mês: the Lima card with how much of it is already paid in the month on show. */
export function BillsHero() {
  const views = useBillViews()
  const f = useFinance()
  const total = monthlyFixedTotal(f.bills)
  const paid = views.filter((v) => v.status === "paid")
  const paidTotal = paid.reduce((sum, v) => sum + v.bill.amount_cents, 0)
  const pending = views.length - paid.length
  return (
    <HeroCard label="Total fixo por mês" value={formatBRL(total)} support={`${paid.length} ${paid.length === 1 ? "paga" : "pagas"} · ${pending} ${pending === 1 ? "pendente" : "pendentes"} · ${formatBRL(paidTotal)} ${paid.length === 1 ? "pago" : "pagos"}`}>
      <ProgressBar value={total === 0 ? 0 : (paidTotal / total) * 100} label="Contas fixas pagas" color="var(--highlight-foreground)" className="bg-highlight-foreground/15" />
    </HeroCard>
  )
}

export function BillsMain() {
  const f = useFinance()
  const views = useBillViews()
  return (
    <div className="flex flex-col gap-4" data-testid="bills-main">
      <AddPill label="Nova conta fixa…" onClick={f.openNewBill} />
      {views.length === 0 ? (
        <EmptyBlock icon={ReceiptIcon} title="Nenhuma conta fixa ainda" description="Cadastre aluguel, internet e assinaturas." />
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

/** Desktop side column: the hero and the next three due dates. */
export function BillsAside() {
  const views = useBillViews().filter((v) => v.status !== "paid")
  return (
    <>
      <BillsHero />
      <section aria-label="Próximos vencimentos" className={cn(SUMMARY_CARD, "flex flex-col gap-2 p-5")}>
        <CardHeader title="Próximos vencimentos" />
        {views.length === 0 ? <p className="text-[13px] leading-5 text-muted-foreground">Tudo pago neste mês.</p> : null}
        {views.slice(0, 3).map(({ bill, daysLeft, status }) => (
          <div key={bill.id} className="flex items-center gap-3 py-1.5">
            <DayBadge day={bill.due_day} className="size-10" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] leading-6">{bill.name}</span>
              <span className="truncate text-[13px] leading-5 text-muted-foreground">{status === "overdue" ? dueText(daysLeft, status) : daysLeft === 0 ? "hoje" : `em ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`}</span>
            </div>
            <MoneyText cents={bill.amount_cents} className="text-[15px] font-semibold" />
          </div>
        ))}
      </section>
    </>
  )
}
