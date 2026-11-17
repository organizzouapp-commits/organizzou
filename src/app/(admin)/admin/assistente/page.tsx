import { CoinsIcon, SparklesIcon } from "lucide-react"

import { DailyBarsChart } from "@/components/admin/charts"
import { AssistantBudgetBanner } from "@/components/admin/assistant-budget-banner"
import { AssistantCostSection } from "@/components/admin/assistant-cost"
import { DataUnavailable, Intro, SegmentedLinks, TableCard } from "@/components/admin/parts"
import { BentoCard, KpiCard } from "@/components/organizzou/Bento"
import { PageGrid, PageShell, StatRow } from "@/components/organizzou/layout"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { periodFromSlug, slugOfPeriod } from "@/lib/admin/assistant-cost"
import { loadBudget } from "@/lib/admin/assistant-budget"
import { assistantCostByUser, assistantTokens, assistantUsage } from "@/lib/admin/data"
import { dayOf } from "@/lib/sp-time"
import { fmtInt, fmtPct } from "@/lib/admin/format"

const RANGES = ["7", "30", "90"] as const

/**
 * Reads only actor, action, confirmed_at, user and date from audit_log: never the payload. The assistant is still a prototype, so
 * "nothing yet" is the true answer and the page says why instead of showing made-up volume.
 */
export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ periodo?: string; custo?: string; q?: string }> }) {
  const { periodo, custo, q } = await searchParams
  const range = RANGES.find((r) => r === periodo) ?? "30"
  const period = periodFromSlug(custo)
  const search = (q ?? "").slice(0, 80)
  const [usage, tokens, cost, budget] = await Promise.all([assistantUsage(Number(range)), assistantTokens(Number(range)), assistantCostByUser(), loadBudget()])
  // The links keep the other filters: the audit period, the cost period and the search.
  const hrefFor = (changes: { custo?: string; q?: string }) => {
    const params = new URLSearchParams()
    if (periodo) params.set("periodo", range)
    params.set("custo", changes.custo ?? slugOfPeriod(period))
    const query = changes.q ?? search
    if (query) params.set("q", query)
    return `?${params.toString()}`
  }

  if (!usage.ok) return <DataUnavailable error={usage.error} />
  const u = usage.data
  const confirmedRatio = u.total > 0 ? u.confirmed / u.total : null

  return (
    <PageShell
      actions={
        <SegmentedLinks
          label="Período"
          active={range}
          options={[
            { value: "7", label: "7 dias", href: "?periodo=7" },
            { value: "30", label: "30 dias", href: "?periodo=30" },
            { value: "90", label: "90 dias", href: "?periodo=90" },
          ]}
        />
      }
    >
      <AssistantBudgetBanner />

      {cost.ok ? (
        <AssistantCostSection rows={cost.data} period={period} search={search} budget={budget} today={dayOf(new Date(), 0)} hrefFor={hrefFor} />
      ) : (
        <Intro icon={CoinsIcon}>O custo por conta aparece aqui quando a migração 20261117000001_admin_assistant_cost.sql for aplicada no banco.</Intro>
      )}

      {u.total === 0 ? (
        <Intro icon={SparklesIcon}>Nenhuma ação do assistente registrada no período. Só ações reais gravadas em auditoria aparecem aqui.</Intro>
      ) : null}

      {tokens.ok ? (
        <StatRow min={200}>
          <KpiCard label="Mensagens ao assistente" value={fmtInt(tokens.data.messages)} support={`nos últimos ${range} dias`} tone="highlight" />
          <KpiCard label="Pessoas que usaram" value={fmtInt(tokens.data.users)} support="com ao menos uma mensagem" />
          <KpiCard label="Tokens de entrada" value={fmtInt(tokens.data.input_tokens)} support="o que o modelo leu" />
          <KpiCard label="Tokens de saída" value={fmtInt(tokens.data.output_tokens)} support="o que o modelo escreveu" />
        </StatRow>
      ) : (
        <Intro icon={CoinsIcon}>Mensagens e tokens aparecem aqui quando a atualização do banco do assistente for aplicada.</Intro>
      )}

      <StatRow min={200}>
        <KpiCard label="Ações executadas" value={fmtInt(u.total)} support={`nos últimos ${range} dias`} tone="highlight" />
        <KpiCard label="Com confirmação" value={fmtInt(u.confirmed)} support="confirmadas pela pessoa" />
        <KpiCard label="Taxa de confirmação" value={fmtPct(confirmedRatio)} support={confirmedRatio == null ? "Sem ações no período" : "das ações registradas"} />
        <KpiCard label="Sem confirmação registrada" value={fmtInt(u.total - u.confirmed)} support="rejeitadas ou sem exigir confirmação" />
      </StatRow>

      <PageGrid>
        <PageGrid.Item span="three-fifths">
          <BentoCard title="Ações por dia" className="h-full">
            <DailyBarsChart data={u.daily.map((d) => ({ day: d.day, value: d.actions }))} label="Ações por dia" empty="Sem ações no período." />
          </BentoCard>
        </PageGrid.Item>
        <PageGrid.Item span="two-fifths">
          <TableCard className="h-full">
            <h2 className="p-6 pb-3 text-[17px] leading-6 font-semibold">Ações por ferramenta</h2>
            {u.by_action.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Ação</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="pr-6 text-right">Confirmadas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {u.by_action.map((row) => (
                    <TableRow key={row.action}>
                      <TableCell className="pl-6 font-mono text-[14px]">{row.action}</TableCell>
                      <TableCell className="tabular text-right">{fmtInt(row.actions)}</TableCell>
                      <TableCell className="tabular pr-6 text-right">{fmtInt(row.confirmed)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="px-6 pb-6 text-[15px] text-muted-foreground">Nenhuma ação no período.</p>
            )}
          </TableCard>
        </PageGrid.Item>
      </PageGrid>

      <PageGrid>
        <PageGrid.Item span="full">
          <TableCard className="h-full">
            <div className="flex flex-col gap-1 p-6 pb-3">
              <h2 className="text-[17px] leading-6 font-semibold">Quem mais usa</h2>
              <p className="text-[13px] leading-5 text-muted-foreground">Só identificação e volume. Nenhum conteúdo de conversa.</p>
            </div>
            {u.top_users.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">E-mail</TableHead>
                    <TableHead className="pr-6 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {u.top_users.map((row) => (
                    <TableRow key={row.user_id}>
                      <TableCell className="pl-6">{row.email}</TableCell>
                      <TableCell className="tabular pr-6 text-right">{fmtInt(row.actions)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="px-6 pb-6 text-[15px] text-muted-foreground">Ninguém usou o assistente no período.</p>
            )}
          </TableCard>
        </PageGrid.Item>
      </PageGrid>
    </PageShell>
  )
}
