import Link from "next/link"
import { TriangleAlertIcon } from "lucide-react"

import { budgetState, monthSpendUsd } from "@/lib/admin/assistant-cost"
import { loadBudget } from "@/lib/admin/assistant-budget"
import { assistantCostByUser } from "@/lib/admin/data"
import { formatBrl, formatUsd, usdToBrl } from "@/lib/assistant-pricing"

/**
 * A banner for the admin pages, shown only when the estimated assistant spend of the month passed the budget. It renders nothing when there
 * is no budget, when the data cannot be read, or while the spend is within the budget. Admin pages only (their layout and the data
 * functions check the admin role).
 */
export async function AssistantBudgetBanner() {
  const [budget, cost] = await Promise.all([loadBudget(), assistantCostByUser()])
  if (!cost.ok || budget.usd == null) return null
  const spent = monthSpendUsd(cost.data)
  if (budgetState(spent, budget.usd).state !== "exceeded") return null
  return (
    <div role="alert" data-testid="assistant-budget-banner" className="flex flex-wrap items-center gap-3 rounded-[20px] border-2 border-foreground p-4 text-[14px] leading-5">
      <TriangleAlertIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
      <p className="min-w-0 flex-1">
        <strong className="font-semibold">O gasto estimado do assistente passou do orçamento do mês:</strong> {formatBrl(usdToBrl(spent))} ({formatUsd(spent)}) de {formatBrl(usdToBrl(budget.usd))} ({formatUsd(budget.usd)}). Nada foi bloqueado.
      </p>
      <Link href="/admin/assistente" className="inline-flex h-11 items-center rounded-full border border-border px-4 font-medium outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
        Ver custos
      </Link>
    </div>
  )
}
