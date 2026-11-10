"use client"

import { useState } from "react"
import { BadgeDollarSignIcon, CheckIcon, ListChecksIcon, SparklesIcon } from "lucide-react"

import { Bento, BentoCard } from "@/components/organizzou/Bento"
import { BentoStat } from "@/components/finance/bento"
import { HatchedProgress, HeroCard } from "@/components/finance/parts"
import { usePlan } from "@/components/organizzou/plan-context"
import { SoonBadge } from "@/components/organizzou/SoonBadge"
import { ProWaitlistDialog } from "@/components/plan/pro-waitlist-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatBRL } from "@/lib/money"
import { hasYearlyPrice, usageView, yearlySavingCents, type PlanUsage } from "@/lib/plan-usage"
import { LIMIT_LABELS, PLANS, type LimitKey, type PlanId } from "@/lib/plans"
import { cn } from "@/lib/utils"

type Billing = "monthly" | "yearly"

const LIMIT_ROWS: LimitKey[] = ["taskBoards", "assistantMessagesPerDay"]
const EMPTY_USAGE: PlanUsage = { taskBoards: null, assistantToday: null }

function limitText(limit: number | null, key: LimitKey) {
  if (limit === null) return "Ilimitado"
  const label = LIMIT_LABELS[key]
  return `${limit} ${limit === 1 ? label.singular : label.plural}`
}

function Price({ plan, billing }: { plan: PlanId; billing: Billing }) {
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

/** One plan: name, price, features, and (for Pro) what the footer can do. The person's own plan has a 2 px border and the "Seu plano" chip. */
function PlanCard({ id, billing, current, className, footer }: { id: PlanId; billing: Billing; current: boolean; className?: string; footer?: React.ReactNode }) {
  const def = PLANS[id]
  return (
    <section aria-label={def.name} data-plan-card={id} data-current={current} className={cn("flex min-w-0 flex-col gap-5 rounded-[24px] border-2 bg-card p-6", current ? "border-primary" : "border-border", className)}>
      <header className="flex min-h-9 items-center justify-between gap-3">
        <h3 className="text-[17px] leading-6 font-semibold">{def.name}</h3>
        {current ? <Badge variant="secondary">Seu plano</Badge> : null}
      </header>
      <p className="text-[15px] leading-6 text-muted-foreground">{def.tagline}</p>
      <Price plan={id} billing={billing} />
      <ul className="flex flex-col">
        {def.features.map((feature) => (
          <li key={feature} className="flex min-h-11 items-center gap-3 border-b border-border py-2 text-[15px] leading-6 last:border-b-0">
            <CheckIcon aria-hidden strokeWidth={1.75} className={cn("size-[18px] shrink-0", id === "free" && "text-muted-foreground")} />
            {feature}
          </li>
        ))}
      </ul>
      {footer}
    </section>
  )
}

/**
 * Plano e cobrança: your plan and what you use of it, the two plans side by side, and the limits table. There is no payment yet, so nothing here
 * charges or shows invoices: "Gerenciar assinatura" is disabled and the only action is the waiting list.
 */
export function PlanoScreen({ email, name, usage = EMPTY_USAGE }: { email: string; name: string; usage?: PlanUsage }) {
  const { plan, pro, definition } = usePlan()
  const [billing, setBilling] = useState<Billing>("monthly")
  const [open, setOpen] = useState(false)
  const free = PLANS.free
  const proDef = PLANS.pro
  const saving = yearlySavingCents("pro")
  const yearly = hasYearlyPrice("pro")
  const boards = usageView(plan, "taskBoards", usage.taskBoards)
  const assistant = usageView(plan, "assistantMessagesPerDay", usage.assistantToday)
  // With no yearly price the period control is hidden and monthly prices show.
  const period: Billing = yearly ? billing : "monthly"

  return (
    <div className="@container flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 @min-[900px]:grid-cols-4">
        <HeroCard
          className="col-span-2"
          density="dense"
          label="Seu plano atual"
          value={definition.name}
          support="Obrigado por apoiar o Organizzou. Sem cobrança por enquanto."
          actions={
            <Button type="button" disabled className="mt-auto h-11 self-start rounded-full border-transparent bg-highlight-foreground/10 text-highlight-foreground md:h-11">
              Gerenciar assinatura
            </Button>
          }
        />
        <BentoStat
          label="Listas de tarefas"
          icon={ListChecksIcon}
          chip={boards.limit === null ? "sem limite" : "no Plano Gratuito"}
          footer={boards.percent !== null ? <HatchedProgress value={boards.percent} label={`Listas de tarefas: ${boards.value}`} /> : undefined}
          className="min-h-[168px]"
        >
          {boards.value}
        </BentoStat>
        <BentoStat
          label="Assistente hoje"
          icon={SparklesIcon}
          chip="mensagens por dia"
          footer={assistant.percent !== null ? <HatchedProgress value={assistant.percent} label={`Assistente hoje: ${assistant.value}`} /> : undefined}
          className="min-h-[168px]"
        >
          {assistant.value}
        </BentoStat>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-[17px] leading-6 font-semibold">Compare os planos</h2>
          <p className="text-[13px] leading-5 text-muted-foreground">{pro ? "Você está no Plano Pro. Obrigado por apoiar o Organizzou." : "Os valores abaixo são estimativas e ainda podem mudar antes do lançamento."}</p>
        </div>
        {yearly ? (
          <Tabs value={billing} onValueChange={(v) => setBilling(v as Billing)}>
            <TabsList aria-label="Periodicidade">
              <TabsTrigger value="monthly">Mensal</TabsTrigger>
              <TabsTrigger value="yearly">
                Anual
                {saving > 0 ? <Badge variant="secondary" className="ml-2">{`economize ${formatBRL(saving)} no anual`}</Badge> : null}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 @min-[900px]:grid-cols-2">
        <PlanCard id="free" billing={period} current={plan === "free"} />
        <PlanCard
          id="pro"
          billing={period}
          current={pro}
          className="@max-[899px]:-order-1 @max-[899px]:data-[current=false]:order-none"
          footer={
            <div className="mt-auto flex flex-col gap-2">
              {pro ? (
                <Button type="button" disabled className="h-11 self-start rounded-full md:h-11">
                  Gerenciar assinatura
                </Button>
              ) : (
                <Button type="button" className="h-11 self-start rounded-full md:h-11" onClick={() => setOpen(true)}>
                  <BadgeDollarSignIcon strokeWidth={1.75} /> Fazer upgrade
                </Button>
              )}
              <p className="text-[13px] leading-5 text-muted-foreground">Em breve: pagamento, troca de período e cancelamento por aqui.</p>
            </div>
          }
        />
      </div>

      <Bento className="gap-4">
        <BentoCard className="col-span-12" title="Comparativo de limites">
          <div role="table" aria-label="Comparativo de limites" className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] text-[15px] leading-6">
            <span role="columnheader" className="pb-2 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Recurso
            </span>
            <span role="columnheader" className="pb-2 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Gratuito
            </span>
            <span role="columnheader" className="pb-2 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Pro
            </span>
            {LIMIT_ROWS.map((key) => (
              <div key={key} role="row" className="col-span-3 grid min-h-12 grid-cols-subgrid items-center border-t border-border py-3">
                <span role="cell">{LIMIT_LABELS[key].plural[0].toUpperCase() + LIMIT_LABELS[key].plural.slice(1)}</span>
                <span role="cell" className="tabular">
                  {limitText(free.limits[key], key)}
                </span>
                <span role="cell" className="tabular">
                  {limitText(proDef.limits[key], key)}
                </span>
              </div>
            ))}
          </div>
        </BentoCard>

        <BentoCard className="col-span-12" title="Cobrança" actions={<SoonBadge />}>
          <p className="max-w-[72ch] text-[15px] leading-6 text-muted-foreground">O pagamento ainda não está disponível. Não há cobrança nem histórico de faturas por enquanto; ao abrir, tudo aparece aqui.</p>
        </BentoCard>
      </Bento>

      <ProWaitlistDialog open={open} onOpenChange={setOpen} email={email} name={name} />
    </div>
  )
}
