import { CalendarIcon, FlagIcon, MessageSquareIcon, PaperclipIcon, SquareCheckIcon, TriangleAlertIcon } from "lucide-react"

import { dayDiff, formatDue, isOverdue } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { asPriority, PRIORITY_LABELS } from "@/features/tasks/types"
import type { TagRow, TaskView } from "@/features/tasks/types"
import { showsFlag } from "@/features/tasks/view"

/** A neutral dot (foreground ~55%): the NAME carries the meaning of a list or tag, never the hue. */
export function NeutralDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full bg-foreground/55", className)} />
}

/** Kept for the screens that still pass a swatch (calendar, pickers): the swatch no longer sets a hue. */
export function SwatchDot({ className }: { swatch?: string; className?: string }) {
  return <NeutralDot className={className} />
}

/** The priority flag: ONLY for high priority, with an accessible name. */
export function PriorityFlag({ priority, className }: { priority: string; className?: string }) {
  if (!showsFlag(priority)) return null
  return <FlagIcon role="img" aria-label={`Prioridade ${PRIORITY_LABELS[asPriority(priority)].toLowerCase()}`} strokeWidth={1.75} className={cn("size-3.5 shrink-0 text-muted-foreground", className)} />
}

/** @deprecated kept for older imports; use PriorityFlag. */
export const PriorityIcon = PriorityFlag

export function TagChip({ tag, className }: { tag: TagRow; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 max-w-32 items-center gap-1.5 rounded-full bg-secondary px-2 text-xs font-medium text-secondary-foreground", className)}>
      <NeutralDot />
      <span className="truncate">{tag.name}</span>
    </span>
  )
}

/** "atrasada há 14 h", "atrasada há 1 dia". */
export function overdueText(dueAt: string, now: Date) {
  const minutes = Math.max(1, Math.round((now.getTime() - new Date(dueAt).getTime()) / 60_000))
  if (minutes < 60) return `atrasada há ${minutes} min`
  if (minutes < 24 * 60) return `atrasada há ${Math.floor(minutes / 60)} h`
  const days = Math.floor(minutes / (24 * 60))
  return `atrasada há ${days} ${days === 1 ? "dia" : "dias"}`
}

type DueLabelProps = {
  task: Pick<TaskView, "due_at" | "due_has_time" | "completed_at">
  now: Date
  timeZone: string
  className?: string
}

/**
 * Due date, first thing of the meta line, icon + text (never color alone): today = foreground 600, later = muted, overdue = alert
 * icon + "atrasada há …" in foreground 500. No border, no chip.
 */
export function DueLabel({ task, now, timeZone, className }: DueLabelProps) {
  if (!task.due_at) return null
  const overdue = !task.completed_at && isOverdue(task, now, timeZone)
  const today = !overdue && !task.completed_at && dayDiff(task.due_at, now, timeZone) === 0
  const Icon = overdue ? TriangleAlertIcon : CalendarIcon
  return (
    <span className={cn("tabular inline-flex items-center gap-1 text-[13px] leading-5", overdue ? "font-medium text-foreground" : today ? "font-semibold text-foreground" : "text-muted-foreground", className)}>
      <Icon aria-hidden strokeWidth={1.75} className="size-3.5 shrink-0" />
      {overdue ? `${overdueText(task.due_at, now)} · ${formatDue(task, now, timeZone)}` : formatDue(task, now, timeZone)}
    </span>
  )
}

/** Subtasks "1/3", comments and attachments: only when above zero. */
export function TaskCounters({ task, className }: { task: TaskView; className?: string }) {
  const items: { key: string; icon: typeof SquareCheckIcon; text: string; label: string }[] = []
  if (task.checklistTotal > 0) items.push({ key: "check", icon: SquareCheckIcon, text: `${task.checklistDone}/${task.checklistTotal}`, label: `${task.checklistDone} de ${task.checklistTotal} itens do checklist` })
  if (task.commentCount > 0) items.push({ key: "comments", icon: MessageSquareIcon, text: String(task.commentCount), label: `${task.commentCount} comentários` })
  if (task.attachmentCount > 0) items.push({ key: "files", icon: PaperclipIcon, text: String(task.attachmentCount), label: `${task.attachmentCount} anexos` })
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

/** Tags as neutral dot + name, at most 2 and "+N". */
export function TagDots({ tags, className }: { tags: TagRow[]; className?: string }) {
  if (tags.length === 0) return null
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2 text-[13px] leading-5 text-muted-foreground", className)}>
      {tags.slice(0, 2).map((tag) => (
        <span key={tag.id} className="inline-flex min-w-0 items-center gap-1.5">
          <NeutralDot />
          <span className="truncate">{tag.name}</span>
        </span>
      ))}
      {tags.length > 2 ? <span className="tabular">+{tags.length - 2}</span> : null}
    </span>
  )
}
