import type { ListRow, TagRow, TaskView } from "@/features/tasks/types"

import type { TaskActions } from "./task-card"

/** Props shared by the three board views. */
export type ViewProps = {
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
  /** The "Adicionar tarefa…" first row of Lista and of the phone Kanban opens the creation sheet. */
  onCreate: (listId?: string) => void
}
