"use client"

import { useEffect, useState } from "react"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

import { InlineInput } from "./inline-input"

type QuickAddProps = {
  label?: string
  onAdd: (title: string) => Promise<boolean>
  className?: string
  /** Changing this number opens the composer (the column header's "+"). */
  openSignal?: number
}

/**
 * "Adicionar tarefa" row that turns into an input (auto-commit rule, see InlineInput). Enter saves and keeps the field open for
 * the next one, Esc discards, leaving the field saves, and pasting several lines creates one task per line.
 */
export function QuickAdd({ label = "Adicionar tarefa", onAdd, className, openSignal = 0 }: QuickAddProps) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    // The signal is an event from the parent (a button press), so it has to be mirrored into state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (openSignal > 0) setOpen(true)
  }, [openSignal])

  if (!open) {
    return (
      <Button variant="ghost" className={`w-full justify-start text-muted-foreground ${className ?? ""}`} onClick={() => setOpen(true)}>
        <PlusIcon strokeWidth={1.75} /> {label}
      </Button>
    )
  }

  return (
    <InlineInput
      multiline
      keepOpen
      maxLength={200}
      ariaLabel="Título da nova tarefa"
      placeholder="Título da tarefa"
      className={className}
      onCommit={onAdd}
      onClose={() => setOpen(false)}
      onPasteLines={async (lines) => {
        for (const line of lines) if (!(await onAdd(line))) break
      }}
    />
  )
}
