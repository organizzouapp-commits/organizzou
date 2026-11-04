"use client"

import { useState } from "react"
import { Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ListRow } from "@/features/tasks/types"

import { ResponsiveSheet } from "./responsive-sheet"

const DELETE_TASKS = "__delete__"

/** "Excluir lista": a list with tasks asks where they go (another list) or confirms deleting them; an empty one just confirms. */
export function DeleteListDialog({ list, taskCount, others, onCancel, onConfirm }: { list: ListRow | null; taskCount: number; others: ListRow[]; onCancel: () => void; onConfirm: (destinationListId: string | null) => void }) {
  return (
    <ResponsiveSheet open={Boolean(list)} onOpenChange={(open) => !open && onCancel()} title="Excluir esta lista?" description={list ? `A lista “${list.name}” será apagada.` : ""}>
      {list ? <Body key={list.id} list={list} taskCount={taskCount} others={others} onCancel={onCancel} onConfirm={onConfirm} /> : null}
    </ResponsiveSheet>
  )
}

function Body({ list, taskCount, others, onCancel, onConfirm }: { list: ListRow; taskCount: number; others: ListRow[]; onCancel: () => void; onConfirm: (destinationListId: string | null) => void }) {
  const [choice, setChoice] = useState<string>(others[0]?.id ?? DELETE_TASKS)
  return (
    <div className="flex flex-col gap-4">
      {taskCount > 0 ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="delete-list-destination">
            A lista tem {taskCount} {taskCount === 1 ? "tarefa" : "tarefas"}. O que fazer com {taskCount === 1 ? "ela" : "elas"}?
          </Label>
          <Select value={choice} onValueChange={setChoice}>
            <SelectTrigger id="delete-list-destination" className="h-11 w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {others.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  Mover para “{o.name}”
                </SelectItem>
              ))}
              <SelectItem value={DELETE_TASKS}>Excluir {taskCount === 1 ? "a tarefa" : "as tarefas"} junto</SelectItem>
            </SelectContent>
          </Select>
          {choice === DELETE_TASKS ? <p className="text-[13px] leading-5 text-muted-foreground">As tarefas serão apagadas depois de 8 segundos; até lá dá para desfazer.</p> : null}
        </div>
      ) : (
        <p className="text-[15px] leading-6">A lista “{list.name}” está vazia e será apagada.</p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1 rounded-full" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" variant="destructive" className="h-11 flex-1 rounded-full" onClick={() => onConfirm(taskCount > 0 && choice !== DELETE_TASKS ? choice : null)}>
          <Trash2Icon strokeWidth={1.75} /> Excluir lista
        </Button>
      </div>
    </div>
  )
}
