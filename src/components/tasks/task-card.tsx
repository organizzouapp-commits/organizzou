"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, CalendarClockIcon, CalendarIcon, CheckIcon, ClockIcon, CopyIcon, EllipsisIcon, ListChecksIcon, PencilIcon, RotateCcwIcon, TextCursorInputIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { colorLabel, resolveHex, taskColorOf, type ColorValue } from "@/features/tasks/colors"
import { priorityOf } from "@/features/tasks/priorities"
import type { TagRow, TaskView } from "@/features/tasks/types"

import { InlineInput } from "./inline-input"
import { useTaskDragging } from "./task-dnd"
import { useLabelColors } from "./label-colors-context"
import { usePriorities } from "./priorities-context"
import { DueLabel, LabelBadge, PriorityFlag, TaskCounters } from "./task-meta"

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
  /** Reorders inside its list (the accessible alternative to dragging). Absent where the order is not the user's. */
  moveUp?: () => void
  moveDown?: () => void
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
  /** "full": date (and time). "time": only the time, for a day list where the day is already selected. */
  dueMode?: "full" | "time"
}

const EASE = "ease-[cubic-bezier(0.2,0.8,0.2,1)]"
/** 20px check, 12px tick, 44px hit area that does not touch the layout. */
export const CHECK_CLASS = "size-5 after:-inset-3 [&_svg]:size-3"

/** The ⋯ menu: the ONE trigger of a card (32 px visual, 44 px hit area). */
function ActionsMenu({ task, actions, open, onOpenChange, onRename }: { task: TaskView; actions: TaskActions; open: boolean; onOpenChange: (open: boolean) => void; onRename: () => void }) {
  const done = Boolean(task.completed_at)
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Mais ações: ${task.title}`} className="relative size-8 shrink-0 rounded-full opacity-100 transition-opacity duration-150 after:absolute after:-inset-1.5 group-focus-within/card:opacity-100 group-hover/card:opacity-100 data-[state=open]:opacity-100 md:opacity-60 [&_svg]:size-4">
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
        {actions.moveUp ? (
          <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={actions.moveUp}>
            <ArrowUpIcon strokeWidth={1.75} /> Mover para cima
          </DropdownMenuItem>
        ) : null}
        {actions.moveDown ? (
          <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={actions.moveDown}>
            <ArrowDownIcon strokeWidth={1.75} /> Mover para baixo
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
 * Touch only: swipe right completes, swipe left reveals three 68 px actions (Adiar 1 h, Amanhã, Mover). A long press starts a drag
 * (never a menu). Mouse and keyboard users have the ⋯ menu.
 */
function SwipeShell({ task, actions, children, className }: { task: TaskView; actions: TaskActions; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; locked: boolean | null } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const host = useRef<HTMLDivElement>(null)
  const done = Boolean(task.completed_at)
  const draggingNow = useTaskDragging()

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
        }}
        onPointerMove={(e) => {
          const s = start.current
          if (!s || draggingNow) return
          const ax = e.clientX - s.x
          const ay = e.clientY - s.y
          if (s.locked === null && (Math.abs(ax) > 8 || Math.abs(ay) > 8)) s.locked = Math.abs(ax) > Math.abs(ay) * 1.5
          if (!s.locked) return
          setDragging(true)
          setDx(ax)
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        onContextMenu={(e) => window.matchMedia("(pointer: coarse)").matches && e.preventDefault()}
        style={{ transform: `translateX(${offset}px)` }}
        className={cn("relative touch-pan-y bg-card md:!transform-none", !dragging && cn("transition-transform duration-[400ms] motion-reduce:transition-none", EASE))}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * ONE task component (Kanban, Lista, Calendário, search) with two densities (card / flat row) and ONE geometry:
 *   - color bar: left 8px, 4px wide, inset 12px top and bottom; checkbox 20px at 24px from the edge (12px after the bar), always.
 *   - CSS grid: row 1 = [check | title | actions], row 2 = the meta row, from the title's left edge to the right padding.
 *   - the check sits in a 20px wrapper aligned to the FIRST title line (15px/20px), so their centers match for any title length.
 *   - actions (flag + ⋯) are centered on that same first line; ⋯ owns the rightmost fixed slot, so it never moves when the flag is absent.
 * Meta row: date/time, priority chip, category chip, tag chips (at most 3 chips, then "+N"), counters pushed to the right edge.
 * The whole card opens the task through a stretched link on the title (the check and ⋯ sit above it).
 */
export function TaskCardBody({ task, tags, now, timeZone, actions, density = "card", className, inert, selecting, selected, onSelect, anchor, dueMode = "full" }: TaskCardBodyProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const openTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(openTimer.current), [])
  const isMobile = useIsMobile()
  const labels = useLabelColors()
  const priorities = usePriorities()
  const taskColor = taskColorOf(labels.state, task)
  const colorHex = resolveHex(taskColor)
  const done = Boolean(task.completed_at)
  const taskTags = task.tagIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is TagRow => Boolean(t))
  const priority = priorityOf(priorities, task)
  // Label chips in order: priority, category, tags. At most 3 are shown, the rest becomes "+N".
  const chips: { key: string; name: string; color: ColorValue }[] = []
  if (priority) chips.push({ key: "priority", name: priority.name, color: labels.colorOf("priority", priority.id) })
  if (task.category) chips.push({ key: "category", name: task.category, color: labels.colorOf("category", task.category) })
  for (const tag of taskTags) chips.push({ key: `tag:${tag.id}`, name: tag.name, color: labels.colorOf("tag", tag.id) })
  const shownChips = chips.slice(0, 3)
  const hiddenChips = chips.slice(3)
  const hasCounters = task.checklistTotal > 0 || task.commentCount > 0 || task.attachmentCount > 0
  const hasDue = Boolean(task.due_at) && (dueMode === "full" || task.due_has_time)
  const hasMeta = hasDue || chips.length > 0 || hasCounters

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
        "group/card relative grid grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-x-3 py-3 pr-3 pl-6 text-card-foreground transition-colors duration-[400ms] select-none motion-reduce:transition-none [-webkit-touch-callout:none]",
        EASE,
        density === "card" ? "min-h-14 rounded-[14px] border border-border bg-card hover:bg-accent/40" : "min-h-14 border-b border-border last:border-b-0",
        selected && "border-foreground/40",
        className
      )}
    >
      {/* The task color: a 4px bar at 8px from the edge, inset 12px (the left padding is constant, so cards with and without color line up). */}
      {colorHex ? <span aria-hidden data-task-color={colorHex} className="pointer-events-none absolute top-3 bottom-3 left-2 w-1 rounded-full" style={{ backgroundColor: colorHex, opacity: done ? 0.5 : 1 }} /> : null}
      {inert ? (
        <span aria-hidden className="block size-5" />
      ) : (
        <span data-task-check className="relative z-10 flex h-5 w-5 items-center justify-center">
          {selecting ? (
            <Checkbox checked={selected} onCheckedChange={() => onSelect?.()} aria-label={`Selecionar ${task.title}`} onPointerDown={(e) => e.stopPropagation()} className={CHECK_CLASS} />
          ) : (
            <Checkbox
              checked={done}
              onCheckedChange={() => actions.toggle()}
              aria-label={done ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
              onPointerDown={(e) => e.stopPropagation()}
              className={CHECK_CLASS}
            />
          )}
        </span>
      )}
      {renaming ? (
        <div className="min-w-0" onPointerDown={(e) => e.stopPropagation()}>
          <InlineInput multiline maxLength={200} initialValue={task.title} ariaLabel={`Renomear ${task.title}`} onCommit={actions.rename} onClose={() => setRenaming(false)} />
        </div>
      ) : (
        <button
          type="button"
          data-task-open
          data-pill-exempt
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
          className="min-w-0 cursor-grab rounded-md text-left outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {/* Completed: struck through and muted (an opacity of 60% would drop the meta line under 4.5:1). */}
          <span data-task-title className={cn("block text-[15px] leading-5 font-semibold [overflow-wrap:anywhere]", done && "text-muted-foreground line-through")}>
            {task.title}
          </span>
        </button>
      )}
      {colorHex ? <span id={`task-color-${task.id}`} className="sr-only">Cor da tarefa: {colorLabel(taskColor)}</span> : null}
      {/* Actions: flag (when there is a priority) then ⋯, both centered on the first title line; ⋯ keeps the rightmost slot. */}
      <div data-task-actions className="relative z-10 flex h-5 items-center justify-end gap-1" onPointerDown={(e) => e.stopPropagation()}>
        {inert ? null : (
          <>
            <PriorityFlag task={task} className="size-4" />
            <ActionsMenu task={task} actions={actions} open={menuOpen} onOpenChange={setMenuOpen} onRename={() => setRenaming(true)} />
          </>
        )}
      </div>
      {hasMeta ? (
        <div data-task-meta className="pointer-events-none col-start-2 col-end-4 mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          {hasDue ? <DueLabel task={task} now={now} timeZone={timeZone} mode={dueMode} className="h-6" /> : null}
          {shownChips.map((chip) => (
            <LabelBadge key={chip.key} name={chip.name} color={chip.color} className="h-6 max-w-40" />
          ))}
          {hiddenChips.length > 0 ? (
            <span data-chip-more title={hiddenChips.map((c) => c.name).join(", ")} className="tabular inline-flex h-6 items-center rounded-full bg-secondary px-2 text-[12px] leading-4 font-medium text-secondary-foreground">
              +{hiddenChips.length}
            </span>
          ) : null}
          <TaskCounters task={task} className="ml-auto h-6" />
        </div>
      ) : null}
    </div>
  )

  if (inert || selecting) return body
  return (
    <SwipeShell task={task} actions={actions} className={density === "card" ? "rounded-[14px]" : undefined}>
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

  // The slot the card will drop into: the card itself steps aside (invisible) and a Lima-free line marks the spot.
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-task-id={body.task.id}
      data-dragging={isDragging ? "" : undefined}
      {...attributes}
      {...listeners}
      className={cn("relative snap-start touch-manipulation cursor-grab outline-none select-none [-webkit-touch-callout:none]", isDragging && "touch-none")}
    >
      <div className={cn(isDragging && "opacity-0")}>
        <TaskCardBody {...body} />
      </div>
      {isDragging ? <span aria-hidden data-drop-indicator className="pointer-events-none absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-primary" /> : null}
    </div>
  )
}
