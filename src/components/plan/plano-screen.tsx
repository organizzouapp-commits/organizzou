"use client"

import { useState } from "react"
import { CheckIcon, SparklesIcon } from "lucide-react"

import { Bento, BentoCard } from "@/components/organizzou/Bento"
import { usePlan } from "@/components/organizzou/plan-context"
import { ProWaitlistDialog } from "@/components/plan/pro-waitlist-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatBRL } from "@/lib/money"
import { LIMIT_LABELS, PLANS, type LimitKey } from "@/lib/plans"

type Billing = "monthly" | "yearly"

const LIMIT_ROWS: LimitKey[] = ["taskBoards", "banks", "assistantMessagesPerDay"]

function limitText(limit: number | null, key: LimitKey) {
  if (limit === null) return "Ilimitado"
  const label = LIMIT_LABELS[key]
  return `${limit} ${limit === 1 ? label.singular : label.plural}`
}

function Price({ plan, billing }: { plan: "free" | "pro"; billing: Billing }) {
  const def = PLANS[plan]
  const cents = billing === "monthly" ? def.price.monthlyCents : def.price.yearlyCents
  if (cents === 0) return <span className="tabular text-[34px] leading-10 font-semibold tracking-[-0.02em]">R$ 0</span>
  return (
    <span className="flex items-baseline gap-1">
      <span className="tabular text-[34px] leading-10 font-semibold tracking-[-0.02em]">{formatBRL(cents)}</span>
      <span className="text-[15px] text-muted-foreground">{billing === "monthly" ? "/mês" : "/ano"}</span>
    </span>
  )
}

export function PlanoScreen({ email, name }: { email: string; name: string }) {
  const { plan, pro } = usePlan()
  const [billing, setBilling] = useState<Billing>("monthly")
  const [open, setOpen] = useState(false)
  const free = PLANS.free
  const proDef = PLANS.pro
  const yearlySavingCents = proDef.price.monthlyCents * 12 - proDef.price.yearlyCents

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-[72ch] text-[15px] leading-6 text-muted-foreground">
          {pro ? "Você está no Plano Pro. Obrigado por apoiar o Organizzou." : "Os valores abaixo são estimativas e ainda podem mudar antes do lançamento."}
        </p>
        <Tabs value={billing} onValueChange={(v) => setBilling(v as Billing)}>
          <TabsList aria-label="Periodicidade">
            <TabsTrigger value="monthly">Mensal</TabsTrigger>
            <TabsTrigger value="yearly">
              Anual
              {yearlySavingCents > 0 ? <Badge variant="secondary" className="ml-2">{`economize ${formatBRL(yearlySavingCents)}`}</Badge> : null}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Bento>
        <BentoCard className="col-span-12 @min-[900px]:col-span-6" title={free.name} actions={plan === "free" ? <Badge variant="secondary">Seu plano</Badge> : null}>
          <div className="flex h-full flex-col gap-5">
            <p className="text-[15px] leading-6 text-muted-foreground">{free.tagline}</p>
            <Price plan="free" billing={billing} />
            <ul className="flex flex-col">
              {free.features.map((f) => (
                <li key={f} className="flex min-h-11 items-center gap-3 border-b border-border py-2 text-[15px] leading-6 last:border-b-0">
                  <CheckIcon aria-hidden strokeWidth={1.75} className="size-[18px] shrink-0 text-muted-foreground" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </BentoCard>

        <BentoCard className="col-span-12 @min-[900px]:col-span-6" title={proDef.name} actions={pro ? <Badge variant="secondary">Seu plano</Badge> : null}>
          <div className="flex h-full flex-col gap-5">
            <p className="text-[15px] leading-6 text-muted-foreground">{proDef.tagline}</p>
            <Price plan="pro" billing={billing} />
            <ul className="flex flex-col">
              {proDef.features.map((f) => (
                <li key={f} className="flex min-h-11 items-center gap-3 border-b border-border py-2 text-[15px] leading-6 last:border-b-0">
                  <CheckIcon aria-hidden strokeWidth={1.75} className="size-[18px] shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {pro ? (
              <div className="mt-auto flex flex-col gap-2">
                <Button disabled className="self-start">Gerenciar assinatura</Button>
                <p className="text-[13px] leading-5 text-muted-foreground">Em breve: gerenciar pagamento, trocar de período e cancelar por aqui.</p>
              </div>
            ) : (
              <Button size="lg" className="mt-auto self-start" onClick={() => setOpen(true)}>
                <SparklesIcon strokeWidth={1.75} /> Fazer upgrade
              </Button>
            )}
          </div>
        </BentoCard>

        <BentoCard className="col-span-12" title="Comparativo de limites">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] text-[15px] leading-6">
            <span className="pb-2 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">Recurso</span>
            <span className="pb-2 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">Gratuito</span>
            <span className="pb-2 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">Pro</span>
            {LIMIT_ROWS.map((key) => (
              <div key={key} className="col-span-3 grid grid-cols-subgrid items-center border-t border-border py-3">
                <span>{LIMIT_LABELS[key].plural[0].toUpperCase() + LIMIT_LABELS[key].plural.slice(1)}</span>
                <span className="tabular">{limitText(free.limits[key], key)}</span>
                <span className="tabular">
                  {limitText(proDef.limits[key], key)}
                </span>
              </div>
            ))}
          </div>
        </BentoCard>
      </Bento>

      <ProWaitlistDialog open={open} onOpenChange={setOpen} email={email} name={name} />
    </div>
  )
}
