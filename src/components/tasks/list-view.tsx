"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { SwipeRow } from "@/components/organizzou/SwipeRow"
import { groupByList } from "@/features/tasks/filters"
import { getSwatch } from "@/lib/swatches"
import { cn } from "@/lib/utils"
import type { TagRow, TaskView } from "@/features/tasks/types"

import { QuickAdd } from "./quick-add"
import { DueLabel, PriorityIcon, TagChip, TaskCounters } from "./task-meta"
import type { ViewProps } from "./types"

function TaskRowItem({
  task,
  tags,
  props,
}: {
  task: TaskView
  tags: TagRow[]
  props: ViewProps
}) {
  const taskTags = task.tagIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is TagRow => Boolean(t))
  const done = Boolean(task.completed_at)

  return (
    <SwipeRow
      onSwipeRight={() => props.onToggleComplete(task)}
      rightLabel={done ? "Reabrir" : "Concluir"}
      onSwipeLeft={() => props.onDeleteRequest(task)}
    >
      <div className="flex min-h-14 items-center gap-4 border-b border-border py-3">
        <Checkbox
          checked={done}
          onCheckedChange={() => props.onToggleComplete(task)}
          aria-label={done ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
        />
        <button
          type="button"
          onClick={() => props.onOpenTask(task.id)}
          className="flex min-w-0 flex-1 flex-col gap-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex items-center gap-2">
            {task.swatch !== "neutro" ? (
              <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", getSwatch(task.swatch).fill)} />
            ) : null}
            <span className={cn("truncate text-[15px] leading-6", done && "text-muted-foreground line-through")}>
              {task.title}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <DueLabel task={task} now={props.now} timeZone={props.timeZone} />
            <TaskCounters task={task} />
            {taskTags.slice(0, 2).map((tag) => (
              <TagChip key={tag.id} tag={tag} />
            ))}
          </span>
        </button>
        <PriorityIcon priority={task.priority} className="shrink-0 text-muted-foreground" />
      </div>
    </SwipeRow>
  )
}

export function ListView(props: ViewProps) {
  const groups = groupByList(props.tasks, props.lists)

  return (
    <div className="flex flex-col gap-10">
      {props.lists.map((list) => {
        const rows = groups.get(list.id) ?? []
        return (
          <section key={list.id} aria-label={list.name} className="flex flex-col">
            <h3 className="mb-1 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              {list.name} <span className="tabular">· {rows.length}</span>
            </h3>
            {rows.map((task) => (
              <TaskRowItem key={task.id} task={task} tags={props.tags} props={props} />
            ))}
            <div className="pt-2">
              <QuickAdd onAdd={(title) => props.onQuickAdd(list.id, title)} />
            </div>
          </section>
        )
      })}
    </div>
  )
}
