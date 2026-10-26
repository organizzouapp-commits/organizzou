import type { z } from "zod"

import type {
  addChecklistItemSchema,
  addCommentSchema,
  completeTaskSchema,
  createBoardSchema,
  createListSchema,
  createTagSchema,
  createTaskSchema,
  moveTasksSchema,
  renameBoardSchema,
  reorderListsSchema,
  setTaskTagsSchema,
  updateChecklistItemSchema,
  updateListSchema,
  updateTaskSchema,
} from "./schemas"
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

/**
 * Everything the board UI needs from a backend. The screens only talk to this interface:
 * `createServerBoardApi` (Supabase server actions) is the real one, `createMockBoardApi`
 * (src/mocks/tasks-api.ts) keeps the prototype running in memory.
 */
export type BoardApi = {
  createBoard(input: z.input<typeof createBoardSchema>): Promise<ActionResult<{ id: string }>>
  renameBoard(input: z.input<typeof renameBoardSchema>): Promise<ActionResult>
  archiveBoard(id: string): Promise<ActionResult<{ nextBoardId: string | null }>>

  createList(input: z.input<typeof createListSchema>): Promise<ActionResult<ListRow>>
  updateList(input: z.input<typeof updateListSchema>): Promise<ActionResult>
  deleteList(id: string): Promise<ActionResult>
  reorderLists(input: z.input<typeof reorderListsSchema>): Promise<ActionResult>

  createTask(input: z.input<typeof createTaskSchema>): Promise<ActionResult<TaskView>>
  updateTask(input: z.input<typeof updateTaskSchema>): Promise<ActionResult<TaskView>>
  deleteTask(id: string): Promise<ActionResult>
  moveTasks(input: z.input<typeof moveTasksSchema>): Promise<ActionResult>
  completeTask(
    input: z.input<typeof completeTaskSchema>
  ): Promise<ActionResult<{ listId: string; completedAt: string | null; position: number }>>

  createTag(input: z.input<typeof createTagSchema>): Promise<ActionResult<TagRow>>
  setTaskTags(input: z.input<typeof setTaskTagsSchema>): Promise<ActionResult>

  addChecklistItem(input: z.input<typeof addChecklistItemSchema>): Promise<ActionResult<ChecklistItemRow>>
  updateChecklistItem(input: z.input<typeof updateChecklistItemSchema>): Promise<ActionResult>
  deleteChecklistItem(id: string): Promise<ActionResult>

  addComment(input: z.input<typeof addCommentSchema>): Promise<ActionResult<CommentRow>>
  deleteComment(id: string): Promise<ActionResult>

  getTaskDetail(taskId: string): Promise<ActionResult<TaskDetail>>
  uploadAttachment(input: { taskId: string; file: File }): Promise<ActionResult<AttachmentRow>>
  deleteAttachment(id: string): Promise<ActionResult>
  getAttachmentUrl(id: string): Promise<ActionResult<{ url: string }>>
}
