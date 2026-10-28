import {
  CalendarIcon,
  CircleAlertIcon,
  MessageSquareIcon,
  PaperclipIcon,
  SignalHighIcon,
  SignalLowIcon,
  SignalMediumIcon,
  SquareCheckIcon,
} from "lucide-react"

import { dayDiff, formatDue, isOverdue } from "@/lib/dates"
import { getSwatch } from "@/lib/swatches"
import { cn } from "@/lib/utils"
import { asPriority, PRIORITY_LABELS } from "@/features/tasks/types"
import type { TagRow, TaskView } from "@/features/tasks/types"

export function SwatchDot({ swatch, className }: { swatch: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full", getSwatch(swatch).fill, className)}
    />
  )
}

export function PriorityIcon({ priority, className }: { priority: string; className?: string }) {
  const value = asPriority(priority)
  if (value === "none") return null
  const Icon = value === "high" ? SignalHighIcon : value === "medium" ? SignalMediumIcon : SignalLowIcon

  return (
    <span className="inline-flex items-center" title={`Prioridade ${PRIORITY_LABELS[value].toLowerCase()}`}>
      <Icon aria-hidden strokeWidth={1.75} className={cn("size-4", className)} />
      <span className="sr-only">Prioridade {PRIORITY_LABELS[value].toLowerCase()}</span>
    </span>
  )
}

export function TagChip({ tag, className }: { tag: TagRow; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-32 items-center gap-1.5 rounded-full bg-secondary px-2 text-xs font-medium text-secondary-foreground",
        className
      )}
    >
      <SwatchDot swatch={tag.swatch} className="size-2" />
      <span className="truncate">{tag.name}</span>
    </span>
  )
}

type DueLabelProps = {
  task: Pick<TaskView, "due_at" | "due_has_time" | "completed_at">
  now: Date
  timeZone: string
  className?: string
}

/**
 * Due date with icon + text, never color alone. Overdue: alert icon + "Atrasada". Today: an outlined chip (Lima outline in dark mode,
 * a Tinta outline in light mode, where Lima lines would be invisible).
 */
export function DueLabel({ task, now, timeZone, className }: DueLabelProps) {
  if (!task.due_at) return null
  const overdue = !task.completed_at && isOverdue(task, now, timeZone)
  const today = !overdue && !task.completed_at && dayDiff(task.due_at, now, timeZone) === 0
  const Icon = overdue ? CircleAlertIcon : CalendarIcon

  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1 text-[13px] leading-5",
        overdue ? "font-medium text-foreground" : "text-muted-foreground",
        today && "rounded-full border border-foreground/40 px-2 font-medium text-foreground dark:border-highlight",
        className
      )}
    >
      <Icon aria-hidden strokeWidth={1.75} className="size-3.5" />
      {overdue ? "Atrasada · " : null}
      {formatDue(task, now, timeZone)}
    </span>
  )
}

export function TaskCounters({ task, className }: { task: TaskView; className?: string }) {
  const items: { key: string; icon: typeof SquareCheckIcon; text: string; label: string }[] = []
  if (task.checklistTotal > 0) {
    items.push({
      key: "check",
      icon: SquareCheckIcon,
      text: `${task.checklistDone}/${task.checklistTotal}`,
      label: `${task.checklistDone} de ${task.checklistTotal} itens do checklist`,
    })
  }
  if (task.commentCount > 0) {
    items.push({ key: "comments", icon: MessageSquareIcon, text: String(task.commentCount), label: `${task.commentCount} comentários` })
  }
  if (task.attachmentCount > 0) {
    items.push({ key: "files", icon: PaperclipIcon, text: String(task.attachmentCount), label: `${task.attachmentCount} anexos` })
  }
  if (items.length === 0) return null

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      {items.map(({ key, icon: Icon, text, label }) => (
        <span key={key} title={label} className="tabular inline-flex items-center gap-1 text-[13px] leading-5 text-muted-foreground">
          <Icon aria-hidden strokeWidth={1.75} className="size-3.5" />
          {text}
          <span className="sr-only">{label}</span>
        </span>
      ))}
    </span>
  )
}
