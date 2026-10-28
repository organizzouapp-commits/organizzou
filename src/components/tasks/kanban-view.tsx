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
  ChevronDownIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  EllipsisIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import { bentoCardClass } from "@/components/organizzou/Bento"
import { PromptDialog } from "@/components/organizzou/PromptDialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { ListRow, TaskView } from "@/features/tasks/types"

import { QuickAdd } from "./quick-add"
import { SortableTaskCard, TaskCardBody } from "./task-card"
import type { ViewProps } from "./types"

type KanbanViewProps = ViewProps & {
  /** Drag and drop only makes sense in manual order without filters. */
  dragEnabled: boolean
  /** Phones show one column at a time, with the lists as tabs. */
  isMobile: boolean
  onMoveTasks: (listId: string, taskIds: string[]) => void
  onMoveTaskToList: (task: TaskView, listId: string) => void
  onAddList: (name: string) => Promise<void>
  onRenameList: (list: ListRow, name: string) => Promise<void>
  onToggleDoneList: (list: ListRow) => void
  onMoveList: (list: ListRow, direction: -1 | 1) => void
  onDeleteList: (list: ListRow) => void
  onClearDone: (list: ListRow) => void
}

function CardMenu({ task, props }: { task: TaskView; props: KanbanViewProps }) {
  const others = props.lists.filter((l) => l.id !== task.list_id)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${task.title}`} className="size-8 bg-card/80">
          <EllipsisIcon strokeWidth={1.75} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => props.onOpenTask(task.id)}>
          <PencilIcon strokeWidth={1.75} /> Editar
        </DropdownMenuItem>
        {others.length > 0 ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowRightIcon strokeWidth={1.75} /> Mover para
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {others.map((list) => (
                <DropdownMenuItem key={list.id} onSelect={() => props.onMoveTaskToList(task, list.id)}>
                  {list.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => props.onDeleteRequest(task)}>
          <Trash2Icon strokeWidth={1.75} /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
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
  // "Concluído" starts collapsed: it is history, not work. The header still accepts drops.
  const [collapsed, setCollapsed] = useState(list.is_done_list && !props.isMobile)

  const menu = (
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
        {list.is_done_list ? (
          <DropdownMenuItem disabled={ids.length === 0} onSelect={() => props.onClearDone(list)}>
            <Trash2Icon strokeWidth={1.75} /> Limpar concluídas
          </DropdownMenuItem>
        ) : null}
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
  )

  return (
    <section
      ref={collapsed ? setNodeRef : undefined}
      aria-label={list.name}
      className={cn(
        bentoCardClass(),
        "flex min-h-72 flex-col gap-3 p-4 md:max-h-[calc(100dvh-21rem)]",
        collapsed && "min-h-0 self-start",
        isOver && collapsed && "bg-muted"
      )}
    >
      <header className="flex shrink-0 items-center gap-2 px-1">
        {list.is_done_list ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Mostrar ${list.name}` : `Recolher ${list.name}`}
            onClick={() => setCollapsed((v) => !v)}
            className="-ml-1"
          >
            {collapsed ? <ChevronRightIcon strokeWidth={1.75} /> : <ChevronDownIcon strokeWidth={1.75} />}
          </Button>
        ) : null}
        <h3 className="min-w-0 flex-1 truncate text-[17px] leading-6 font-semibold">{list.name}</h3>
        <span className="tabular text-[13px] leading-5 text-muted-foreground">{ids.length}</span>
        {menu}
        <PromptDialog
          open={renaming}
          onOpenChange={setRenaming}
          title="Renomear lista"
          label="Nome da lista"
          initialValue={list.name}
          onSubmit={(name) => props.onRenameList(list, name)}
        />
      </header>

      {collapsed ? null : (
        <>
          <div
            ref={setNodeRef}
            className={cn("no-scrollbar flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-2xl p-1 transition-colors duration-200", isOver && "bg-muted")}
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
                    menu={<CardMenu task={task} props={props} />}
                    onOpen={() => props.onOpenTask(id)}
                    onToggleComplete={() => props.onToggleComplete(task)}
                  />
                )
              })}
            </SortableContext>
            {ids.length === 0 ? <p className="px-2 py-6 text-center text-[13px] leading-5 text-muted-foreground">Nada por aqui.</p> : null}
          </div>
          {/* Always visible: it does not scroll away with the cards. */}
          <div className="shrink-0">
            <QuickAdd onAdd={(title) => props.onQuickAdd(list.id, title)} />
          </div>
        </>
      )}
    </section>
  )
}

export function KanbanView(props: KanbanViewProps) {
  const { lists, tasks } = props
  const [override, setOverride] = useState<Record<string, string[]> | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [mobileList, setMobileList] = useState<string | null>(null)

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
  const visibleLists = props.isMobile ? lists.filter((l) => l.id === currentMobile) : lists

  return (
    <div className="flex flex-col gap-3">
      {props.isMobile ? (
        <Tabs value={currentMobile} onValueChange={setMobileList}>
          <TabsList aria-label="Listas do quadro">
            {lists.map((list) => (
              <TabsTrigger key={list.id} value={list.id}>
                {list.name} <span className="tabular text-muted-foreground">{columns[list.id]?.length ?? 0}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}
      {!props.dragEnabled && !props.isMobile ? (
        <p className="text-[13px] leading-5 text-muted-foreground">Para arrastar tarefas, volte à ordem manual e limpe os filtros.</p>
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
        {/* Fluid columns: at least 280 px, they share the row when there are few and the row scrolls sideways when there are many. */}
        <div
          className="relative grid items-start gap-4 pb-2 md:auto-cols-[minmax(280px,1fr)] md:grid-flow-col md:overflow-x-auto"
          style={props.isMobile ? undefined : { gridAutoColumns: "minmax(280px, 1fr)" }}
        >
          {visibleLists.map((list) => (
            <Column
              key={list.id}
              list={list}
              index={lists.indexOf(list)}
              total={lists.length}
              ids={columns[list.id] ?? []}
              taskById={taskById}
              props={props}
            />
          ))}
        </div>
        <Button variant="outline" className="self-start" onClick={() => setAdding(true)}>
          <PlusIcon strokeWidth={1.75} /> Nova lista
        </Button>
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
      <PromptDialog open={adding} onOpenChange={setAdding} title="Nova lista" label="Nome da lista" submitLabel="Criar lista" onSubmit={props.onAddList} />
    </div>
  )
}
