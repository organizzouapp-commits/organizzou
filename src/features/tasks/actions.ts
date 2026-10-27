"use server"

import { revalidatePath } from "next/cache"
import type { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"

import {
  addChecklistItemSchema,
  addCommentSchema,
  completeTaskSchema,
  createBoardSchema,
  createListSchema,
  createTagSchema,
  createTaskSchema,
  moveTasksSchema,
  registerAttachmentSchema,
  renameBoardSchema,
  reorderListsSchema,
  setTaskTagsSchema,
  updateChecklistItemSchema,
  updateListSchema,
  updateTaskSchema,
} from "./schemas"
import { queryTaskDetail } from "./detail"
import { buildTaskViews } from "./queries"
import type {
  ActionResult,
  AttachmentRow,
  ChecklistItemRow,
  CommentRow,
  ListRow,
  TagRow,
  TaskDetail,
  TaskView,
} from "./types"

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"]

const SAVE_ERROR = "Não consegui salvar. Verifique a conexão e tente de novo."
const SESSION_ERROR = "Sua sessão expirou. Entre de novo."

async function session() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  return userId ? { supabase, userId } : null
}

function invalid(error: z.ZodError): { ok: false; error: string } {
  return { ok: false, error: error.issues[0]?.message ?? SAVE_ERROR }
}

function refresh() {
  revalidatePath("/dashboard")
}

// ---------------------------------------------------------------- boards

export async function createBoard(input: z.input<typeof createBoardSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = createBoardSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }

  const { data: last } = await s.supabase.from("boards").select("position").order("position", { ascending: false }).limit(1)
  const { data: board, error } = await s.supabase
    .from("boards")
    .insert({ user_id: s.userId, name: parsed.data.name, position: (last?.[0]?.position ?? 0) + 1000 })
    .select("id")
    .single()
  if (error || !board) return { ok: false, error: SAVE_ERROR }

  const { error: listsError } = await s.supabase.from("board_lists").insert([
    { user_id: s.userId, board_id: board.id, name: "A fazer", position: 1000 },
    { user_id: s.userId, board_id: board.id, name: "Em andamento", position: 2000 },
    { user_id: s.userId, board_id: board.id, name: "Concluído", position: 3000, is_done_list: true },
  ])
  if (listsError) return { ok: false, error: SAVE_ERROR }

  return { ok: true, data: { id: board.id } }
}

export async function renameBoard(input: z.input<typeof renameBoardSchema>): Promise<ActionResult> {
  const parsed = renameBoardSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }

  const { error } = await s.supabase.from("boards").update({ name: parsed.data.name }).eq("id", parsed.data.id)
  return error ? { ok: false, error: SAVE_ERROR } : { ok: true }
}

/** Archives a board (soft delete). The UI asks for confirmation first. */
export async function archiveBoard(id: string): Promise<ActionResult<{ nextBoardId: string | null }>> {
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }

  const { error } = await s.supabase.from("boards").update({ archived: true }).eq("id", id)
  if (error) return { ok: false, error: SAVE_ERROR }

  await s.supabase.from("audit_log").insert({
    user_id: s.userId,
    actor: "app",
    action: "board.archive",
    entity_type: "board",
    entity_id: id,
    confirmed_at: new Date().toISOString(),
  })

  const { data: next } = await s.supabase.from("boards").select("id").eq("archived", false).order("position").limit(1)
  refresh()
  return { ok: true, data: { nextBoardId: next?.[0]?.id ?? null } }
}

// ----------------------------------------------------------------- lists

export async function createList(input: z.input<typeof createListSchema>): Promise<ActionResult<ListRow>> {
  const parsed = createListSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }

  const { data: last } = await s.supabase
    .from("board_lists")
    .select("position")
    .eq("board_id", parsed.data.boardId)
    .order("position", { ascending: false })
    .limit(1)
  const { data, error } = await s.supabase
    .from("board_lists")
    .insert({
      user_id: s.userId,
      board_id: parsed.data.boardId,
      name: parsed.data.name,
      position: (last?.[0]?.position ?? 0) + 1000,
    })
    .select("*")
    .single()
  return error || !data ? { ok: false, error: SAVE_ERROR } : { ok: true, data }
}

export async function updateList(input: z.input<typeof updateListSchema>): Promise<ActionResult> {
  const parsed = updateListSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }

  const patch: { name?: string; is_done_list?: boolean } = {}
  if (parsed.data.name !== undefined) patch.name = parsed.data.name
  if (parsed.data.isDoneList !== undefined) patch.is_done_list = parsed.data.isDoneList
  const { error } = await s.supabase.from("board_lists").update(patch).eq("id", parsed.data.id)
  if (error) return { ok: false, error: SAVE_ERROR }
  refresh()
  return { ok: true }
}

/** Deletes a list and every task in it. The UI shows the task count and asks for confirmation first. */
export async function deleteList(id: string): Promise<ActionResult> {
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }

  const { data: list } = await s.supabase.from("board_lists").select("board_id").eq("id", id).maybeSingle()
  if (!list) return { ok: false, error: SAVE_ERROR }
  const { count } = await s.supabase
    .from("board_lists")
    .select("id", { count: "exact", head: true })
    .eq("board_id", list.board_id)
  if ((count ?? 0) <= 1) return { ok: false, error: "O quadro precisa ter pelo menos uma lista." }

  const { error } = await s.supabase.from("board_lists").delete().eq("id", id)
  if (error) return { ok: false, error: SAVE_ERROR }

  await s.supabase.from("audit_log").insert({
    user_id: s.userId,
    actor: "app",
    action: "list.delete",
    entity_type: "board_list",
    entity_id: id,
    confirmed_at: new Date().toISOString(),
  })
  refresh()
  return { ok: true }
}

export async function reorderLists(input: z.input<typeof reorderListsSchema>): Promise<ActionResult> {
  const parsed = reorderListsSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }

  const { error } = await s.supabase.rpc("reorder_lists", {
    p_board_id: parsed.data.boardId,
    p_list_ids: parsed.data.listIds,
  })
  return error ? { ok: false, error: SAVE_ERROR } : { ok: true }
}

// ----------------------------------------------------------------- tasks

export async function createTask(input: z.input<typeof createTaskSchema>): Promise<ActionResult<TaskView>> {
  const parsed = createTaskSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }
  const v = parsed.data

  const { data: last } = await s.supabase
    .from("tasks")
    .select("position")
    .eq("list_id", v.listId)
    .order("position", { ascending: false })
    .limit(1)
  const { data, error } = await s.supabase
    .from("tasks")
    .insert({
      user_id: s.userId,
      board_id: v.boardId,
      list_id: v.listId,
      title: v.title,
      description: v.description ?? null,
      priority: v.priority ?? "none",
      due_at: v.dueAt ?? null,
      due_has_time: v.dueHasTime ?? false,
      category: v.category || null,
      swatch: v.swatch ?? "neutro",
      position: (last?.[0]?.position ?? 0) + 1000,
    })
    .select("*")
    .single()
  if (error || !data) return { ok: false, error: SAVE_ERROR }

  const [view] = await buildTaskViews(s.supabase, [data])
  refresh()
  return { ok: true, data: view }
}

export async function updateTask(input: z.input<typeof updateTaskSchema>): Promise<ActionResult<TaskView>> {
  const parsed = updateTaskSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }
  const p = parsed.data.patch

  const patch: TaskUpdate = {}
  if (p.title !== undefined) patch.title = p.title
  if (p.description !== undefined) patch.description = p.description
  if (p.priority !== undefined) patch.priority = p.priority
  if (p.dueAt !== undefined) patch.due_at = p.dueAt
  if (p.dueHasTime !== undefined) patch.due_has_time = p.dueHasTime
  if (p.category !== undefined) patch.category = p.category || null
  if (p.swatch !== undefined) patch.swatch = p.swatch
  if (p.dueAt === null) patch.due_has_time = false

  const { data, error } = await s.supabase.from("tasks").update(patch).eq("id", parsed.data.id).select("*").single()
  if (error || !data) return { ok: false, error: SAVE_ERROR }

  const [view] = await buildTaskViews(s.supabase, [data])
  refresh()
  return { ok: true, data: view }
}

/** Deletes a task for good. The UI asks for confirmation first. */
export async function deleteTask(id: string): Promise<ActionResult> {
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }

  const { data: files } = await s.supabase
    .from("attachments")
    .select("id, storage_path")
    .eq("entity_type", "task")
    .eq("entity_id", id)

  const { error } = await s.supabase.from("tasks").delete().eq("id", id)
  if (error) return { ok: false, error: SAVE_ERROR }

  if (files && files.length > 0) {
    await s.supabase.storage.from("task-attachments").remove(files.map((f) => f.storage_path))
    await s.supabase.from("attachments").delete().in("id", files.map((f) => f.id))
  }
  await s.supabase.from("audit_log").insert({
    user_id: s.userId,
    actor: "app",
    action: "task.delete",
    entity_type: "task",
    entity_id: id,
    confirmed_at: new Date().toISOString(),
  })
  refresh()
  return { ok: true }
}

/** Moves tasks into `listId` in the given order (drag and drop). Done lists set `completed_at`. */
export async function moveTasks(input: z.input<typeof moveTasksSchema>): Promise<ActionResult> {
  const parsed = moveTasksSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }

  const { error } = await s.supabase.rpc("reorder_tasks", {
    p_list_id: parsed.data.listId,
    p_task_ids: parsed.data.taskIds,
  })
  if (error) return { ok: false, error: SAVE_ERROR }
  refresh()
  return { ok: true }
}

/** Completes a task (moves it to the board's done list) or reopens it (moves it to the first open list). */
export async function completeTask(
  input: z.input<typeof completeTaskSchema>
): Promise<ActionResult<{ listId: string; completedAt: string | null; position: number }>> {
  const parsed = completeTaskSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }

  const { data: task } = await s.supabase.from("tasks").select("id, board_id, list_id").eq("id", parsed.data.id).maybeSingle()
  if (!task) return { ok: false, error: SAVE_ERROR }
  const { data: lists } = await s.supabase.from("board_lists").select("id, is_done_list, position").eq("board_id", task.board_id).order("position")
  if (!lists || lists.length === 0) return { ok: false, error: SAVE_ERROR }

  const target = parsed.data.done
    ? (lists.find((l) => l.is_done_list) ?? null)
    : (lists.find((l) => !l.is_done_list) ?? lists[0])

  // No done list: keep the task where it is and only toggle completed_at.
  const listId = target?.id ?? task.list_id
  const { data: last } = await s.supabase
    .from("tasks")
    .select("position")
    .eq("list_id", listId)
    .order("position", { ascending: false })
    .limit(1)
  const position = target && target.id !== task.list_id ? (last?.[0]?.position ?? 0) + 1000 : undefined
  const completedAt = parsed.data.done ? new Date().toISOString() : null

  const { data: updated, error } = await s.supabase
    .from("tasks")
    .update({ list_id: listId, completed_at: completedAt, ...(position !== undefined ? { position } : {}) })
    .eq("id", parsed.data.id)
    .select("list_id, completed_at, position")
    .single()
  if (error || !updated) return { ok: false, error: SAVE_ERROR }
  refresh()
  return { ok: true, data: { listId: updated.list_id, completedAt: updated.completed_at, position: updated.position } }
}

// ------------------------------------------------------------------ tags

export async function createTag(input: z.input<typeof createTagSchema>): Promise<ActionResult<TagRow>> {
  const parsed = createTagSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }

  const { data, error } = await s.supabase
    .from("tags")
    .insert({ user_id: s.userId, name: parsed.data.name, swatch: parsed.data.swatch ?? "neutro" })
    .select("*")
    .single()
  if (error?.code === "23505") return { ok: false, error: "Você já tem uma tag com esse nome." }
  return error || !data ? { ok: false, error: SAVE_ERROR } : { ok: true, data }
}

export async function setTaskTags(input: z.input<typeof setTaskTagsSchema>): Promise<ActionResult> {
  const parsed = setTaskTagsSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }
  const { taskId, tagIds } = parsed.data

  const { error: deleteError } = await s.supabase.from("task_tags").delete().eq("task_id", taskId)
  if (deleteError) return { ok: false, error: SAVE_ERROR }
  if (tagIds.length > 0) {
    const { error } = await s.supabase
      .from("task_tags")
      .insert(tagIds.map((tag_id) => ({ user_id: s.userId, task_id: taskId, tag_id })))
    if (error) return { ok: false, error: SAVE_ERROR }
  }
  return { ok: true }
}

// ------------------------------------------------------------- checklist

export async function addChecklistItem(
  input: z.input<typeof addChecklistItemSchema>
): Promise<ActionResult<ChecklistItemRow>> {
  const parsed = addChecklistItemSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }

  const { data: last } = await s.supabase
    .from("task_checklist_items")
    .select("position")
    .eq("task_id", parsed.data.taskId)
    .order("position", { ascending: false })
    .limit(1)
  const { data, error } = await s.supabase
    .from("task_checklist_items")
    .insert({
      user_id: s.userId,
      task_id: parsed.data.taskId,
      text: parsed.data.text,
      position: (last?.[0]?.position ?? 0) + 1000,
    })
    .select("*")
    .single()
  return error || !data ? { ok: false, error: SAVE_ERROR } : { ok: true, data }
}

export async function updateChecklistItem(input: z.input<typeof updateChecklistItemSchema>): Promise<ActionResult> {
  const parsed = updateChecklistItemSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }

  const patch: { text?: string; done?: boolean } = {}
  if (parsed.data.text !== undefined) patch.text = parsed.data.text
  if (parsed.data.done !== undefined) patch.done = parsed.data.done
  const { error } = await s.supabase.from("task_checklist_items").update(patch).eq("id", parsed.data.id)
  return error ? { ok: false, error: SAVE_ERROR } : { ok: true }
}

export async function deleteChecklistItem(id: string): Promise<ActionResult> {
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }
  const { error } = await s.supabase.from("task_checklist_items").delete().eq("id", id)
  return error ? { ok: false, error: SAVE_ERROR } : { ok: true }
}

// -------------------------------------------------------------- comments

export async function addComment(input: z.input<typeof addCommentSchema>): Promise<ActionResult<CommentRow>> {
  const parsed = addCommentSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }

  const { data, error } = await s.supabase
    .from("task_comments")
    .insert({ user_id: s.userId, task_id: parsed.data.taskId, body: parsed.data.body })
    .select("*")
    .single()
  return error || !data ? { ok: false, error: SAVE_ERROR } : { ok: true, data }
}

export async function deleteComment(id: string): Promise<ActionResult> {
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }
  const { error } = await s.supabase.from("task_comments").delete().eq("id", id)
  return error ? { ok: false, error: SAVE_ERROR } : { ok: true }
}

// ----------------------------------------------------------- attachments

/** Registers a file the browser already uploaded to Storage under "<user_id>/...". */
export async function registerAttachment(
  input: z.input<typeof registerAttachmentSchema>
): Promise<ActionResult<AttachmentRow>> {
  const parsed = registerAttachmentSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }

  if (!parsed.data.storagePath.startsWith(`${s.userId}/`)) {
    return { ok: false, error: "Arquivo inválido." }
  }
  const { data, error } = await s.supabase
    .from("attachments")
    .insert({
      user_id: s.userId,
      entity_type: "task",
      entity_id: parsed.data.taskId,
      storage_path: parsed.data.storagePath,
      file_name: parsed.data.fileName,
      mime_type: parsed.data.mimeType ?? null,
      size_bytes: parsed.data.sizeBytes,
    })
    .select("*")
    .single()
  return error || !data ? { ok: false, error: SAVE_ERROR } : { ok: true, data }
}

export async function deleteAttachment(id: string): Promise<ActionResult> {
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }

  const { data: file } = await s.supabase.from("attachments").select("storage_path").eq("id", id).maybeSingle()
  if (!file) return { ok: false, error: SAVE_ERROR }
  await s.supabase.storage.from("task-attachments").remove([file.storage_path])
  const { error } = await s.supabase.from("attachments").delete().eq("id", id)
  return error ? { ok: false, error: SAVE_ERROR } : { ok: true }
}

export async function getAttachmentUrl(id: string): Promise<ActionResult<{ url: string }>> {
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }

  const { data: file } = await s.supabase.from("attachments").select("storage_path, file_name").eq("id", id).maybeSingle()
  if (!file) return { ok: false, error: SAVE_ERROR }
  const { data, error } = await s.supabase.storage
    .from("task-attachments")
    .createSignedUrl(file.storage_path, 60, { download: file.file_name })
  return error || !data ? { ok: false, error: SAVE_ERROR } : { ok: true, data: { url: data.signedUrl } }
}

// ---------------------------------------------------------------- detail

export async function getTaskDetail(taskId: string): Promise<ActionResult<TaskDetail>> {
  const s = await session()
  if (!s) return { ok: false, error: SESSION_ERROR }
  const detail = await queryTaskDetail(s.supabase, taskId)
  return detail ? { ok: true, data: detail } : { ok: false, error: "Não consegui abrir a tarefa." }
}
