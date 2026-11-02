import { ActiveUsersChart } from "@/components/admin/charts"
import { DataUnavailable, Intro, SegmentedLinks } from "@/components/admin/parts"
import { BentoCard } from "@/components/organizzou/Bento"
import { PageShell } from "@/components/organizzou/layout"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { activeUsersSeries, activityHeatmap, cohortRetention, overviewStats, type CohortCell, type HeatCell } from "@/lib/admin/data"
import { fmtDateTime, fmtInt, fmtPct, fmtSqlDate } from "@/lib/admin/format"

const RANGES = ["30", "90", "365"] as const
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const WEEKS = [1, 2, 3, 4, 5, 6, 7, 8]

function addDays(day: string, days: number) {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Cohorts by signup week x weeks since signup. A week that ended before activity tracking began has no data: "—", never 0%. */
function CohortTable({ cells, trackingSince }: { cells: CohortCell[]; trackingSince: string | null }) {
  const cohorts = [...new Set(cells.map((c) => c.cohort_week))].sort().reverse()
  const trackedFrom = trackingSince ? trackingSince.slice(0, 10) : null
  if (cohorts.length === 0) return <p className="text-[15px] text-muted-foreground">Nenhum cadastro nas últimas semanas.</p>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Semana do cadastro</TableHead>
          <TableHead className="text-right">Pessoas</TableHead>
          {WEEKS.map((w) => (
            <TableHead key={w} className="text-right last:pr-6">
              Sem. {w}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {cohorts.map((cohort) => {
          const row = new Map(cells.filter((c) => c.cohort_week === cohort).map((c) => [c.week_offset, c]))
          const size = row.get(0)?.cohort_size ?? 0
          return (
            <TableRow key={cohort}>
              <TableCell className="tabular pl-6 whitespace-nowrap">{fmtSqlDate(cohort)}</TableCell>
              <TableCell className="tabular text-right">{fmtInt(size)}</TableCell>
              {WEEKS.map((w) => {
                const cell = row.get(w)
                const weekEnd = addDays(cohort, w * 7 + 7)
                const measured = Boolean(cell) && trackedFrom !== null && weekEnd > trackedFrom
                return (
                  <TableCell key={w} className="tabular text-right last:pr-6">
                    {measured && cell && size > 0 ? fmtPct(cell.active_users / size) : "—"}
                  </TableCell>
                )
              })}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function Heatmap({ cells }: { cells: HeatCell[] }) {
  const grid = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.users]))
  const max = Math.max(1, ...cells.map((c) => c.users))
  if (cells.length === 0) return <p className="text-[15px] text-muted-foreground">Ainda não há acessos registrados.</p>
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[680px] grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-1 text-[11px]" role="table" aria-label="Pessoas por dia da semana e hora">
        <span aria-hidden />
        {Array.from({ length: 24 }, (_, hour) => (
          <span key={hour} className="tabular text-center text-muted-foreground">
            {hour % 3 === 0 ? `${hour}h` : ""}
          </span>
        ))}
        {WEEKDAYS.map((label, dow) => (
          <div key={label} role="row" className="contents">
            <span className="flex items-center text-[13px] text-muted-foreground">{label}</span>
            {Array.from({ length: 24 }, (_, hour) => {
              const users = grid.get(`${dow}-${hour}`) ?? 0
              return (
                <span
                  key={hour}
                  role="cell"
                  title={`${label}, ${hour}h: ${users} ${users === 1 ? "pessoa" : "pessoas"}`}
                  aria-label={`${label}, ${hour}h: ${users}`}
                  className="relative flex h-8 items-center justify-center overflow-hidden rounded-md border border-border"
                >
                  {users > 0 ? <span aria-hidden className="absolute inset-0 bg-chart-1" style={{ opacity: 0.15 + 0.85 * (users / max) }} /> : null}
                  {users > 0 ? <span className="tabular relative text-[10px] font-medium text-foreground mix-blend-normal">{users}</span> : null}
                </span>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const { periodo } = await searchParams
  const range = RANGES.find((r) => r === periodo) ?? "30"
  const [stats, series, cohorts, heat] = await Promise.all([overviewStats(), activeUsersSeries(Number(range)), cohortRetention(12), activityHeatmap(Number(range))])
  const trackingSince = stats.ok ? stats.data.tracking_since : null

  return (
    <PageShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Intro className="flex-1">
          {trackingSince
            ? `Atividade medida desde ${fmtDateTime(trackingSince)}. Antes disso, só existe o último login de cada pessoa.`
            : "A atividade ainda não começou a ser medida. Até lá, “ativo” usa o último login de cada pessoa."}{" "}
          Um dia ativo é um dia (fuso de São Paulo) em que a pessoa abriu o app.
        </Intro>
        <SegmentedLinks
          label="Período"
          active={range}
          options={[
            { value: "30", label: "30 dias", href: "?periodo=30" },
            { value: "90", label: "90 dias", href: "?periodo=90" },
            { value: "365", label: "1 ano", href: "?periodo=365" },
          ]}
        />
      </div>

      <BentoCard title="Pessoas ativas: diário, semanal e mensal">{series.ok ? <ActiveUsersChart data={series.data} /> : <DataUnavailable error={series.error} />}</BentoCard>

      <BentoCard title="Retenção por coorte" bodyClassName="-mx-6 -mb-2">
        {cohorts.ok ? <CohortTable cells={cohorts.data} trackingSince={trackingSince} /> : <DataUnavailable error={cohorts.error} />}
        <p className="px-6 pt-4 text-[13px] leading-5 text-muted-foreground">
          Cada linha é a semana de cadastro; cada coluna, a porcentagem da turma que abriu o app naquela semana depois do cadastro. “—” = semana sem medição.
        </p>
      </BentoCard>

      <BentoCard title="Horários de pico">{heat.ok ? <Heatmap cells={heat.data} /> : <DataUnavailable error={heat.error} />}</BentoCard>
    </PageShell>
  )
}
