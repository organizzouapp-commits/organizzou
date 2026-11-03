"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRightIcon, CalendarIcon, CheckIcon, SearchXIcon, Trash2Icon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { bentoCardClass } from "@/components/organizzou/Bento"
import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { EmptyState } from "@/components/organizzou/EmptyState"
import { PromptDialog } from "@/components/organizzou/PromptDialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { useIsMobile } from "@/hooks/use-mobile"
import type { BoardApi } from "@/features/tasks/board-api"
import {
  applyFilters,
  countActiveFilters,
  EMPTY_FILTERS,
  sortTasks,
  type SortKey,
  type TaskFilters,
} from "@/features/tasks/filters"
import { dueOfShortcut, shortcutCounts, type Shortcut } from "@/features/tasks/view"
import { asPriority, type BoardData, type ListRow, type Priority, type TagRow, type TaskView } from "@/features/tasks/types"
import { dayKey, toDueIso } from "@/lib/dates"

import { BoardToolbar, type ViewMode } from "./board-toolbar"
import { CalendarView } from "./calendar-view"
import { KanbanView } from "./kanban-view"
import { ListView } from "./list-view"
import { MoveDialog } from "./move-dialog"
import { NewTaskDialog, type NewTaskInput } from "./new-task-dialog"
import type { TaskActions } from "./task-card"
import { TaskDetail } from "./task-detail"

type BoardClientProps = {
  initial: BoardData
  /** Backend adapter: server actions in production, in-memory mock in the prototype. */
  api: BoardApi
  /** The view named in the URL (?view=), or null: then the device's last view, or the default for its size. */
  initialView: ViewMode | null
  /** Server time, so the server render and hydration agree on "today". */
  nowIso: string
  /** Where board links point, e.g. "/dashboard/tarefas". */
  basePath?: string
}

export function BoardClient({ initial, api, initialView, nowIso, basePath = "/dashboard/tarefas" }: BoardClientProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [now] = useState(() => new Date(nowIso))
  const [boardName, setBoardName] = useState(initial.board.name)
  const [boards, setBoards] = useState(initial.boards)
  const [lists, setLists] = useState<ListRow[]>(initial.lists)
  const [tasks, setTasks] = useState<TaskView[]>(initial.tasks)
  const tasksRef = useRef(tasks)
  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])
  const [tags, setTags] = useState<TagRow[]>(initial.tags)
  const [view, setView] = useState<ViewMode>(initialView ?? "kanban")
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortKey>("manual")
  const [openId, setOpenId] = useState<string | null>(null)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [newTaskList, setNewTaskList] = useState<string | undefined>(undefined)
  const [moveFor, setMoveFor] = useState<TaskView[] | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDelete, setBulkDelete] = useState(false)
  const [newBoardOpen, setNewBoardOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<TaskView | null>(null)
  const [listToDelete, setListToDelete] = useState<ListRow | null>(null)
  const [doneToClear, setDoneToClear] = useState<ListRow | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const hoveredTask = useRef<string | null>(null)

  // The view: the URL (?view=) wins, then this device class's last choice (localStorage), then Lista on phones and Kanban on desktop.
  // The shortcut chip (?atalho=) is read once as well.
  const [viewChecked, setViewChecked] = useState(false)
  if (!viewChecked && typeof window !== "undefined") {
    setViewChecked(true)
    const params = new URL(window.location.href).searchParams
    const fromUrl = params.get("view") ?? params.get("visao")
    const phone = window.matchMedia("(max-width: 767px)").matches
    const device = phone ? "mobile" : "desktop"
    let stored: string | null = null
    try {
      stored = window.localStorage.getItem(`organizzou:tarefas-view:${device}`)
    } catch {
      stored = null
    }
    const pick = (value: string | null): ViewMode | null => (value === "kanban" || value === "lista" || value === "calendario" ? value : null)
    setView(pick(fromUrl) ?? pick(stored) ?? (phone ? "lista" : "kanban"))
    const atalho = params.get("atalho")
    if (atalho) setFilters((f) => ({ ...f, due: dueOfShortcut(atalho) }))
  }

  const timeZone = initial.timezone
  const boardId = initial.board.id
  const filtering = countActiveFilters(filters) > 0 || filters.query.trim() !== ""
  const visible = useMemo(
    () => sortTasks(applyFilters(tasks, filters, { now, timeZone }), sort),
    [tasks, filters, sort, now, timeZone]
  )
  const openTask = tasks.find((t) => t.id === openId) ?? null

  // The open task lives in the URL (?tarefa=<id>): opening pushes a history entry so Back closes it, a reload or a shared link opens
  // the same task over the same board, and the board behind never moves.
  function openTaskById(id: string | null) {
    setOpenId(id)
    const url = new URL(window.location.href)
    if (id) {
      if (url.searchParams.get("tarefa") === id) return
      url.searchParams.set("tarefa", id)
      window.history.pushState({ tarefa: id }, "", url)
    } else if (url.searchParams.has("tarefa")) {
      url.searchParams.delete("tarefa")
      window.history.pushState({}, "", url)
    }
  }
  useEffect(() => {
    const fromUrl = new URL(window.location.href).searchParams.get("tarefa")
    // The URL is only readable in the browser: a direct load or a reload opens that task.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fromUrl && /^[0-9a-f-]{36}$/i.test(fromUrl)) setOpenId(fromUrl)
    const onPop = () => setOpenId(new URL(window.location.href).searchParams.get("tarefa"))
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])
  const counts = useMemo(() => shortcutCounts(tasks, { now, timeZone }), [tasks, now, timeZone])

  function changeView(next: ViewMode) {
    setView(next)
    const url = new URL(window.location.href)
    url.searchParams.set("view", next)
    url.searchParams.delete("visao")
    window.history.replaceState(null, "", url)
    try {
      window.localStorage.setItem(`organizzou:tarefas-view:${window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop"}`, next)
    } catch {
      // Private mode: the choice just does not survive the visit.
    }
  }

  function changeShortcut(shortcut: Shortcut) {
    setFilters((f) => ({ ...f, due: dueOfShortcut(shortcut) }))
    const url = new URL(window.location.href)
    if (shortcut === "todas") url.searchParams.delete("atalho")
    else url.searchParams.set("atalho", shortcut)
    window.history.replaceState(null, "", url)
  }

  function replaceTask(next: TaskView) {
    setTasks((current) => current.map((t) => (t.id === next.id ? next : t)))
  }

  // ------------------------------------------------------------ tasks

  async function quickAdd(listId: string, title: string) {
    const result = await api.createTask({ boardId, listId, title })
    if (!result.ok) {
      toast.error(result.error)
      return false
    }
    setTasks((current) => [...current, result.data])
    return true
  }

  async function createFromDialog(input: NewTaskInput) {
    const dueAt = input.dueDay ? toDueIso(input.dueDay, input.dueTime, timeZone) : null
    const result = await api.createTask({ boardId, listId: input.listId, title: input.title, priority: input.priority as Priority, dueAt, dueHasTime: Boolean(input.dueTime) })
    if (!result.ok) {
      toast.error(result.error)
      return false
    }
    setTasks((current) => [...current, result.data])
    toast.success("Tarefa criada.")
    return true
  }

  async function moveToList(listId: string, taskIds: string[]) {
    const snapshot = tasks
    const target = lists.find((l) => l.id === listId)
    const stamp = new Date().toISOString()
    setTasks((current) =>
      current.map((task) => {
        const index = taskIds.indexOf(task.id)
        if (index === -1) return task
        return {
          ...task,
          list_id: listId,
          position: (index + 1) * 1000,
          completed_at: target?.is_done_list ? (task.completed_at ?? stamp) : null,
        }
      })
    )
    const result = await api.moveTasks({ listId, taskIds })
    if (!result.ok) {
      setTasks(snapshot)
      toast.error(result.error)
    }
  }

  function moveTaskToList(task: TaskView, listId: string) {
    if (task.list_id === listId) return
    const ids = tasks
      .filter((t) => t.list_id === listId)
      .sort((a, b) => a.position - b.position)
      .map((t) => t.id)
    void moveToList(listId, [...ids, task.id])
  }

  async function toggleComplete(task: TaskView) {
    const snapshot = tasks
    const done = !task.completed_at
    const doneList = lists.find((l) => l.is_done_list)
    const openList = lists.find((l) => !l.is_done_list) ?? lists[0]
    const target = done ? doneList : openList
    const listId = target?.id ?? task.list_id
    const lastPosition = Math.max(0, ...tasks.filter((t) => t.list_id === listId).map((t) => t.position))

    replaceTask({
      ...task,
      list_id: listId,
      completed_at: done ? new Date().toISOString() : null,
      position: target && target.id !== task.list_id ? lastPosition + 1000 : task.position,
    })
    const result = await api.completeTask({ id: task.id, done })
    if (!result.ok) {
      setTasks(snapshot)
      toast.error(result.error)
      return
    }
    toast(done ? "Tarefa concluída." : "Tarefa reaberta.", {
      action: {
        label: "Desfazer",
        onClick: () => {
          const current = tasksRef.current.find((t) => t.id === task.id)
          if (current) void toggleComplete(current)
        },
      },
    })
  }

  async function confirmDeleteTask() {
    const task = taskToDelete
    setTaskToDelete(null)
    if (!task) return
    const snapshot = tasks
    openTaskById(null)
    setTasks((current) => current.filter((t) => t.id !== task.id))
    const result = await api.deleteTask(task.id)
    if (!result.ok) {
      setTasks(snapshot)
      toast.error(result.error)
      return
    }
    toast("Tarefa excluída.")
  }

  async function duplicateTask(task: TaskView) {
    const result = await api.createTask({ boardId, listId: task.list_id, title: `${task.title} (cópia)`.slice(0, 200), description: task.description, priority: asPriority(task.priority), dueAt: task.due_at, dueHasTime: task.due_has_time })
    if (!result.ok) return void toast.error(result.error)
    setTasks((current) => [...current, result.data])
    toast.success("Tarefa duplicada.")
  }

  /** Moves a task's due date (optimistic, rolled back if the save fails). */
  async function reschedule(task: TaskView, dueAt: string, hasTime: boolean, message: string) {
    const snapshot = task
    replaceTask({ ...task, due_at: dueAt, due_has_time: hasTime })
    const result = await api.updateTask({ id: task.id, patch: { dueAt, dueHasTime: hasTime } })
    if (!result.ok) {
      replaceTask(snapshot)
      toast.error(result.error)
      return
    }
    toast(message, {
      action: {
        label: "Desfazer",
        onClick: () => {
          replaceTask(snapshot)
          void api.updateTask({ id: task.id, patch: { dueAt: snapshot.due_at, dueHasTime: snapshot.due_has_time } })
        },
      },
    })
  }

  function postpone1h(task: TaskView) {
    const base = Math.max(now.getTime(), task.due_at ? new Date(task.due_at).getTime() : now.getTime())
    void reschedule(task, new Date(base + 3_600_000).toISOString(), true, "Adiado em 1 hora.")
  }

  function postponeTomorrow(task: TaskView) {
    const tomorrow = new Date(now.getTime() + 86_400_000)
    const time = task.due_has_time && task.due_at ? new Intl.DateTimeFormat("sv-SE", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(task.due_at)) : null
    void reschedule(task, toDueIso(dayKey(tomorrow, timeZone), time, timeZone), Boolean(time), "Adiado para amanhã.")
  }

  function actionsFor(task: TaskView): TaskActions {
    return {
      open: () => openTaskById(task.id),
      toggle: () => void toggleComplete(task),
      postpone1h: () => postpone1h(task),
      tomorrow: () => postponeTomorrow(task),
      move: () => setMoveFor([task]),
      remove: () => setTaskToDelete(task),
      select: () => {
        setSelecting(true)
        setSelected(new Set([task.id]))
      },
    }
  }

  const selection = {
    active: selecting,
    ids: selected,
    toggle: (id: string) =>
      setSelected((current) => {
        const next = new Set(current)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
  }
  function stopSelecting() {
    setSelecting(false)
    setSelected(new Set())
  }
  const selectedTasks = tasks.filter((t) => selected.has(t.id))

  async function bulkComplete() {
    for (const task of selectedTasks.filter((t) => !t.completed_at)) await toggleComplete(task)
    stopSelecting()
  }
  function bulkTomorrow() {
    for (const task of selectedTasks.filter((t) => !t.completed_at)) postponeTomorrow(task)
    stopSelecting()
  }
  async function confirmBulkDelete() {
    setBulkDelete(false)
    const doomed = selectedTasks
    const snapshot = tasks
    setTasks((current) => current.filter((t) => !selected.has(t.id)))
    for (const task of doomed) {
      const result = await api.deleteTask(task.id)
      if (!result.ok) {
        setTasks(snapshot)
        toast.error(result.error)
        stopSelecting()
        return
      }
    }
    toast(`${doomed.length} ${doomed.length === 1 ? "tarefa excluída" : "tarefas excluídas"}.`)
    stopSelecting()
  }

  // ------------------------------------------------------------ lists

  async function addList(name: string) {
    const result = await api.createList({ boardId, name })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setLists((current) => [...current, result.data])
  }

  async function renameList(list: ListRow, name: string) {
    const snapshot = lists
    setLists((current) => current.map((l) => (l.id === list.id ? { ...l, name } : l)))
    const result = await api.updateList({ id: list.id, name })
    if (!result.ok) {
      setLists(snapshot)
      toast.error(result.error)
    }
  }

  async function toggleDoneList(list: ListRow) {
    const snapshot = lists
    const next = !list.is_done_list
    setLists((current) => current.map((l) => (l.id === list.id ? { ...l, is_done_list: next } : l)))
    const result = await api.updateList({ id: list.id, isDoneList: next })
    if (!result.ok) {
      setLists(snapshot)
      toast.error(result.error)
    }
  }

  async function moveList(list: ListRow, direction: -1 | 1) {
    const index = lists.findIndex((l) => l.id === list.id)
    const swapWith = index + direction
    if (swapWith < 0 || swapWith >= lists.length) return
    const snapshot = lists
    const next = [...lists]
    ;[next[index], next[swapWith]] = [next[swapWith], next[index]]
    setLists(next.map((l, i) => ({ ...l, position: (i + 1) * 1000 })))
    const result = await api.reorderLists({ boardId, listIds: next.map((l) => l.id) })
    if (!result.ok) {
      setLists(snapshot)
      toast.error(result.error)
    }
  }

  async function confirmDeleteList() {
    const list = listToDelete
    setListToDelete(null)
    if (!list) return
    const result = await api.deleteList(list.id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setLists((current) => current.filter((l) => l.id !== list.id))
    setTasks((current) => current.filter((t) => t.list_id !== list.id))
    toast("Lista excluída.")
  }

  // ----------------------------------------------------------- boards

  async function newBoard(name: string) {
    const result = await api.createBoard({ name })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    router.push(`${basePath}/${result.data.id}`)
  }

  async function doRenameBoard(name: string) {
    const result = await api.renameBoard({ id: boardId, name })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setBoardName(name)
    setBoards((current) => current.map((b) => (b.id === boardId ? { ...b, name } : b)))
  }

  async function confirmArchive() {
    setArchiveOpen(false)
    const result = await api.archiveBoard(boardId)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast("Quadro arquivado.")
    router.push(result.data.nextBoardId ? `/dashboard/tarefas/${result.data.nextBoardId}` : "/dashboard/tarefas")
  }

  usePrimaryAction("Nova tarefa", () => setNewTaskOpen(true))

  async function confirmClearDone() {
    const list = doneToClear
    setDoneToClear(null)
    if (!list) return
    const doomed = tasks.filter((t) => t.list_id === list.id)
    const snapshot = tasks
    setTasks((current) => current.filter((t) => t.list_id !== list.id))
    for (const task of doomed) {
      const result = await api.deleteTask(task.id)
      if (!result.ok) {
        setTasks(snapshot)
        toast.error(result.error)
        return
      }
    }
    toast(`${doomed.length} ${doomed.length === 1 ? "tarefa concluída removida" : "tarefas concluídas removidas"}.`)
  }

  // Remember the board in use: /dashboard/tarefas opens it next time.
  useEffect(() => {
    document.cookie = `tasks_last_board=${initial.board.id}; path=/; max-age=31536000; samesite=lax`
  }, [initial.board.id])

  // Keyboard shortcuts: N new, / search, E edit, Space complete, ? help (ignored while typing or with a dialog open).
  const shortcutRef = useRef<(event: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    shortcutRef.current = (event) => {
      const el = event.target as HTMLElement | null
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (el && (el.closest("input, textarea, select, [contenteditable=true]") || el.closest("[role=dialog], [role=menu], [role=listbox]"))) {
        if (event.key === "Escape" && openId && el.closest("aside[aria-label='Detalhes da tarefa']")) openTaskById(null)
        return
      }
      const focusedCard = el?.closest<HTMLElement>("[data-task-id]")?.dataset.taskId ?? hoveredTask.current
      const current = focusedCard ? tasks.find((t) => t.id === focusedCard) : undefined
      switch (event.key) {
        case "n":
        case "N":
          event.preventDefault()
          setNewTaskOpen(true)
          break
        case "/":
          event.preventDefault()
          searchRef.current?.focus()
          break
        case "e":
        case "E":
          if (current) {
            event.preventDefault()
            openTaskById(current.id)
          }
          break
        case " ":
          if (current && !(el instanceof HTMLButtonElement && el.getAttribute("role") === "checkbox")) {
            event.preventDefault()
            void toggleComplete(current)
          }
          break
        case "?":
          event.preventDefault()
          setHelpOpen(true)
          break
        case "Escape":
          if (openId) openTaskById(null)
          break
      }
    }
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => shortcutRef.current(event)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const listTaskCount = listToDelete ? tasks.filter((t) => t.list_id === listToDelete.id).length : 0
  const viewProps = {
    lists,
    tasks: visible,
    tags,
    now,
    timeZone,
    onOpenTask: openTaskById,
    onToggleComplete: (task: TaskView) => void toggleComplete(task),
    onDeleteRequest: setTaskToDelete,
    onQuickAdd: quickAdd,
    actionsFor,
    selection,
    onCreate: (listId?: string) => {
      setNewTaskList(listId)
      setNewTaskOpen(true)
    },
  }

  return (
    <div className="flex flex-col gap-5">
      <div className={bentoCardClass()}>
      <BoardToolbar
        ref={searchRef}
        isMobile={isMobile}
        boards={boards.map((b) => (b.id === boardId ? { ...b, name: boardName } : b))}
        boardId={boardId}
        onSelectBoard={(id) => router.push(`${basePath}/${id}`)}
        onNewBoard={() => setNewBoardOpen(true)}
        onRenameBoard={() => setRenameOpen(true)}
        onArchiveBoard={() => setArchiveOpen(true)}
        onNewTask={() => {
          setNewTaskList(undefined)
          setNewTaskOpen(true)
        }}
        view={view}
        onViewChange={changeView}
        filters={filters}
        onFiltersChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        lists={lists}
        tags={tags}
        counts={counts}
        onShortcut={changeShortcut}
      />
      </div>

      <div
        className="flex items-start gap-5"
        onMouseOver={(e) => {
          hoveredTask.current = (e.target as HTMLElement).closest<HTMLElement>("[data-task-id]")?.dataset.taskId ?? null
        }}
        onMouseLeave={() => {
          hoveredTask.current = null
        }}
      >
      <div className="min-w-0 flex-1">
      {view !== "kanban" && filtering && visible.length === 0 ? (
        <EmptyState
          icon={SearchXIcon}
          title="Nenhuma tarefa com esses filtros"
          description="Ajuste a busca ou limpe os filtros."
          action={
            <Button variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>
              Limpar filtros
            </Button>
          }
        />
      ) : view === "kanban" ? (
        <KanbanView
          {...viewProps}
          dragEnabled={sort === "manual" && !filtering}
          onMoveTasks={(listId, ids) => void moveToList(listId, ids)}
          onAddList={addList}
          onRenameList={renameList}
          onToggleDoneList={(list) => void toggleDoneList(list)}
          onMoveList={(list, direction) => void moveList(list, direction)}
          onDeleteList={setListToDelete}
          isMobile={isMobile}
          onClearDone={setDoneToClear}
        />
      ) : view === "lista" ? (
        <div className={bentoCardClass()}>
          <ListView {...viewProps} />
        </div>
      ) : (
        <div className={bentoCardClass()}>
          <CalendarView {...viewProps} />
        </div>
      )}
      </div>
      </div>

      <TaskDetail
        api={api}
        task={openTask}
        boardName={boardName}
        lists={lists}
        tags={tags}
        timeZone={timeZone}
        now={now}
        siblings={visible.map((t) => t.id)}
        onNavigate={(id) => openTaskById(id)}
        onClose={() => openTaskById(null)}
        onTaskChange={replaceTask}
        onToggleComplete={(task) => void toggleComplete(task)}
        onMove={(task) => setMoveFor([task])}
        onMoveToList={moveTaskToList}
        onDuplicate={(task) => void duplicateTask(task)}
        onTagCreated={(tag) => setTags((current) => [...current, tag].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")))}
        onDelete={setTaskToDelete}
      />

      <Dialog open={Boolean(openId && !openTask)} onOpenChange={(open) => !open && openTaskById(null)}>
        <DialogContent className="max-w-sm rounded-[20px]">
          <DialogHeader>
            <DialogTitle>Tarefa não encontrada</DialogTitle>
            <DialogDescription>Ela pode ter sido excluída ou o link está incompleto.</DialogDescription>
          </DialogHeader>
          <Button type="button" className="h-11 rounded-full" onClick={() => openTaskById(null)}>
            Voltar para as tarefas
          </Button>
        </DialogContent>
      </Dialog>
      <NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} lists={lists} defaultListId={newTaskList} now={now} timeZone={timeZone} onCreate={createFromDialog} />
      <MoveDialog
        open={Boolean(moveFor)}
        onOpenChange={(open) => !open && setMoveFor(null)}
        lists={lists}
        currentListId={moveFor && moveFor.length === 1 ? moveFor[0].list_id : null}
        title={moveFor && moveFor.length > 1 ? `Mover ${moveFor.length} tarefas para…` : "Mover para…"}
        onPick={(listId) => {
          for (const task of moveFor ?? []) moveTaskToList(task, listId)
          if ((moveFor?.length ?? 0) > 1) stopSelecting()
        }}
      />
      <ConfirmDialog
        open={bulkDelete}
        onOpenChange={setBulkDelete}
        title={`Excluir ${selectedTasks.length} ${selectedTasks.length === 1 ? "tarefa" : "tarefas"}?`}
        description="As tarefas selecionadas serão apagadas. Essa ação não pode ser desfeita."
        onConfirm={() => void confirmBulkDelete()}
      />
      {selecting ? (
        <div role="toolbar" aria-label="Ações da seleção" data-testid="selection-bar" className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-border bg-card px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:inset-x-auto md:right-8 md:bottom-6 md:left-auto md:rounded-[20px] md:border">
          <span className="tabular mr-auto text-[15px] font-semibold">{selected.size} {selected.size === 1 ? "selecionada" : "selecionadas"}</span>
          <Button variant="outline" className="h-11 rounded-full" disabled={selected.size === 0} onClick={() => void bulkComplete()}>
            <CheckIcon strokeWidth={1.75} /> Concluir
          </Button>
          <Button variant="outline" className="h-11 rounded-full" disabled={selected.size === 0} onClick={() => setMoveFor(selectedTasks)}>
            <ArrowRightIcon strokeWidth={1.75} /> Mover
          </Button>
          <Button variant="outline" className="h-11 rounded-full" disabled={selected.size === 0} onClick={bulkTomorrow}>
            <CalendarIcon strokeWidth={1.75} /> Adiar
          </Button>
          <Button variant="outline" className="h-11 rounded-full" disabled={selected.size === 0} onClick={() => setBulkDelete(true)}>
            <Trash2Icon strokeWidth={1.75} /> Excluir
          </Button>
          <Button variant="ghost" size="icon" className="size-11 rounded-full" aria-label="Sair da seleção" onClick={stopSelecting}>
            <XIcon strokeWidth={1.75} />
          </Button>
        </div>
      ) : null}
      <PromptDialog open={newBoardOpen} onOpenChange={setNewBoardOpen} title="Novo quadro" label="Nome do quadro" submitLabel="Criar quadro" onSubmit={newBoard} />
      <PromptDialog open={renameOpen} onOpenChange={setRenameOpen} title="Renomear quadro" label="Nome do quadro" initialValue={boardName} onSubmit={doRenameBoard} />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Arquivar este quadro?"
        description="O quadro some da lista. As tarefas ficam guardadas."
        confirmLabel="Arquivar"
        onConfirm={() => void confirmArchive()}
      />
      <ConfirmDialog
        open={Boolean(taskToDelete)}
        onOpenChange={(open) => !open && setTaskToDelete(null)}
        title="Excluir esta tarefa?"
        description={taskToDelete ? `“${taskToDelete.title}” será apagada. Essa ação não pode ser desfeita.` : ""}
        onConfirm={() => void confirmDeleteTask()}
      />
      <ConfirmDialog
        open={Boolean(doneToClear)}
        onOpenChange={(open) => !open && setDoneToClear(null)}
        title="Limpar as tarefas concluídas?"
        description={doneToClear ? `As ${tasks.filter((t) => t.list_id === doneToClear.id).length} tarefas de “${doneToClear.name}” serão apagadas. Essa ação não pode ser desfeita.` : ""}
        confirmLabel="Limpar concluídas"
        onConfirm={() => void confirmClearDone()}
      />
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atalhos do teclado</DialogTitle>
            <DialogDescription>Funcionam fora dos campos de texto.</DialogDescription>
          </DialogHeader>
          <dl className="flex flex-col">
            {[
              ["N", "Nova tarefa"],
              ["/", "Buscar"],
              ["E", "Editar a tarefa sob o cursor ou em foco"],
              ["Espaço", "Concluir ou reabrir a tarefa em foco"],
              ["Esc", "Fechar os detalhes"],
              ["?", "Mostrar esta ajuda"],
            ].map(([key, text]) => (
              <div key={key} className="flex min-h-11 items-center gap-4 border-b border-border last:border-b-0">
                <dt>
                  <kbd className="rounded-md border border-border px-2 py-0.5 text-[13px]">{key}</kbd>
                </dt>
                <dd className="text-[15px] leading-6">{text}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(listToDelete)}
        onOpenChange={(open) => !open && setListToDelete(null)}
        title="Excluir esta lista?"
        description={
          listToDelete
            ? listTaskCount > 0
              ? `A lista “${listToDelete.name}” e as ${listTaskCount} tarefas dela serão apagadas. Essa ação não pode ser desfeita.`
              : `A lista “${listToDelete.name}” será apagada.`
            : ""
        }
        confirmLabel="Excluir lista"
        onConfirm={() => void confirmDeleteList()}
      />
    </div>
  )
}
