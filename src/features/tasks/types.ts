import type { Database } from "@/lib/supabase/types"

type Tables = Database["public"]["Tables"]

export const PRIORITIES = ["none", "low", "medium", "high"] as const
export type Priority = (typeof PRIORITIES)[number]

export const PRIORITY_LABELS: Record<Priority, string> = {
  none: "Sem prioridade",
  low: "Baixa",
  medium: "Média",
  high: "Alta",
}

export type BoardRow = Tables["boards"]["Row"]
export type ListRow = Tables["board_lists"]["Row"]
export type TaskRow = Tables["tasks"]["Row"]
export type TagRow = Tables["tags"]["Row"]
export type ChecklistItemRow = Tables["task_checklist_items"]["Row"]
export type CommentRow = Tables["task_comments"]["Row"]
export type AttachmentRow = Tables["attachments"]["Row"]

/** A task plus the aggregates the board needs to render cards without extra requests. */
export type TaskView = TaskRow & {
  tagIds: string[]
  checklistTotal: number
  checklistDone: number
  commentCount: number
  attachmentCount: number
}

export type BoardData = {
  board: BoardRow
  boards: Pick<BoardRow, "id" | "name">[]
  lists: ListRow[]
  tasks: TaskView[]
  tags: TagRow[]
  timezone: string
}

export type TaskDetail = {
  checklist: ChecklistItemRow[]
  comments: CommentRow[]
  attachments: AttachmentRow[]
}

export type ActionResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string }

export function asPriority(value: string): Priority {
  return (PRIORITIES as readonly string[]).includes(value) ? (value as Priority) : "none"
}
