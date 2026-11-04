"use client"

import { useState } from "react"
import { DndContext, closestCenter, type Announcements, type DragEndEvent, type UniqueIdentifier } from "@dnd-kit/core"
import { SortableContext, arrayMove, rectSortingStrategy, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarClockIcon, GripVerticalIcon, PiggyBankIcon, PlusIcon, StarIcon, TargetIcon, WalletIcon } from "lucide-react"

import { Collapse, GroupHeader } from "@/components/organizzou/Group"
import { useTaskSensors } from "@/components/tasks/task-dnd"
import { Button } from "@/components/ui/button"
import { runningTotal } from "@/features/finance/goal-history"
import { applyGoalOrder } from "@/features/finance/goal-layout"
import type { FinancialGoalRow } from "@/features/finance/types"
import { formatBRL } from "@/lib/money"
import { cn } from "@/lib/utils"

import { BentoStat, Sparkline } from "./bento"
import { useFinance } from "./context"
import { EmptyBlock, GOAL_ICONS, HeroCard, MoneyText, ProgressRing, RowMenu } from "./parts"

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

/** Goals in progress in the person's order (nearest deadline first until they choose; the first is the featured one), achieved goals apart. */
export function useGoalSets() {
  const f = useFinance()
  const open = applyGoalOrder(
    f.goals.filter((g) => g.current_cents < g.target_cents),
    f.goalOrder
  )
  const done = f.goals.filter((g) => g.current_cents >= g.target_cents)
  return { open, done }
}

// ------------------------------------------------------------------ summary

export function GoalsHero() {
  const f = useFinance()
  const saved = f.goals.reduce((sum, g) => sum + g.current_cents, 0)
  const target = f.goals.reduce((sum, g) => sum + g.target_cents, 0)
  const pct = target === 0 ? 0 : Math.round(Math.min(100, (saved / target) * 100))
  return (
    <HeroCard
      label="Guardado nas metas"
      value={<MoneyText cents={saved} dimDecimals />}
      progress={{ value: pct, label: "Guardado nas metas" }}
      footer={`${pct}% de ${formatBRL(target)} · ${f.goals.length} ${f.goals.length === 1 ? "meta" : "metas"}`}
      onArrow={() => document.querySelector("[data-group=active]")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      arrowLabel="Ir para as metas em andamento"
      className="h-full justify-between md:min-h-[168px]"
    />
  )
}

export function GoalStats({ compact = false }: { compact?: boolean }) {
  const f = useFinance()
  const { open } = useGoalSets()
  const missing = open.reduce((sum, g) => sum + (g.target_cents - g.current_cents), 0)
  const monthly = open.filter((g) => g.deadline).reduce((sum, g) => sum + projection(g, f.today).monthly, 0)
  const next = [...open].filter((g) => g.deadline).sort((a, b) => a.deadline!.localeCompare(b.deadline!))[0]
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

// ------------------------------------------------------------------ sortable

/** One draggable goal. The grip (a button) is the handle for mouse, touch (long press) and keyboard (Space, arrows, Space). */
function SortableGoal({ goal, className, children }: { goal: FinancialGoalRow; className?: string; children: (grip: React.ReactNode, dragging: boolean) => React.ReactNode }) {
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: goal.id, transition: { duration: reduce ? 0 : 400, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" } })
  const grip = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      data-grip
      aria-label={`Reordenar ${goal.name}`}
      className="relative flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-full opacity-70 outline-none after:absolute after:-inset-1.5 hover:bg-foreground/10 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
    >
      <GripVerticalIcon aria-hidden strokeWidth={1.75} className="size-4" />
    </button>
  )
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} data-sortable-goal={goal.id} className={cn("min-w-0 [&>*]:h-full", isDragging && "relative z-20 opacity-90", className)}>
      {children(grip, isDragging)}
    </div>
  )
}

/** The sortable region of the goals in progress; dropping a goal in the first slot makes it the featured one. */
function SortableGoals({ goals, layout, children }: { goals: FinancialGoalRow[]; layout: "grid" | "list"; children: React.ReactNode }) {
  const f = useFinance()
  const sensors = useTaskSensors()
  const ids = goals.map((g) => g.id)
  const nameOf = (id: UniqueIdentifier) => goals.find((g) => g.id === id)?.name ?? "Meta"
  const position = (id: UniqueIdentifier) => ids.indexOf(String(id)) + 1
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Meta ${nameOf(active.id)} levantada. Posição ${position(active.id)} de ${ids.length}.`,
    onDragOver: ({ active, over }) => (over ? `Meta ${nameOf(active.id)} sobre a posição ${position(over.id)} de ${ids.length}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `Meta ${nameOf(active.id)} solta na posição ${position(over.id)} de ${ids.length}.${position(over.id) === 1 ? " Ela é a meta em destaque." : ""}` : `Meta ${nameOf(active.id)} solta onde estava.`),
    onDragCancel: ({ active }) => `Reordenação cancelada. A meta ${nameOf(active.id)} voltou ao lugar.`,
  }
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    f.setGoalOrder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }
  return (
    <DndContext id="goals-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={{ announcements, screenReaderInstructions: { draggable: "Para reordenar, aperte espaço, use as setas para mover e aperte espaço para soltar. Esc cancela. A primeira posição é a meta em destaque." } }}>
      <SortableContext items={ids} strategy={layout === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

// ------------------------------------------------------------------ goal cards

/** The featured goal: a dark card with the header, the big ring beside the amounts, the sparkline of contributions (only when there is history) and the projection with Guardar. */
export function FeaturedGoal({ goal, grip }: { goal: FinancialGoalRow; grip?: React.ReactNode }) {
  const f = useFinance()
  const { text } = projection(goal, f.today)
  const points = runningTotal(goal.current_cents, f.goalHistory[goal.id] ?? [])
  return (
    <section aria-label={goal.name} data-goal={goal.id} data-featured className="relative flex min-w-0 flex-col gap-4 rounded-[20px] border border-border bg-palette-tinta p-5 text-palette-papel dark:bg-palette-grafite">
      <div className="flex items-center justify-between gap-3">
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
        <div className="flex shrink-0 items-center gap-1 text-palette-papel">
          {grip}
          <RowMenu icon="arrow" title={goal.name} onEdit={() => f.editGoal(goal)} onDelete={() => f.removeGoal(goal)} className="text-palette-papel hover:bg-palette-papel/10 hover:text-palette-papel" />
        </div>
      </div>
      <div className="flex items-center gap-5">
        <GoalRing goal={goal} size={120} tone="inverse" />
        <div className="flex min-w-0 flex-col gap-1">
          <MoneyText cents={goal.current_cents} dimDecimals className="text-[28px] leading-9 font-semibold" />
          <span className="tabular truncate text-[13px] leading-5 text-palette-papel/70">de {formatBRL(goal.target_cents)}</span>
        </div>
      </div>
      {points.length >= 2 ? <Sparkline points={points} label={`Aportes em ${goal.name}`} className="h-16" /> : null}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <p className="min-w-[180px] flex-1 text-[13px] leading-5 text-palette-papel/80">{text}</p>
        <button type="button" onClick={() => f.fundGoal(goal)} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-palette-lima px-5 text-[14px] font-semibold text-palette-tinta outline-none transition-colors duration-[400ms] hover:bg-palette-lima/90 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none">
          <PlusIcon aria-hidden strokeWidth={1.75} className="size-4" /> Guardar
        </button>
      </div>
    </section>
  )
}

/** A goal in progress, as a card of the grid: icon, name, deadline, ring, amounts and a full-width Guardar. */
export function GoalBentoCard({ goal, grip, order }: { goal: FinancialGoalRow; grip?: React.ReactNode; order: string[] }) {
  const f = useFinance()
  return (
    <section aria-label={goal.name} data-goal={goal.id} data-done="false" className="relative flex min-w-0 flex-col gap-3 rounded-[20px] border border-border bg-card p-4">
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
        <div className="flex shrink-0 items-center">
          {grip}
          <RowMenu title={goal.name} extra={[{ label: "Destacar", icon: StarIcon, onSelect: () => f.featureGoal(goal, order) }]} onEdit={() => f.editGoal(goal)} onDelete={() => f.removeGoal(goal)} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <GoalRing goal={goal} size={72} />
        <div className="flex min-w-0 flex-col">
          <span className="tabular truncate text-[13px] leading-5 text-muted-foreground">
            {formatBRL(goal.current_cents)} de {formatBRL(goal.target_cents)}
          </span>
          <span className="text-[12px] leading-4 text-muted-foreground">{projection(goal, f.today).text}</span>
        </div>
      </div>
      <Button variant="outline" className="mt-auto h-11 w-full" onClick={() => f.fundGoal(goal)}>
        <PlusIcon strokeWidth={1.75} /> Guardar
      </Button>
    </section>
  )
}

/** Phones: a compact row (grip, ring 72, name, amounts, a circle "+"). Tapping the row edits the goal; "Destacar" lives in the edit sheet. */
export function GoalRow({ goal, grip }: { goal: FinancialGoalRow; grip?: React.ReactNode }) {
  const f = useFinance()
  return (
    <section aria-label={goal.name} data-goal={goal.id} data-done="false" className="relative flex items-center gap-2 rounded-[14px] border border-border bg-card p-3">
      {grip}
      <GoalRing goal={goal} size={72} />
      <div className="flex min-w-0 flex-1 flex-col pl-1">
        <button type="button" data-goal-title onClick={() => f.editGoal(goal)} className="truncate text-left text-[15px] leading-6 font-semibold outline-none after:absolute after:inset-0 after:rounded-[14px] focus-visible:after:ring-3 focus-visible:after:ring-ring/50">
          {goal.name}
        </button>
        <span className="tabular text-[13px] leading-5 text-muted-foreground">
          {formatBRL(goal.current_cents)} <span className="whitespace-nowrap">de {formatBRL(goal.target_cents)}</span>
        </span>
        <span className="truncate text-[12px] leading-4 text-muted-foreground">{deadlineText(goal)}</span>
      </div>
      <Button variant="outline" size="icon" aria-label={`Guardar em ${goal.name}`} className="relative z-10 shrink-0" onClick={() => f.fundGoal(goal)}>
        <PlusIcon strokeWidth={1.75} />
      </Button>
    </section>
  )
}

/** An achieved goal: the 100% ring, the name, the amount and "Meta alcançada". No icon, no Guardar; the card opens the edit sheet. */
export function AchievedGoal({ goal }: { goal: FinancialGoalRow }) {
  const f = useFinance()
  return (
    <section aria-label={goal.name} data-goal={goal.id} data-done="true" className="relative flex min-w-0 items-center gap-4 rounded-[20px] border border-border bg-card p-4">
      <GoalRing goal={goal} size={64} />
      <div className="flex min-w-0 flex-col">
        <button type="button" data-goal-title onClick={() => f.editGoal(goal)} className="truncate text-left text-[15px] leading-6 font-semibold outline-none after:absolute after:inset-0 after:rounded-[20px] focus-visible:after:ring-3 focus-visible:after:ring-ring/50">
          {goal.name}
        </button>
        <MoneyText cents={goal.current_cents} className="text-[13px] leading-5 text-muted-foreground" />
        <span className="text-[12px] leading-4 font-semibold text-palette-tinta-verso dark:text-brand">Meta alcançada</span>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ tab content

function Achieved({ done, className }: { done: FinancialGoalRow[]; className: string }) {
  const [open, setOpen] = useState(false)
  if (done.length === 0) return null
  return (
    <section data-group="done" aria-label="Alcançadas" className="flex min-w-0 flex-col">
      <GroupHeader label="Alcançadas" count={done.length} open={open} onToggle={() => setOpen((v) => !v)} />
      <Collapse open={open}>
        <div data-group-rows className={className}>
          {done.map((g) => (
            <AchievedGoal key={g.id} goal={g} />
          ))}
        </div>
      </Collapse>
    </section>
  )
}

/** The dashed tile that sits in the first empty cell after the last goal in progress. */
export function NewGoalCard({ compact = false }: { compact?: boolean }) {
  const f = useFinance()
  return (
    <button type="button" data-new-goal data-add-task-pill onClick={f.openNewGoal} className={cn("flex w-full flex-col items-center justify-center gap-2 border border-dashed border-border text-[15px] text-muted-foreground outline-none transition-colors duration-[400ms] hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none", compact ? "min-h-[72px] flex-row rounded-[14px] p-3" : "min-h-[200px] rounded-[20px] p-5")}>
      <PlusIcon aria-hidden strokeWidth={1.75} className={compact ? "size-5" : "size-6"} />
      Nova meta…
    </button>
  )
}

/** Desktop and tablet: the hero and the stats, "Em andamento" (the featured goal first, the cards after it and the dashed tile), then Alcançadas. */
export function GoalsDesktop() {
  const f = useFinance()
  const { open, done } = useGoalSets()
  const [activeOpen, setActiveOpen] = useState(true)
  const order = open.map((g) => g.id)
  return (
    <div data-testid="goals-main" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-8 xl:grid-cols-12">
      <div className="md:col-span-2 lg:col-span-8 xl:col-span-4">
        <GoalsHero />
      </div>
      <div className="md:col-span-2 lg:col-span-8 xl:col-span-8">
        <GoalStats />
      </div>
      <section data-group="active" aria-label="Em andamento" className="flex min-w-0 flex-col md:col-span-2 lg:col-span-8 xl:col-span-12">
        <GroupHeader label="Em andamento" count={open.length} open={activeOpen} onToggle={() => setActiveOpen((v) => !v)} />
        <Collapse open={activeOpen}>
          {f.goals.length === 0 ? <EmptyBlock icon={TargetIcon} title="Nenhuma meta ainda" description="Crie uma meta e acompanhe quanto já guardou." /> : null}
          <SortableGoals goals={open} layout="grid">
            <div data-group-rows className="grid grid-cols-1 gap-4 pb-3 md:grid-cols-2 lg:grid-cols-8 xl:grid-cols-12">
              {open.map((g, i) => (
                <SortableGoal key={g.id} goal={g} className={i === 0 ? "md:col-span-2 lg:col-span-8 xl:col-span-6" : "lg:col-span-4 xl:col-span-3"}>
                  {(grip) => (i === 0 ? <FeaturedGoal goal={g} grip={grip} /> : <GoalBentoCard goal={g} grip={grip} order={order} />)}
                </SortableGoal>
              ))}
              <div className="min-w-0 lg:col-span-4 xl:col-span-3 [&>*]:h-full">
                <NewGoalCard />
              </div>
            </div>
          </SortableGoals>
        </Collapse>
      </section>
      <div className="md:col-span-2 lg:col-span-8 xl:col-span-12">
        <Achieved done={done} className="grid grid-cols-1 gap-4 pb-3 md:grid-cols-2 xl:grid-cols-3" />
      </div>
    </div>
  )
}

/** Phones: hero, two tiles, Em andamento (featured + compact rows + the dashed row), Alcançadas collapsed. */
export function GoalsMobile() {
  const { open, done } = useGoalSets()
  const [activeOpen, setActiveOpen] = useState(true)
  return (
    <div data-testid="goals-main" className="flex flex-col gap-3">
      <GoalsHero />
      <GoalStats compact />
      <section data-group="active" aria-label="Em andamento" className="flex flex-col">
        <GroupHeader label="Em andamento" count={open.length} open={activeOpen} onToggle={() => setActiveOpen((v) => !v)} />
        <Collapse open={activeOpen}>
          <SortableGoals goals={open} layout="list">
            <div data-group-rows className="flex flex-col gap-2 pb-2">
              {open.map((g, i) => (
                <SortableGoal key={g.id} goal={g}>
                  {(grip) => (i === 0 ? <FeaturedGoal goal={g} grip={grip} /> : <GoalRow goal={g} grip={grip} />)}
                </SortableGoal>
              ))}
              <NewGoalCard compact />
            </div>
          </SortableGoals>
        </Collapse>
      </section>
      <Achieved done={done} className="flex flex-col gap-2 pb-2" />
    </div>
  )
}
