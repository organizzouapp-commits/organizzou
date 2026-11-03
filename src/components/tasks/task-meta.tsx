import { CalendarIcon, FlagIcon, MessageSquareIcon, PaperclipIcon, SquareCheckIcon, TriangleAlertIcon } from "lucide-react"

import { dayDiff, formatDue, isOverdue } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { colorLabel, resolveHex, tintStyle, type ColorValue } from "@/features/tasks/colors"
import { isTopHalf, priorityOf } from "@/features/tasks/priorities"
import type { TagRow, TaskView } from "@/features/tasks/types"
import { useLabelColors } from "./label-colors-context"
import { usePriorities } from "./priorities-context"

/** A neutral dot (foreground ~55%): the NAME carries the meaning of a list or tag, never the hue. */
export function NeutralDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full bg-foreground/55", className)} />
}

/** An 8px dot in a label's color (neutral when it has none). Meaning always comes with the name next to it. */
export function ColorDot({ color, className }: { color: ColorValue; className?: string }) {
  const hex = resolveHex(color)
  if (!hex) return <NeutralDot className={className} />
  return <span aria-hidden data-color-dot={hex} className={cn("inline-block size-2 shrink-0 rounded-full ring-1 ring-foreground/25", className)} style={{ backgroundColor: hex }} />
}

/**
 * A tag or category. No color: dot + name (flat). With a color: a pill tinted with the color at 16% over the surface and a 1px border
 * at 30%; the text ALWAYS stays the neutral foreground token, so contrast never depends on the chosen color.
 */
export function LabelBadge({ name, color, className }: { name: string; color: ColorValue; className?: string }) {
  const hex = resolveHex(color)
  if (!hex) {
    return (
      <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
        <NeutralDot />
        <span className="truncate">{name}</span>
      </span>
    )
  }
  return (
    <span data-label-badge={hex} title={colorLabel(color)} style={tintStyle(hex)} className={cn("inline-flex h-5 min-w-0 items-center gap-1.5 rounded-full border px-2 text-[12px] leading-4 font-medium text-foreground", className)}>
      <ColorDot color={color} />
      <span className="truncate">{name}</span>
    </span>
  )
}

/** Kept for the screens that still pass a swatch (calendar, pickers): the swatch no longer sets a hue. */
export function SwatchDot({ className }: { swatch?: string; className?: string }) {
  return <NeutralDot className={className} />
}

/**
 * The priority flag for ANY priority of the person's list (nothing for "Sem prioridade"): filled for the heavier half, outline for
 * the lighter half, and the name in the accessible label, so the meaning never rides on the fill alone.
 */
export function PriorityFlag({ task, className }: { task: Pick<TaskView, "id" | "priority">; className?: string }) {
  const state = usePriorities()
  const { colorOf } = useLabelColors()
  const def = priorityOf(state, task)
  if (!def) return null
  const hex = resolveHex(colorOf("priority", def.id))
  return <FlagIcon role="img" aria-label={`Prioridade ${def.name.toLowerCase()}`} strokeWidth={1.75} style={hex ? { color: hex } : undefined} className={cn("size-3.5 shrink-0", !hex && "text-muted-foreground", isTopHalf(state.list, def.id) && "fill-current", className)} />
}

/** @deprecated kept for older imports; use PriorityFlag. */
export const PriorityIcon = PriorityFlag

export function TagChip({ tag, className }: { tag: TagRow; className?: string }) {
  const { colorOf } = useLabelColors()
  const color = colorOf("tag", tag.id)
  if (resolveHex(color)) return <LabelBadge name={tag.name} color={color} className={cn("h-6 max-w-32", className)} />
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

/** Category (when set) and tags as badges, at most 2 tags and "+N". Colors come from the person's label colors. */
export function TagDots({ tags, category, className }: { tags: TagRow[]; category?: string | null; className?: string }) {
  const { colorOf } = useLabelColors()
  if (tags.length === 0 && !category) return null
  return (
    <span className={cn("inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5 text-muted-foreground", className)}>
      {category ? <LabelBadge name={category} color={colorOf("category", category)} className="max-w-full" /> : null}
      {tags.slice(0, 2).map((tag) => (
        <LabelBadge key={tag.id} name={tag.name} color={colorOf("tag", tag.id)} className="max-w-full" />
      ))}
      {tags.length > 2 ? <span className="tabular">+{tags.length - 2}</span> : null}
    </span>
  )
}
