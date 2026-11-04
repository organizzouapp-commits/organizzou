"use client"

import { useEffect, useMemo, useState } from "react"
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { closestCorners, DndContext, DragOverlay, useDroppable, type DragEndEvent, type DragOverEvent } from "@dnd-kit/core"
import { ChevronDownIcon, PlusIcon, SquareCheckIcon } from "lucide-react"

import { cardHover } from "@/components/organizzou/Bento"
import { EmptyState } from "@/components/organizzou/EmptyState"
import { Button } from "@/components/ui/button"
import { groupByDue } from "@/features/tasks/view"
import type { ListRow, TaskView } from "@/features/tasks/types"
import { cn } from "@/lib/utils"

import { ListMenu, ListName } from "./list-parts"
import { QuickAdd } from "./quick-add"
import { SortableTaskCard, TaskCardBody } from "./task-card"
import { DRAG_OVERLAY_CLASS, hapticTick, TaskDragProvider, useDragHover, useTaskSensors } from "./task-dnd"
import type { ViewProps } from "./types"

export type GroupBy = "lista" | "prazo"

const STORAGE_KEY = "organizzou:tarefas-groups"
const FOLDED_BY_DEFAULT = new Set(["concluidas"])

function readFolded(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

/**
 * Collapsing = the body shrinks to height 0 (0.4 s, instant under reduced motion) and is hidden afterwards, leaving the header only:
 * a collapsed group has no padding, margin, border or min-height of its own (the spacing between groups lives on the section).
 */
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      inert={!open}
      data-collapse={open ? "open" : "closed"}
      className={cn("grid transition-[grid-template-rows,visibility] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none", open ? "grid-rows-[1fr]" : "invisible grid-rows-[0fr]")}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}

/** Phones: 8px under a collapsed group, 16px under an expanded one (none after the last). Desktop keeps the container gap. */
const groupSpacing = (mobile: boolean, open: boolean) => (mobile ? cn("flex flex-col last:mb-0", open ? "mb-4" : "mb-2") : "flex flex-col gap-1")

function Row({ task, props, mobile }: { task: TaskView; props: ViewProps; mobile: boolean }) {
  return (
    <TaskCardBody
      density={mobile ? "card" : "row"}
      anchor
      task={task}
      tags={props.tags}
      now={props.now}
      timeZone={props.timeZone}
      actions={props.actionsFor(task)}
      selecting={props.selection.active}
      selected={props.selection.ids.has(task.id)}
      onSelect={() => props.selection.toggle(task.id)}
    />
  )
}

function Chevron({ open }: { open: boolean }) {
  return <ChevronDownIcon aria-hidden strokeWidth={1.75} className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-[400ms] motion-reduce:transition-none", !open && "-rotate-90")} />
}

const countPill = "tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[12px] leading-4 font-medium"
const overline = "text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase"

/** One group per list of the quadro: the same lists, order and collapsed state as the Kanban. */
export function ListGroup({ list, index, total, tasks, props, mobile, dragEnabled, onAddTask, dueMode, highlightId }: {
  highlightId?: string | null
  list: ListRow; index: number; total: number; tasks: TaskView[]; props: ViewProps; mobile: boolean; dragEnabled: boolean; /** Where "+" and the dashed pill create the task themselves (the calendar prefills the day) instead of the inline composer. */ onAddTask?: (list: ListRow) => void; dueMode?: "full" | "time" }) {
  const [editing, setEditing] = useState(false)
  const [signal, setSignal] = useState(0)
  const open = !props.collapsed(list)
  const { setNodeRef } = useDroppable({ id: list.id, data: { type: "list" } })
  const sortable = (task: TaskView) => (
    <SortableTaskCard
      key={task.id}
      listId={list.id}
      disabled={!dragEnabled || props.selection.active}
      density={mobile ? "card" : "row"}
      dueMode={dueMode}
      highlight={highlightId === task.id}
      task={task}
      tags={props.tags}
      now={props.now}
      timeZone={props.timeZone}
      actions={props.actionsFor(task)}
      selecting={props.selection.active}
      selected={props.selection.ids.has(task.id)}
      onSelect={() => props.selection.toggle(task.id)}
    />
  )
  const ids = tasks.map((t) => t.id)
  return (
    <section ref={setNodeRef} data-group={list.id} data-drop-group={list.id} aria-label={list.name} className={groupSpacing(mobile, open)}>
      <div data-group-header className="-ml-2 flex h-11 items-center gap-1 pl-1">
        <button type="button" aria-expanded={open} aria-label={`${open ? "Recolher" : "Expandir"} ${list.name}`} onClick={() => props.onToggleCollapse(list)} className={cn("flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50", cardHover)}>
          <Chevron open={open} />
        </button>
        <ListName list={list} actions={props} editing={editing} onEditingChange={setEditing} className="min-w-0" />
        <span className={countPill}>{tasks.length}</span>
        <Button variant="ghost" size="icon" aria-label={`Adicionar tarefa em ${list.name}`} className="size-11 rounded-full md:size-9" onClick={() => (onAddTask ? onAddTask(list) : open ? setSignal((n) => n + 1) : props.onToggleCollapse(list))}>
          <PlusIcon strokeWidth={1.75} />
        </Button>
        <ListMenu list={list} index={index} total={total} count={tasks.length} actions={props} onRename={() => setEditing(true)} />
      </div>
      <Collapse open={open}>
        {mobile ? (
          // Phones: a transparent container, separate cards (same card as the Kanban) and a dashed composer pill.
          <div className="flex flex-col gap-2 pt-1">
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {tasks.map(sortable)}
            </SortableContext>
            {tasks.length === 0 ? <p className="px-2 py-2 text-[13px] leading-5 text-muted-foreground">Nada em {list.name}.</p> : null}
            {onAddTask ? (
              <Button type="button" variant="outline" data-testid="group-add-pill" className="h-11 w-full justify-start border-dashed text-muted-foreground" onClick={() => onAddTask(list)}>
                <PlusIcon strokeWidth={1.75} /> Adicionar tarefa…
              </Button>
            ) : (
              <QuickAdd label="Adicionar tarefa…" onAdd={(title) => props.onQuickAdd(list.id, title)} openSignal={signal} className="h-11 rounded-full border border-dashed border-border" />
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-[16px] border border-border bg-card">
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {tasks.map(sortable)}
            </SortableContext>
            {tasks.length === 0 ? <p className="px-4 py-4 text-[13px] leading-5 text-muted-foreground">Nada em {list.name}.</p> : null}
            <div className="border-t border-border p-1.5">
              <QuickAdd onAdd={(title) => props.onQuickAdd(list.id, title)} openSignal={signal} />
            </div>
          </div>
        )}
      </Collapse>
    </section>
  )
}

/**
 * Lista. Default grouping = the quadro's lists (same as the Kanban, collapse/reorder/rename shared); "Agrupar por" can switch to
 * Prazo (Atrasadas, Hoje, Amanhã…). Headers: chevron, name, count, "+" and the ⋯ menu for lists.
 */
export function ListView(props: ViewProps & { groupBy: GroupBy; isMobile?: boolean; dragEnabled?: boolean; onMoveTasks?: (listId: string, taskIds: string[]) => void }) {
  const mobile = Boolean(props.isMobile)
  const dragEnabled = Boolean(props.dragEnabled && props.onMoveTasks && props.groupBy === "lista")
  const sensors = useTaskSensors()
  const [override, setOverride] = useState<Record<string, string[]> | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const taskById = useMemo(() => new Map(props.tasks.map((t) => [t.id, t])), [props.tasks])
  const base = useMemo(() => {
    const map: Record<string, string[]> = Object.fromEntries(props.lists.map((l) => [l.id, [] as string[]]))
    for (const task of props.tasks) map[task.list_id]?.push(task.id)
    return map
  }, [props.lists, props.tasks])
  const columns = override ?? base
  // A collapsed group opens after ~500 ms under the dragged card, so it can be dropped inside.
  const hoverRef = useDragHover(activeId !== null, (hover) => {
    const list = hover.kind === "group" ? props.lists.find((l) => l.id === hover.id) : undefined
    if (list && props.collapsed(list)) props.onToggleCollapse(list)
  })
  const containerOf = (id: string, cols: Record<string, string[]>) => (id in cols ? id : Object.keys(cols).find((key) => cols[key].includes(id)))
  const titleOf = (id: unknown) => taskById.get(String(id))?.title ?? ""
  const listNameOf = (id: string | undefined) => props.lists.find((l) => l.id === id)?.name ?? "outra posição"

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const cols = override ?? base
    const activeKey = String(active.id)
    const overKey = String(over.id)
    const from = containerOf(activeKey, cols)
    const to = containerOf(overKey, cols)
    if (!from || !to || from === to) return
    const overIndex = cols[to].indexOf(overKey)
    const below = active.rect.current.translated && active.rect.current.translated.top > over.rect.top + over.rect.height
    const index = overKey in cols ? cols[to].length : overIndex >= 0 ? overIndex + (below ? 1 : 0) : cols[to].length
    setOverride({ ...cols, [from]: cols[from].filter((id) => id !== activeKey), [to]: [...cols[to].slice(0, index), activeKey, ...cols[to].slice(index)] })
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    const cols = override ?? base
    const activeKey = String(active.id)
    const container = containerOf(activeKey, cols)
    if (!container || !over) return setOverride(null)
    let ids = cols[container]
    if (containerOf(String(over.id), cols) === container) {
      const oldIndex = ids.indexOf(activeKey)
      const newIndex = String(over.id) in cols ? ids.length - 1 : ids.indexOf(String(over.id))
      if (newIndex >= 0 && oldIndex !== newIndex) ids = arrayMove(ids, oldIndex, newIndex)
    }
    const unchanged = taskById.get(activeKey)?.list_id === container && base[container].join() === ids.join()
    if (!unchanged) props.onMoveTasks?.(container, ids)
    setOverride(null)
  }
  void hoverRef
  const [folded, setFolded] = useState<Record<string, boolean>>({})
  useEffect(() => {
    // localStorage only exists in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFolded(readFolded())
  }, [])
  const isFolded = (id: string) => folded[id] ?? FOLDED_BY_DEFAULT.has(id)
  function toggle(id: string) {
    const next = { ...folded, [id]: !isFolded(id) }
    setFolded(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Private mode: the choice just does not survive the visit.
    }
  }

  const byList = props.groupBy === "lista"
  const groups =
    props.groupBy === "prazo"
      ? groupByDue(props.tasks, { now: props.now, timeZone: props.timeZone }).map((g) => ({ id: g.id as string, label: g.label, tasks: g.tasks }))
        : []

  const activeTask = activeId ? taskById.get(activeId) : undefined
  const content = (
    <div className={cn("flex flex-col", !mobile && "gap-4")}>
      {byList && props.lists.length === 0 ? (
        <EmptyState
          icon={SquareCheckIcon}
          title="Nenhuma lista por aqui"
          description="Crie a primeira lista deste quadro."
          action={
            <Button type="button" className="h-11 rounded-full px-5" onClick={() => void props.onAddList("A fazer")}>
              <PlusIcon strokeWidth={1.75} /> Criar lista
            </Button>
          }
        />
      ) : null}
      {byList
        ? props.lists.map((list, i) => <ListGroup key={list.id} list={list} index={i} total={props.lists.length} tasks={(columns[list.id] ?? []).map((id) => taskById.get(id)).filter((t): t is TaskView => Boolean(t))} props={props} mobile={mobile} dragEnabled={dragEnabled} />)
        : groups.map((group) => {
            const open = !isFolded(group.id)
            return (
              <section key={group.id} data-group={group.id} aria-label={group.label} className={groupSpacing(mobile, open)}>
                <button type="button" data-group-header aria-expanded={open} onClick={() => toggle(group.id)} className={cn("-ml-2 flex h-11 w-full items-center gap-2 rounded-full px-2 text-left", cardHover)}>
                  <Chevron open={open} />
                  <h3 className={overline}>{group.label}</h3>
                  <span className={countPill}>{group.tasks.length}</span>
                </button>
                <Collapse open={open}>
                  {mobile ? (
                    <div className="flex flex-col gap-2 pt-1">
                      {group.tasks.map((task) => (
                        <Row key={task.id} task={task} props={props} mobile />
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-[16px] border border-border bg-card">
                      {group.tasks.map((task) => (
                        <Row key={task.id} task={task} props={props} mobile={false} />
                      ))}
                    </div>
                  )}
                </Collapse>
              </section>
            )
          })}
      {!byList && groups.length === 0 ? <EmptyState icon={SquareCheckIcon} title="Nenhuma tarefa por aqui" description="Adicione a primeira tarefa." /> : null}
    </div>
  )

  return (
    <TaskDragProvider value={activeId !== null}>
      <DndContext
        id="lista-dnd"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={({ active }) => (setActiveId(String(active.id)), hapticTick())}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => (setActiveId(null), setOverride(null))}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `Tarefa ${titleOf(active.id)} pega.`,
            onDragOver: ({ active, over }) => (over ? `Tarefa ${titleOf(active.id)} sobre ${listNameOf(containerOf(String(over.id), override ?? base))}.` : undefined),
            onDragEnd: ({ active }) => `Tarefa ${titleOf(active.id)} solta em ${listNameOf(containerOf(String(active.id), override ?? base))}.`,
            onDragCancel: () => "Movimento cancelado.",
          },
          screenReaderInstructions: { draggable: "Para mover, aperte espaço, use as setas para escolher o lugar e aperte espaço de novo. Esc cancela. Também dá para usar Mover para… no menu." },
        }}
      >
        {content}
        <DragOverlay>{activeTask ? <TaskCardBody inert density={mobile ? "card" : "row"} task={activeTask} tags={props.tags} now={props.now} timeZone={props.timeZone} actions={props.actionsFor(activeTask)} className={cn(DRAG_OVERLAY_CLASS, !mobile && "rounded-[14px] border border-border bg-card")} /> : null}</DragOverlay>
      </DndContext>
    </TaskDragProvider>
  )
}
