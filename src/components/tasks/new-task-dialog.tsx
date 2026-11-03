"use client"

import { useState } from "react"
import { addDays, format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useIsMobile } from "@/hooks/use-mobile"
import { dayKey } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { PRIORITIES, PRIORITY_LABELS, type ListRow, type Priority } from "@/features/tasks/types"
import { readAs } from "@/server/assistant/parse"

export type NewTaskInput = { listId: string; title: string; priority: Priority; dueDay: string | null; dueTime: string | null }

type NewTaskDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  lists: ListRow[]
  /** Pre-selected list (the "+" of a column). */
  defaultListId?: string
  /** Pre-filled due date (the calendar's selected day, optionally with a time). */
  defaultDue?: { day: string; time?: string }
  now: Date
  timeZone: string
  onCreate: (input: NewTaskInput) => Promise<boolean>
}

type DuePreset = "hoje" | "amanha" | "semana" | "sem-data" | "auto" | "dia"

const PRESETS: { id: Exclude<DuePreset, "auto" | "dia">; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "amanha", label: "Amanhã" },
  { id: "semana", label: "Próxima semana" },
  { id: "sem-data", label: "Sem data" },
]

/** The same creation form everywhere: a bottom sheet on phones, a dialog on desktop. */
export function NewTaskDialog(props: NewTaskDialogProps) {
  const isMobile = useIsMobile()
  const { open, onOpenChange } = props
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Nova tarefa</DrawerTitle>
            <DrawerDescription className="sr-only">Crie uma tarefa.</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{open ? <NewTaskForm {...props} onClose={() => onOpenChange(false)} /> : null}</div>
        </DrawerContent>
      </Drawer>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[20px]">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription className="sr-only">Crie uma tarefa.</DialogDescription>
        </DialogHeader>
        {open ? <NewTaskForm {...props} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function NewTaskForm({ lists, defaultListId, defaultDue, now, timeZone, onCreate, onClose }: NewTaskDialogProps & { onClose: () => void }) {
  const [title, setTitle] = useState("")
  const [listId, setListId] = useState(defaultListId ?? lists.find((l) => !l.is_done_list)?.id ?? lists[0]?.id ?? "")
  const [priority, setPriority] = useState<Priority>("none")
  const [due, setDue] = useState<DuePreset>(defaultDue ? "dia" : "auto")
  const [busy, setBusy] = useState(false)

  // The text is read with the real quick-capture parser ("amanhã 10h", "alta"): what it finds only fills what the chips left open.
  const read = title.trim() ? readAs("tarefa", title.trim(), now) : null
  const today = dayKey(now, timeZone)

  function resolveDue(): { day: string | null; time: string | null } {
    if (due === "dia" && defaultDue) return { day: defaultDue.day, time: defaultDue.time ?? null }
    if (due === "hoje") return { day: today, time: null }
    if (due === "amanha") return { day: format(addDays(new Date(`${today}T12:00:00`), 1), "yyyy-MM-dd"), time: null }
    if (due === "semana") return { day: format(addDays(new Date(`${today}T12:00:00`), 7), "yyyy-MM-dd"), time: null }
    if (due === "sem-data") return { day: null, time: null }
    return { day: read?.type === "tarefa" ? (read.day ?? null) : null, time: read?.type === "tarefa" ? (read.time ?? null) : null }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault()
        const value = (read?.type === "tarefa" && due === "auto" ? read.title : title).trim() || title.trim()
        if (!value || busy) return
        setBusy(true)
        const when = resolveDue()
        const finalPriority = priority !== "none" ? priority : read?.type === "tarefa" && read.priority && PRIORITIES.includes(read.priority as Priority) ? (read.priority as Priority) : "none"
        const ok = await onCreate({ listId, title: value, priority: finalPriority, dueDay: when.day, dueTime: when.time })
        setBusy(false)
        if (ok) onClose()
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-task-title">Título</Label>
        <Input id="new-task-title" autoFocus value={title} maxLength={200} placeholder="Ex.: ligar para o banco amanhã 10h" className="h-12 rounded-xl text-[15px]" onChange={(e) => setTitle(e.target.value)} />
        {read?.type === "tarefa" && due === "auto" && (read.day || read.time) ? (
          <p className="text-[13px] leading-5 text-muted-foreground" role="status">
            Entendi o prazo{read.day ? ` ${read.day.split("-").reverse().join("/")}` : ""}
            {read.time ? ` às ${read.time}` : ""}. Use os atalhos abaixo para mudar.
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">Prazo</span>
        <div role="group" aria-label="Prazo" className="flex flex-wrap gap-2">
          {defaultDue ? (
            <button
              type="button"
              aria-pressed={due === "dia"}
              onClick={() => setDue(due === "dia" ? "auto" : "dia")}
              className={cn("inline-flex h-11 items-center rounded-full border px-4 text-[14px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50", due === "dia" ? "border-transparent bg-foreground/14 font-semibold" : "border-border")}
            >
              {format(new Date(`${defaultDue.day}T12:00:00`), "EEE, d MMM", { locale: ptBR })}
              {defaultDue.time ? ` · ${defaultDue.time}` : ""}
            </button>
          ) : null}
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={due === p.id}
              onClick={() => setDue(due === p.id ? "auto" : p.id)}
              className={cn("inline-flex h-11 items-center rounded-full border px-4 text-[14px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50", due === p.id ? "border-transparent bg-foreground/14 font-semibold" : "border-border")}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-task-list">Lista</Label>
          <Select value={listId} onValueChange={setListId}>
            <SelectTrigger id="new-task-list" className="h-11 w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lists.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-task-priority">Prioridade</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
            <SelectTrigger id="new-task-priority" className="h-11 w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter className="max-md:flex-row">
        <Button type="button" variant="outline" className="h-11 flex-1 rounded-full md:flex-none" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" className="h-11 flex-1 rounded-full md:flex-none" disabled={busy || !title.trim()}>
          Criar tarefa
        </Button>
      </DialogFooter>
    </form>
  )
}
