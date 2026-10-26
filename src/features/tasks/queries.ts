import "server-only"

import { DEFAULT_TIMEZONE } from "@/lib/dates"
import { getSession } from "@/lib/supabase/session"

import type { BoardData, TaskView } from "./types"

export async function getBoards() {
  const { supabase } = await getSession()
  const { data } = await supabase
    .from("boards")
    .select("id, name")
    .eq("archived", false)
    .order("position")
    .order("created_at")
  return data ?? []
}

export async function getTimezone() {
  const { supabase, userId } = await getSession()
  const { data } = await supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle()
  return data?.timezone ?? DEFAULT_TIMEZONE
}

function countBy<T extends { task_id: string }>(rows: T[]) {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const list = map.get(row.task_id)
    if (list) list.push(row)
    else map.set(row.task_id, [row])
  }
  return map
}

/** Attaches tag ids, checklist progress and comment/attachment counts to raw task rows. */
export async function buildTaskViews(
  supabase: Awaited<ReturnType<typeof getSession>>["supabase"],
  tasks: Omit<TaskView, "tagIds" | "checklistTotal" | "checklistDone" | "commentCount" | "attachmentCount">[]
): Promise<TaskView[]> {
  if (tasks.length === 0) return []
  const ids = tasks.map((t) => t.id)

  const [tagLinks, checklist, comments, attachments] = await Promise.all([
    supabase.from("task_tags").select("task_id, tag_id").in("task_id", ids),
    supabase.from("task_checklist_items").select("task_id, done").in("task_id", ids),
    supabase.from("task_comments").select("task_id").in("task_id", ids),
    supabase.from("attachments").select("entity_id").eq("entity_type", "task").in("entity_id", ids),
  ])

  const tagsByTask = countBy(tagLinks.data ?? [])
  const checklistByTask = countBy(checklist.data ?? [])
  const commentsByTask = countBy(comments.data ?? [])
  const attachmentsByTask = new Map<string, number>()
  for (const row of attachments.data ?? []) {
    attachmentsByTask.set(row.entity_id, (attachmentsByTask.get(row.entity_id) ?? 0) + 1)
  }

  return tasks.map((task) => {
    const items = checklistByTask.get(task.id) ?? []
    return {
      ...task,
      tagIds: (tagsByTask.get(task.id) ?? []).map((link) => link.tag_id),
      checklistTotal: items.length,
      checklistDone: items.filter((item) => item.done).length,
      commentCount: commentsByTask.get(task.id)?.length ?? 0,
      attachmentCount: attachmentsByTask.get(task.id) ?? 0,
    }
  })
}

export async function getBoardData(boardId: string): Promise<BoardData | null> {
  const { supabase, userId } = await getSession()

  const [boardRes, boardsRes, listsRes, tasksRes, tagsRes, profileRes] = await Promise.all([
    supabase.from("boards").select("*").eq("id", boardId).eq("archived", false).maybeSingle(),
    supabase.from("boards").select("id, name").eq("archived", false).order("position").order("created_at"),
    supabase.from("board_lists").select("*").eq("board_id", boardId).order("position"),
    supabase.from("tasks").select("*").eq("board_id", boardId).eq("archived", false).order("position"),
    supabase.from("tags").select("*").order("name"),
    supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
  ])

  if (!boardRes.data) return null

  return {
    board: boardRes.data,
    boards: boardsRes.data ?? [],
    lists: listsRes.data ?? [],
    tasks: await buildTaskViews(supabase, tasksRes.data ?? []),
    tags: tagsRes.data ?? [],
    timezone: profileRes.data?.timezone ?? DEFAULT_TIMEZONE,
  }
}
