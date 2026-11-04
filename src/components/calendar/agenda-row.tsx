"use client"

import { BookOpenIcon, CalendarDaysIcon, DumbbellIcon, EllipsisIcon, ExternalLinkIcon, MapPinIcon, RotateCcwIcon, SquareCheckIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { AgendaItem } from "@/features/calendar/types"
import { cn } from "@/lib/utils"

const menuItem = "min-h-11 gap-3 rounded-xl px-3 text-[15px]"

export type AgendaRowProps = {
  item: AgendaItem
  /** "11:00 – 11:30" or "Dia todo" (the screen knows its time zone). */
  time: string
  color: string | null
  onOpen: (item: AgendaItem) => void
  /** Tasks only: completes in place (the screen shows the undo toast). */
  onToggle?: (item: AgendaItem) => void
  onDelete?: (item: AgendaItem) => void
}

const LEADING = { event: CalendarDaysIcon, workout: DumbbellIcon, study: BookOpenIcon, task: SquareCheckIcon } as const

/**
 * The compact row of the Agenda page (view mode): no surface of its own, a 3px bar (item color, or neutral), a 20px leading slot (a real
 * checkbox for tasks, a static icon for the rest), a one-line title and a one-line "<time> · <context>" subtitle, and a ⋯ menu.
 * The whole row opens the item (the title button stretches over it); the checkbox and the menu sit above that.
 */
export function AgendaRow({ item, time, color, onOpen, onToggle, onDelete }: AgendaRowProps) {
  const done = Boolean(item.done)
  const Leading = LEADING[item.kind]
  const isTask = item.kind === "task"
  const readOnly = item.kind === "workout" || item.kind === "study"
  return (
    <div
      data-agenda-row
      data-kind={item.kind}
      data-day-item={item.id}
      className="group/row relative flex min-h-14 items-center gap-2.5 rounded-[10px] border-b border-foreground/8 py-2 pr-1 pl-4 last:border-b-0 hover:bg-foreground/4 focus-within:bg-foreground/4"
    >
      <span aria-hidden data-row-bar className="pointer-events-none absolute top-2 bottom-2 left-1 w-[3px] rounded-full" style={{ backgroundColor: color ?? "color-mix(in oklab, var(--foreground) 28%, transparent)" }} />
      {isTask ? (
        <Checkbox
          checked={done}
          onCheckedChange={() => onToggle?.(item)}
          aria-label={done ? `Reabrir ${item.title}` : `Concluir ${item.title}`}
          className="relative z-10 size-5 after:-inset-3"
        />
      ) : (
        <Leading aria-hidden strokeWidth={1.75} className="size-[18px] shrink-0 text-muted-foreground" />
      )}
      <button
        type="button"
        data-agenda-open
        onClick={() => onOpen(item)}
        className={cn("flex min-w-0 flex-1 flex-col gap-0.5 rounded-[10px] text-left outline-none after:absolute after:inset-0 after:rounded-[10px] focus-visible:after:ring-3 focus-visible:after:ring-ring/50", done && "opacity-60")}
      >
        <span data-row-title className={cn("truncate text-[15px] leading-5 font-semibold", done && "line-through")}>
          {item.title}
        </span>
        <span data-row-subtitle className="tabular flex min-w-0 items-center gap-1 text-[13px] leading-5 text-muted-foreground">
          <span className="shrink-0">{time}</span>
          {item.detail ? (
            <>
              <span aria-hidden className="shrink-0">
                ·
              </span>
              {item.place ? <MapPinIcon aria-hidden strokeWidth={1.75} className="size-3.5 shrink-0" /> : null}
              <span className="truncate">{item.detail}</span>
            </>
          ) : null}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Mais ações: ${item.title}`}
            className="relative z-10 size-8 shrink-0 after:absolute after:-inset-1.5 data-[state=open]:opacity-100 lg:opacity-0 lg:group-focus-within/row:opacity-100 lg:group-hover/row:opacity-100 lg:focus-visible:opacity-100"
          >
            <EllipsisIcon strokeWidth={1.75} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48 rounded-2xl p-2">
          <DropdownMenuItem className={menuItem} onSelect={() => onOpen(item)}>
            <ExternalLinkIcon strokeWidth={1.75} /> Abrir
          </DropdownMenuItem>
          {isTask && !readOnly ? (
            <>
              <DropdownMenuItem className={menuItem} onSelect={() => onToggle?.(item)}>
                {done ? <RotateCcwIcon strokeWidth={1.75} /> : <SquareCheckIcon strokeWidth={1.75} />} {done ? "Reabrir" : "Concluir"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className={menuItem} onSelect={() => onDelete?.(item)}>
                <Trash2Icon strokeWidth={1.75} /> Excluir tarefa
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
