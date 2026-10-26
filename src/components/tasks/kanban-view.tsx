"use client"

import { useMemo, useState } from "react"
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
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CircleCheckIcon,
  EllipsisIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import { PromptDialog } from "@/components/organizzou/PromptDialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { ListRow, TaskView } from "@/features/tasks/types"

import { QuickAdd } from "./quick-add"
import { SortableTaskCard, TaskCardBody } from "./task-card"
import type { ViewProps } from "./types"

type KanbanViewProps = ViewProps & {
  /** Drag and drop only makes sense in manual order without filters. */
  dragEnabled: boolean
  onMoveTasks: (listId: string, taskIds: string[]) => void
  onAddList: (name: string) => Promise<void>
  onRenameList: (list: ListRow, name: string) => Promise<void>
  onToggleDoneList: (list: ListRow) => void
  onMoveList: (list: ListRow, direction: -1 | 1) => void
  onDeleteList: (list: ListRow) => void
}

function Column({
  list,
  index,
  total,
  ids,
  taskById,
  props,
}: {
  list: ListRow
  index: number
  total: number
  ids: string[]
  taskById: Map<string, TaskView>
  props: KanbanViewProps
}) {
  const { setNodeRef, isOver } = useDroppable({ id: list.id, data: { type: "list" } })
  const [renaming, setRenaming] = useState(false)

  return (
    <section
      aria-label={list.name}
      className="flex w-[85vw] max-w-80 shrink-0 snap-center flex-col gap-3 md:w-72 md:snap-align-none"
    >
      <header className="flex items-center gap-2 px-1">
        <h3 className="min-w-0 flex-1 truncate text-[17px] leading-6 font-semibold">{list.name}</h3>
        {list.is_done_list ? (
          <span title="Lista de concluídas" className="text-muted-foreground">
            <CircleCheckIcon aria-hidden strokeWidth={1.75} className="size-4" />
            <span className="sr-only">Lista de concluídas</span>
          </span>
        ) : null}
        <span className="tabular text-[13px] leading-5 text-muted-foreground">{ids.length}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Opções da lista ${list.name}`}>
              <EllipsisIcon strokeWidth={1.75} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setRenaming(true)}>
              <PencilIcon strokeWidth={1.75} /> Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => props.onToggleDoneList(list)}>
              <CircleCheckIcon strokeWidth={1.75} />
              {list.is_done_list ? "Não é lista de concluídas" : "Tarefas aqui contam como concluídas"}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index === 0} onSelect={() => props.onMoveList(list, -1)}>
              <ArrowLeftIcon strokeWidth={1.75} /> Mover para a esquerda
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index === total - 1} onSelect={() => props.onMoveList(list, 1)}>
              <ArrowRightIcon strokeWidth={1.75} /> Mover para a direita
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => props.onDeleteList(list)}>
              <Trash2Icon strokeWidth={1.75} /> Excluir lista
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <PromptDialog
          open={renaming}
          onOpenChange={setRenaming}
          title="Renomear lista"
          label="Nome da lista"
          initialValue={list.name}
          onSubmit={(name) => props.onRenameList(list, name)}
        />
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-col gap-2 rounded-2xl p-1 transition-colors duration-200",
          isOver && "bg-muted"
        )}
      >
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
                onOpen={() => props.onOpenTask(id)}
                onToggleComplete={() => props.onToggleComplete(task)}
              />
            )
          })}
        </SortableContext>
        <QuickAdd onAdd={(title) => props.onQuickAdd(list.id, title)} />
      </div>
    </section>
  )
}

export function KanbanView(props: KanbanViewProps) {
  const { lists, tasks } = props
  const [override, setOverride] = useState<Record<string, string[]> | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const base = useMemo(() => {
    const map: Record<string, string[]> = Object.fromEntries(lists.map((l) => [l.id, [] as string[]]))
    for (const task of [...tasks].sort((a, b) => a.position - b.position)) map[task.list_id]?.push(task.id)
    return map
  }, [lists, tasks])
  const columns = override ?? base

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Touch needs a short press so horizontal/vertical scrolling still works.
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
    const below =
      active.rect.current.translated && active.rect.current.translated.top > over.rect.top + over.rect.height
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
    const unchanged =
      original?.list_id === container && base[container].join() === ids.join()
    if (!unchanged) props.onMoveTasks(container, ids)
    setOverride(null)
  }

  const activeTask = activeId ? taskById.get(activeId) : undefined

  return (
    <div className="flex flex-col gap-3">
      {!props.dragEnabled ? (
        <p className="text-[13px] leading-5 text-muted-foreground">
          Para arrastar tarefas, volte à ordem manual e limpe os filtros.
        </p>
      ) : null}
      <DndContext
        id="kanban-dnd"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null)
          setOverride(null)
        }}
      >
        <div className="relative -mx-4 flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:snap-none md:px-0">
          {lists.map((list, index) => (
            <Column
              key={list.id}
              list={list}
              index={index}
              total={lists.length}
              ids={columns[list.id] ?? []}
              taskById={taskById}
              props={props}
            />
          ))}
          <div className="w-[85vw] max-w-80 shrink-0 snap-center md:w-72 md:snap-align-none">
            <Button variant="outline" className="w-full justify-start" onClick={() => setAdding(true)}>
              <PlusIcon strokeWidth={1.75} /> Nova lista
            </Button>
          </div>
        </div>
        <DragOverlay>
          {activeTask ? (
            <TaskCardBody
              task={activeTask}
              tags={props.tags}
              now={props.now}
              timeZone={props.timeZone}
              onOpen={() => {}}
              onToggleComplete={() => {}}
              className="-translate-y-0.5 rotate-1"
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      <PromptDialog
        open={adding}
        onOpenChange={setAdding}
        title="Nova lista"
        label="Nome da lista"
        submitLabel="Criar lista"
        onSubmit={props.onAddList}
      />
    </div>
  )
}
