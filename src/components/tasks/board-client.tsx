"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { SearchXIcon } from "lucide-react"
import { toast } from "sonner"

import { bentoCardClass } from "@/components/organizzou/Bento"
import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { EmptyState } from "@/components/organizzou/EmptyState"
import { PromptDialog } from "@/components/organizzou/PromptDialog"
import { Button } from "@/components/ui/button"
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
import type { BoardData, ListRow, Priority, TagRow, TaskView } from "@/features/tasks/types"

import { BoardToolbar, type ViewMode } from "./board-toolbar"
import { CalendarView } from "./calendar-view"
import { KanbanView } from "./kanban-view"
import { ListView } from "./list-view"
import { NewTaskDialog } from "./new-task-dialog"
import { TaskSheet } from "./task-sheet"

type BoardClientProps = {
  initial: BoardData
  /** Backend adapter: server actions in production, in-memory mock in the prototype. */
  api: BoardApi
  initialView: ViewMode
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
  const [tags, setTags] = useState<TagRow[]>(initial.tags)
  const [view, setView] = useState<ViewMode>(initialView)
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortKey>("manual")
  const [openId, setOpenId] = useState<string | null>(null)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [newBoardOpen, setNewBoardOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<TaskView | null>(null)
  const [listToDelete, setListToDelete] = useState<ListRow | null>(null)

  const timeZone = initial.timezone
  const boardId = initial.board.id
  const filtering = countActiveFilters(filters) > 0 || filters.query.trim() !== ""
  const visible = useMemo(
    () => sortTasks(applyFilters(tasks, filters, { now, timeZone }), sort),
    [tasks, filters, sort, now, timeZone]
  )
  const openTask = tasks.find((t) => t.id === openId) ?? null

  function changeView(next: ViewMode) {
    setView(next)
    const url = new URL(window.location.href)
    url.searchParams.set("visao", next)
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

  async function createFromDialog(input: { listId: string; title: string; priority: Priority }) {
    const result = await api.createTask({ boardId, ...input })
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
    toast(done ? "Tarefa concluída." : "Tarefa reaberta.")
  }

  async function confirmDeleteTask() {
    const task = taskToDelete
    setTaskToDelete(null)
    if (!task) return
    const snapshot = tasks
    setOpenId(null)
    setTasks((current) => current.filter((t) => t.id !== task.id))
    const result = await api.deleteTask(task.id)
    if (!result.ok) {
      setTasks(snapshot)
      toast.error(result.error)
      return
    }
    toast("Tarefa excluída.")
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

  const listTaskCount = listToDelete ? tasks.filter((t) => t.list_id === listToDelete.id).length : 0
  const viewProps = {
    lists,
    tasks: visible,
    tags,
    now,
    timeZone,
    onOpenTask: setOpenId,
    onToggleComplete: (task: TaskView) => void toggleComplete(task),
    onDeleteRequest: setTaskToDelete,
    onQuickAdd: quickAdd,
  }

  return (
    <div className="flex flex-col gap-5">
      <div className={bentoCardClass()}>
      <BoardToolbar
        boards={boards.map((b) => (b.id === boardId ? { ...b, name: boardName } : b))}
        boardId={boardId}
        onSelectBoard={(id) => router.push(`${basePath}/${id}`)}
        onNewBoard={() => setNewBoardOpen(true)}
        onRenameBoard={() => setRenameOpen(true)}
        onArchiveBoard={() => setArchiveOpen(true)}
        onNewTask={() => setNewTaskOpen(true)}
        view={view}
        onViewChange={changeView}
        filters={filters}
        onFiltersChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        lists={lists}
        tags={tags}
        visibleCount={visible.length}
      />
      </div>

      {view !== "kanban" && filtering && visible.length === 0 ? (
        <EmptyState
          icon={SearchXIcon}
          title="Nenhuma tarefa encontrada"
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

      <TaskSheet
        api={api}
        task={openTask}
        lists={lists}
        tags={tags}
        timeZone={timeZone}
        isMobile={isMobile}
        onClose={() => setOpenId(null)}
        onTaskChange={replaceTask}
        onMoveToList={moveTaskToList}
        onTagCreated={(tag) => setTags((current) => [...current, tag].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")))}
        onDelete={setTaskToDelete}
      />

      <NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} lists={lists} onCreate={createFromDialog} />
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
