import { Suspense } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { SparklesIcon } from "lucide-react"

import { EmptyState } from "@/components/organizzou/EmptyState"
import { modules, type ModuleId } from "@/components/organizzou/modules"
import { ListRow } from "@/components/organizzou/ListRow"
import { Stat } from "@/components/organizzou/Stat"
import { TodayTasks } from "@/components/today/today-tasks"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { getTodayData } from "@/features/tasks/today"
import { greeting, inTz } from "@/lib/dates"

const SOON: ModuleId[] = ["rotina", "agenda", "financas", "treinos", "dieta", "estudos"]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">
      {children}
    </h2>
  )
}

async function TodayContent() {
  const data = await getTodayData()
  const now = new Date(data.now)
  const firstName = data.name.split(" ")[0]
  const dateText = format(inTz(now, data.timeZone), "EEEE, d 'de' MMMM", { locale: ptBR })

  const planned = data.dueToday.length + data.overdue.length + data.doneToday
  const progress = planned === 0 ? 0 : Math.round((data.doneToday / planned) * 100)
  const pending = data.dueToday.length + data.overdue.length

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <span className="text-[13px] leading-5 text-muted-foreground capitalize">{dateText}</span>
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.02em] md:text-[28px] md:leading-[34px]">
          {greeting(now, data.timeZone)}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-base leading-6 text-muted-foreground">
          {pending === 0
            ? "Tudo certo por hoje."
            : pending === 1
              ? "1 tarefa para hoje."
              : `${pending} tarefas para hoje.`}
        </p>
      </header>

      <section aria-label="Resumo" className="flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Para hoje" value={String(data.dueToday.length)} support={data.dueToday.length === 1 ? "tarefa" : "tarefas"} />
          <Stat label="Atrasadas" value={String(data.overdue.length)} support={data.overdue.length === 1 ? "tarefa" : "tarefas"} />
          <Stat label="Concluídas" value={String(data.doneToday)} support="hoje" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="tabular flex justify-between text-[13px] leading-5">
            <span>Progresso do dia</span>
            <span className="text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} aria-label="Progresso do dia" />
        </div>
      </section>

      {data.overdue.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>Atrasadas</SectionTitle>
          <TodayTasks tasks={data.overdue} now={data.now} timeZone={data.timeZone} />
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <SectionTitle>Para hoje</SectionTitle>
        {data.dueToday.length > 0 ? (
          <TodayTasks tasks={data.dueToday} now={data.now} timeZone={data.timeZone} />
        ) : (
          <EmptyState
            icon={SparklesIcon}
            title="Nada marcado para hoje"
            description="Defina uma data de entrega nas suas tarefas e elas aparecem aqui."
            action={
              <Button asChild variant="outline">
                <Link href="/dashboard/tarefas">Ver tarefas</Link>
              </Button>
            }
          />
        )}
      </section>

      {data.upcoming.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>Próximas</SectionTitle>
          <TodayTasks tasks={data.upcoming} now={data.now} timeZone={data.timeZone} completable={false} />
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <SectionTitle>Em breve</SectionTitle>
        <div>
          {SOON.map((id) => (
            <ListRow
              key={id}
              icon={modules[id].icon}
              title={modules[id].name}
              trailing={<Badge variant="secondary">Em breve</Badge>}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function TodaySkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-64" />
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}

/** The dashboard fed by the real Supabase tasks (used when isMock is false). */
export function LiveToday() {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <TodayContent />
    </Suspense>
  )
}
