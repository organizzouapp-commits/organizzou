"use client"

import Link from "next/link"
import { BadgeDollarSignIcon } from "lucide-react"

import { usePlan } from "@/components/organizzou/plan-context"
import { SoonBadge } from "@/components/organizzou/SoonBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LIMIT_LABELS, type LimitKey } from "@/lib/plans"

const ROWS: LimitKey[] = ["taskBoards", "banks", "assistantMessagesPerDay"]

export function PlanSettings() {
  const { definition, pro } = usePlan()
  return (
    <div className="@container grid w-full gap-8 @min-[860px]:grid-cols-2">
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <BadgeDollarSignIcon aria-hidden strokeWidth={1.75} className="size-6" />
          <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em]">Plano e cobrança</h2>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-[15px] leading-6">
          Seu plano atual: <Badge variant="secondary">{definition.name}</Badge>
        </p>
        <div className="flex flex-col border-t border-border">
          {ROWS.map((key) => {
            const limit = definition.limits[key]
            return (
              <div key={key} className="flex min-h-12 items-center justify-between gap-3 border-b border-border text-[15px] leading-6">
                <span>{LIMIT_LABELS[key].plural[0].toUpperCase() + LIMIT_LABELS[key].plural.slice(1)}</span>
                <span className="tabular text-muted-foreground">{limit === null ? "Ilimitado" : limit}</span>
              </div>
            )
          })}
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {pro ? (
            <Button disabled>Gerenciar assinatura</Button>
          ) : (
            <Button asChild>
              <Link href="/dashboard/plano">
                <BadgeDollarSignIcon strokeWidth={1.75} /> Fazer upgrade
              </Link>
            </Button>
          )}
          <SoonBadge />
        </div>
        <p className="text-[13px] leading-5 text-muted-foreground">
          O pagamento ainda não está disponível. Não há cobrança nem histórico de faturas por enquanto; ao abrir, tudo aparece aqui.
        </p>
      </section>
    </div>
  )
}
