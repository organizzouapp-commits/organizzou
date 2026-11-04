"use client"

import { useEffect, useState } from "react"
import { PlusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

import { InlineInput } from "./inline-input"

/** The one look of every "Adicionar tarefa…" control: a full-width dashed pill, 44px on phones and 40px from 768px. */
export const ADD_PILL =
  "relative flex h-11 w-full items-center gap-2 rounded-full border border-dashed border-foreground/35 bg-foreground/5 px-4 text-left text-[14px] leading-5 font-semibold text-foreground/85 outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:border-foreground/60 hover:bg-foreground/8 focus-visible:border-foreground/60 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none md:h-10"

type AddTaskPillProps = {
  label?: string
  /** Turns the pill into an input; Enter/blur commit (auto-commit rule), Esc cancels. */
  onAdd?: (title: string) => Promise<boolean>
  /** Instead of the input: just reacts to the press (the Agenda opens the new-task sheet prefilled with the day). */
  onPress?: () => void
  className?: string
  /** Changing this number opens the composer (the group header's "+"). */
  openSignal?: number
}

/**
 * THE "Adicionar tarefa…" pill of Tarefas (Kanban lists, Lista groups, Agenda groups and rail, "Todas"). Clicking it swaps it for an input
 * pill of the same size. Enter saves and keeps the field open for the next one, Esc discards, leaving the field saves, and pasting several
 * lines creates one task per line.
 */
export function AddTaskPill({ label = "Adicionar tarefa…", onAdd, onPress, className, openSignal = 0 }: AddTaskPillProps) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    // The signal is an event from the parent (a button press), so it has to be mirrored into state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (openSignal > 0 && onAdd) setOpen(true)
  }, [openSignal, onAdd])

  if (!open || !onAdd) {
    return (
      <button type="button" data-add-task-pill className={cn(ADD_PILL, className)} onClick={() => (onAdd ? setOpen(true) : onPress?.())}>
        <PlusIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0" />
        {label}
      </button>
    )
  }

  return (
    <InlineInput
      multiline
      keepOpen
      maxLength={200}
      ariaLabel="Título da nova tarefa"
      placeholder="Título da tarefa"
      className={cn("w-full", className)}
      inputClassName="h-11 min-h-11 rounded-full border border-dashed border-foreground/60 bg-foreground/8 px-4 py-2.5 text-[14px] md:h-10 md:min-h-10 md:py-2"
      onCommit={onAdd}
      onClose={() => setOpen(false)}
      onPasteLines={async (lines) => {
        for (const line of lines) if (!(await onAdd(line))) break
      }}
    />
  )
}

/** Kept for existing imports: the same pill. */
export const QuickAdd = AddTaskPill
