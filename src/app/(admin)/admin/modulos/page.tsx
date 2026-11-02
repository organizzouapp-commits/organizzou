import { FlaskConicalIcon } from "lucide-react"

import { ModuleWeeksChart, type ModuleWeekDatum } from "@/components/admin/charts"
import { DataUnavailable, TableCard } from "@/components/admin/parts"
import { BentoCard } from "@/components/organizzou/Bento"
import { PageGrid, PageShell } from "@/components/organizzou/layout"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { moduleAdoption, moduleUsage } from "@/lib/admin/data"
import { fmtInt, fmtPct } from "@/lib/admin/format"

/** Features that have a real table behind them. Everything else in the app is still simulated. */
const FEATURES = [
  { key: "tarefas", label: "Tarefas" },
  { key: "quadros", label: "Quadros" },
  { key: "etiquetas", label: "Etiquetas" },
  { key: "anexos", label: "Anexos" },
]

const SIMULATED = ["Hoje", "Rotina", "Agenda", "Finanças", "Treinos", "Dieta", "Estudos", "Notas e lembretes", "Metas", "Diário", "Cofre"]

/** Counts only: how many records were created per week and how many people use each feature. No record is ever opened. */
export default async function ModulesPage() {
  const [usage, adoption] = await Promise.all([moduleUsage(12), moduleAdoption()])

  const weeks = new Map<string, ModuleWeekDatum>()
  const totals = new Map<string, number>()
  if (usage.ok) {
    for (const row of usage.data) {
      const entry = weeks.get(row.week) ?? { week: row.week }
      entry[row.feature] = row.records
      weeks.set(row.week, entry)
      totals.set(row.feature, (totals.get(row.feature) ?? 0) + row.records)
    }
  }
  const chartData = [...weeks.values()].sort((a, b) => String(a.week).localeCompare(String(b.week))).map((w) => ({ ...w, ...Object.fromEntries(FEATURES.filter((f) => !(f.key in w)).map((f) => [f.key, 0])) }))

  const ranking = FEATURES.map((f) => ({ ...f, records: totals.get(f.key) ?? 0 })).sort((a, b) => b.records - a.records)
  const adoptionBy = new Map(adoption.ok ? adoption.data.map((a) => [a.feature, a]) : [])
  const activeBase = adoption.ok ? (adoption.data[0]?.active_users ?? 0) : 0

  return (
    <PageShell>
      <BentoCard title="Registros criados por semana (últimas 12 semanas)">{usage.ok ? <ModuleWeeksChart data={chartData} features={FEATURES} /> : <DataUnavailable error={usage.error} />}</BentoCard>

      <PageGrid>
        <PageGrid.Item span="three-fifths">
          <TableCard className="h-full">
            <div className="flex flex-col gap-1 p-6 pb-3">
              <h2 className="text-[17px] leading-6 font-semibold">Quem usa cada recurso</h2>
              <p className="text-[13px] leading-5 text-muted-foreground">Base: {fmtInt(activeBase)} pessoas ativas nos últimos 30 dias. “Usa” = tem pelo menos um registro.</p>
            </div>
            {adoption.ok ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Recurso</TableHead>
                    <TableHead className="text-right">Pessoas</TableHead>
                    <TableHead className="pr-6 text-right">% dos ativos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FEATURES.map((f) => {
                    const a = adoptionBy.get(f.key)
                    return (
                      <TableRow key={f.key}>
                        <TableCell className="pl-6">{f.label}</TableCell>
                        <TableCell className="tabular text-right">{fmtInt(a?.users ?? 0)}</TableCell>
                        <TableCell className="tabular pr-6 text-right">{activeBase > 0 ? fmtPct((a?.users ?? 0) / activeBase) : "—"}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="px-6 pb-6">
                <DataUnavailable error={adoption.error} />
              </div>
            )}
          </TableCard>
        </PageGrid.Item>

        <PageGrid.Item span="two-fifths">
          <BentoCard title="Recursos mais usados (12 semanas)" className="h-full">
            <ol className="flex flex-col">
              {ranking.map((f, index) => (
                <li key={f.key} className="flex items-center gap-3 border-b border-border py-3 text-[15px] last:border-b-0">
                  <span className="tabular w-5 text-muted-foreground">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{f.label}</span>
                  <span className="tabular font-medium">{fmtInt(f.records)}</span>
                </li>
              ))}
            </ol>
          </BentoCard>
        </PageGrid.Item>
      </PageGrid>

      <BentoCard title="Ainda sem dados reais">
        <p className="flex items-start gap-3 text-[15px] leading-6 text-muted-foreground">
          <FlaskConicalIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
          <span>
            Estes módulos ainda são simulados no app (sem tabela no banco), então não há nada para contar: {SIMULATED.join(", ")}. Quando cada um ganhar tabelas, entra aqui como contagem agregada.
          </span>
        </p>
      </BentoCard>
    </PageShell>
  )
}
