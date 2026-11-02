import Link from "next/link"
import { BanknoteXIcon, ReceiptTextIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import { ComingSoon, DataUnavailable, TableCard } from "@/components/admin/parts"
import { PlanChart } from "@/components/admin/charts"
import { BentoCard, KpiCard } from "@/components/organizzou/Bento"
import { PageGrid, PageShell, StatRow } from "@/components/organizzou/layout"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { billingProvider } from "@/lib/admin/billing"
import { activeCourtesies, planDistribution } from "@/lib/admin/data"
import { fmtDate, fmtInt } from "@/lib/admin/format"

/**
 * Payments are not built. This page shows only what exists in the database today (people per plan, active courtesies) and marks
 * everything that needs a payment provider as "Em breve". It never estimates MRR or churn.
 */
export default async function BillingPage() {
  const [plans, courtesies] = await Promise.all([planDistribution(), activeCourtesies()])
  // A real provider would replace the placeholders below. Typed in src/lib/admin/billing.ts.
  const provider = billingProvider

  const count = { free: 0, pro: 0, courtesy: 0 }
  if (plans.ok) {
    for (const row of plans.data) {
      if (row.plan === "free") count.free += row.users
      else if (row.courtesy) count.courtesy += row.users
      else count.pro += row.users
    }
  }

  return (
    <PageShell>
      {!plans.ok ? <DataUnavailable error={plans.error} /> : null}
      <StatRow min={200}>
        <KpiCard label="Plano Gratuito" value={fmtInt(count.free)} support="pessoas" />
        <KpiCard label="Plano Pro" value={fmtInt(count.pro + count.courtesy)} support="pessoas, incluindo cortesias" tone="highlight" />
        <KpiCard label="Cortesias ativas" value={fmtInt(count.courtesy)} support="Pro com data de fim" />
      </StatRow>

      <PageGrid>
        <PageGrid.Item span="half">
          <BentoCard title="Pessoas por plano" className="h-full">
            {plans.ok ? (
              <PlanChart
                data={[
                  { key: "free", label: "Gratuito", users: count.free },
                  { key: "pro", label: "Pro", users: count.pro },
                  { key: "cortesia", label: "Pro de cortesia", users: count.courtesy },
                ]}
              />
            ) : (
              <DataUnavailable error={plans.error} />
            )}
            <p className="mt-4 text-[13px] leading-5 text-muted-foreground">Hoje todo Pro é concedido por um admin: ainda não existe cobrança.</p>
          </BentoCard>
        </PageGrid.Item>
        <PageGrid.Item span="half">
          <TableCard className="h-full">
            <div className="flex items-center justify-between gap-3 p-6 pb-3">
              <h2 className="text-[17px] leading-6 font-semibold">Cortesias ativas</h2>
            </div>
            {courtesies.ok && courtesies.data.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Pessoa</TableHead>
                    <TableHead className="pr-6 text-right">Termina em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courtesies.data.map((c) => (
                    <TableRow key={c.user_id}>
                      <TableCell className="pl-6">
                        <Link href={`/admin/usuarios?usuario=${c.user_id}`} className="rounded-md outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                          {c.email}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular pr-6 text-right">{fmtDate(c.until)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : courtesies.ok ? (
              <p className="px-6 pb-6 text-[15px] text-muted-foreground">Nenhuma cortesia ativa. Dê um Pro de cortesia pelo painel de cada usuário.</p>
            ) : (
              <div className="px-6 pb-6">
                <DataUnavailable error={courtesies.error} title="Não carregou" />
              </div>
            )}
          </TableCard>
        </PageGrid.Item>
      </PageGrid>

      <PageGrid>
        {provider ? null : (
          <>
            <PageGrid.Item span="half">
              <ComingSoon icon={TrendingUpIcon} title="Receita recorrente (MRR)" description="Quanto entra por mês com as assinaturas ativas." needs="um provedor de pagamento ligado em src/lib/admin/billing.ts" />
            </PageGrid.Item>
            <PageGrid.Item span="half">
              <ComingSoon icon={TrendingDownIcon} title="Cancelamentos (churn)" description="Quantas pessoas deixam de pagar a cada mês." needs="um provedor de pagamento e o histórico de assinaturas" />
            </PageGrid.Item>
            <PageGrid.Item span="half">
              <ComingSoon icon={ReceiptTextIcon} title="Faturas" description="Cobranças emitidas, pagas e em aberto." needs="um provedor de pagamento" />
            </PageGrid.Item>
            <PageGrid.Item span="half">
              <ComingSoon icon={BanknoteXIcon} title="Falhas de pagamento" description="Cartões recusados e cobranças que precisam de atenção." needs="um provedor de pagamento" />
            </PageGrid.Item>
          </>
        )}
      </PageGrid>
    </PageShell>
  )
}
