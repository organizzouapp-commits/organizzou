import type { ListRow, TagRow, TaskView } from "@/features/tasks/types"

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
}
