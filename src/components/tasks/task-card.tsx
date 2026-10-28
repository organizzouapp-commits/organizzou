"use client"

import type { CSSProperties } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { Checkbox } from "@/components/ui/checkbox"
import { getSwatch } from "@/lib/swatches"
import { cn } from "@/lib/utils"
import type { TagRow, TaskView } from "@/features/tasks/types"

import { DueLabel, PriorityIcon, TagChip, TaskCounters } from "./task-meta"

type TaskCardBodyProps = {
  /** Hover/focus actions (edit, move, delete). */
  menu?: React.ReactNode
  task: TaskView
  tags: TagRow[]
  now: Date
  timeZone: string
  onOpen: () => void
  onToggleComplete: () => void
  className?: string
}

/** The visual card, shared by the sortable item and the drag overlay. */
export function TaskCardBody({ task, tags, now, timeZone, onOpen, onToggleComplete, menu, className }: TaskCardBodyProps) {
  const swatch = getSwatch(task.swatch)
  const taskTags = task.tagIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is TagRow => Boolean(t))
  // The flag only shows above normal priority.
  const flagged = task.priority === "high" || task.priority === "medium"
  const hasMeta = Boolean(task.due_at) || flagged || task.checklistTotal + task.commentCount + task.attachmentCount > 0

  return (
    <div
      className={cn(
        "group/card relative flex gap-3 overflow-hidden rounded-xl border border-border bg-card p-3 text-card-foreground transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:bg-accent/40 motion-reduce:transition-none",
        task.completed_at && "opacity-70",
        className
      )}
    >
      {task.swatch !== "neutro" ? (
        <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", swatch.fill)} />
      ) : null}
      <Checkbox
        checked={Boolean(task.completed_at)}
        onCheckedChange={() => onToggleComplete()}
        aria-label={task.completed_at ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
        className="mt-0.5"
        onPointerDown={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 flex-col gap-2 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className={cn("text-[15px] leading-5 font-medium break-words", task.completed_at && "line-through")}>
          {task.title}
        </span>
        {taskTags.length > 0 ? (
          <span className="flex flex-wrap gap-1.5">
            {taskTags.slice(0, 3).map((tag) => (
              <TagChip key={tag.id} tag={tag} />
            ))}
            {taskTags.length > 3 ? (
              <span className="text-xs leading-6 text-muted-foreground">+{taskTags.length - 3}</span>
            ) : null}
          </span>
        ) : null}
        {hasMeta ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <DueLabel task={task} now={now} timeZone={timeZone} />
            {flagged ? <PriorityIcon priority={task.priority} className="text-muted-foreground" /> : null}
            <TaskCounters task={task} />
          </span>
        ) : null}
      </button>
      {menu ? (
        <div className="absolute top-1.5 right-1.5 opacity-0 transition-opacity duration-150 group-focus-within/card:opacity-100 group-hover/card:opacity-100 max-md:opacity-100" onPointerDown={(e) => e.stopPropagation()}>
          {menu}
        </div>
      ) : null}
    </div>
  )
}

type SortableTaskCardProps = Omit<TaskCardBodyProps, "className"> & {
  listId: string
  disabled: boolean
}

export function SortableTaskCard({ listId, disabled, ...body }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: body.task.id,
    data: { type: "task", listId },
    disabled,
  })
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-task-id={body.task.id}
      {...attributes}
      {...listeners}
      className={cn("touch-manipulation outline-none", isDragging && "opacity-40")}
    >
      <TaskCardBody {...body} />
    </div>
  )
}
