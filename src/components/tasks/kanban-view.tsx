"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  closestCenter,
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChevronDownIcon, GripVerticalIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ListRow, TaskView } from "@/features/tasks/types"

import { InlineInput } from "./inline-input"
import { ListMenu, ListName } from "./list-parts"
import { QuickAdd } from "./quick-add"
import { SortableTaskCard, TaskCardBody } from "./task-card"
import type { ViewProps } from "./types"

type KanbanViewProps = ViewProps & {
  /** Drag and drop only makes sense in manual order without filters. */
  dragEnabled: boolean
  /** Phones show one list at a time (tabs above, swipe between them) and the page scrolls normally. */
  isMobile: boolean
  onMoveTasks: (listId: string, taskIds: string[]) => void
  /** Phones: the list shown (the tabs live in the sticky header block). */
  activeListId: string | null
  onActiveListChange: (id: string) => void
}

const MOBILE_VISIBLE = 5
const LIST_PREFIX = "list:"
const sortableId = (id: string) => `${LIST_PREFIX}${id}`
const isListId = (id: unknown) => String(id).startsWith(LIST_PREFIX)

/** Desktop board: as tall as the space under the toolbar (at least 420 px) so every list scrolls inside itself. */
function useFillHeight(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    const fit = () => {
      const top = el.getBoundingClientRect().top + window.scrollY
      el.style.height = `${Math.max(420, Math.round(window.innerHeight - top - 24))}px`
    }
    fit()
    window.addEventListener("resize", fit)
    const observer = new ResizeObserver(fit)
    observer.observe(document.body)
    return () => {
      window.removeEventListener("resize", fit)
      observer.disconnect()
    }
  }, [ref, enabled])
}

const SCROLL = "overflow-y-auto overscroll-contain [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] scroll-py-2"

function Column({ list, index, total, ids, taskById, props }: { list: ListRow; index: number; total: number; ids: string[]; taskById: Map<string, TaskView>; props: KanbanViewProps }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: sortableId(list.id), data: { type: "list-sort" } })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: list.id, data: { type: "list" } })
  const [editing, setEditing] = useState(false)
  const [signal, setSignal] = useState(0)
  const collapsed = props.collapsed(list)
  const style = { transform: CSS.Translate.toString(transform), transition }

  if (collapsed) {
    return (
      <section ref={setNodeRef} style={style} data-column={list.id} data-collapsed aria-label={list.name} className={cn("flex h-full w-14 shrink-0 flex-col items-center rounded-[16px] border border-border bg-card py-3", isDragging && "opacity-60")}>
        <button type="button" aria-expanded={false} aria-label={`Expandir ${list.name}, ${ids.length} ${ids.length === 1 ? "tarefa" : "tarefas"}`} onClick={() => props.onToggleCollapse(list)} className="flex min-h-11 flex-col items-center gap-3 rounded-xl px-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <ChevronDownIcon aria-hidden strokeWidth={1.75} className="size-4 -rotate-90 text-muted-foreground" />
          <span className="tabular rounded-full bg-muted px-2 text-[13px] leading-5">{ids.length}</span>
          <span className="text-[15px] leading-6 font-semibold [text-orientation:mixed] [writing-mode:vertical-rl]">{list.name}</span>
        </button>
      </section>
    )
  }

  return (
    <section
      ref={setNodeRef}
      style={style}
      data-column={list.id}
      aria-label={list.name}
      className={cn("group/col flex h-full min-h-0 max-w-[520px] min-w-[300px] flex-1 basis-[300px] flex-col rounded-[16px] border border-border bg-card", isDragging && "z-10 opacity-60")}
    >
      <header {...listeners} className="flex h-14 shrink-0 cursor-grab items-center gap-1 px-3">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          aria-label={`Mover a lista ${list.name}`}
          title="Arraste para reordenar (Alt + setas)"
          onKeyDown={(e) => {
            if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
              e.preventDefault()
              e.stopPropagation()
              props.onMoveList(list, e.key === "ArrowLeft" ? -1 : 1)
            }
          }}
          className="-ml-1 flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none group-focus-within/col:opacity-100 group-hover/col:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <GripVerticalIcon aria-hidden strokeWidth={1.75} className="size-4" />
        </button>
        <Button variant="ghost" size="icon" aria-expanded aria-label={`Recolher ${list.name}`} onClick={() => props.onToggleCollapse(list)} className="size-8 rounded-full">
          <ChevronDownIcon strokeWidth={1.75} />
        </Button>
        <ListName list={list} actions={props} editing={editing} onEditingChange={setEditing} />
        <span className="tabular rounded-full bg-muted px-2 text-[13px] leading-5">{ids.length}</span>
        <Button variant="ghost" size="icon" aria-label={`Adicionar tarefa em ${list.name}`} className="size-9 rounded-full" onClick={() => setSignal((n) => n + 1)}>
          <PlusIcon strokeWidth={1.75} />
        </Button>
        <ListMenu list={list} index={index} total={total} count={ids.length} actions={props} onRename={() => setEditing(true)} />
      </header>

      <div ref={setDropRef} data-list-scroll className={cn("flex min-h-16 flex-1 flex-col gap-2 px-2 pb-2", SCROLL, "transition-colors duration-200", isOver && "bg-muted")}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id) => {
            const task = taskById.get(id)
            if (!task) return null
            return (
              <SortableTaskCard
                key={id}
                listId={list.id}
                disabled={!props.dragEnabled}
                task={task}
                tags={props.tags}
                now={props.now}
                timeZone={props.timeZone}
                actions={props.actionsFor(task)}
                selecting={props.selection.active}
                selected={props.selection.ids.has(id)}
                onSelect={() => props.selection.toggle(id)}
              />
            )
          })}
        </SortableContext>
        {ids.length === 0 ? <p className="px-2 py-6 text-center text-[13px] leading-5 text-muted-foreground">Nada em {list.name}.</p> : null}
      </div>
      <div className="shrink-0 border-t border-border p-2">
        <QuickAdd onAdd={(title) => props.onQuickAdd(list.id, title)} openSignal={signal} />
      </div>
    </section>
  )
}

/** "+ Nova lista": the last item of the board, as wide as a list; a click turns it into the name field. */
function NewListTile({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  return (
    <div data-new-list className="h-14 max-w-[520px] min-w-[300px] flex-1 basis-[300px] self-start rounded-[16px] border border-dashed border-border">
      {open ? (
        <div className="flex h-full items-center px-2">
          <InlineInput ariaLabel="Nome da nova lista" placeholder="Nome da lista" className="w-full items-center" onCommit={async (name) => void (await onAdd(name))} onClose={() => setOpen(false)} />
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="flex h-full w-full items-center gap-2 rounded-[16px] px-4 text-[15px] text-muted-foreground outline-none hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50">
          <PlusIcon aria-hidden strokeWidth={1.75} className="size-4" /> Nova lista
        </button>
      )}
    </div>
  )
}

function MobileColumn({ list, index, total, ids, taskById, props }: { list: ListRow; index: number; total: number; ids: string[]; taskById: Map<string, TaskView>; props: KanbanViewProps }) {
  const [showAll, setShowAll] = useState(false)
  const [editing, setEditing] = useState(false)
  const hidden = Math.max(0, ids.length - MOBILE_VISIBLE)
  return (
    <section data-column={list.id} aria-label={list.name} className="flex min-w-0 flex-col gap-2">
      <header className="flex min-h-11 items-center gap-1 px-1">
        <ListName list={list} actions={props} editing={editing} onEditingChange={setEditing} />
        <span className="tabular rounded-full bg-muted px-2 text-[13px] leading-5">{ids.length}</span>
        <Button variant="ghost" size="icon" aria-label={`Adicionar tarefa em ${list.name}`} className="size-11 rounded-full" onClick={() => props.onCreate(list.id)}>
          <PlusIcon strokeWidth={1.75} />
        </Button>
        <ListMenu list={list} index={index} total={total} count={ids.length} actions={props} onRename={() => setEditing(true)} />
      </header>
      <QuickAdd label="Adicionar tarefa…" onAdd={(title) => props.onQuickAdd(list.id, title)} className="h-11 rounded-[14px] border border-dashed border-border" />
      {ids.slice(0, showAll ? undefined : MOBILE_VISIBLE).map((id) => {
        const task = taskById.get(id)
        if (!task) return null
        return <TaskCardBody key={id} anchor task={task} tags={props.tags} now={props.now} timeZone={props.timeZone} actions={props.actionsFor(task)} selecting={props.selection.active} selected={props.selection.ids.has(id)} onSelect={() => props.selection.toggle(id)} />
      })}
      {ids.length === 0 ? <p className="px-2 py-6 text-center text-[13px] leading-5 text-muted-foreground">Nada em {list.name}.</p> : null}
      {hidden > 0 && !showAll ? (
        <Button variant="ghost" className="h-11 rounded-full" onClick={() => setShowAll(true)}>
          Ver mais {hidden} {hidden === 1 ? "tarefa" : "tarefas"}
        </Button>
      ) : null}
    </section>
  )
}

export function KanbanView(props: KanbanViewProps) {
  const { lists, tasks } = props
  const [override, setOverride] = useState<Record<string, string[]> | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const board = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  useFillHeight(board, !props.isMobile)

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const base = useMemo(() => {
    const map: Record<string, string[]> = Object.fromEntries(lists.map((l) => [l.id, [] as string[]]))
    for (const task of [...tasks].sort((a, b) => a.position - b.position)) map[task.list_id]?.push(task.id)
    return map
  }, [lists, tasks])
  const columns = override ?? base
  const currentMobile = lists.find((l) => l.id === props.activeListId)?.id ?? lists[0]?.id

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Lists only collide with lists; tasks only with tasks and the list bodies.
  const collision: CollisionDetection = (args) => {
    if (isListId(args.active.id)) return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => isListId(c.id)) })
    return closestCorners({ ...args, droppableContainers: args.droppableContainers.filter((c) => !isListId(c.id)) })
  }

  function containerOf(id: string, cols: Record<string, string[]>) {
    if (id in cols) return id
    return Object.keys(cols).find((key) => cols[key].includes(id))
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || isListId(active.id)) return
    const cols = override ?? base
    const activeKey = String(active.id)
    const overKey = String(over.id)
    const from = containerOf(activeKey, cols)
    const to = containerOf(overKey, cols)
    if (!from || !to || from === to) return

    const overIndex = cols[to].indexOf(overKey)
    const below = active.rect.current.translated && active.rect.current.translated.top > over.rect.top + over.rect.height
    const index = overKey in cols ? cols[to].length : overIndex >= 0 ? overIndex + (below ? 1 : 0) : cols[to].length

    setOverride({
      ...cols,
      [from]: cols[from].filter((id) => id !== activeKey),
      [to]: [...cols[to].slice(0, index), activeKey, ...cols[to].slice(index)],
    })
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (isListId(active.id)) {
      if (!over || !isListId(over.id) || active.id === over.id) return
      const ids = lists.map((l) => l.id)
      const from = ids.indexOf(String(active.id).slice(LIST_PREFIX.length))
      const to = ids.indexOf(String(over.id).slice(LIST_PREFIX.length))
      if (from >= 0 && to >= 0) props.onReorderLists(arrayMove(ids, from, to))
      return
    }
    const cols = override ?? base
    const activeKey = String(active.id)
    const container = containerOf(activeKey, cols)

    if (!container || !over) {
      setOverride(null)
      return
    }
    let ids = cols[container]
    const overContainer = containerOf(String(over.id), cols)
    if (overContainer === container) {
      const oldIndex = ids.indexOf(activeKey)
      const newIndex = String(over.id) in cols ? ids.length - 1 : ids.indexOf(String(over.id))
      if (newIndex >= 0 && oldIndex !== newIndex) ids = arrayMove(ids, oldIndex, newIndex)
    }

    const original = taskById.get(activeKey)
    const unchanged = original?.list_id === container && base[container].join() === ids.join()
    if (!unchanged) props.onMoveTasks(container, ids)
    setOverride(null)
  }

  const activeTask = activeId && !isListId(activeId) ? taskById.get(activeId) : undefined
  const activeList = activeId && isListId(activeId) ? lists.find((l) => l.id === activeId.slice(LIST_PREFIX.length)) : undefined

  // Phones: the tabs (in the sticky header) follow the swipe, and picking a tab scrolls to the list.
  const programmaticUntil = useRef(0)
  function onScroll() {
    const el = scroller.current
    // Ignore the scroll events of our own smooth scroll (picking a tab), they would flip the tab back.
    if (!el || Date.now() < programmaticUntil.current) return
    const index = Math.round(el.scrollLeft / (el.clientWidth + 12))
    const id = lists[index]?.id
    if (id && id !== currentMobile) props.onActiveListChange(id)
  }
  useEffect(() => {
    const el = scroller.current
    const index = lists.findIndex((l) => l.id === currentMobile)
    if (!el || index < 0) return
    const left = index * (el.clientWidth + 12)
    if (Math.abs(el.scrollLeft - left) > 4) programmaticUntil.current = Date.now() + 800
    if (Math.abs(el.scrollLeft - left) > 4) el.scrollTo({ left, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
  }, [currentMobile, lists])

  const listName = (id: unknown) => lists.find((l) => l.id === String(id).slice(LIST_PREFIX.length))?.name ?? "Lista"

  return (
    <DndContext
      id="kanban-dnd"
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => (isListId(active.id) ? `Lista ${listName(active.id)} pega.` : "Tarefa pega."),
          onDragOver: ({ active, over }) => (isListId(active.id) && over ? `Lista ${listName(active.id)} sobre a posição de ${listName(over.id)}.` : "Tarefa sobre outra posição."),
          onDragEnd: ({ active, over }) => (isListId(active.id) ? (over ? `Lista ${listName(active.id)} solta na posição de ${listName(over.id)}.` : `Lista ${listName(active.id)} solta.`) : "Tarefa solta."),
          onDragCancel: () => "Movimento cancelado.",
        },
        screenReaderInstructions: { draggable: "Para mover, aperte espaço, use as setas para escolher o lugar e aperte espaço de novo. Esc cancela. Também dá para usar Mover para… no menu." },
      }}
      onDragCancel={() => {
        setActiveId(null)
        setOverride(null)
      }}
    >
      {props.isMobile ? (
        <div ref={scroller} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto">
          {lists.map((list, i) => (
            <div key={list.id} className="w-full shrink-0 snap-start">
              <MobileColumn list={list} index={i} total={lists.length} ids={columns[list.id] ?? []} taskById={taskById} props={props} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {!props.dragEnabled ? <p className="text-[13px] leading-5 text-muted-foreground">Para arrastar tarefas, volte à ordem manual e limpe os filtros.</p> : null}
          <div ref={board} data-testid="kanban-board" className="flex gap-4 overflow-x-auto overflow-y-hidden pb-1 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
            <SortableContext items={lists.map((l) => sortableId(l.id))} strategy={horizontalListSortingStrategy}>
              {lists.map((list, i) => (
                <Column key={list.id} list={list} index={i} total={lists.length} ids={columns[list.id] ?? []} taskById={taskById} props={props} />
              ))}
            </SortableContext>
            <NewListTile onAdd={props.onAddList} />
          </div>
        </div>
      )}
      <DragOverlay>
        {activeTask ? <TaskCardBody inert task={activeTask} tags={props.tags} now={props.now} timeZone={props.timeZone} actions={props.actionsFor(activeTask)} className="-translate-y-0.5 rotate-1" /> : null}
        {activeList ? <div className="flex h-14 items-center rounded-[16px] border border-border bg-card px-4 text-[15px] font-semibold">{activeList.name}</div> : null}
      </DragOverlay>
    </DndContext>
  )
}
