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
import { DEFAULT_PRIORITY_STATE, enumFor, localPriorityRepo, newPriorityId, priorityOf, usageOf, type PriorityState } from "@/features/tasks/priorities"
import { countForShortcut, criteriaToFilters, DEFAULT_SHORTCUTS, filtersToCriteria, isActiveShortcut, loadShortcuts, saveShortcuts, type ShortcutCriteria, type ShortcutDef } from "@/features/tasks/shortcuts"
import { dueOfShortcut } from "@/features/tasks/view"
import { asPriority, type BoardData, type ListRow, type Priority, type TagRow, type TaskView } from "@/features/tasks/types"
import { dayKey, toDueIso } from "@/lib/dates"
import { cn } from "@/lib/utils"

import { BoardToolbar, type ViewMode } from "./board-toolbar"
import { CalendarView } from "./calendar-view"
import { DeleteListDialog } from "./delete-list-dialog"
import { KanbanTabs } from "./kanban-tabs"
import { KanbanView } from "./kanban-view"
import { ManageListsSheet } from "./manage-lists-sheet"
import { ShortcutEditor } from "./shortcut-editor"
import { useCollapsedLists } from "./list-parts"
import { ListView, type GroupBy } from "./list-view"
import { MoveDialog } from "./move-dialog"
import { NewTaskDialog, type NewTaskInput } from "./new-task-dialog"
import type { TaskActions } from "./task-card"
import { LabelColorsProvider, useLabelColorsStore } from "./label-colors-context"
import { PrioritiesProvider } from "./priorities-context"
import { TaskDetail, type Taxonomy } from "./task-detail"

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

const foldDone = (list: ListRow) => list.is_done_list
const never = () => false

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
  const [groupBy, setGroupBy] = useState<GroupBy>("lista")
  const [mobileList, setMobileList] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [newTaskList, setNewTaskList] = useState<string | undefined>(undefined)
  /** Pre-filled due date of the "Nova tarefa" form (the calendar's selected day, plus a free hour when it is today). */
  const [newTaskDue, setNewTaskDue] = useState<{ day: string; time?: string } | undefined>(undefined)
  const [calendarDay, setCalendarDay] = useState<string | null>(null)
  const [moveFor, setMoveFor] = useState<TaskView[] | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDelete, setBulkDelete] = useState(false)
  const [newBoardOpen, setNewBoardOpen] = useState(false)
  const [editingBoardName, setEditingBoardName] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<TaskView | null>(null)
  const [listToDelete, setListToDelete] = useState<ListRow | null>(null)
  const [doneToClear, setDoneToClear] = useState<ListRow | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [manageListsOpen, setManageListsOpen] = useState(false)
  const labels = useLabelColorsStore()
  const [prio, setPrio] = useState<PriorityState>(DEFAULT_PRIORITY_STATE)
  useEffect(() => {
    // The person's priorities live in the browser until the server adapter exists (see features/tasks/priorities.ts).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrio(localPriorityRepo.load())
  }, [])
  const [shortcuts, setShortcuts] = useState<ShortcutDef[]>(DEFAULT_SHORTCUTS)
  const [editorOpen, setEditorOpen] = useState(false)
  const [shortcutDraft, setShortcutDraft] = useState<ShortcutCriteria | null>(null)
  useEffect(() => {
    // The saved shortcuts only exist in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShortcuts(loadShortcuts())
  }, [])
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

  // Collapsed lists are shared by Kanban and Lista; Lista folds "concluded" lists the first time.
  const { collapsed, toggle: toggleCollapse } = useCollapsedLists(initial.board.id, view === "lista" ? foldDone : never)

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
  const counts = useMemo(() => Object.fromEntries(shortcuts.map((s) => [s.id, countForShortcut(s, tasks, { now, timeZone })])), [shortcuts, tasks, now, timeZone])
  const activeShortcutId = shortcuts.find((s) => isActiveShortcut(s, filters))?.id ?? null
  const categories = useMemo(() => [...new Set(tasks.map((t) => t.category).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b, "pt-BR")), [tasks])
  const listCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of visible) map[t.list_id] = (map[t.list_id] ?? 0) + 1
    return map
  }, [visible])

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

  function changeShortcut(def: ShortcutDef) {
    // Clicking the active chip clears it (back to "Todas").
    const target = activeShortcutId === def.id && def.id !== "todas" ? (shortcuts.find((s) => s.id === "todas") ?? def) : def
    setFilters((f) => criteriaToFilters(target.criteria, f))
    const url = new URL(window.location.href)
    if (target.builtin && target.id !== "todas") url.searchParams.set("atalho", target.id)
    else url.searchParams.delete("atalho")
    window.history.replaceState(null, "", url)
  }

  function changeShortcuts(next: ShortcutDef[]) {
    setShortcuts(next)
    saveShortcuts(next)
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

  /**
   * A manual reorder (drag, or "Mover para cima/baixo"): persists the order of the list. When the sort was not "Manual", the order the
   * person just made would be invisible, so the sort switches to Manual with a toast whose "Desfazer" restores order and sort.
   */
  async function reorderTasks(listId: string, taskIds: string[]) {
    const before = tasks
    const previousSort = sort
    await moveToList(listId, taskIds)
    if (previousSort === "manual") return
    setSort("manual")
    toast("Ordenação manual ativada", {
      action: {
        label: "Desfazer",
        onClick: () => {
          setSort(previousSort)
          setTasks(before)
          const moved = before.find((t) => taskIds.includes(t.id) && t.list_id !== listId) ?? null
          const listsToRestore = new Set([listId, ...(moved ? [moved.list_id] : [])])
          for (const id of listsToRestore) {
            const ordered = before.filter((t) => t.list_id === id).sort((a, b) => a.position - b.position).map((t) => t.id)
            if (ordered.length > 0) void api.moveTasks({ listId: id, taskIds: ordered })
          }
        },
      },
    })
  }

  function moveWithinList(task: TaskView, direction: -1 | 1) {
    const ids = tasks
      .filter((t) => t.list_id === task.list_id)
      .sort((a, b) => a.position - b.position)
      .map((t) => t.id)
    const index = ids.indexOf(task.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= ids.length) {
      toast(direction === -1 ? "A tarefa já está no topo." : "A tarefa já está no fim.")
      return
    }
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    void reorderTasks(task.list_id, ids)
    toast(direction === -1 ? "Tarefa movida para cima." : "Tarefa movida para baixo.")
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

  // ------------------------------------------------------- priorities, tags, categories (the pickers' data)

  /** Keeps the stored enum of every task in step with the weight of its priority (filters and sorting read the enum). */
  async function syncPriorityEnums(next: PriorityState) {
    for (const t of tasksRef.current) {
      const want = enumFor(next.list, priorityOf(next, t)?.id ?? null)
      if (want === t.priority) continue
      replaceTask({ ...t, priority: want })
      await api.updateTask({ id: t.id, patch: { priority: want } })
    }
  }
  function commitPriorities(next: PriorityState) {
    setPrio(next)
    localPriorityRepo.save(next)
    void syncPriorityEnums(next)
  }

  const taxonomy: Taxonomy = {
    priorities: {
      state: prio,
      pick: (task, id) => {
        const assigned = { ...prio.assigned }
        if (id) assigned[task.id] = id
        else delete assigned[task.id]
        const next = { ...prio, assigned }
        setPrio(next)
        localPriorityRepo.save(next)
        const want = enumFor(next.list, id)
        replaceTask({ ...task, priority: want })
        void api.updateTask({ id: task.id, patch: { priority: want } }).then((r) => {
          if (!r.ok) toast.error(r.error)
        })
      },
      create: (name) => {
        const id = newPriorityId()
        commitPriorities({ ...prio, list: [...prio.list, { id, name }] })
        return id
      },
      rename: (id, name) => commitPriorities({ ...prio, list: prio.list.map((p) => (p.id === id ? { ...p, name } : p)) }),
      reorder: (ids) => commitPriorities({ ...prio, list: ids.map((id) => prio.list.find((p) => p.id === id)!).filter(Boolean) }),
      remove: (id) => {
        // Affected tasks fall back to "Sem prioridade".
        for (const t of tasks.filter((x) => priorityOf(prio, x)?.id === id)) {
          replaceTask({ ...t, priority: "none" })
          void api.updateTask({ id: t.id, patch: { priority: "none" } })
        }
        commitPriorities({ list: prio.list.filter((p) => p.id !== id), assigned: Object.fromEntries(Object.entries(prio.assigned).filter(([, v]) => v !== id)) })
      },
      usage: (id) => usageOf(prio, tasks, id),
    },
    tags: {
      rename: async (id, name) => {
        const result = await api.renameTag({ id, name })
        if (!result.ok) {
          toast.error(result.error)
          return false
        }
        setTags((current) => current.map((t) => (t.id === id ? { ...t, name } : t)))
        return true
      },
      remove: (id) => {
        void api.deleteTag(id).then((result) => {
          if (!result.ok) return void toast.error(result.error)
          setTags((current) => current.filter((t) => t.id !== id))
          setTasks((current) => current.map((t) => ({ ...t, tagIds: t.tagIds.filter((x) => x !== id) })))
        })
      },
      usage: (id) => tasks.filter((t) => t.tagIds.includes(id)).length,
    },
    categories: {
      list: categories,
      rename: (from, to) => {
        const color = labels.colorOf("category", from)
        if (color) {
          labels.setColor("category", to, color)
          labels.setColor("category", from, null)
        }
        for (const t of tasks.filter((x) => x.category === from)) {
          replaceTask({ ...t, category: to })
          void api.updateTask({ id: t.id, patch: { category: to } })
        }
      },
      remove: (name) => {
        for (const t of tasks.filter((x) => x.category === name)) {
          replaceTask({ ...t, category: null })
          void api.updateTask({ id: t.id, patch: { category: null } })
        }
      },
      usage: (name) => tasks.filter((t) => t.category === name).length,
    },
  }

  /** Detail pop-up / "Mover para…": another quadro. The task leaves this board, the toast offers to put it back. */
  async function moveToBoard(task: TaskView, targetBoardId: string, listId?: string) {
    const result = await api.moveTaskToBoard({ taskId: task.id, boardId: targetBoardId, listId })
    if (!result.ok) return void toast.error(result.error)
    openTaskById(null)
    setTasks((current) => current.filter((t) => t.id !== task.id))
    toast(`Movida para ${result.data.boardName} › ${result.data.listName}`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          void api.moveTaskToBoard({ taskId: task.id, boardId, listId: task.list_id }).then((back) => {
            if (!back.ok) return void toast.error(back.error)
            setTasks((current) => [...current.filter((t) => t.id !== task.id), task])
          })
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
      moveUp: filtering ? undefined : () => moveWithinList(task, -1),
      moveDown: filtering ? undefined : () => moveWithinList(task, 1),
      remove: () => setTaskToDelete(task),
      duplicate: () => void duplicateTask(task),
      rename: async (title) => {
        const previous = task
        replaceTask({ ...task, title })
        const result = await api.updateTask({ id: task.id, patch: { title } })
        if (!result.ok) {
          replaceTask(previous)
          toast.error(result.error)
          return false
        }
        return true
      },
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

  async function reorderLists(ids: string[]) {
    const snapshot = lists
    setLists(ids.map((id, i) => ({ ...lists.find((l) => l.id === id)!, position: (i + 1) * 1000 })))
    const result = await api.reorderLists({ boardId, listIds: ids })
    if (!result.ok) {
      setLists(snapshot)
      toast.error(result.error)
    }
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

  async function confirmDeleteList(destinationListId: string | null) {
    const list = listToDelete
    setListToDelete(null)
    if (!list) return
    // Tasks that have somewhere to go are moved first; otherwise they go with the list.
    if (destinationListId) {
      const keep = tasks.filter((t) => t.list_id === destinationListId).sort((a, b) => a.position - b.position).map((t) => t.id)
      const moving = tasks.filter((t) => t.list_id === list.id).sort((a, b) => a.position - b.position).map((t) => t.id)
      if (moving.length > 0) {
        await moveToList(destinationListId, [...keep, ...moving])
        // moveToList rolls back and reports on failure: stop if the tasks did not leave.
        if (tasksRef.current.some((t) => t.list_id === list.id && moving.includes(t.id))) return
      }
    }
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

  // "Nova tarefa" from the app header: pre-filled with this quadro and, on phones in Kanban, the list being looked at.
  usePrimaryAction("Nova tarefa", () => {
    setNewTaskList(view === "kanban" && isMobile ? (mobileList ?? lists[0]?.id) : undefined)
    setNewTaskDue(view === "calendario" && isMobile && calendarDay ? { day: calendarDay, time: calendarDay === dayKey(now, timeZone) ? nextFreeHour() : undefined } : undefined)
    setNewTaskOpen(true)
  })

  /** The next whole hour of today that has no timed task yet (null when the day is full). */
  function nextFreeHour() {
    const hourIn = (date: Date | string) => Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone }).format(new Date(date))) % 24
    const today = dayKey(now, timeZone)
    const busy = new Set(tasks.filter((t) => t.due_at && t.due_has_time && dayKey(t.due_at, timeZone) === today).map((t) => hourIn(t.due_at!)))
    for (let hour = hourIn(now) + 1; hour <= 23; hour += 1) if (!busy.has(hour)) return `${String(hour).padStart(2, "0")}:00`
    return undefined
  }

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
    onCreate: (listId?: string, day?: string) => {
      setNewTaskList(listId)
      setNewTaskDue(day ? { day } : undefined)
      setNewTaskOpen(true)
    },
    onRenameList: renameList,
    onToggleDoneList: (list: ListRow) => void toggleDoneList(list),
    onMoveList: (list: ListRow, direction: -1 | 1) => void moveList(list, direction),
    onDeleteList: setListToDelete,
    onClearDone: setDoneToClear,
    onAddList: addList,
    onReorderLists: (ids: string[]) => void reorderLists(ids),
    collapsed,
    onToggleCollapse: toggleCollapse,
  }

  return (
    <LabelColorsProvider value={labels}>
    <PrioritiesProvider value={prio}>
    <div className="flex flex-col gap-5 max-md:gap-3">
      <div data-testid="board-header" className={cn("max-md:mt-3 max-md:rounded-[20px] max-md:border max-md:border-border max-md:bg-card max-md:p-3", !isMobile && bentoCardClass())}>
      <BoardToolbar
        ref={searchRef}
        isMobile={isMobile}
        boards={boards.map((b) => (b.id === boardId ? { ...b, name: boardName } : b))}
        boardId={boardId}
        onSelectBoard={(id) => router.push(`${basePath}/${id}`)}
        onNewBoard={() => setNewBoardOpen(true)}
        editingName={editingBoardName}
        onEditingNameChange={setEditingBoardName}
        onCommitBoardName={doRenameBoard}
        onArchiveBoard={() => setArchiveOpen(true)}
        view={view}
        onViewChange={changeView}
        filters={filters}
        onFiltersChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        lists={lists}
        tags={tags}
        shortcuts={shortcuts}
        counts={counts}
        activeShortcutId={activeShortcutId}
        onShortcut={changeShortcut}
        onEditShortcuts={() => {
          setShortcutDraft(null)
          setEditorOpen(true)
        }}
        onSaveFilterAsShortcut={() => {
          setShortcutDraft(filtersToCriteria(filters))
          setEditorOpen(true)
        }}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        onManageLists={() => setManageListsOpen(true)}
        listTabs={
          <KanbanTabs
            lists={lists}
            counts={listCounts}
            activeId={mobileList ?? lists[0]?.id}
            onSelect={setMobileList}
            onAdd={addList}
            onManage={() => setManageListsOpen(true)}
          />
        }
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
          dragEnabled={!filtering}
          onMoveTasks={(listId, ids) => void reorderTasks(listId, ids)}
          isMobile={isMobile}
          activeListId={mobileList}
          onActiveListChange={setMobileList}
        />
      ) : view === "lista" ? (
        <div className={cn(!isMobile && bentoCardClass())}>
          <ListView {...viewProps} groupBy={groupBy} isMobile={isMobile} dragEnabled={!filtering} onMoveTasks={(listId, ids) => void reorderTasks(listId, ids)} />
        </div>
      ) : (
        <CalendarView {...viewProps} nowIso={nowIso} onDayChange={setCalendarDay} onSchedule={(task, dueIso, hasTime) => void reschedule(task, dueIso, hasTime, "Tarefa reagendada.")} />
      )}
      </div>
      </div>

      <ShortcutEditor open={editorOpen} onOpenChange={setEditorOpen} shortcuts={shortcuts} onChange={changeShortcuts} lists={lists} tags={tags} categories={categories} draft={shortcutDraft} />
      <ManageListsSheet open={manageListsOpen} onOpenChange={setManageListsOpen} lists={lists} actions={viewProps} />
      <TaskDetail
        api={api}
        taxonomy={taxonomy}
        task={openTask}
        boardName={boardName}
        boardId={boardId}
        boards={boards.map((b) => (b.id === boardId ? { ...b, name: boardName } : b))}
        onMoveToBoard={(task, target) => void moveToBoard(task, target)}
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
      <NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} lists={lists} defaultListId={newTaskList} defaultDue={newTaskDue} now={now} timeZone={timeZone} onCreate={createFromDialog} />
      <MoveDialog
        open={Boolean(moveFor)}
        onOpenChange={(open) => !open && setMoveFor(null)}
        lists={lists}
        boards={boards.map((b) => (b.id === boardId ? { ...b, name: boardName } : b))}
        currentBoardId={boardId}
        loadLists={async (id) => {
          const result = await api.getBoardLists(id)
          if (!result.ok) {
            toast.error(result.error)
            return []
          }
          return result.data
        }}
        onPickInBoard={(targetBoard, listId) => {
          for (const task of moveFor ?? []) void moveToBoard(task, targetBoard, listId)
          if ((moveFor?.length ?? 0) > 1) stopSelecting()
        }}
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
      <DeleteListDialog list={listToDelete} taskCount={listTaskCount} others={lists.filter((l) => l.id !== listToDelete?.id)} onCancel={() => setListToDelete(null)} onConfirm={(destination) => void confirmDeleteList(destination)} />
    </div>
    </PrioritiesProvider>
    </LabelColorsProvider>
  )
}
