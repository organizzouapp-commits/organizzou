import Link from "next/link"

import { DataUnavailable, TableCard } from "@/components/admin/parts"
import { PlanChart } from "@/components/admin/charts"
import { BentoCard, KpiCard } from "@/components/organizzou/Bento"
import { PageGrid, PageShell, StatRow } from "@/components/organizzou/layout"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { OrphanRetryButton } from "@/components/admin/orphan-retry-button"
import { launchPriceUsers, manualProAccounts, type ManualPro } from "@/lib/admin/billing-extra"
import { openOrphanSubscriptions } from "@/lib/admin/billing-orphans"
import { activeCourtesies, billingByUser, type BillingRow, planDistribution } from "@/lib/admin/data"
import { fmtDate, fmtInt } from "@/lib/admin/format"
import { formatBRL } from "@/lib/money"

const PERIOD = { monthly: "Mensal", annual: "Anual" } as const
const METHOD = { card: "Cartão", pix: "Pix", boleto: "Boleto" } as const
const STATUS = { pending: "Pendente", active: "Ativa", overdue: "Em atraso", canceled: "Cancelada", ended: "Encerrada" } as const
const INVOICE = { RECEIVED: "Paga", CONFIRMED: "Paga", RECEIVED_IN_CASH: "Paga", PENDING: "Pendente", OVERDUE: "Atrasada", REFUNDED: "Reembolsada" } as Record<string, string>

function SubscriptionsTable({ rows, manual, launch }: { rows: BillingRow[]; manual: ManualPro[]; launch: Set<string> | null }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Pessoa</TableHead>
          <TableHead>Plano</TableHead>
          <TableHead>Período</TableHead>
          <TableHead>Forma</TableHead>
          <TableHead>Assinatura</TableHead>
          <TableHead>Última fatura</TableHead>
          <TableHead>Preço de lançamento</TableHead>
          <TableHead className="pr-6 text-right">Pro até</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.user_id}>
            <TableCell className="pl-6">
              <Link href={`/admin/usuarios?usuario=${row.user_id}`} className="rounded-md outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                {row.name ? `${row.name} · ` : ""}
                {row.email}
              </Link>
            </TableCell>
            <TableCell>{row.plan === "pro" ? "Pro" : "Gratuito"}</TableCell>
            <TableCell>{PERIOD[row.period]}</TableCell>
            <TableCell>{METHOD[row.method]}</TableCell>
            <TableCell>
              <Badge variant="secondary">{STATUS[row.status]}</Badge>
              {row.cancel_at_period_end ? <span className="ml-2 text-[13px] text-muted-foreground">cancela no fim</span> : null}
            </TableCell>
            <TableCell>{row.last_invoice ? `${INVOICE[row.last_invoice.status] ?? row.last_invoice.status} · ${formatBRL(row.last_invoice.amount_cents)}` : "—"}</TableCell>
            <TableCell>{launch === null ? "—" : launch.has(row.user_id) ? "Já usou" : "Não usou"}</TableCell>
            <TableCell className="tabular pr-6 text-right">{fmtDate(row.plan_until)}</TableCell>
          </TableRow>
        ))}
        {manual.map((m) => (
          <TableRow key={m.userId}>
            <TableCell className="pl-6">
              <Link href={`/admin/usuarios?usuario=${m.userId}`} className="rounded-md outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                {m.email}
              </Link>
            </TableCell>
            <TableCell>Pro</TableCell>
            <TableCell>—</TableCell>
            <TableCell>—</TableCell>
            <TableCell>
              <Badge>Pro manual</Badge>
              <span className="ml-2 text-[13px] text-muted-foreground">{m.planUntil ? "cortesia com data de fim" : "sem cobrança"}</span>
            </TableCell>
            <TableCell>—</TableCell>
            <TableCell>—</TableCell>
            <TableCell className="tabular pr-6 text-right">{m.planUntil ? fmtDate(m.planUntil) : "sem fim"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/**
 * People per plan, active courtesies and, now that payments exist, every account with a subscription: plan, period, method, status and the
 * last invoice. Granting or revoking Pro by hand is in each person's panel (Alterar plano), audit-logged. Nothing here estimates revenue.
 */
export default async function BillingPage() {
  const [plans, courtesies, subscriptions, orphans, manualPro] = await Promise.all([planDistribution(), activeCourtesies(), billingByUser(), openOrphanSubscriptions(), manualProAccounts()])
  const manual = manualPro.ok ? manualPro.data : []
  const launched = await launchPriceUsers(subscriptions.ok ? subscriptions.data.map((s) => s.user_id) : [])
  const launch = launched.ok ? launched.data : null

  const count = { free: 0, pro: 0, courtesy: 0 }
  if (plans.ok) {
    for (const row of plans.data) {
      if (row.plan === "free") count.free += row.users
      else if (row.courtesy) count.courtesy += row.users
      else count.pro += row.users
    }
  }
  const subs = subscriptions.ok ? subscriptions.data : []
  const active = subs.filter((s) => s.status === "active").length
  const overdue = subs.filter((s) => s.status === "overdue").length

  return (
    <PageShell>
      {!plans.ok ? <DataUnavailable error={plans.error} /> : null}
      <StatRow min={200}>
        <KpiCard label="Plano Gratuito" value={fmtInt(count.free)} support="pessoas" />
        <KpiCard label="Plano Pro" value={fmtInt(count.pro + count.courtesy)} support="pessoas, incluindo cortesias" tone="highlight" />
        <KpiCard label="Assinaturas ativas" value={subscriptions.ok ? fmtInt(active) : "—"} support={subscriptions.ok ? "com cobrança" : "aguardando a migration"} />
        <KpiCard label="Em atraso" value={subscriptions.ok ? fmtInt(overdue) : "—"} support="cobrança que não passou" />
        <KpiCard label="Cortesias ativas" value={fmtInt(count.courtesy)} support="Pro com data de fim" />
      </StatRow>

      <PageGrid>
        <PageGrid.Item span="full">
          <TableCard>
            <div className="flex flex-col gap-1 p-6 pb-3">
              <h2 className="text-[17px] leading-6 font-semibold">Assinaturas</h2>
              <p className="text-[13px] leading-5 text-muted-foreground">Para dar ou tirar o Pro à mão, abra a pessoa e use Alterar plano (fica na auditoria). Tirar o Pro de quem tem assinatura ativa não cancela a cobrança: cancele também no Asaas.</p>
            </div>
            {subscriptions.ok && subs.length + manual.length > 0 ? (
              <SubscriptionsTable rows={subs} manual={manual} launch={launch} />
            ) : subscriptions.ok ? (
              <p className="px-6 pb-6 text-[15px] text-muted-foreground">Ninguém assinou ainda.</p>
            ) : (
              <p className="px-6 pb-6 text-[15px] text-muted-foreground">A lista de assinaturas aparece quando a migration 20261118000003_admin_billing.sql for aplicada no banco.</p>
            )}
          </TableCard>
        </PageGrid.Item>
        {orphans.ok && orphans.data.length === 0 ? null : (
          <PageGrid.Item span="full">
            <TableCard>
              <div className="flex flex-col gap-1 p-6 pb-3">
                <h2 className="text-[17px] leading-6 font-semibold">Pendentes de limpeza</h2>
                <p className="text-[13px] leading-5 text-muted-foreground">Assinaturas que um pagamento que falhou não conseguiu apagar no Asaas. Podem cobrar o valor normal no vencimento: apague e confira no painel do Asaas.</p>
              </div>
              {orphans.ok ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Assinatura no Asaas</TableHead>
                      <TableHead>Pessoa</TableHead>
                      <TableHead>Desde</TableHead>
                      <TableHead className="pr-6 text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orphans.data.map((o) => (
                      <TableRow key={o.asaasSubscriptionId}>
                        <TableCell className="pl-6 font-mono text-[13px]">{o.asaasSubscriptionId}</TableCell>
                        <TableCell>
                          {o.userId ? (
                            <Link href={`/admin/usuarios?usuario=${o.userId}`} className="rounded-md outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                              abrir pessoa
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="tabular">{fmtDate(o.createdAt)}</TableCell>
                        <TableCell className="pr-6 text-right">
                          <OrphanRetryButton subscription={o.asaasSubscriptionId} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="px-6 pb-6">
                  <DataUnavailable error={orphans.error} title="Não carregou" />
                </div>
              )}
            </TableCard>
          </PageGrid.Item>
        )}
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
    </PageShell>
  )
}
