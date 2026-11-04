import type { ListRow, TagRow, TaskView } from "@/features/tasks/types"

import type { ListActions } from "./list-parts"
import type { TaskActions } from "./task-card"

/** Props shared by the three board views. */
export type ViewProps = ListActions & {
  lists: ListRow[]
  tasks: TaskView[]
  tags: TagRow[]
  now: Date
  timeZone: string
  onOpenTask: (id: string) => void
  onToggleComplete: (task: TaskView) => void
  onDeleteRequest: (task: TaskView) => void
  onQuickAdd: (listId: string, title: string) => Promise<boolean>
  /** Everything a task can do from its card, row, swipe panel or menu. */
  actionsFor: (task: TaskView) => TaskActions
  /** Multi-select mode (long press on a row): the views show selection checks. */
  selection: { active: boolean; ids: Set<string>; toggle: (id: string) => void }
  /** Opens the creation sheet (phones) for a list. */
  /** `day` (yyyy-MM-dd) pre-fills the due date (the calendar's "Adicionar tarefa"). */
  onCreate: (listId?: string, day?: string, time?: string, title?: string) => void
}
