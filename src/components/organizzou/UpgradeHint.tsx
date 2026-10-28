"use client"

import Link from "next/link"
import { SparklesIcon } from "lucide-react"

import { usePlan } from "@/components/organizzou/plan-context"
import { Button } from "@/components/ui/button"
import { LIMIT_LABELS, PLANS, reachedLimit, type LimitKey } from "@/lib/plans"
import { cn } from "@/lib/utils"

type UpgradeHintProps = {
  /** Which plan limit this hint talks about. */
  limit: LimitKey
  /** How much of the limit the user has used. */
  used: number
  /** Show the hint only once the limit is reached (default) or always while on the free plan. */
  when?: "reached" | "always"
  className?: string
}

/**
 * Small card that explains what the free plan limits and links to the Plano Pro page. Renders nothing for Pro users, and (by
 * default) nothing until the limit is reached. Limits come from `src/lib/plans.ts`.
 */
export function UpgradeHint({ limit, used, when = "reached", className }: UpgradeHintProps) {
  const { plan, pro } = usePlan()
  if (pro) return null
  const max = PLANS[plan].limits[limit]
  if (max === null) return null
  const reached = reachedLimit(plan, limit, used)
  if (when === "reached" && !reached) return null
  const label = LIMIT_LABELS[limit]

  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border border-border bg-card p-4", className)}>
      <SparklesIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-[15px] leading-6">
          {reached ? "Você chegou ao limite do Plano Gratuito: " : "O Plano Gratuito tem limite: "}
          <span className="tabular">
            {Math.min(used, max)}/{max}
          </span>{" "}
          {max === 1 ? label.singular : label.plural}.
        </p>
        <p className="text-[13px] leading-5 text-muted-foreground">{label.hint} no Plano Pro.</p>
        <Button asChild variant="outline" size="sm" className="self-start">
          <Link href="/dashboard/plano">Ver Plano Pro</Link>
        </Button>
      </div>
    </div>
  )
}
