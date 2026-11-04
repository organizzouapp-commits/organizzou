import { CalendarIcon, ClockIcon, MessageSquareIcon, PaperclipIcon, SquareCheckIcon, TriangleAlertIcon } from "lucide-react"

import { dayDiff, formatDue, isOverdue, splitDue } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { colorLabel, resolveHex, tintStyle, type ColorValue } from "@/features/tasks/colors"
import type { TagRow, TaskView } from "@/features/tasks/types"
import { useLabelColors } from "./label-colors-context"

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
      <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-[12px] leading-4 font-medium text-muted-foreground", className)}>
        <NeutralDot />
        <span className="truncate">{name}</span>
      </span>
    )
  }
  return (
    <span data-label-badge={hex} title={colorLabel(color)} style={tintStyle(hex)} className={cn("inline-flex h-6 min-w-0 items-center gap-1.5 rounded-full border px-2 text-[12px] leading-4 font-medium text-foreground", className)}>
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
 * A label chip of a card (category or tag): tinted pill with the name, or just its 10px dot in "compact labels" mode. The same element
 * animates between the two (0.4s, instant under reduced motion). Clicking it toggles the mode for every card (it never opens the task).
 */
export function LabelChip({ name, color, compact, onToggle, className }: { name: string; color: ColorValue; compact: boolean; onToggle: () => void; className?: string }) {
  const hex = resolveHex(color)
  const toggleLabel = compact ? "Mostrar nomes das etiquetas" : "Ocultar nomes das etiquetas"
  return (
    <button
      type="button"
      data-label-chip
      aria-pressed={compact}
      aria-label={`${toggleLabel}: ${name}`}
      title={name}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      onPointerDown={(e) => e.stopPropagation()}
      style={!compact && hex ? tintStyle(hex) : undefined}
      className={cn(
        "pointer-events-auto relative z-10 inline-flex h-6 min-w-0 shrink-0 items-center rounded-full border text-[12px] leading-4 font-medium text-foreground outline-none transition-[padding,background-color,border-color,gap] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] after:absolute after:-inset-2.5 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
        compact ? "gap-0 border-transparent bg-transparent px-1.5" : cn("gap-1.5 px-2", !hex && "border-transparent bg-secondary"),
        className
      )}
    >
      <span role="img" aria-label={name} data-label-dot={hex ?? "neutral"} className={cn("inline-block size-2.5 shrink-0 rounded-full", hex ? "ring-1 ring-foreground/25" : "bg-foreground/55")} style={hex ? { backgroundColor: hex } : undefined} />
      <span aria-hidden={compact} className={cn("overflow-hidden text-left whitespace-nowrap transition-[max-width,opacity] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none", compact ? "max-w-0 opacity-0" : "max-w-40 truncate opacity-100")}>{name}</span>
    </button>
  )
}

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
  /** "time": only the clock time (the day is already selected on screen); nothing for an all-day task. */
  mode?: "full" | "time"
}

/**
 * Due date, first thing of the meta line, icon + text (never color alone): today = foreground 600, later = muted, overdue = alert
 * icon + "atrasada há …" in foreground 500. No border, no chip.
 */
export function DueLabel({ task, now, timeZone, className, mode = "full" }: DueLabelProps) {
  if (!task.due_at) return null
  if (mode === "time") {
    const time = task.due_has_time ? splitDue(task.due_at, true, timeZone).time : null
    if (!time) return null
    return (
      <span data-due-time className={cn("tabular inline-flex items-center gap-1 text-[13px] leading-5 text-muted-foreground", className)}>
        <ClockIcon aria-hidden strokeWidth={1.75} className="size-3.5 shrink-0" />
        {time}
      </span>
    )
  }
  const overdue = !task.completed_at && isOverdue(task, now, timeZone)
  const today = !overdue && !task.completed_at && dayDiff(task.due_at, now, timeZone) === 0
  const Icon = overdue ? TriangleAlertIcon : CalendarIcon
  return (
    <span data-due-label className={cn("tabular inline-flex items-center gap-1 text-[13px] leading-5", overdue ? "font-medium text-foreground" : today ? "font-semibold text-foreground" : "text-muted-foreground", className)}>
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
    <span data-task-counters className={cn("inline-flex flex-none items-center gap-2.5", className)}>
      {items.map(({ key, icon: Icon, text, label }) => (
        <span key={key} title={label} className="tabular inline-flex items-center gap-1 text-[13px] leading-5 text-muted-foreground">
          <Icon aria-hidden strokeWidth={1.75} className="size-3.5 shrink-0" />
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
