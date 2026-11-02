import { CheckIcon, InfoIcon } from "lucide-react"

import { Intro } from "@/components/admin/parts"
import { BentoCard } from "@/components/organizzou/Bento"
import { PageGrid, PageShell } from "@/components/organizzou/layout"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LIMIT_LABELS, PLANS, type LimitKey } from "@/lib/plans"
import { formatBRL } from "@/lib/money"

const LIMIT_KEYS = Object.keys(LIMIT_LABELS) as LimitKey[]

function limitText(value: number | null, key: LimitKey) {
  if (value === null) return "Ilimitado"
  const label = value === 1 ? LIMIT_LABELS[key].singular : LIMIT_LABELS[key].plural
  return `${value} ${label}`
}

/** Read-only view of src/lib/plans.ts. Nothing here can change a plan: edits are code changes for now. */
export default function PlansPage() {
  const plans = Object.values(PLANS)
  return (
    <PageShell>
      <Intro icon={InfoIcon}>
        Somente leitura. Os planos, os limites e os preços vêm de <span className="font-mono text-[14px] text-foreground">src/lib/plans.ts</span>. Por enquanto, qualquer mudança é feita no código.
      </Intro>

      <PageGrid>
        {plans.map((plan) => (
          <PageGrid.Item key={plan.id} span="half">
            <BentoCard title={plan.name} tone="default" className="h-full" actions={<Badge variant={plan.id === "pro" ? "default" : "secondary"}>{plan.id === "pro" ? "Pago" : "Grátis"}</Badge>}>
              <p className="text-[15px] leading-6 text-muted-foreground">{plan.tagline}</p>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <dt className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">Mensal</dt>
                  <dd className="tabular text-2xl leading-8 font-semibold">{formatBRL(plan.price.monthlyCents)}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">Anual</dt>
                  <dd className="tabular text-2xl leading-8 font-semibold">{formatBRL(plan.price.yearlyCents)}</dd>
                </div>
              </dl>
              {plan.id === "pro" ? <p className="mt-2 text-[13px] leading-5 text-muted-foreground">Preços provisórios (TODO do dono no código). Ninguém é cobrado ainda.</p> : null}
              <h3 className="mt-6 mb-2 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">O que inclui</h3>
              <ul className="flex flex-col gap-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-[15px] leading-6">
                    <CheckIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </BentoCard>
          </PageGrid.Item>
        ))}
      </PageGrid>

      <BentoCard title="Limites por plano" bodyClassName="-mx-6 -mb-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Limite</TableHead>
              {plans.map((plan, i) => (
                <TableHead key={plan.id} className={i === plans.length - 1 ? "pr-6" : undefined}>
                  {plan.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {LIMIT_KEYS.map((key) => (
              <TableRow key={key}>
                <TableCell className="pl-6">{LIMIT_LABELS[key].plural.replace(/^./, (c) => c.toUpperCase())}</TableCell>
                {plans.map((plan, i) => (
                  <TableCell key={plan.id} className={i === plans.length - 1 ? "tabular pr-6" : "tabular"}>
                    {limitText(plan.limits[key], key)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </BentoCard>
    </PageShell>
  )
}
