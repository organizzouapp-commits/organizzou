"use client"

import { useState } from "react"
import { DndContext, DragOverlay, MouseSensor, TouchSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { CheckIcon, CopyIcon, EllipsisIcon, GripVerticalIcon, PencilIcon, PlayIcon, Trash2Icon } from "lucide-react"

import { AddPill } from "@/components/finance/parts"
import { useTaskSensors } from "@/components/tasks/task-dnd"
import { LetterBadge } from "@/components/workouts/treino-hoje"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MONDAY_FIRST, formatLoad, lastLoad, planTotals, sortWeekdays } from "@/features/workouts/plans"
import { planLetter } from "@/features/workouts/session"
import type { PlanExerciseRow, SetLogRow, WorkoutPlanRow, WorkoutSessionRow } from "@/features/workouts/types"
import { cn } from "@/lib/utils"

const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
const WEEKDAY_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]

export type MeusTreinosProps = {
  plans: WorkoutPlanRow[]
  planExercises: PlanExerciseRow[]
  sets: SetLogRow[]
  sessions: WorkoutSessionRow[]
  /** 0 = Sunday … 6 = Saturday, today's weekday. */
  todayWeekday: number
  isMobile: boolean
  exerciseName: (id: string) => string
  /** Plans whose list shows every exercise on a phone. */
  showAll: Set<string>
  onToggleShowAll: (planId: string) => void
  onCreate: () => void
  onToggleDay: (plan: WorkoutPlanRow, day: number) => void
  onDropOnDay: (plan: WorkoutPlanRow, day: number) => void
  onReorder: (planId: string, fromId: string, toId: string) => void
  onAddExercise: (plan: WorkoutPlanRow) => void
  onEditExercise: (row: PlanExerciseRow) => void
  onDuplicate: (plan: WorkoutPlanRow) => void
  onRename: (plan: WorkoutPlanRow) => void
  onDelete: (plan: WorkoutPlanRow) => void
  onStart: (plan: WorkoutPlanRow) => void
}

/** The whole tab: AddPill, the weekly planning (drop targets) and the workout cards (the drag sources). */
export function MeusTreinos(props: MeusTreinosProps) {
  const { plans } = props
  const [dragging, setDragging] = useState<WorkoutPlanRow | null>(null)
  // Mouse and long-press touch; the keyboard alternative is the menu of every day cell.
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 4 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }))

  function onDragEnd({ active, over }: DragEndEvent) {
    setDragging(null)
    const plan = plans.find((p) => p.id === active.id)
    if (!plan || !over || !String(over.id).startsWith("day-")) return
    props.onDropOnDay(plan, Number(String(over.id).slice(4)))
  }

  return (
    <div className="@container flex min-w-0 flex-col gap-4" data-testid="meus-treinos">
      <AddPill label="Novo treino… ex.: Treino D — Ombros" onClick={props.onCreate} className="h-11" />
      <DndContext id="plans-dnd" sensors={sensors} collisionDetection={closestCenter} onDragStart={({ active }) => setDragging(plans.find((p) => p.id === active.id) ?? null)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <PlanningCard {...props} />
        <div className="grid items-stretch gap-4 @min-[680px]:grid-cols-2 @min-[1040px]:grid-cols-3" data-testid="plan-grid">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} {...props} />
          ))}
        </div>
        <DragOverlay>
          {dragging ? (
            <div className="flex items-center gap-3 rounded-[14px] border border-border bg-card p-2 pr-4">
              <LetterBadge letter={planLetter(plans, dragging.id)} tone="lima" className="size-10 text-[15px]" />
              <span className="text-[15px] font-semibold">{dragging.name}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

// ------------------------------------------------------------------ weekly planning

function DayCell({ day, plans, allPlans, today, onToggleDay }: { day: number; plans: WorkoutPlanRow[]; allPlans: WorkoutPlanRow[]; today: boolean; onToggleDay: (plan: WorkoutPlanRow, day: number) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` })
  const names = plans.map((p) => p.name).join(", ")
  return (
    <div ref={setNodeRef} data-droppable-day={day} className="min-w-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-day={day}
            data-over={isOver}
            aria-label={`${WEEKDAY_LONG[day]}: ${names || "descanso"}. Escolher treino`}
            className={cn(
              "flex h-[76px] w-full min-w-0 flex-col items-center justify-center gap-1 rounded-[14px] px-0.5 outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none md:h-24",
              today ? "bg-highlight text-highlight-foreground" : "bg-muted/50 hover:bg-muted",
              isOver && "ring-2 ring-foreground ring-offset-2 ring-offset-card"
            )}
          >
            <span aria-hidden className={cn("text-[11px] leading-4 font-semibold tracking-[0.08em] uppercase", !today && "text-muted-foreground")}>
              {WEEKDAY_SHORT[day]}
            </span>
            {plans.length > 0 ? (
              <>
                <span aria-hidden className="flex items-center gap-1">
                  {plans.map((p) => (
                    <LetterBadge key={p.id} letter={planLetter(allPlans, p.id)} tone={today ? "inverse" : "muted"} className="size-6" />
                  ))}
                </span>
                <span aria-hidden className="hidden w-full truncate px-1 text-[11px] leading-4 md:block">
                  {plans[0].name}
                  {plans.length > 1 ? ` +${plans.length - 1}` : ""}
                </span>
              </>
            ) : (
              <span aria-hidden className={cn("text-[11px] leading-6", today ? "text-highlight-foreground/75" : "text-muted-foreground")}>
                <span className="md:hidden">–</span>
                <span className="max-md:hidden">descanso</span>
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-56">
          <DropdownMenuLabel>Escolher treino · {WEEKDAY_LONG[day]}</DropdownMenuLabel>
          {allPlans.length === 0 ? <DropdownMenuItem disabled>Nenhum treino ainda</DropdownMenuItem> : null}
          {allPlans.map((plan) => {
            const on = plan.weekdays.includes(day)
            return (
              <DropdownMenuItem key={plan.id} onSelect={() => onToggleDay(plan, day)}>
                <LetterBadge letter={planLetter(allPlans, plan.id)} tone="muted" className="size-5 text-[11px]" />
                <span className="min-w-0 flex-1 truncate">{plan.name}</span>
                {on ? (
                  <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                    <CheckIcon aria-hidden strokeWidth={1.75} className="size-3.5" /> Remover
                  </span>
                ) : null}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function PlanningCard({ plans, todayWeekday, onToggleDay }: MeusTreinosProps) {
  return (
    <section aria-label="Planejamento da semana" data-testid="planning-card" className="flex flex-col gap-3 rounded-[20px] border border-border bg-card p-3 md:p-5">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1">
        <h3 className="text-[17px] leading-6 font-semibold">Planejamento da semana</h3>
        <span data-chip className="inline-flex h-6 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 text-muted-foreground">
          Arraste um treino para mudar o dia
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5 md:gap-2" role="group" aria-label="Treinos por dia da semana">
        {MONDAY_FIRST.map((day) => (
          <DayCell key={day} day={day} plans={plans.filter((p) => p.weekdays.includes(day))} allPlans={plans} today={day === todayWeekday} onToggleDay={onToggleDay} />
        ))}
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ workout cards

function ExerciseRow({ item, name, load, onEdit }: { item: PlanExerciseRow; name: string; load: string | null; onEdit: () => void }) {
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, transition: { duration: reduce ? 0 : 400, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" } })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} data-exercise-row={item.id} className={cn("flex h-11 items-center gap-1 rounded-[12px] bg-card", isDragging && "relative z-20 opacity-90")}>
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        data-grip
        aria-label={`Reordenar ${name}`}
        className="relative flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-muted-foreground outline-none after:absolute after:-inset-1.5 hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
      >
        <GripVerticalIcon aria-hidden strokeWidth={1.75} className="size-4" />
      </button>
      <button type="button" onClick={onEdit} aria-label={`Editar ${name}`} className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-[12px] px-1 text-left outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="min-w-0 flex-1 truncate text-[14px] leading-5">{name}</span>
        <span className="tabular shrink-0 text-[13px] leading-5 text-muted-foreground">
          {item.sets} × {item.reps}
          {load ? ` · ${load}` : ""}
        </span>
      </button>
    </li>
  )
}

function PlanCard({ plan, plans, planExercises, sets, sessions, todayWeekday, isMobile, exerciseName, showAll, onToggleShowAll, onAddExercise, onEditExercise, onDuplicate, onRename, onDelete, onStart, onReorder }: MeusTreinosProps & { plan: WorkoutPlanRow }) {
  const sensors = useTaskSensors()
  const { attributes, listeners, setNodeRef: setHandleRef, isDragging } = useDraggable({ id: plan.id })
  const items = planExercises.filter((e) => e.plan_id === plan.id).sort((a, b) => a.position - b.position)
  const letter = planLetter(plans, plan.id)
  const totals = planTotals(items)
  const isToday = plan.weekdays.includes(todayWeekday)
  const collapsed = isMobile && items.length > 3 && !showAll.has(plan.id)
  const visible = collapsed ? items.slice(0, 3) : items

  return (
    <section aria-label={plan.name} data-plan={plan.id} className={cn("flex h-full min-w-0 flex-col gap-4 rounded-[20px] border border-border bg-card p-4 md:p-5", isDragging && "opacity-60")}>
      <div className="flex items-center gap-3">
        <button type="button" ref={setHandleRef} {...attributes} {...listeners} tabIndex={-1} data-plan-handle aria-label={`Arrastar o treino ${letter} para um dia da semana`} className="relative shrink-0 cursor-grab touch-none rounded-full outline-none after:absolute after:-inset-1 active:cursor-grabbing">
          <LetterBadge letter={letter} tone={isToday ? "lima" : "outline"} className="size-10 text-[15px]" />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[17px] leading-6 font-semibold">{plan.name}</h3>
          <p className="tabular truncate text-[13px] leading-5 text-muted-foreground">
            Treino {letter} · {totals.sets} {totals.sets === 1 ? "série" : "séries"} · ~{totals.minutes} min
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Opções de ${plan.name}`} className="relative size-9 shrink-0 rounded-full after:absolute after:-inset-1">
              <EllipsisIcon strokeWidth={1.75} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onRename(plan)}>
              <PencilIcon strokeWidth={1.75} /> Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDuplicate(plan)}>
              <CopyIcon strokeWidth={1.75} /> Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(plan)}>
              <Trash2Icon strokeWidth={1.75} /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" data-testid="plan-weekdays">
        {isToday ? <span className="inline-flex h-6 items-center rounded-full bg-highlight px-2 text-[12px] leading-4 font-semibold text-highlight-foreground">hoje</span> : null}
        {plan.weekdays.length === 0 ? <span className="text-[13px] leading-5 text-muted-foreground">Sem dia fixo</span> : null}
        {sortWeekdays(plan.weekdays).map((d) => (
          <span key={d} className="inline-flex h-6 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 text-muted-foreground">
            {WEEKDAY_SHORT[d]}
          </span>
        ))}
      </div>

      <DndContext id={`ex-dnd-${plan.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => over && active.id !== over.id && onReorder(plan.id, String(active.id), String(over.id))} accessibility={{ screenReaderInstructions: { draggable: "Para reordenar, aperte espaço, use as setas para mover e aperte espaço para soltar. Esc cancela." } }}>
        <SortableContext items={visible.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col" data-testid="plan-exercises">
            {visible.map((item) => (
              <ExerciseRow key={item.id} item={item} name={exerciseName(item.exercise_id)} load={formatLoad(lastLoad(item.exercise_id, sets, sessions) ?? item.target_load_kg)} onEdit={() => onEditExercise(item)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {items.length === 0 ? <p className="text-[13px] leading-5 text-muted-foreground">Nenhum exercício ainda.</p> : null}
      {isMobile && items.length > 3 ? (
        <button type="button" aria-expanded={!collapsed} onClick={() => onToggleShowAll(plan.id)} className="relative -mt-2 h-9 w-fit rounded-full px-3 text-[13px] leading-5 text-muted-foreground outline-none after:absolute after:inset-x-0 after:-inset-y-1 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
          {collapsed ? `Ver todos os ${items.length} exercícios` : "Ver menos"}
        </button>
      ) : null}

      <div className="mt-auto flex flex-col gap-3">
        <AddPill label="Exercício" onClick={() => onAddExercise(plan)} className="h-10 md:h-10" />
        <div className="flex items-center gap-2">
          <Button data-testid="start-plan" className="h-11 flex-1 rounded-full" onClick={() => onStart(plan)}>
            <PlayIcon strokeWidth={1.75} /> Iniciar treino
          </Button>
          <Button variant="outline" className="h-11 rounded-full px-4" onClick={() => onDuplicate(plan)}>
            <CopyIcon strokeWidth={1.75} /> Duplicar
          </Button>
        </div>
      </div>
    </section>
  )
}

