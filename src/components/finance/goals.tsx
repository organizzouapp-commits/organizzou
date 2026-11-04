"use client"

import { useState } from "react"
import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarClockIcon, PlusIcon, TargetIcon } from "lucide-react"

import { Collapse, GroupHeader } from "@/components/organizzou/Group"
import { Button } from "@/components/ui/button"
import type { FinancialGoalRow } from "@/features/finance/types"
import { formatBRL } from "@/lib/money"
import { cn } from "@/lib/utils"

import { useFinance } from "./context"
import { AddPill, CardHeader, EmptyBlock, GOAL_ICONS, HeroCard, LIST_CARD, ProgressBar, ProgressRing, RowMenu, SUMMARY_CARD } from "./parts"

/** Months left until a deadline (at least one) and the monthly amount that reaches the goal. */
export function projection(goal: FinancialGoalRow, today: string) {
  const remaining = Math.max(0, goal.target_cents - goal.current_cents)
  if (remaining === 0) return { remaining, monthly: 0, text: "Meta alcançada" }
  if (!goal.deadline) return { remaining, monthly: 0, text: `Faltam ${formatBRL(remaining)}.` }
  const months = Math.max(1, Math.ceil(differenceInCalendarDays(parseISO(goal.deadline), parseISO(today)) / 30))
  const monthly = Math.ceil(remaining / months)
  return { remaining, monthly, text: `Guardando ${formatBRL(monthly)} por mês você chega em ${format(parseISO(goal.deadline), "MMM 'de' yyyy", { locale: ptBR }).replace(".", "")}.` }
}

function GoalCard({ goal }: { goal: FinancialGoalRow }) {
  const f = useFinance()
  const Icon = GOAL_ICONS[f.goalIcons[goal.id] ?? "piggy"]
  const ratio = goal.target_cents === 0 ? 0 : Math.min(100, (goal.current_cents / goal.target_cents) * 100)
  const { remaining, text } = projection(goal, f.today)
  const done = remaining === 0
  return (
    <section aria-label={goal.name} data-goal={goal.id} data-done={done} className={cn(LIST_CARD, "relative flex min-w-0 flex-col gap-3 p-4")}>
      <div className="flex items-start gap-3">
        <ProgressRing value={ratio} label={`Progresso de ${goal.name}`} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <Icon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" />
            <button type="button" data-goal-title onClick={() => f.editGoal(goal)} className="min-w-0 truncate text-left text-[17px] leading-6 font-semibold outline-none after:absolute after:inset-0 after:rounded-[14px] focus-visible:after:ring-3 focus-visible:after:ring-ring/50">
              {goal.name}
            </button>
          </span>
          <span className="tabular truncate text-[13px] leading-5 text-muted-foreground">
            {formatBRL(goal.current_cents)} de {formatBRL(goal.target_cents)}
          </span>
          {goal.deadline ? <span className="truncate text-[13px] leading-5 text-muted-foreground">Até {format(parseISO(goal.deadline), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span> : null}
        </div>
      </div>
      <p className={cn("min-h-10 text-[13px] leading-5", done ? "font-semibold text-palette-tinta-verso dark:text-brand" : "text-muted-foreground")}>{text}</p>
      <div className="relative z-10 flex items-center justify-between gap-2">
        <Button variant="outline" disabled={done} onClick={() => f.fundGoal(goal)}>
          <PlusIcon strokeWidth={1.75} /> Guardar
        </Button>
        <RowMenu title={goal.name} onEdit={() => f.editGoal(goal)} onDelete={() => f.removeGoal(goal)} />
      </div>
    </section>
  )
}

function GoalGroup({ id, label, goals, defaultOpen }: { id: string; label: string; goals: FinancialGoalRow[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  if (goals.length === 0) return null
  return (
    <section data-group={id} aria-label={label} className="@container flex flex-col">
      <GroupHeader label={label} count={goals.length} open={open} onToggle={() => setOpen((v) => !v)} />
      <Collapse open={open}>
        <div data-group-rows className="grid grid-cols-1 gap-3 pb-3 @min-[560px]:grid-cols-2 @min-[820px]:grid-cols-3">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </div>
      </Collapse>
    </section>
  )
}

export function GoalsMain() {
  const f = useFinance()
  const open = f.goals.filter((g) => g.current_cents < g.target_cents)
  const done = f.goals.filter((g) => g.current_cents >= g.target_cents)
  return (
    <div className="flex flex-col gap-4" data-testid="goals-main">
      <AddPill label="Nova meta…" onClick={f.openNewGoal} />
      {f.goals.length === 0 ? (
        <EmptyBlock icon={TargetIcon} title="Nenhuma meta ainda" description="Crie uma meta e acompanhe quanto já guardou." />
      ) : (
        <div className="flex flex-col">
          <GoalGroup id="active" label="Em andamento" goals={open} defaultOpen />
          <GoalGroup id="done" label="Alcançadas" goals={done} defaultOpen={false} />
        </div>
      )}
    </div>
  )
}

export function GoalsHero() {
  const f = useFinance()
  const saved = f.goals.reduce((sum, g) => sum + g.current_cents, 0)
  const target = f.goals.reduce((sum, g) => sum + g.target_cents, 0)
  const pct = target === 0 ? 0 : Math.round(Math.min(100, (saved / target) * 100))
  return (
    <HeroCard label="Guardado nas metas" value={formatBRL(saved)} support={`${pct}% de ${formatBRL(target)} · ${f.goals.length} ${f.goals.length === 1 ? "meta" : "metas"}`}>
      <ProgressBar value={pct} label="Guardado nas metas" color="var(--highlight-foreground)" className="bg-highlight-foreground/15" />
    </HeroCard>
  )
}

/** Desktop side card: the unfinished goal whose deadline is nearest. */
export function NextDeadline() {
  const f = useFinance()
  const next = f.goals
    .filter((g) => g.deadline && g.current_cents < g.target_cents)
    .sort((a, b) => (a.deadline as string).localeCompare(b.deadline as string))[0]
  return (
    <section aria-label="Próximo prazo" className={cn(SUMMARY_CARD, "flex flex-col gap-3 p-5")}>
      <CardHeader title="Próximo prazo" />
      {next ? (
        <>
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50">
              <CalendarClockIcon strokeWidth={1.75} className="size-[18px]" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] leading-6 font-medium">{next.name}</span>
              <span className="truncate text-[13px] leading-5 text-muted-foreground">Até {format(parseISO(next.deadline as string), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
              <span className="tabular truncate text-[13px] leading-5 text-muted-foreground">faltam {formatBRL(next.target_cents - next.current_cents)}</span>
            </div>
          </div>
          <Button variant="outline" className="self-start" onClick={() => f.fundGoal(next)}>
            <PlusIcon strokeWidth={1.75} /> Guardar
          </Button>
        </>
      ) : (
        <p className="text-[13px] leading-5 text-muted-foreground">Nenhuma meta com prazo em aberto.</p>
      )}
    </section>
  )
}
