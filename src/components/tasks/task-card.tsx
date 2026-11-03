"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowRightIcon, CalendarClockIcon, CalendarIcon, CheckIcon, ClockIcon, CopyIcon, EllipsisIcon, ListChecksIcon, PencilIcon, RotateCcwIcon, TextCursorInputIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { colorLabel, resolveHex, taskColorOf } from "@/features/tasks/colors"
import type { TagRow, TaskView } from "@/features/tasks/types"

import { InlineInput } from "./inline-input"
import { useLabelColors } from "./label-colors-context"
import { DueLabel, PriorityFlag, TagDots, TaskCounters } from "./task-meta"

/** What a task can do from its card, row, swipe panel or menu. */
export type TaskActions = {
  open: () => void
  toggle: () => void
  postpone1h: () => void
  tomorrow: () => void
  move: () => void
  remove: () => void
  /** Enters multi-select mode with this task selected. */
  select: () => void
  duplicate: () => void
  /** Opens the date sheet ("Agendar…"). Only where scheduling is the point (the calendar): it replaces "Mover" in the swipe panel. */
  schedule?: () => void
  /** Renames in place (auto-commit); resolves false when the save failed. */
  rename: (title: string) => Promise<boolean>
}

type Density = "card" | "row"

type TaskCardBodyProps = {
  task: TaskView
  tags: TagRow[]
  now: Date
  timeZone: string
  actions: TaskActions
  density?: Density
  className?: string
  /** Drag overlay and previews: no controls. */
  inert?: boolean
  /** Multi-select mode: a selection check replaces the open behaviour. */
  selecting?: boolean
  selected?: boolean
  onSelect?: () => void
  /** Marks the root as the task's anchor (the Kanban wrapper does it itself; Lista rows set this). */
  anchor?: boolean
}

const EASE = "ease-[cubic-bezier(0.2,0.8,0.2,1)]"

/** The ⋯ menu: the ONE trigger of a card (32 px column; 44 px hit area on phones). A long press opens it on phones too. */
function ActionsMenu({ task, actions, open, onOpenChange, onRename }: { task: TaskView; actions: TaskActions; open: boolean; onOpenChange: (open: boolean) => void; onRename: () => void }) {
  const done = Boolean(task.completed_at)
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Mais ações: ${task.title}`} className="relative size-8 rounded-full opacity-100 transition-opacity duration-150 group-focus-within/card:opacity-100 group-hover/card:opacity-100 data-[state=open]:opacity-100 max-md:after:absolute max-md:after:-inset-1.5 md:opacity-60">
          <EllipsisIcon strokeWidth={1.75} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52 rounded-2xl p-2">
        <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={actions.toggle}>
          {done ? <RotateCcwIcon strokeWidth={1.75} /> : <CheckIcon strokeWidth={1.75} />} {done ? "Reabrir" : "Concluir"}
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={actions.open}>
          <PencilIcon strokeWidth={1.75} /> Abrir detalhes
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={onRename}>
          <TextCursorInputIcon strokeWidth={1.75} /> Renomear
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={actions.duplicate}>
          <CopyIcon strokeWidth={1.75} /> Duplicar
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={actions.select}>
          <ListChecksIcon strokeWidth={1.75} /> Selecionar
        </DropdownMenuItem>
        {!done ? (
          <>
            <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={actions.postpone1h}>
              <ClockIcon strokeWidth={1.75} /> Adiar 1 h
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={actions.tomorrow}>
              <CalendarIcon strokeWidth={1.75} /> Amanhã
            </DropdownMenuItem>
          </>
        ) : null}
        {actions.schedule ? (
          <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={actions.schedule}>
            <CalendarClockIcon strokeWidth={1.75} /> Agendar…
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={actions.move}>
          <ArrowRightIcon strokeWidth={1.75} /> Mover para…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={actions.remove}>
          <Trash2Icon strokeWidth={1.75} /> Excluir tarefa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const SWIPE_RIGHT = 72
const PANEL = 68
const SWIPE_LEFT_OPEN = PANEL * 3

/**
 * Touch only: swipe right completes, swipe left reveals three 68 px actions (Adiar 1 h, Amanhã, Mover); a long press opens the
 * menu. Mouse and keyboard users have the hover actions and the ⋯ menu.
 */
function SwipeShell({ task, actions, onLongPress, children, className }: { task: TaskView; actions: TaskActions; onLongPress: () => void; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; locked: boolean | null } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const host = useRef<HTMLDivElement>(null)
  const done = Boolean(task.completed_at)

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!host.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [open])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const offset = dragging ? Math.max(-SWIPE_LEFT_OPEN, Math.min(SWIPE_RIGHT + 24, (open ? -SWIPE_LEFT_OPEN : 0) + dx)) : open ? -SWIPE_LEFT_OPEN : 0
  const finish = () => {
    window.clearTimeout(timer.current)
    const moved = dx
    start.current = null
    setDragging(false)
    setDx(0)
    if (moved >= SWIPE_RIGHT && !open) actions.toggle()
    else if (moved <= -44 && !done) setOpen(true)
    else if (moved >= 22 && open) setOpen(false)
  }
  const act = (run: () => void) => () => {
    setOpen(false)
    run()
  }
  const panel = "flex flex-col items-center justify-center gap-1 text-[12px] leading-4 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

  return (
    <div ref={host} className={cn("relative overflow-hidden md:overflow-visible", className)}>
      <div aria-hidden className="absolute inset-y-0 left-0 flex items-center bg-foreground/10 px-5 text-[13px] font-medium md:hidden" style={{ width: SWIPE_RIGHT + 24 }}>
        <CheckIcon strokeWidth={1.75} className="mr-2 size-5" /> {done ? "Reabrir" : "Concluir"}
      </div>
      <div aria-hidden={!open} className="absolute inset-y-0 right-0 flex md:hidden" style={{ width: SWIPE_LEFT_OPEN }}>
        <button type="button" data-pill-exempt tabIndex={open ? 0 : -1} onClick={act(actions.postpone1h)} className={cn(panel, "w-[68px] bg-foreground/10")}>
          <ClockIcon aria-hidden strokeWidth={1.75} className="size-5" /> Adiar 1 h
        </button>
        <button type="button" data-pill-exempt tabIndex={open ? 0 : -1} onClick={act(actions.tomorrow)} className={cn(panel, "w-[68px] bg-foreground/[0.16]")}>
          <CalendarIcon aria-hidden strokeWidth={1.75} className="size-5" /> Amanhã
        </button>
        <button type="button" data-pill-exempt tabIndex={open ? 0 : -1} onClick={act(actions.schedule ?? actions.move)} className={cn(panel, "w-[68px] bg-foreground/22")}>
          {actions.schedule ? <CalendarClockIcon aria-hidden strokeWidth={1.75} className="size-5" /> : <ArrowRightIcon aria-hidden strokeWidth={1.75} className="size-5" />} {actions.schedule ? "Data…" : "Mover"}
        </button>
      </div>
      <div
        onPointerDown={(e) => {
          if (e.pointerType !== "touch") return
          start.current = { x: e.clientX, y: e.clientY, locked: null }
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => {
            if (start.current && start.current.locked === null) {
              start.current = null
              onLongPress()
            }
          }, 520)
        }}
        onPointerMove={(e) => {
          const s = start.current
          if (!s) return
          const ax = e.clientX - s.x
          const ay = e.clientY - s.y
          if (Math.abs(ax) > 8 || Math.abs(ay) > 8) window.clearTimeout(timer.current)
          if (s.locked === null && (Math.abs(ax) > 8 || Math.abs(ay) > 8)) s.locked = Math.abs(ax) > Math.abs(ay) * 1.5
          if (!s.locked) return
          setDragging(true)
          setDx(ax)
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        style={{ transform: `translateX(${offset}px)` }}
        className={cn("relative touch-pan-y bg-card md:!transform-none", !dragging && cn("transition-transform duration-[400ms] motion-reduce:transition-none", EASE))}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * ONE task component with two densities. Anatomy, left to right: checkbox (22 px visual, 44 px hit area on phones), then the title
 * (15 px 600, at most 2 lines) with the priority flag AFTER it (high only), then ONE meta line: due date first, list/tag as a
 * neutral dot + name, counters on the right. No stripe, no signal bars, no chip borders. Desktop: hover and focus reveal the quick
 * actions. Phones: swipe and long press.
 */
export function TaskCardBody({ task, tags, now, timeZone, actions, density = "card", className, inert, selecting, selected, onSelect, anchor }: TaskCardBodyProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const openTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(openTimer.current), [])
  const isMobile = useIsMobile()
  const labels = useLabelColors()
  const taskColor = taskColorOf(labels.state, task)
  const colorHex = resolveHex(taskColor)
  const done = Boolean(task.completed_at)
  const taskTags = task.tagIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is TagRow => Boolean(t))

  const body = (
    <div
      data-density={density}
      data-task-id={anchor ? task.id : undefined}
      data-selected={selected ? "" : undefined}
      onKeyDown={(e) => {
        if (e.key === "F2" && !inert && !selecting && !renaming) {
          e.preventDefault()
          setRenaming(true)
        }
      }}
      className={cn(
        "group/card relative flex items-start gap-3 text-card-foreground transition-colors duration-[400ms] motion-reduce:transition-none",
        EASE,
        density === "card" ? "min-h-[72px] rounded-[14px] border border-border bg-card py-2.5 pr-3 pl-4 hover:bg-accent/40 md:min-h-[84px] md:py-3" : "min-h-[64px] border-b border-border py-2 pr-1 pl-4 last:border-b-0 md:pr-3 md:pl-5",
        selected && "border-foreground/40",
        className
      )}
    >
      {/* The task color: a 4 px bar inset on the left (the left padding is constant, so cards with and without color line up). */}
      {colorHex ? <span aria-hidden data-task-color={colorHex} className="pointer-events-none absolute top-3 bottom-3 left-2 w-1 rounded-full" style={{ backgroundColor: colorHex, opacity: done ? 0.5 : 1 }} /> : null}
      {inert ? null : (
        <span className="-my-2 -ml-1.5 flex size-11 shrink-0 items-center justify-center md:my-0 md:ml-0 md:size-7">
          {selecting ? (
            <Checkbox checked={selected} onCheckedChange={() => onSelect?.()} aria-label={`Selecionar ${task.title}`} onPointerDown={(e) => e.stopPropagation()} className="size-[22px] after:-inset-x-3 after:-inset-y-3 md:size-7" />
          ) : (
            <Checkbox
              checked={done}
              onCheckedChange={() => actions.toggle()}
              aria-label={done ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
              onPointerDown={(e) => e.stopPropagation()}
              className="size-[22px] after:-inset-x-3 after:-inset-y-3 md:size-7"
            />
          )}
        </span>
      )}
      {renaming ? (
        <div className="flex min-w-0 flex-1 flex-col justify-center py-1" onPointerDown={(e) => e.stopPropagation()}>
          <InlineInput multiline maxLength={200} initialValue={task.title} ariaLabel={`Renomear ${task.title}`} onCommit={actions.rename} onClose={() => setRenaming(false)} />
        </div>
      ) : (
      <button
        type="button"
        data-task-open data-pill-exempt
        aria-describedby={colorHex ? `task-color-${task.id}` : undefined}
        onClick={(e) => {
          if (selecting) return onSelect?.()
          // Desktop: a double click renames, so the single click waits a beat; phones open at once.
          if (isMobile || e.detail === 0) return actions.open()
          window.clearTimeout(openTimer.current)
          openTimer.current = window.setTimeout(actions.open, 220)
        }}
        onDoubleClick={(e) => {
          if (selecting || isMobile) return
          e.preventDefault()
          window.clearTimeout(openTimer.current)
          setRenaming(true)
        }}
        className="flex min-w-0 flex-1 cursor-grab flex-col justify-center gap-1 self-stretch rounded-md py-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-md:min-h-11"
      >
        {/* Completed: struck through and muted (an opacity of 60% would drop the meta line under 4.5:1). */}
        <span className={cn("text-[15px] leading-5 font-semibold [overflow-wrap:anywhere]", done && "text-muted-foreground line-through")}>
          <span>{task.title}</span>
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
          <DueLabel task={task} now={now} timeZone={timeZone} />
          <TagDots tags={taskTags} category={task.category} />
          <TaskCounters task={task} className="ml-auto" />
        </span>
      </button>
      )}
      {colorHex ? <span id={`task-color-${task.id}`} className="sr-only">Cor da tarefa: {colorLabel(taskColor)}</span> : null}
      {/* The flag comes right after the title, high priority only. */}
      <PriorityFlag task={task} className="mt-1 -ml-1 self-start" />
      {inert ? null : (
        <div className="-mr-1 flex w-8 shrink-0 items-start justify-center" onPointerDown={(e) => e.stopPropagation()}>
          <ActionsMenu task={task} actions={actions} open={menuOpen} onOpenChange={setMenuOpen} onRename={() => setRenaming(true)} />
        </div>
      )}
    </div>
  )

  if (inert || selecting) return body
  return (
    <SwipeShell task={task} actions={actions} onLongPress={() => setMenuOpen(true)} className={density === "card" ? "rounded-[14px]" : undefined}>
      {body}
    </SwipeShell>
  )
}

type SortableTaskCardProps = Omit<TaskCardBodyProps, "className"> & {
  listId: string
  disabled: boolean
}

export function SortableTaskCard({ listId, disabled, ...body }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: body.task.id,
    data: { type: "task", listId },
    disabled,
  })
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} data-task-id={body.task.id} {...attributes} {...listeners} className={cn("snap-start touch-manipulation cursor-grab outline-none", isDragging && "opacity-40")}>
      <TaskCardBody {...body} />
    </div>
  )
}
