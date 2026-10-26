"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PRIORITIES, PRIORITY_LABELS, type ListRow, type Priority } from "@/features/tasks/types"

type NewTaskDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  lists: ListRow[]
  onCreate: (input: { listId: string; title: string; priority: Priority }) => Promise<boolean>
}

export function NewTaskDialog({ open, onOpenChange, lists, onCreate }: NewTaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? <NewTaskForm lists={lists} onCreate={onCreate} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function NewTaskForm({
  lists,
  onCreate,
  onClose,
}: Pick<NewTaskDialogProps, "lists" | "onCreate"> & { onClose: () => void }) {
  const [title, setTitle] = useState("")
  const [listId, setListId] = useState(lists.find((l) => !l.is_done_list)?.id ?? lists[0]?.id ?? "")
  const [priority, setPriority] = useState<Priority>("none")
  const [busy, setBusy] = useState(false)

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!title.trim() || busy) return
        setBusy(true)
        const ok = await onCreate({ listId, title: title.trim(), priority })
        setBusy(false)
        if (ok) onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>Nova tarefa</DialogTitle>
        <DialogDescription className="sr-only">Crie uma tarefa neste quadro.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-task-title">Título</Label>
        <Input id="new-task-title" autoFocus value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-task-list">Lista</Label>
          <Select value={listId} onValueChange={setListId}>
            <SelectTrigger id="new-task-list" className="w-full">
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
            <SelectTrigger id="new-task-priority" className="w-full">
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
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy || !title.trim()}>
          Criar tarefa
        </Button>
      </DialogFooter>
    </form>
  )
}
