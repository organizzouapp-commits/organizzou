"use client"

import { useMemo, useRef, useState } from "react"
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { ArrowLeftIcon, ArrowRightIcon, ChevronDownIcon, CircleCheckIcon, EllipsisIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { PromptDialog } from "@/components/organizzou/PromptDialog"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"
import type { ListRow, TaskView } from "@/features/tasks/types"

import { QuickAdd } from "./quick-add"
import { SortableTaskCard, TaskCardBody } from "./task-card"
import type { ViewProps } from "./types"

type KanbanViewProps = ViewProps & {
  /** Drag and drop only makes sense in manual order without filters. */
  dragEnabled: boolean
  /** Phones show one column at a time (status tabs, swipe between them). */
  isMobile: boolean
  onMoveTasks: (listId: string, taskIds: string[]) => void
  onAddList: (name: string) => Promise<void>
  onRenameList: (list: ListRow, name: string) => Promise<void>
  onToggleDoneList: (list: ListRow) => void
  onMoveList: (list: ListRow, direction: -1 | 1) => void
  onDeleteList: (list: ListRow) => void
  onClearDone: (list: ListRow) => void
}

const EASE = "ease-[cubic-bezier(0.2,0.8,0.2,1)]"
const MOBILE_VISIBLE = 5

function ColumnMenu({ list, index, total, count, props, onRename }: { list: ListRow; index: number; total: number; count: number; props: KanbanViewProps; onRename: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Opções da lista ${list.name}`} className="size-9 rounded-full">
          <EllipsisIcon strokeWidth={1.75} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56 rounded-2xl p-2">
        <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={onRename}>
          <PencilIcon strokeWidth={1.75} /> Renomear
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={() => props.onToggleDoneList(list)}>
          <CircleCheckIcon strokeWidth={1.75} />
          {list.is_done_list ? "Não é lista de concluídas" : "Tarefas aqui contam como concluídas"}
        </DropdownMenuItem>
        {list.is_done_list ? (
          <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" disabled={count === 0} onSelect={() => props.onClearDone(list)}>
            <Trash2Icon strokeWidth={1.75} /> Limpar concluídas
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" disabled={index === 0} onSelect={() => props.onMoveList(list, -1)}>
          <ArrowLeftIcon strokeWidth={1.75} /> Mover para a esquerda
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" disabled={index === total - 1} onSelect={() => props.onMoveList(list, 1)}>
          <ArrowRightIcon strokeWidth={1.75} /> Mover para a direita
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={() => props.onDeleteList(list)}>
          <Trash2Icon strokeWidth={1.75} /> Excluir lista
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Column({ list, index, total, ids, taskById, props, wide }: { list: ListRow; index: number; total: number; ids: string[]; taskById: Map<string, TaskView>; props: KanbanViewProps; wide: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: list.id, data: { type: "list" } })
  const [renaming, setRenaming] = useState(false)
  const [signal, setSignal] = useState(0)
  const [showAll, setShowAll] = useState(false)
  // "Concluído" is a normal column from 1280 px; below that it folds into a 56 px rail the person can expand.
  const [expandedByUser, setExpandedByUser] = useState<boolean | null>(null)
  const collapsed = list.is_done_list && !props.isMobile && (expandedByUser === null ? !wide : !expandedByUser)

  if (collapsed) {
    return (
      <section ref={setNodeRef} aria-label={list.name} className={cn("sticky top-2 flex w-14 flex-col items-center gap-3 self-start rounded-[16px] border border-border bg-card py-3", isOver && "bg-muted")}>
        <button type="button" aria-expanded={false} aria-label={`Mostrar ${list.name}, ${ids.length} tarefas`} onClick={() => setExpandedByUser(true)} className="flex min-h-11 flex-col items-center gap-2 rounded-xl px-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="tabular rounded-full bg-muted px-2 text-[13px] leading-5">{ids.length}</span>
          <span className="text-[15px] leading-6 font-semibold [text-orientation:mixed] [writing-mode:vertical-rl]">{list.name}</span>
        </button>
      </section>
    )
  }

  const hidden = props.isMobile ? Math.max(0, ids.length - MOBILE_VISIBLE) : 0
  return (
    <section data-column={list.id} aria-label={list.name} className="flex min-w-0 flex-col gap-2 rounded-[16px] border border-border bg-card p-2 md:p-3">
      {/* The header sticks to the top of the page scroll (no inner scroll in the column). */}
      <header className="sticky top-0 z-10 -mx-2 -mt-2 flex min-h-12 items-center gap-1 rounded-t-[16px] bg-card px-4 md:-mx-3 md:-mt-3 md:px-5">
        {list.is_done_list && wide ? (
          <Button variant="ghost" size="icon" aria-expanded aria-label={`Recolher ${list.name}`} onClick={() => setExpandedByUser(false)} className="-ml-2 size-9 rounded-full max-[1279px]:inline-flex min-[1280px]:hidden">
            <ChevronDownIcon strokeWidth={1.75} />
          </Button>
        ) : null}
        <h3 className="min-w-0 flex-1 truncate text-[15px] leading-6 font-semibold">{list.name}</h3>
        <span className="tabular rounded-full bg-muted px-2 text-[13px] leading-5">{ids.length}</span>
        <Button variant="ghost" size="icon" aria-label={`Adicionar tarefa em ${list.name}`} className="size-9 rounded-full" onClick={() => (props.isMobile ? props.onCreate(list.id) : setSignal((n) => n + 1))}>
          <PlusIcon strokeWidth={1.75} />
        </Button>
        <ColumnMenu list={list} index={index} total={total} count={ids.length} props={props} onRename={() => setRenaming(true)} />
        <PromptDialog open={renaming} onOpenChange={setRenaming} title="Renomear lista" label="Nome da lista" initialValue={list.name} onSubmit={(name) => props.onRenameList(list, name)} />
      </header>

      <div ref={setNodeRef} className={cn("flex min-h-16 flex-col gap-2 rounded-[14px] transition-colors duration-200", isOver && "bg-muted")}>
        {props.isMobile ? (
          <button type="button" onClick={() => props.onCreate(list.id)} className="flex min-h-11 items-center gap-2 rounded-[14px] border border-dashed border-border px-3 text-[15px] text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <PlusIcon aria-hidden strokeWidth={1.75} className="size-4" /> Adicionar tarefa…
          </button>
        ) : null}
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.slice(0, props.isMobile && !showAll ? MOBILE_VISIBLE : undefined).map((id) => {
            const task = taskById.get(id)
            if (!task) return null
            return (
              <SortableTaskCard
                key={id}
                listId={list.id}
                disabled={!props.dragEnabled || props.isMobile}
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
        {props.isMobile && hidden > 0 && !showAll ? (
          <Button variant="ghost" className="h-11 rounded-full" onClick={() => setShowAll(true)}>
            Ver mais {hidden} {hidden === 1 ? "tarefa" : "tarefas"}
          </Button>
        ) : null}
      </div>
      {props.isMobile ? null : <QuickAdd onAdd={(title) => props.onQuickAdd(list.id, title)} openSignal={signal} className="mt-1" />}
    </section>
  )

}

export function KanbanView(props: KanbanViewProps) {
  const { lists, tasks } = props
  const [override, setOverride] = useState<Record<string, string[]> | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [mobileList, setMobileList] = useState<string | null>(null)
  const wide = useMediaQuery("(min-width: 1280px)")
  const scroller = useRef<HTMLDivElement>(null)

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const base = useMemo(() => {
    const map: Record<string, string[]> = Object.fromEntries(lists.map((l) => [l.id, [] as string[]]))
    for (const task of [...tasks].sort((a, b) => a.position - b.position)) map[task.list_id]?.push(task.id)
    return map
  }, [lists, tasks])
  const columns = override ?? base
  const currentMobile = lists.find((l) => l.id === mobileList)?.id ?? lists[0]?.id

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function containerOf(id: string, cols: Record<string, string[]>) {
    if (id in cols) return id
    return Object.keys(cols).find((key) => cols[key].includes(id))
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

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

    setOverride({
      ...cols,
      [from]: cols[from].filter((id) => id !== activeKey),
      [to]: [...cols[to].slice(0, index), activeKey, ...cols[to].slice(index)],
    })
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const cols = override ?? base
    const activeKey = String(active.id)
    const container = containerOf(activeKey, cols)
    setActiveId(null)

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

  const activeTask = activeId ? taskById.get(activeId) : undefined

  // Phones: the tabs follow the swipe (scroll-snap) and a tap scrolls to the column.
  function onScroll() {
    const el = scroller.current
    if (!el) return
    const index = Math.round(el.scrollLeft / (el.clientWidth + 12))
    const id = lists[index]?.id
    if (id && id !== currentMobile) setMobileList(id)
  }
  function selectTab(id: string) {
    setMobileList(id)
    const el = scroller.current
    const index = lists.findIndex((l) => l.id === id)
    if (el && index >= 0) el.scrollTo({ left: index * (el.clientWidth + 12), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
  }

  return (
    <div className="flex flex-col gap-3">
      {props.isMobile ? (
        <div role="tablist" aria-label="Status das tarefas" className="no-scrollbar flex h-12 gap-1 overflow-x-auto rounded-full bg-muted p-1">
          {lists.map((list) => {
            const active = list.id === currentMobile
            return (
              <button
                key={list.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(list.id)}
                className={cn(
                  "flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[14px] whitespace-nowrap outline-none transition-colors duration-[400ms] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                  EASE,
                  active ? "bg-highlight font-semibold text-highlight-foreground" : "text-muted-foreground"
                )}
              >
                {list.name}
                <span className="tabular">{columns[list.id]?.length ?? 0}</span>
              </button>
            )
          })}
        </div>
      ) : null}
      {!props.dragEnabled && !props.isMobile ? <p className="text-[13px] leading-5 text-muted-foreground">Para arrastar tarefas, volte à ordem manual e limpe os filtros.</p> : null}
      <DndContext
        id="kanban-dnd"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        accessibility={{ announcements: ANNOUNCEMENTS, screenReaderInstructions: { draggable: "Para mover a tarefa, aperte espaço, use as setas para escolher o lugar e aperte espaço de novo. Esc cancela. Também dá para usar Mover para… no menu da tarefa." } }}
        onDragCancel={() => {
          setActiveId(null)
          setOverride(null)
        }}
      >
        {props.isMobile ? (
          <div ref={scroller} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto">
            {lists.map((list, i) => (
              <div key={list.id} className="w-full shrink-0 snap-start">
                <Column list={list} index={i} total={lists.length} ids={columns[list.id] ?? []} taskById={taskById} props={props} wide={false} />
              </div>
            ))}
          </div>
        ) : (
          // Columns are 300-380 px, left aligned, and wrap to a new row instead of scrolling sideways (the page has ONE scroll).
          <div className="grid items-start justify-start gap-4 pb-2 [grid-template-columns:repeat(auto-fill,minmax(300px,380px))]">
            {lists.map((list, i) => (
              <Column key={list.id} list={list} index={i} total={lists.length} ids={columns[list.id] ?? []} taskById={taskById} props={props} wide={wide} />
            ))}
          </div>
        )}
        <Button variant="outline" className="h-11 self-start rounded-full" onClick={() => setAdding(true)}>
          <PlusIcon strokeWidth={1.75} /> Nova lista
        </Button>
        <DragOverlay>{activeTask ? <TaskCardBody inert task={activeTask} tags={props.tags} now={props.now} timeZone={props.timeZone} actions={props.actionsFor(activeTask)} className="-translate-y-0.5 rotate-1" /> : null}</DragOverlay>
      </DndContext>
      <PromptDialog open={adding} onOpenChange={setAdding} title="Nova lista" label="Nome da lista" submitLabel="Criar lista" onSubmit={props.onAddList} />
    </div>
  )
}

/** Screen-reader announcements for keyboard and pointer dragging, in pt-BR. */
const ANNOUNCEMENTS = {
  onDragStart: () => "Tarefa pega.",
  onDragOver: () => "Tarefa sobre outra posição.",
  onDragEnd: () => "Tarefa solta.",
  onDragCancel: () => "Movimento cancelado.",
}
