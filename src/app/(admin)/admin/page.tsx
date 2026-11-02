import Link from "next/link"
import { CircleCheckIcon, KeyRoundIcon, TriangleAlertIcon } from "lucide-react"

import { ActiveUsersChart, PlanChart, SignupsChart } from "@/components/admin/charts"
import { AdminKpi, DataUnavailable, SegmentedLinks } from "@/components/admin/parts"
import { BentoCard } from "@/components/organizzou/Bento"
import { PageShell, SplitLayout, StatRow } from "@/components/organizzou/layout"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { activeCourtesies, activeUsersSeries, overviewStats, planDistribution, recentSignups, signupsByDay, unwrap } from "@/lib/admin/data"
import { daysUntil, fmtDate, fmtDateTime, variation } from "@/lib/admin/format"
import { secretKeyConfigured } from "@/lib/admin/secret"

const RANGES = ["30", "90", "365"] as const
type Range = (typeof RANGES)[number]

function initials(value: string) {
  return value
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const { periodo } = await searchParams
  const range: Range = RANGES.find((r) => r === periodo) ?? "30"

  const [stats, signups, active, plans, recent, courtesies] = await Promise.all([
    overviewStats(),
    signupsByDay(Number(range)),
    activeUsersSeries(Number(range)),
    planDistribution(),
    recentSignups(6),
    activeCourtesies(),
  ])

  if (!stats.ok) return <DataUnavailable error={stats.error} />
  const s = stats.data

  const slices = [
    { key: "free", label: "Gratuito", users: 0 },
    { key: "pro", label: "Pro", users: 0 },
    { key: "cortesia", label: "Pro de cortesia", users: 0 },
  ]
  for (const row of unwrap(plans, [])) {
    const slice = row.plan === "free" ? slices[0] : row.courtesy ? slices[2] : slices[1]
    slice.users += row.users
  }

  const endingSoon = unwrap(courtesies, []).filter((c) => daysUntil(c.until) < 7)
  const alerts: { id: string; icon: typeof TriangleAlertIcon; text: string }[] = []
  if (!secretKeyConfigured()) alerts.push({ id: "key", icon: KeyRoundIcon, text: "Chave do servidor ausente: as ações de escrita (plano, suspender, sessões) ficam desativadas." })
  if (!s.tracking_since) alerts.push({ id: "tracking", icon: TriangleAlertIcon, text: "Ainda não há histórico de atividade. Até acumular, “ativos” usa o último login." })
  if (endingSoon.length > 0) alerts.push({ id: "courtesy", icon: TriangleAlertIcon, text: `${endingSoon.length} ${endingSoon.length === 1 ? "cortesia termina" : "cortesias terminam"} em até 7 dias.` })
  if (!plans.ok || !signups.ok || !active.ok) alerts.push({ id: "partial", icon: TriangleAlertIcon, text: "Algum gráfico não carregou: confira as migrations do admin." })

  return (
    <PageShell>
      <SplitLayout
        aside={
          <>
            <BentoCard title="Últimos cadastros" href="/admin/usuarios" linkLabel="Ver todos">
              {recent.ok && recent.data.length > 0 ? (
                <ul className="flex flex-col">
                  {recent.data.map((person) => (
                    <li key={person.id} className="border-b border-border last:border-b-0">
                      <Link href={`/admin/usuarios?usuario=${person.id}`} className="flex min-h-14 items-center gap-3 rounded-xl py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                        <Avatar className="size-10 shrink-0">
                          <AvatarFallback>{initials(person.name || person.email)}</AvatarFallback>
                        </Avatar>
                        <span className="flex min-w-0 flex-1 flex-col leading-tight">
                          <span className="truncate text-[15px] font-medium">{person.name || person.email.split("@")[0]}</span>
                          <span className="truncate text-[13px] text-muted-foreground">{person.email}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <Badge variant={person.plan === "pro" ? "default" : "secondary"} className="rounded-full">
                            {person.plan === "pro" ? "Pro" : "Gratuito"}
                          </Badge>
                          <span className="tabular text-[12px] text-muted-foreground">{fmtDate(person.created_at)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : recent.ok ? (
                <p className="text-[15px] text-muted-foreground">Nenhum cadastro ainda.</p>
              ) : (
                <DataUnavailable error={recent.error} title="Não carregou" />
              )}
            </BentoCard>

            <BentoCard title="Alertas do sistema" href="/admin/status" linkLabel="Ver status">
              {alerts.length === 0 ? (
                <p className="flex items-center gap-3 text-[15px] text-muted-foreground">
                  <CircleCheckIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" /> Nenhum alerta no momento.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {alerts.map((alert) => (
                    <li key={alert.id} className="flex items-start gap-3 text-[15px] leading-6">
                      <alert.icon aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
                      <span>{alert.text}</span>
                    </li>
                  ))}
                </ul>
              )}
              {s.tracking_since ? <p className="mt-4 text-[13px] leading-5 text-muted-foreground">Atividade medida desde {fmtDateTime(s.tracking_since)}.</p> : null}
            </BentoCard>
          </>
        }
      >
        <div className="flex min-w-0 flex-col gap-5">
          <StatRow min={170}>
            <AdminKpi label="Usuários totais" value={s.total_users} variation={variation(s.total_users, s.total_users_prev)} compareLabel="vs 7 dias atrás" href="/admin/usuarios" />
            <AdminKpi label="Ativos hoje" value={s.active_today} variation={variation(s.active_today, s.active_yesterday)} compareLabel="vs ontem" tone="highlight" href="/admin/atividade" />
            <AdminKpi label="Ativos 7 dias" value={s.active_7d} variation={variation(s.active_7d, s.active_7d_prev)} compareLabel="vs 7 dias anteriores" href="/admin/atividade" />
            <AdminKpi label="Novos 7 dias" value={s.new_7d} variation={variation(s.new_7d, s.new_7d_prev)} compareLabel="vs 7 dias anteriores" />
            <AdminKpi label="Plano Pro" value={s.pro_users} variation={variation(s.pro_users, s.pro_users_prev)} compareLabel="vs 7 dias atrás" href="/admin/assinaturas" />
            <AdminKpi label="Lista de espera" value={s.waitlist} variation={variation(s.waitlist, s.waitlist_prev)} compareLabel="vs 7 dias atrás" href="/admin/lista-de-espera" />
          </StatRow>

          <div className="flex justify-end">
            <SegmentedLinks
              label="Período dos gráficos"
              active={range}
              options={[
                { value: "30", label: "30 dias", href: "?periodo=30" },
                { value: "90", label: "90 dias", href: "?periodo=90" },
                { value: "365", label: "1 ano", href: "?periodo=365" },
              ]}
            />
          </div>

          <BentoCard title="Cadastros por dia">{signups.ok ? <SignupsChart data={signups.data} /> : <DataUnavailable error={signups.error} />}</BentoCard>
          <BentoCard title="Pessoas ativas: diário, semanal e mensal" href="/admin/atividade" linkLabel="Ver atividade">
            {active.ok ? <ActiveUsersChart data={active.data} /> : <DataUnavailable error={active.error} />}
          </BentoCard>
          <BentoCard title="Distribuição de planos" href="/admin/assinaturas" linkLabel="Ver assinaturas">
            {plans.ok ? <PlanChart data={slices} /> : <DataUnavailable error={plans.error} />}
          </BentoCard>
        </div>
      </SplitLayout>
    </PageShell>
  )
}
