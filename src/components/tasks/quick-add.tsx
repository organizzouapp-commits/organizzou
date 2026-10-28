"use client"

import { useRef, useState } from "react"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type QuickAddProps = {
  label?: string
  onAdd: (title: string) => Promise<boolean>
  className?: string
}

/**
 * "Adicionar tarefa" row that turns into an input. Enter saves and keeps the field open for the next one, Shift+Enter inserts a
 * new line, Esc closes, and pasting several lines creates one task per line.
 */
export function QuickAdd({ label = "Adicionar tarefa", onAdd, className }: QuickAddProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  async function addAll(values: string[]) {
    setBusy(true)
    let ok = true
    for (const value of values) {
      if (!(await onAdd(value))) {
        ok = false
        break
      }
    }
    setBusy(false)
    if (ok) setTitle("")
    // Keep typing: the field gets the focus back after the (disabled) save.
    requestAnimationFrame(() => ref.current?.focus())
  }

  async function submit() {
    const value = title.trim()
    if (!value || busy) return
    await addAll([value])
  }

  if (!open) {
    return (
      <Button variant="ghost" className={`w-full justify-start text-muted-foreground ${className ?? ""}`} onClick={() => setOpen(true)}>
        <PlusIcon strokeWidth={1.75} /> {label}
      </Button>
    )
  }

  return (
    <Textarea
      ref={ref}
      autoFocus
      rows={1}
      value={title}
      disabled={busy}
      placeholder="Título da tarefa (Enter adiciona)"
      aria-label="Título da nova tarefa"
      className={`min-h-11 resize-none py-2.5 ${className ?? ""}`}
      onChange={(e) => setTitle(e.target.value)}
      onPaste={(e) => {
        const text = e.clipboardData.getData("text")
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
        if (lines.length > 1) {
          e.preventDefault()
          void addAll(lines)
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          void submit()
        }
        if (e.key === "Escape") {
          e.stopPropagation()
          setOpen(false)
          setTitle("")
        }
      }}
      onBlur={() => {
        if (!title.trim()) setOpen(false)
      }}
    />
  )
}
