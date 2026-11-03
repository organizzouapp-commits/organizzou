"use client"

import { useMemo } from "react"

import { BoardClient } from "@/components/tasks/board-client"
import type { BoardApi } from "@/features/tasks/board-api"
import type { AttachmentRow, BoardData, ChecklistItemRow, CommentRow, ListRow, TagRow, TaskView } from "@/features/tasks/types"
import { toDueIso } from "@/lib/dates"

const TZ = "America/Sao_Paulo"
const U = "00000000-0000-4000-8000-000000000001"

const BOARD = "b0000000-0000-4000-8000-000000000001"
const L = [
  { id: "a0000000-0000-4000-8000-000000000001", name: "A fazer", done: false },
  { id: "a0000000-0000-4000-8000-000000000002", name: "Em andamento", done: false },
  { id: "a0000000-0000-4000-8000-000000000003", name: "Concluído", done: true },
]
const TAGS = ["Casa", "Trabalho", "Pessoal", "Estudos"].map((name, i): TagRow => ({ id: `c0000000-0000-4000-8000-00000000000${i + 1}`, name, swatch: "neutro", user_id: U, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" }))

function ymd(offsetDays: number, now: number) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date(now + offsetDays * 86_400_000))
}

function build(nowMs: number, volume = 0): BoardData {
  const lists: ListRow[] = L.map((l, i) => ({ id: l.id, board_id: BOARD, name: l.name, is_done_list: l.done, position: (i + 1) * 1000, user_id: U, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" }))
  let n = 0
  const task = (listIdx: number, title: string, over: Partial<TaskView> & { dueDay?: number; time?: string; tags?: number[] } = {}): TaskView => {
    n += 1
    const { dueDay, time, tags, ...rest } = over
    return {
      id: `d0000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      board_id: BOARD,
      list_id: L[listIdx].id,
      title,
      description: null,
      priority: "none",
      due_at: dueDay === undefined ? null : toDueIso(ymd(dueDay, nowMs), time ?? null, TZ),
      due_has_time: Boolean(time),
      completed_at: L[listIdx].done ? new Date(nowMs - n * 3_600_000).toISOString() : null,
      archived: false,
      position: n * 1000,
      swatch: "neutro",
      category: null,
      user_id: U,
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
      tagIds: (tags ?? []).map((t) => TAGS[t].id),
      checklistTotal: 0,
      checklistDone: 0,
      commentCount: 0,
      attachmentCount: 0,
      ...rest,
    }
  }
  const tasks = [
    task(0, "Comprar planta para a sala", { dueDay: 0, tags: [0] }),
    task(0, "Revisar proposta do cliente Almeida & Filhos com a equipe comercial antes da reunião de quinta", { dueDay: 1, time: "10:00", priority: "high", tags: [1], attachmentCount: 1 }),
    task(0, "Planejar viagem de fim de ano para Florianópolis", { dueDay: 20, tags: [2], checklistTotal: 4, checklistDone: 1 }),
    task(0, "Atualizar planilha de custos do trimestre", { dueDay: 4, tags: [1] }),
    task(0, "Pesquisar curso de fotografia", { tags: [2, 3, 0] }),
    task(0, "Enviar relatório semanal", { dueDay: -1, tags: [1] }),
    task(0, "Pagar o IPTU", { dueDay: -2, priority: "high" }),
    task(0, "Ligar para o contador", { dueDay: 0, time: "23:30", priority: "high", commentCount: 2 }),
    task(0, "Agendar dentista", { dueDay: 2 }),
    task(1, "Preparar apresentação de resultados do 3º trimestre", { dueDay: 3, time: "14:00", priority: "high", tags: [1], checklistTotal: 5, checklistDone: 3, commentCount: 1, attachmentCount: 2 }),
    task(1, "Organizar o guarda-roupa", { dueDay: 1, tags: [0] }),
    task(1, "Entrevistar candidata para vaga de analista", { dueDay: 5, time: "11:00", tags: [1] }),
    task(2, "Fechar contrato com fornecedor de embalagens", { dueDay: -3, tags: [1] }),
    task(2, "Trocar a lâmpada da cozinha", { tags: [0] }),
    task(2, "Conciliar notas fiscais de setembro", { tags: [1] }),
    // Optional extra volume (?volume=30) to exercise the internal scroll of a long list.
    ...Array.from({ length: volume }, (_, i) => task(0, `Tarefa extra ${i + 1}`, { dueDay: (i % 9) - 2 })),
  ]
  return { board: { id: BOARD, name: "Minhas tarefas", user_id: U, archived: false, position: 1000, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" } as BoardData["board"], boards: [{ id: BOARD, name: "Minhas tarefas" }, { id: "b0000000-0000-4000-8000-000000000002", name: "Casa e vida" }], lists, tasks, tags: TAGS, timezone: TZ }
}

/** An in-memory BoardApi: enough for the screens to work end to end in the fixture (nothing is saved anywhere). */
function createFixtureApi(initial: BoardData): BoardApi {
  const ok = { ok: true } as const
  let tasks = [...initial.tasks]
  const checklists = new Map<string, ChecklistItemRow[]>()
  const comments = new Map<string, CommentRow[]>()
  const attachments = new Map<string, AttachmentRow[]>()
  const seq = { n: 1000 }
  const nid = () => `e0000000-0000-4000-8000-${String(++seq.n).padStart(12, "0")}`
  const stamp = () => new Date().toISOString()
  const patchTask = (taskId: string, patch: Partial<TaskView>) => {
    tasks = tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
    return tasks.find((t) => t.id === taskId)!
  }
  return {
    createBoard: async () => ({ ok: true, data: { id: nid() } }),
    renameBoard: async () => ok,
    archiveBoard: async () => ({ ok: true, data: { nextBoardId: null } }),
    createList: async (input) => ({ ok: true, data: { id: nid(), board_id: input.boardId, name: input.name, is_done_list: false, position: 9000, user_id: U, created_at: stamp(), updated_at: stamp() } }),
    updateList: async () => ok,
    deleteList: async () => ok,
    reorderLists: async () => ok,
    createTask: async (input) => {
      const t: TaskView = {
        id: nid(), board_id: input.boardId, list_id: input.listId, title: input.title, description: input.description ?? null, priority: input.priority ?? "none", due_at: input.dueAt ?? null, due_has_time: input.dueHasTime ?? false,
        completed_at: null, archived: false, position: 99000 + seq.n, swatch: "neutro", category: null, user_id: U, created_at: stamp(), updated_at: stamp(), tagIds: [], checklistTotal: 0, checklistDone: 0, commentCount: 0, attachmentCount: 0,
      }
      tasks = [...tasks, t]
      return { ok: true, data: t }
    },
    updateTask: async ({ id: taskId, patch }) => {
      const mapped: Partial<TaskView> = {}
      if (patch.title !== undefined) mapped.title = patch.title
      if (patch.description !== undefined) mapped.description = patch.description
      if (patch.priority !== undefined) mapped.priority = patch.priority
      if (patch.dueAt !== undefined) mapped.due_at = patch.dueAt
      if (patch.dueHasTime !== undefined) mapped.due_has_time = patch.dueHasTime
      if (patch.category !== undefined) mapped.category = patch.category
      if (patch.swatch !== undefined) mapped.swatch = patch.swatch
      return { ok: true, data: patchTask(taskId, mapped) }
    },
    deleteTask: async (taskId) => {
      tasks = tasks.filter((t) => t.id !== taskId)
      return ok
    },
    moveTasks: async ({ listId, taskIds }) => {
      const target = initial.lists.find((l) => l.id === listId)
      taskIds.forEach((taskId, i) => patchTask(taskId, { list_id: listId, position: (i + 1) * 1000, completed_at: target?.is_done_list ? stamp() : null }))
      return ok
    },
    completeTask: async ({ id: taskId, done }) => {
      const list = initial.lists.find((l) => (done ? l.is_done_list : !l.is_done_list))!
      patchTask(taskId, { list_id: list.id, completed_at: done ? stamp() : null })
      return { ok: true, data: { listId: list.id, completedAt: done ? stamp() : null, position: 99000 } }
    },
    moveTaskToBoard: async ({ taskId, boardId }) => {
      tasks = tasks.filter((t) => t.id !== taskId)
      return { ok: true, data: { boardName: boardId.endsWith("2") ? "Casa e vida" : "Minhas tarefas", listId: "a0000000-0000-4000-8000-000000000001", listName: "A fazer" } }
    },
    getBoardLists: async (boardId) => ({ ok: true, data: initial.lists.map((l) => ({ ...l, board_id: boardId })) }),
    renameTag: async () => ok,
    deleteTag: async () => ok,
    createTag: async ({ name }) => ({ ok: true, data: { id: nid(), name, swatch: "neutro", user_id: U, created_at: stamp(), updated_at: stamp() } }),
    setTaskTags: async ({ taskId, tagIds }) => {
      patchTask(taskId, { tagIds })
      return ok
    },
    addChecklistItem: async ({ taskId, text }) => {
      const item: ChecklistItemRow = { id: nid(), task_id: taskId, text, done: false, position: 0, user_id: U, created_at: stamp(), updated_at: stamp() } as ChecklistItemRow
      checklists.set(taskId, [...(checklists.get(taskId) ?? []), item])
      return { ok: true, data: item }
    },
    updateChecklistItem: async ({ id: itemId, text, done }) => {
      for (const [taskId, list] of checklists) checklists.set(taskId, list.map((i) => (i.id === itemId ? { ...i, ...(text !== undefined ? { text } : {}), ...(done !== undefined ? { done } : {}) } : i)))
      return ok
    },
    deleteChecklistItem: async (itemId) => {
      for (const [taskId, list] of checklists) checklists.set(taskId, list.filter((i) => i.id !== itemId))
      return ok
    },
    addComment: async ({ taskId, body }) => {
      const c: CommentRow = { id: nid(), task_id: taskId, body, user_id: U, created_at: stamp(), updated_at: stamp() } as CommentRow
      comments.set(taskId, [...(comments.get(taskId) ?? []), c])
      return { ok: true, data: c }
    },
    deleteComment: async (commentId) => {
      for (const [taskId, list] of comments) comments.set(taskId, list.filter((c) => c.id !== commentId))
      return ok
    },
    getTaskDetail: async (taskId) => ({ ok: true, data: { checklist: checklists.get(taskId) ?? [], comments: comments.get(taskId) ?? [], attachments: attachments.get(taskId) ?? [] } }),
    uploadAttachment: async ({ taskId, file }) => {
      const a: AttachmentRow = { id: nid(), task_id: taskId, file_name: file.name, size_bytes: file.size, mime_type: file.type, storage_path: "fixture", user_id: U, created_at: stamp() } as unknown as AttachmentRow
      attachments.set(taskId, [...(attachments.get(taskId) ?? []), a])
      return { ok: true, data: a }
    },
    deleteAttachment: async (attId) => {
      for (const [taskId, list] of attachments) attachments.set(taskId, list.filter((a) => a.id !== attId))
      return ok
    },
    getAttachmentUrl: async () => ({ ok: true, data: { url: "about:blank" } }),
  }
}

export function FixtureBoard({ nowMs, view, volume = 0 }: { nowMs: number; view: "kanban" | "lista" | "calendario" | null; volume?: number }) {
  const data = useMemo(() => build(nowMs, volume), [nowMs, volume])
  const api = useMemo(() => createFixtureApi(data), [data])
  return <BoardClient initial={data} api={api} initialView={view} nowIso={new Date(nowMs).toISOString()} basePath="/design-system/tarefas" />
}


