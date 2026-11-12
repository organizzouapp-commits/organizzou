"use client"

import { CheckIcon, ClockIcon, RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { BillView } from "@/features/finance/stats"
import { cn } from "@/lib/utils"

import { useFinance } from "./context"
import { DayBadge, LIST_CARD, MoneyText, RowMenu } from "./parts"
import { SwipeRow } from "@/components/organizzou/SwipeRow"

/** "Venceu há 3 dias" / "Vence hoje" / "Vence em 5 dias" / "Pago". */
export function dueText(daysLeft: number, status: string) {
  if (status === "paid") return "Pago"
  const n = Math.abs(daysLeft)
  if (daysLeft < 0) return `Venceu há ${n} ${n === 1 ? "dia" : "dias"}`
  if (daysLeft === 0) return "Vence hoje"
  return `Vence em ${n} ${n === 1 ? "dia" : "dias"}`
}

/**
 * The two-line bill card: the name and the amount, then the meta (clock + when) and the Pagar pill. `withBadge` adds the DayBadge on the
 * left and ⋯ on the right (Contas fixas); the watch lists leave both out. `swipe` adds the phone gestures (right = Pagar, left = Excluir).
 */
export function BillMini({ view, withBadge = false, withMenu = false, withCategory = false, swipe = false }: { view: BillView; withBadge?: boolean; withMenu?: boolean; withCategory?: boolean; swipe?: boolean }) {
  const f = useFinance()
  const { bill, status, daysLeft } = view
  const paid = status === "paid"
  const when = paid ? "pago" : dueText(daysLeft, status).toLowerCase()
  const card = (
    <div data-bill={bill.id} data-status={status} className={cn(LIST_CARD, "relative flex items-center gap-3 p-3")}>
      {withBadge ? <DayBadge day={bill.due_day} className="size-10" /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <button type="button" data-item-title onClick={() => f.editBill(bill)} className="min-w-0 truncate text-left text-[15px] leading-6 font-medium outline-none after:absolute after:inset-0 after:rounded-[14px] focus-visible:after:ring-3 focus-visible:after:ring-ring/50">
            {bill.name}
          </button>
          <MoneyText cents={bill.amount_cents} className="shrink-0 text-[15px] leading-6 font-semibold" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span data-item-subtitle className="flex min-w-0 items-center gap-1 text-[13px] leading-5 text-muted-foreground">
            <ClockIcon aria-hidden strokeWidth={1.75} className="size-3.5 shrink-0" />
            <span className="truncate">{withCategory ? `${f.categoryName(bill.category_id)} · ${when}` : when.charAt(0).toUpperCase() + when.slice(1)}</span>
          </span>
          <span className="relative z-10 shrink-0">
            {paid ? (
              <span data-paid-pill className="inline-flex h-9 items-center gap-1 rounded-full bg-muted px-3 text-[13px] leading-5 font-medium text-muted-foreground">
                <CheckIcon aria-hidden strokeWidth={1.75} className="size-3.5" /> Pago
              </span>
            ) : (
              <Button size="sm" onClick={() => f.payBill(bill)}>
                Pagar
              </Button>
            )}
          </span>
        </div>
      </div>
      {withMenu ? <RowMenu title={bill.name} onEdit={() => f.editBill(bill)} onDelete={() => f.removeBill(bill)} extra={paid ? [{ label: "Reabrir conta", icon: RotateCcwIcon, onSelect: () => f.reopenBill(bill) }] : undefined} className="-mr-1 self-start" /> : null}
    </div>
  )
  if (!swipe) return card
  return (
    <SwipeRow className="rounded-[14px]" surfaceClassName="bg-transparent" rightLabel="Pagar" onSwipeRight={paid ? undefined : () => f.payBill(bill)} onSwipeLeft={() => f.removeBill(bill)}>
      {card}
    </SwipeRow>
  )
}
