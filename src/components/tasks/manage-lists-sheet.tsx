"use client"

import { useState } from "react"
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowDownIcon, ArrowUpIcon, CircleCheckIcon, EllipsisIcon, GripVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { ListRow } from "@/features/tasks/types"

import { InlineInput } from "./inline-input"
import type { ListActions } from "./list-parts"
import { ResponsiveSheet } from "./responsive-sheet"

const item = "min-h-11 gap-3 rounded-xl px-3 text-[15px]"

function Row({ list, index, total, actions }: { list: ListRow; index: number; total: number; actions: ListActions }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: list.id })
  const [editing, setEditing] = useState(false)
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} data-manage-list={list.id} className={isDragging ? "relative z-10 opacity-70" : undefined}>
      <div className="flex min-h-13 items-center gap-1 border-b border-border">
        <button type="button" {...attributes} {...listeners} aria-label={`Reordenar ${list.name}`} className="flex size-11 shrink-0 touch-none items-center justify-center rounded-lg text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <GripVerticalIcon aria-hidden strokeWidth={1.75} className="size-4" />
        </button>
        {editing ? (
          <InlineInput initialValue={list.name} ariaLabel={`Nome da lista ${list.name}`} className="min-w-0 flex-1" onCommit={(name) => actions.onRenameList(list, name)} onClose={() => setEditing(false)} />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md text-left text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <span className="truncate">{list.name}</span>
            {list.is_done_list ? <CircleCheckIcon aria-label="Conta como concluída" strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" /> : null}
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Opções da lista ${list.name}`} className="size-11 rounded-full">
              <EllipsisIcon strokeWidth={1.75} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56 rounded-2xl p-2">
            <DropdownMenuItem className={item} disabled={index === 0} onSelect={() => actions.onMoveList(list, -1)}>
              <ArrowUpIcon strokeWidth={1.75} /> Mover para cima
            </DropdownMenuItem>
            <DropdownMenuItem className={item} disabled={index === total - 1} onSelect={() => actions.onMoveList(list, 1)}>
              <ArrowDownIcon strokeWidth={1.75} /> Mover para baixo
            </DropdownMenuItem>
            <DropdownMenuItem className={item} onSelect={() => actions.onToggleDoneList(list)}>
              <CircleCheckIcon strokeWidth={1.75} /> {list.is_done_list ? "Não conta como concluída" : "Conta como concluída"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={item} onSelect={() => actions.onDeleteList(list)}>
              <Trash2Icon strokeWidth={1.75} /> Excluir lista
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}

/** "Gerenciar listas" (phones): drag handles to reorder, tap a name to rename, ⋯ per row, "+ Nova lista". */
export function ManageListsSheet({ open, onOpenChange, lists, actions }: { open: boolean; onOpenChange: (open: boolean) => void; lists: ListRow[]; actions: ListActions }) {
  const [adding, setAdding] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const ids = lists.map((l) => l.id)
    actions.onReorderLists(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Gerenciar listas" description="Arraste para reordenar, toque no nome para renomear.">
      <div className="flex flex-col gap-3">
        <DndContext id="manage-lists-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={lists.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col">
              {lists.map((list, i) => (
                <Row key={list.id} list={list} index={i} total={lists.length} actions={actions} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        {adding ? (
          <InlineInput ariaLabel="Nome da nova lista" placeholder="Nome da lista" onCommit={async (name) => void (await actions.onAddList(name))} onClose={() => setAdding(false)} />
        ) : (
          <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setAdding(true)}>
            <PlusIcon strokeWidth={1.75} /> Nova lista
          </Button>
        )}
      </div>
    </ResponsiveSheet>
  )
}
