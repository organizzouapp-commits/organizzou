"use client"

import { useState } from "react"
import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarClockIcon, PiggyBankIcon, PlusIcon, TargetIcon, WalletIcon } from "lucide-react"

import { Collapse, GroupHeader } from "@/components/organizzou/Group"
import { Button } from "@/components/ui/button"
import { runningTotal } from "@/features/finance/goal-history"
import type { FinancialGoalRow } from "@/features/finance/types"
import { formatBRL } from "@/lib/money"
import { cn } from "@/lib/utils"

import { BentoStat, Sparkline } from "./bento"
import { useFinance } from "./context"
import { AddPill, EmptyBlock, GOAL_ICONS, HeroCard, MoneyText, ProgressRing, RowMenu } from "./parts"

/** Months left until a deadline (at least one) and the monthly amount that reaches the goal. */
export function projection(goal: FinancialGoalRow, today: string) {
  const remaining = Math.max(0, goal.target_cents - goal.current_cents)
  if (remaining === 0) return { remaining, monthly: 0, text: "Meta alcançada" }
  if (!goal.deadline) return { remaining, monthly: 0, text: `Faltam ${formatBRL(remaining)}.` }
  const months = Math.max(1, Math.ceil(differenceInCalendarDays(parseISO(goal.deadline), parseISO(today)) / 30))
  const monthly = Math.ceil(remaining / months)
  return { remaining, monthly, text: `Guardando ${formatBRL(monthly)} por mês você chega em ${format(parseISO(goal.deadline), "MMM 'de' yyyy", { locale: ptBR }).replace(".", "")}.` }
}

const ratioOf = (g: FinancialGoalRow) => (g.target_cents === 0 ? 0 : Math.min(100, (g.current_cents / g.target_cents) * 100))
const deadlineText = (g: FinancialGoalRow) => (g.deadline ? `Até ${format(parseISO(g.deadline), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}` : "Sem prazo")

export function GoalRing({ goal, size = 64, tone = "default" }: { goal: FinancialGoalRow; size?: number; tone?: "default" | "inverse" }) {
  return <ProgressRing value={ratioOf(goal)} label={`Progresso de ${goal.name}`} size={size} tone={tone} />
}

function GoalGlyph({ goal, className }: { goal: FinancialGoalRow; className?: string }) {
  const f = useFinance()
  const Icon = GOAL_ICONS[f.goalIcons[goal.id] ?? "piggy"]
  return <Icon aria-hidden strokeWidth={1.75} className={className} />
}

/** In-progress goals first by deadline (the nearest is the featured one), achieved goals apart. */
export function useGoalSets() {
  const f = useFinance()
  const open = f.goals.filter((g) => g.current_cents < g.target_cents).sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"))
  const done = f.goals.filter((g) => g.current_cents >= g.target_cents)
  return { open, done }
}

// ------------------------------------------------------------------ summary

export function GoalsHero() {
  const f = useFinance()
  const saved = f.goals.reduce((sum, g) => sum + g.current_cents, 0)
  const target = f.goals.reduce((sum, g) => sum + g.target_cents, 0)
  const pct = target === 0 ? 0 : Math.round(Math.min(100, (saved / target) * 100))
  return <HeroCard label="Guardado nas metas" value={<MoneyText cents={saved} dimDecimals />} progress={{ value: pct, label: "Guardado nas metas" }} support={`${pct}% de ${formatBRL(target)} · ${f.goals.length} ${f.goals.length === 1 ? "meta" : "metas"}`} className="h-full justify-between" />
}

export function GoalStats({ compact = false }: { compact?: boolean }) {
  const f = useFinance()
  const { open } = useGoalSets()
  const missing = open.reduce((sum, g) => sum + (g.target_cents - g.current_cents), 0)
  const monthly = open.filter((g) => g.deadline).reduce((sum, g) => sum + projection(g, f.today).monthly, 0)
  const next = open.find((g) => g.deadline)
  return (
    <div data-testid="goal-stats" className={cn("grid gap-3 md:gap-4", compact ? "grid-cols-2" : "grid-cols-2 xl:grid-cols-3")}>
      <BentoStat compact={compact} label="Falta guardar" icon={WalletIcon} chip={`${open.length} ${open.length === 1 ? "meta" : "metas"}`}>
        <MoneyText cents={missing} dimDecimals />
      </BentoStat>
      <BentoStat compact={compact} label="Aporte por mês" icon={PiggyBankIcon} chip="para chegar nos prazos">
        <MoneyText cents={monthly} dimDecimals />
      </BentoStat>
      {compact ? null : (
        <BentoStat label="Próximo prazo" icon={CalendarClockIcon} chip={next?.name ?? "nenhum prazo"} className="col-span-2 xl:col-span-1">
          <span>{next?.deadline ? format(parseISO(next.deadline), "d MMM yyyy", { locale: ptBR }).replace(".", "") : "—"}</span>
        </BentoStat>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ goal cards

/** The featured goal: a dark card with the big ring, the amounts, the sparkline of contributions (only when there is history) and Guardar. */
export function FeaturedGoal({ goal }: { goal: FinancialGoalRow }) {
  const f = useFinance()
  const { text } = projection(goal, f.today)
  const points = runningTotal(goal.current_cents, f.goalHistory[goal.id] ?? [])
  return (
    <section aria-label={goal.name} data-goal={goal.id} data-featured className="relative flex min-w-0 flex-col gap-4 rounded-[20px] border border-border bg-palette-tinta p-5 text-palette-papel dark:bg-palette-grafite">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full border border-palette-papel/25">
            <GoalGlyph goal={goal} className="size-[18px]" />
          </span>
          <div className="flex min-w-0 flex-col">
            <button type="button" data-goal-title onClick={() => f.editGoal(goal)} className="truncate text-left text-[17px] leading-6 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              {goal.name}
            </button>
            <span className="truncate text-[13px] leading-5 text-palette-papel/70">{deadlineText(goal)}</span>
          </div>
        </div>
        <RowMenu title={goal.name} onEdit={() => f.editGoal(goal)} onDelete={() => f.removeGoal(goal)} className="text-palette-papel hover:bg-palette-papel/10 hover:text-palette-papel" />
      </div>
      <div className="flex items-center gap-5">
        <GoalRing goal={goal} size={112} tone="inverse" />
        <div className="flex min-w-0 flex-col gap-1">
          <MoneyText cents={goal.current_cents} dimDecimals className="text-[26px] leading-8 font-semibold" />
          <span className="tabular truncate text-[13px] leading-5 text-palette-papel/70">de {formatBRL(goal.target_cents)}</span>
        </div>
      </div>
      {points.length >= 2 ? <Sparkline points={points} label={`Aportes em ${goal.name}`} /> : null}
      <p className="text-[13px] leading-5 text-palette-papel/80">{text}</p>
      <button type="button" onClick={() => f.fundGoal(goal)} className="inline-flex h-11 w-fit items-center gap-1.5 rounded-full bg-palette-lima px-5 text-[14px] font-semibold text-palette-tinta outline-none transition-colors duration-[400ms] hover:bg-palette-lima/90 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none">
        <PlusIcon aria-hidden strokeWidth={1.75} className="size-4" /> Guardar
      </button>
    </section>
  )
}

/** A goal card of the grid: icon, name, deadline, ring, amounts and a full-width Guardar. */
export function GoalBentoCard({ goal }: { goal: FinancialGoalRow }) {
  const f = useFinance()
  const done = goal.current_cents >= goal.target_cents
  return (
    <section aria-label={goal.name} data-goal={goal.id} data-done={done} className="relative flex min-w-0 flex-col gap-3 rounded-[20px] border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50">
            <GoalGlyph goal={goal} className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col">
            <button type="button" data-goal-title onClick={() => f.editGoal(goal)} className="truncate text-left text-[15px] leading-6 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              {goal.name}
            </button>
            <span className="truncate text-[12px] leading-4 text-muted-foreground">{deadlineText(goal)}</span>
          </div>
        </div>
        <RowMenu title={goal.name} onEdit={() => f.editGoal(goal)} onDelete={() => f.removeGoal(goal)} />
      </div>
      <div className="flex items-center gap-3">
        <GoalRing goal={goal} size={72} />
        <div className="flex min-w-0 flex-col">
          <span className="tabular truncate text-[13px] leading-5 text-muted-foreground">
            {formatBRL(goal.current_cents)} de {formatBRL(goal.target_cents)}
          </span>
          {done ? <span className="text-[13px] leading-5 font-semibold text-palette-tinta-verso dark:text-brand">Meta alcançada</span> : <span className="text-[12px] leading-4 text-muted-foreground">{projection(goal, f.today).text}</span>}
        </div>
      </div>
      <Button variant="outline" className="h-11 w-full" disabled={done} onClick={() => f.fundGoal(goal)}>
        <PlusIcon strokeWidth={1.75} /> Guardar
      </Button>
    </section>
  )
}

/** Phones: a compact row (ring 72, name, amounts, a circle "+"). Tapping the row edits the goal. */
export function GoalRow({ goal }: { goal: FinancialGoalRow }) {
  const f = useFinance()
  const done = goal.current_cents >= goal.target_cents
  return (
    <section aria-label={goal.name} data-goal={goal.id} data-done={done} className="relative flex items-center gap-3 rounded-[14px] border border-border bg-card p-3">
      <GoalRing goal={goal} size={72} />
      <div className="flex min-w-0 flex-1 flex-col">
        <button type="button" data-goal-title onClick={() => f.editGoal(goal)} className="truncate text-left text-[15px] leading-6 font-semibold outline-none after:absolute after:inset-0 after:rounded-[14px] focus-visible:after:ring-3 focus-visible:after:ring-ring/50">
          {goal.name}
        </button>
        <span className="tabular truncate text-[13px] leading-5 text-muted-foreground">
          {formatBRL(goal.current_cents)} de {formatBRL(goal.target_cents)}
        </span>
        {done ? <span className="text-[12px] leading-4 font-semibold text-palette-tinta-verso dark:text-brand">Meta alcançada</span> : <span className="truncate text-[12px] leading-4 text-muted-foreground">{deadlineText(goal)}</span>}
      </div>
      <Button variant="outline" size="icon" aria-label={`Guardar em ${goal.name}`} disabled={done} className="relative z-10 shrink-0" onClick={() => f.fundGoal(goal)}>
        <PlusIcon strokeWidth={1.75} />
      </Button>
    </section>
  )
}

// ------------------------------------------------------------------ tab content

function Achieved({ children, count }: { children: React.ReactNode; count: number }) {
  const [open, setOpen] = useState(false)
  if (count === 0) return null
  return (
    <section data-group="done" aria-label="Alcançadas" className="flex min-w-0 flex-col">
      <GroupHeader label="Alcançadas" count={count} open={open} onToggle={() => setOpen((v) => !v)} />
      <Collapse open={open}>{children}</Collapse>
    </section>
  )
}

export function NewGoalCard() {
  const f = useFinance()
  return (
    <button type="button" data-add-task-pill onClick={f.openNewGoal} className="flex min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-border p-5 text-[15px] text-muted-foreground outline-none transition-colors duration-[400ms] hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none">
      <PlusIcon aria-hidden strokeWidth={1.75} className="size-6" />
      Nova meta…
    </button>
  )
}

/** Desktop and tablet: the hero + stats row, the featured goal with its neighbours, then the achieved ones and the dashed card. */
export function GoalsDesktop() {
  const f = useFinance()
  const { open, done } = useGoalSets()
  const [featured, ...rest] = open
  return (
    <div data-testid="goals-main" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-8 xl:grid-cols-12">
      <div className="md:col-span-2 lg:col-span-8 xl:col-span-4">
        <GoalsHero />
      </div>
      <div className="md:col-span-2 lg:col-span-8 xl:col-span-8">
        <GoalStats />
      </div>
      {featured ? (
        <div data-group="active" className="md:col-span-2 lg:col-span-8 xl:col-span-6">
          <FeaturedGoal goal={featured} />
        </div>
      ) : null}
      {rest.map((g) => (
        <div key={g.id} className="lg:col-span-4 xl:col-span-3">
          <GoalBentoCard goal={g} />
        </div>
      ))}
      {f.goals.length === 0 ? (
        <div className="md:col-span-2 lg:col-span-8 xl:col-span-12">
          <EmptyBlock icon={TargetIcon} title="Nenhuma meta ainda" description="Crie uma meta e acompanhe quanto já guardou." />
        </div>
      ) : null}
      <div className="md:col-span-2 lg:col-span-8 xl:col-span-8">
        <Achieved count={done.length}>
          <div data-group-rows className="grid grid-cols-1 gap-4 pb-3 md:grid-cols-2">
            {done.map((g) => (
              <GoalBentoCard key={g.id} goal={g} />
            ))}
          </div>
        </Achieved>
      </div>
      <div className="md:col-span-2 lg:col-span-8 xl:col-span-4 xl:col-start-9">
        <NewGoalCard />
      </div>
    </div>
  )
}

/** Phones: hero, two tiles, the dashed pill, Em andamento (featured + compact rows), Alcançadas collapsed. */
export function GoalsMobile() {
  const f = useFinance()
  const { open, done } = useGoalSets()
  const [featured, ...rest] = open
  const [activeOpen, setActiveOpen] = useState(true)
  return (
    <div data-testid="goals-main" className="flex flex-col gap-3">
      <GoalsHero />
      <GoalStats compact />
      <AddPill label="Nova meta…" onClick={f.openNewGoal} />
      {open.length > 0 ? (
        <section data-group="active" aria-label="Em andamento" className="flex flex-col">
          <GroupHeader label="Em andamento" count={open.length} open={activeOpen} onToggle={() => setActiveOpen((v) => !v)} />
          <Collapse open={activeOpen}>
            <div data-group-rows className="flex flex-col gap-2 pb-2">
              {featured ? <FeaturedGoal goal={featured} /> : null}
              {rest.map((g) => (
                <GoalRow key={g.id} goal={g} />
              ))}
            </div>
          </Collapse>
        </section>
      ) : null}
      <Achieved count={done.length}>
        <div data-group-rows className="flex flex-col gap-2 pb-2">
          {done.map((g) => (
            <GoalRow key={g.id} goal={g} />
          ))}
        </div>
      </Achieved>
    </div>
  )
}

