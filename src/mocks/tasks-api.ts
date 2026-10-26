import type { BoardApi } from "@/features/tasks/board-api"
import type {
  AttachmentRow,
  BoardData,
  ChecklistItemRow,
  CommentRow,
  ListRow,
  TagRow,
  TaskView,
} from "@/features/tasks/types"

import { buildMockBoards } from "./tasks"
import { dayOf, mockId } from "./time"

const USER = "00000000-0000-4000-8000-000000000001"

type Detail = { checklist: ChecklistItemRow[]; comments: CommentRow[]; attachments: AttachmentRow[] }

/** In-memory store shared by every mock board screen until the page is reloaded. */
type Store = {
  day: string
  boards: BoardData[]
  archived: Set<string>
  tags: TagRow[]
  details: Map<string, Detail>
}

let store: Store | null = null

export const FIRST_MOCK_BOARD_ID = "b0000000-0000-4000-8000-000000000001"

export function getMockBoardsStore(nowIso: string): Store {
  // Rebuilt once per day so relative dates ("Hoje", "Atrasadas") never go stale.
  if (!store || store.day !== dayOf(nowIso)) {
    const { boards, tags } = buildMockBoards(nowIso)
    const details = new Map<string, Detail>()
    for (const board of boards) {
      for (const task of board.tasks) {
        details.set(task.id, {
          checklist: Array.from({ length: task.checklistTotal }, (_, index) => ({
            id: mockId("chk"),
            user_id: USER,
            task_id: task.id,
            text: ["Reunir os números", "Escrever o resumo", "Revisar com a equipe", "Enviar para aprovação", "Arquivar versão final", "Avisar o time"][index] ?? `Item ${index + 1}`,
            done: index < task.checklistDone,
            position: (index + 1) * 1000,
            created_at: task.created_at,
            updated_at: task.updated_at,
          })),
          comments: Array.from({ length: task.commentCount }, (_, index) => ({
            id: mockId("cmt"),
            user_id: USER,
            task_id: task.id,
            body: ["Lembrar de incluir o comparativo com o mês passado.", "Combinei com a Marina de enviar até as 17h."][index] ?? "Anotado.",
            created_at: task.created_at,
            updated_at: task.created_at,
          })),
          attachments: Array.from({ length: task.attachmentCount }, (_, index) => ({
            id: mockId("att"),
            user_id: USER,
            entity_type: "task",
            entity_id: task.id,
            storage_path: `mock/${task.id}/${index}`,
            file_name: ["proposta-almeida-v3.pdf", "resultados-3t.xlsx"][index] ?? `arquivo-${index + 1}.pdf`,
            mime_type: "application/pdf",
            size_bytes: [482_000, 1_240_000][index] ?? 100_000,
            created_at: task.created_at,
            updated_at: task.created_at,
          })),
        })
      }
    }
    store = { day: dayOf(nowIso), boards, archived: new Set(), tags, details }
  }
  return store
}

const ok = { ok: true } as const

/** Same contract as the Supabase server actions, but everything stays in memory. */
export function createMockBoardApi(nowIso: string): BoardApi {
  const s = getMockBoardsStore(nowIso)
  const allTasks = () => s.boards.flatMap((b) => b.tasks)
  const findTask = (id: string) => allTasks().find((t) => t.id === id)
  const boardOf = (boardId: string) => s.boards.find((b) => b.board.id === boardId)
  const stamp = () => new Date().toISOString()
  const detailOf = (taskId: string) => {
    let detail = s.details.get(taskId)
    if (!detail) {
      detail = { checklist: [], comments: [], attachments: [] }
      s.details.set(taskId, detail)
    }
    return detail
  }
  const refreshBoardList = () => {
    const list = s.boards.filter((b) => !s.archived.has(b.board.id)).map((b) => ({ id: b.board.id, name: b.board.name }))
    for (const board of s.boards) board.boards = list
  }
  const withCounters = (task: TaskView): TaskView => {
    const detail = detailOf(task.id)
    return {
      ...task,
      checklistTotal: detail.checklist.length,
      checklistDone: detail.checklist.filter((i) => i.done).length,
      commentCount: detail.comments.length,
      attachmentCount: detail.attachments.length,
    }
  }
  const replace = (task: TaskView) => {
    const board = boardOf(task.board_id)
    if (board) board.tasks = board.tasks.map((t) => (t.id === task.id ? task : t))
  }

  return {
    async createBoard({ name }) {
      const id = mockId("brd")
      const list = (label: string, index: number, done = false): ListRow => ({
        id: mockId("list"),
        user_id: USER,
        board_id: id,
        name: label,
        position: (index + 1) * 1000,
        is_done_list: done,
        created_at: stamp(),
        updated_at: stamp(),
      })
      s.boards.push({
        board: { id, user_id: USER, name, position: s.boards.length * 1000 + 1000, archived: false, created_at: stamp(), updated_at: stamp() },
        boards: [],
        lists: [list("A fazer", 0), list("Em andamento", 1), list("Concluído", 2, true)],
        tasks: [],
        tags: s.tags,
        timezone: s.boards[0]?.timezone ?? "America/Sao_Paulo",
      })
      refreshBoardList()
      return { ok: true, data: { id } }
    },
    async renameBoard({ id, name }) {
      const board = boardOf(id)
      if (board) board.board = { ...board.board, name }
      refreshBoardList()
      return ok
    },
    async archiveBoard(id) {
      s.archived.add(id)
      refreshBoardList()
      const next = s.boards.find((b) => !s.archived.has(b.board.id))
      return { ok: true, data: { nextBoardId: next?.board.id ?? null } }
    },

    async createList({ boardId, name }) {
      const board = boardOf(boardId)
      if (!board) return { ok: false, error: "Quadro não encontrado." }
      const list: ListRow = {
        id: mockId("list"),
        user_id: USER,
        board_id: boardId,
        name,
        position: Math.max(0, ...board.lists.map((l) => l.position)) + 1000,
        is_done_list: false,
        created_at: stamp(),
        updated_at: stamp(),
      }
      board.lists = [...board.lists, list]
      return { ok: true, data: list }
    },
    async updateList({ id, name, isDoneList }) {
      for (const board of s.boards) {
        board.lists = board.lists.map((l) =>
          l.id === id ? { ...l, name: name ?? l.name, is_done_list: isDoneList ?? l.is_done_list } : l
        )
      }
      return ok
    },
    async deleteList(id) {
      for (const board of s.boards) {
        if (!board.lists.some((l) => l.id === id)) continue
        if (board.lists.length <= 1) return { ok: false, error: "O quadro precisa ter pelo menos uma lista." }
        board.lists = board.lists.filter((l) => l.id !== id)
        board.tasks = board.tasks.filter((t) => t.list_id !== id)
      }
      return ok
    },
    async reorderLists({ boardId, listIds }) {
      const board = boardOf(boardId)
      if (board) {
        board.lists = listIds
          .map((id, index) => {
            const list = board.lists.find((l) => l.id === id)
            return list ? { ...list, position: (index + 1) * 1000 } : null
          })
          .filter((l): l is ListRow => Boolean(l))
      }
      return ok
    },

    async createTask(input) {
      const board = boardOf(input.boardId)
      if (!board) return { ok: false, error: "Quadro não encontrado." }
      const task: TaskView = {
        id: mockId("task"),
        user_id: USER,
        board_id: input.boardId,
        list_id: input.listId,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? "none",
        due_at: input.dueAt ?? null,
        due_has_time: input.dueHasTime ?? false,
        category: input.category ?? null,
        swatch: input.swatch ?? "neutro",
        position: Math.max(0, ...board.tasks.filter((t) => t.list_id === input.listId).map((t) => t.position)) + 1000,
        completed_at: null,
        archived: false,
        created_at: stamp(),
        updated_at: stamp(),
        tagIds: [],
        checklistTotal: 0,
        checklistDone: 0,
        commentCount: 0,
        attachmentCount: 0,
      }
      board.tasks = [...board.tasks, task]
      return { ok: true, data: task }
    },
    async updateTask({ id, patch }) {
      const task = findTask(id)
      if (!task) return { ok: false, error: "Tarefa não encontrada." }
      const next: TaskView = {
        ...task,
        title: patch.title ?? task.title,
        description: patch.description === undefined ? task.description : patch.description,
        priority: patch.priority ?? task.priority,
        due_at: patch.dueAt === undefined ? task.due_at : patch.dueAt,
        due_has_time: patch.dueAt === null ? false : (patch.dueHasTime ?? task.due_has_time),
        category: patch.category === undefined ? task.category : patch.category,
        swatch: patch.swatch ?? task.swatch,
        updated_at: stamp(),
      }
      replace(next)
      return { ok: true, data: withCounters(next) }
    },
    async deleteTask(id) {
      for (const board of s.boards) board.tasks = board.tasks.filter((t) => t.id !== id)
      return ok
    },
    async moveTasks({ listId, taskIds }) {
      const target = s.boards.flatMap((b) => b.lists).find((l) => l.id === listId)
      taskIds.forEach((taskId, index) => {
        const task = findTask(taskId)
        if (!task) return
        replace({
          ...task,
          list_id: listId,
          position: (index + 1) * 1000,
          completed_at: target?.is_done_list ? (task.completed_at ?? stamp()) : null,
        })
      })
      return ok
    },
    async completeTask({ id, done }) {
      const task = findTask(id)
      const board = task ? boardOf(task.board_id) : undefined
      if (!task || !board) return { ok: false, error: "Tarefa não encontrada." }
      const target = done ? board.lists.find((l) => l.is_done_list) : (board.lists.find((l) => !l.is_done_list) ?? board.lists[0])
      const listId = target?.id ?? task.list_id
      const position =
        target && target.id !== task.list_id
          ? Math.max(0, ...board.tasks.filter((t) => t.list_id === listId).map((t) => t.position)) + 1000
          : task.position
      const completedAt = done ? stamp() : null
      replace({ ...task, list_id: listId, position, completed_at: completedAt })
      return { ok: true, data: { listId, completedAt, position } }
    },

    async createTag({ name, swatch }) {
      if (s.tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
        return { ok: false, error: "Você já tem uma tag com esse nome." }
      }
      const tag: TagRow = { id: mockId("tag"), user_id: USER, name, swatch: swatch ?? "neutro", created_at: stamp(), updated_at: stamp() }
      s.tags.push(tag)
      return { ok: true, data: tag }
    },
    async setTaskTags({ taskId, tagIds }) {
      const task = findTask(taskId)
      if (task) replace({ ...task, tagIds })
      return ok
    },

    async addChecklistItem({ taskId, text }) {
      const detail = detailOf(taskId)
      const item: ChecklistItemRow = {
        id: mockId("chk"),
        user_id: USER,
        task_id: taskId,
        text,
        done: false,
        position: (detail.checklist.length + 1) * 1000,
        created_at: stamp(),
        updated_at: stamp(),
      }
      detail.checklist.push(item)
      return { ok: true, data: item }
    },
    async updateChecklistItem({ id, text, done }) {
      for (const detail of s.details.values()) {
        detail.checklist = detail.checklist.map((i) => (i.id === id ? { ...i, text: text ?? i.text, done: done ?? i.done } : i))
      }
      return ok
    },
    async deleteChecklistItem(id) {
      for (const detail of s.details.values()) detail.checklist = detail.checklist.filter((i) => i.id !== id)
      return ok
    },

    async addComment({ taskId, body }) {
      const comment: CommentRow = { id: mockId("cmt"), user_id: USER, task_id: taskId, body, created_at: stamp(), updated_at: stamp() }
      detailOf(taskId).comments.push(comment)
      return { ok: true, data: comment }
    },
    async deleteComment(id) {
      for (const detail of s.details.values()) detail.comments = detail.comments.filter((c) => c.id !== id)
      return ok
    },

    async getTaskDetail(taskId) {
      const detail = detailOf(taskId)
      return { ok: true, data: { checklist: [...detail.checklist], comments: [...detail.comments], attachments: [...detail.attachments] } }
    },
    async uploadAttachment({ taskId, file }) {
      const attachment: AttachmentRow = {
        id: mockId("att"),
        user_id: USER,
        entity_type: "task",
        entity_id: taskId,
        storage_path: `mock/${taskId}/${file.name}`,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        created_at: stamp(),
        updated_at: stamp(),
      }
      detailOf(taskId).attachments.push(attachment)
      return { ok: true, data: attachment }
    },
    async deleteAttachment(id) {
      for (const detail of s.details.values()) detail.attachments = detail.attachments.filter((a) => a.id !== id)
      return ok
    },
    async getAttachmentUrl() {
      return { ok: true, data: { url: "data:text/plain;charset=utf-8,Arquivo%20de%20exemplo%20do%20prot%C3%B3tipo." } }
    },
  }
}
