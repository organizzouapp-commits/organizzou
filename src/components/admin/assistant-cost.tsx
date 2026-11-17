import Link from "next/link"
import { CoinsIcon, SearchIcon, TriangleAlertIcon } from "lucide-react"

import { AssistantBudgetForm } from "@/components/admin/assistant-budget-form"
import { Intro, SegmentedLinks, TableCard } from "@/components/admin/parts"
import { BentoCard, KpiCard } from "@/components/organizzou/Bento"
import { StatRow } from "@/components/organizzou/layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { budgetState, costLines, monthSpendUsd, PERIODS, projectMonth, slugOfPeriod, totalsOf, type CostLine, type CostRow, type Period } from "@/lib/admin/assistant-cost"
import type { BudgetInfo } from "@/lib/admin/assistant-budget"
import { fmtDateTime, fmtInt } from "@/lib/admin/format"
import { ESTIMATE_NOTE, formatBrl, formatUsd, usdToBrl, ASSISTANT_PRICING } from "@/lib/assistant-pricing"
import { cn } from "@/lib/utils"

const money = (usd: number) => ({ brl: formatBrl(usdToBrl(usd)), usd: formatUsd(usd) })

/** A real/dollar pair, the real value first. */
function Money({ usd, className }: { usd: number; className?: string }) {
  const m = money(usd)
  return (
    <span className={cn("tabular flex flex-col leading-tight", className)}>
      <span className="font-medium">{m.brl}</span>
      <span className="text-[12px] text-muted-foreground">{m.usd}</span>
    </span>
  )
}

/** The bar "gasto estimado do mês vs. orçamento": a warning from 80%, and a clear state above the budget. */
export function BudgetBar({ spentUsd, budgetUsd }: { spentUsd: number; budgetUsd: number | null }) {
  const { state, ratio } = budgetState(spentUsd, budgetUsd)
  if (state === "none" || ratio == null) return <p className="text-[14px] leading-5 text-muted-foreground">Nenhum orçamento definido. Defina um valor para acompanhar o gasto do mês.</p>
  const percent = Math.round(ratio * 100)
  return (
    <div className="flex flex-col gap-2" data-testid="budget-bar" data-state={state}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-[14px] leading-5">
        <span className="tabular font-medium">
          {formatBrl(usdToBrl(spentUsd))} <span className="text-muted-foreground">({formatUsd(spentUsd)})</span> de {formatBrl(usdToBrl(budgetUsd!))} <span className="text-muted-foreground">({formatUsd(budgetUsd!)})</span>
        </span>
        <span className="tabular font-semibold">{percent}%</span>
      </div>
      <div role="progressbar" aria-label="Gasto estimado do mês em relação ao orçamento" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, percent)} className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-[width] duration-[400ms] motion-reduce:transition-none", state === "ok" ? "bg-highlight" : "bg-foreground")} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
      {state !== "ok" ? (
        <p role="status" className="flex items-center gap-2 text-[14px] leading-5 font-medium">
          <TriangleAlertIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0" />
          {state === "exceeded" ? "O gasto estimado passou do orçamento do mês." : "O gasto estimado chegou a 80% do orçamento do mês."}
        </p>
      ) : null}
    </div>
  )
}

function AccountCard({ line }: { line: CostLine }) {
  const { row, shown } = line
  return (
    <li className="flex flex-col gap-3 rounded-[20px] border border-border p-4" data-testid="cost-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] leading-6 font-semibold">{row.name || row.email}</span>
          {row.name ? <span className="truncate text-[13px] leading-5 text-muted-foreground">{row.email}</span> : null}
        </div>
        <Badge variant="outline">{row.plan === "pro" ? "Pro" : "Gratuito"}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] leading-5">
        <Stat label="Mensagens hoje" value={fmtInt(line.todayMessages)} />
        <Stat label="Mensagens no mês" value={fmtInt(line.monthMessages)} />
        <Stat label="Tokens de entrada" value={fmtInt(shown.input)} />
        <Stat label="Tokens de saída" value={fmtInt(shown.output)} />
        <div className="flex flex-col">
          <dt className="text-muted-foreground">Custo no mês</dt>
          <dd>
            <Money usd={line.monthCostUsd} />
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-muted-foreground">Custo total</dt>
          <dd>
            <Money usd={line.totalCostUsd} />
          </dd>
        </div>
      </dl>
      <p className="text-[12px] leading-4 text-muted-foreground">Último uso: {fmtDateTime(row.last_use)}</p>
    </li>
  )
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="tabular font-medium">{value}</dd>
  </div>
)

/**
 * "Custo do assistente por conta": month-to-date spend against the budget, the projection, and one line per account (a table from 768px, cards
 * on phones). Counts and tokens only: no message text exists in what this receives. Every figure is an ESTIMATE from tokens (see assistant-pricing.ts).
 */
export function AssistantCostSection({ rows, period, search, budget, today, hrefFor }: { rows: CostRow[]; period: Period; search: string; budget: BudgetInfo; today: string; hrefFor: (changes: { custo?: string; q?: string }) => string }) {
  const lines = costLines(rows, period, search)
  const totals = totalsOf(lines)
  const monthSpend = monthSpendUsd(rows)
  const projection = projectMonth(monthSpend, today)
  const totalSpend = rows.reduce((a, r) => a + costLines([r], "total", "")[0].costUsd, 0)
  const activeMonth = rows.filter((r) => r.month.messages > 0).length
  const month = money(monthSpend)

  return (
    <section aria-label="Custo do assistente por conta" className="flex flex-col gap-5" data-testid="assistant-cost">
      <div className="flex flex-col gap-1 px-1">
        <h2 className="text-[19px] leading-7 font-semibold">Custo do assistente por conta</h2>
        <p className="text-[13px] leading-5 text-muted-foreground">
          <strong className="font-semibold text-foreground">Estimativa.</strong> {ESTIMATE_NOTE} Preços: US$ {ASSISTANT_PRICING.inputUsdPerMillion.toFixed(2)} (entrada) e US$ {ASSISTANT_PRICING.outputUsdPerMillion.toFixed(2)} (saída) por milhão de tokens, modelo {ASSISTANT_PRICING.model}. Só contagens e tokens; nenhum texto de conversa.
        </p>
      </div>

      <StatRow min={200}>
        <KpiCard label="Gasto estimado no mês" value={month.brl} support={`${month.usd} · estimativa`} tone="highlight" />
        <KpiCard label="Projeção do mês" value={projection == null ? "—" : money(projection).brl} support={projection == null ? "sem dados" : `${money(projection).usd} · no ritmo atual`} />
        <KpiCard label="Gasto total" value={money(totalSpend).brl} support={`${money(totalSpend).usd} · desde o início`} />
        <KpiCard label="Contas que usaram no mês" value={fmtInt(activeMonth)} support={`de ${fmtInt(rows.length)} com algum uso`} />
      </StatRow>

      <BentoCard title="Orçamento mensal" bodyClassName="gap-4">
        <BudgetBar spentUsd={monthSpend} budgetUsd={budget.usd} />
        <AssistantBudgetForm current={budget.usd} source={budget.source} canSave={budget.canSave} />
      </BentoCard>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedLinks label="Período do custo" active={slugOfPeriod(period)} options={PERIODS.map((p) => ({ value: p.slug, label: p.label, href: hrefFor({ custo: p.slug }) }))} />
        <form action="" method="get" role="search" className="flex w-full items-center gap-2 sm:w-auto">
          <input type="hidden" name="custo" value={slugOfPeriod(period)} />
          <label className="relative flex-1 sm:w-72">
            <span className="sr-only">Buscar por nome ou e-mail</span>
            <SearchIcon aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input name="q" defaultValue={search} placeholder="Buscar por nome ou e-mail" className="h-11 w-full rounded-full border border-border bg-card pr-4 pl-9 text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
          </label>
          <Button type="submit" variant="outline" className="h-11 rounded-full px-4">
            Buscar
          </Button>
        </form>
      </div>

      {lines.length === 0 ? (
        <Intro icon={CoinsIcon}>{rows.length === 0 ? "Ninguém usou o assistente ainda." : "Nenhuma conta encontrada para essa busca."}</Intro>
      ) : (
        <>
          {/* Phones: one card per account. */}
          <ul className="flex flex-col gap-3 md:hidden" aria-label="Contas por custo">
            {lines.map((line) => (
              <AccountCard key={line.row.user_id} line={line} />
            ))}
            <li className="flex flex-col gap-1 rounded-[20px] border border-dashed border-border p-4" data-testid="cost-total-card">
              <span className="text-[13px] font-semibold">Total ({lines.length} {lines.length === 1 ? "conta" : "contas"})</span>
              <span className="tabular text-[13px] text-muted-foreground">
                {fmtInt(totals.shown.messages)} mensagens no período · {fmtInt(totals.shown.input)} entrada · {fmtInt(totals.shown.output)} saída
              </span>
              <span className="tabular text-[13px]">
                Mês {money(totals.monthCostUsd).brl} ({money(totals.monthCostUsd).usd}) · Total {money(totals.totalCostUsd).brl} ({money(totals.totalCostUsd).usd})
              </span>
            </li>
          </ul>

          {/* From 768px: the table. */}
          <TableCard className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Conta</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Msgs hoje</TableHead>
                  <TableHead className="text-right">Msgs mês</TableHead>
                  <TableHead className="text-right">Entrada</TableHead>
                  <TableHead className="text-right">Saída</TableHead>
                  <TableHead className="text-right">Custo no mês</TableHead>
                  <TableHead className="text-right">Custo total</TableHead>
                  <TableHead className="pr-6">Último uso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.row.user_id}>
                    <TableCell className="max-w-64 pl-6">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{line.row.name || line.row.email}</span>
                        {line.row.name ? <span className="truncate text-[13px] text-muted-foreground">{line.row.email}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell>{line.row.plan === "pro" ? "Pro" : "Gratuito"}</TableCell>
                    <TableCell className="tabular text-right">{fmtInt(line.todayMessages)}</TableCell>
                    <TableCell className="tabular text-right">{fmtInt(line.monthMessages)}</TableCell>
                    <TableCell className="tabular text-right">{fmtInt(line.shown.input)}</TableCell>
                    <TableCell className="tabular text-right">{fmtInt(line.shown.output)}</TableCell>
                    <TableCell className="text-right">
                      <Money usd={line.monthCostUsd} className="items-end" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money usd={line.totalCostUsd} className="items-end" />
                    </TableCell>
                    <TableCell className="tabular pr-6 text-[13px]">{fmtDateTime(line.row.last_use)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow data-testid="cost-total-row">
                  <TableCell className="pl-6 font-semibold">Total ({lines.length})</TableCell>
                  <TableCell />
                  <TableCell className="tabular text-right font-semibold">{fmtInt(lines.reduce((a, l) => a + l.todayMessages, 0))}</TableCell>
                  <TableCell className="tabular text-right font-semibold">{fmtInt(lines.reduce((a, l) => a + l.monthMessages, 0))}</TableCell>
                  <TableCell className="tabular text-right font-semibold">{fmtInt(totals.shown.input)}</TableCell>
                  <TableCell className="tabular text-right font-semibold">{fmtInt(totals.shown.output)}</TableCell>
                  <TableCell className="text-right">
                    <Money usd={totals.monthCostUsd} className="items-end font-semibold" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money usd={totals.totalCostUsd} className="items-end font-semibold" />
                  </TableCell>
                  <TableCell className="pr-6" />
                </TableRow>
              </TableFooter>
            </Table>
          </TableCard>
          <p className="px-1 text-[12px] leading-4 text-muted-foreground">
            Entrada e saída seguem o período escolhido ({PERIODS.find((p) => p.value === period)!.label.toLowerCase()}), assim como a ordem (maior custo primeiro). <Link href={hrefFor({ q: "" })} className="underline underline-offset-2">Limpar busca</Link>
          </p>
        </>
      )}
    </section>
  )
}
