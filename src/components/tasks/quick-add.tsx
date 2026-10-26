"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type QuickAddProps = {
  label?: string
  onAdd: (title: string) => Promise<boolean>
}

/** "Adicionar tarefa" button that turns into an input. Enter saves and keeps adding, Esc closes. */
export function QuickAdd({ label = "Adicionar tarefa", onAdd }: QuickAddProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit() {
    const value = title.trim()
    if (!value || busy) return
    setBusy(true)
    const ok = await onAdd(value)
    setBusy(false)
    if (ok) setTitle("")
  }

  if (!open) {
    return (
      <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={() => setOpen(true)}>
        <PlusIcon strokeWidth={1.75} /> {label}
      </Button>
    )
  }

  return (
    <Input
      autoFocus
      value={title}
      disabled={busy}
      placeholder="Título da tarefa"
      aria-label="Título da nova tarefa"
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          void submit()
        }
        if (e.key === "Escape") {
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
