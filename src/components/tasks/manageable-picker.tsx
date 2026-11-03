"use client"

import { useState } from "react"
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { CheckIcon, GripVerticalIcon, PencilIcon, PlusIcon, SettingsIcon, Trash2Icon } from "lucide-react"

import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { InlineInput } from "./inline-input"

export type PickerItem = { id: string; label: string }

type ManageablePickerProps = {
  /** What the thing is called, singular and lowercase: "prioridade", "tag", "categoria". */
  noun: string
  items: PickerItem[]
  selected: string[]
  multiple?: boolean
  /** A fixed first row that can be picked but never edited ("Sem prioridade"). */
  fixed?: PickerItem
  onSelect: (id: string) => void
  onCreate: (name: string) => Promise<boolean | void> | boolean | void
  onRename: (id: string, name: string) => Promise<boolean | void> | boolean | void
  onDelete: (id: string) => void
  /** How many tasks use an item (shown in the delete confirmation). */
  usage: (id: string) => number
  /** Order matters (priorities): rows get a drag handle in manage mode. */
  onReorder?: (ids: string[]) => void
}

function Row({ item, picked, managing, reorderable, editing, setEditing, props, onAskDelete }: { item: PickerItem; picked: boolean; managing: boolean; reorderable: boolean; editing: boolean; setEditing: (v: boolean) => void; props: ManageablePickerProps; onAskDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !reorderable || !managing })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} data-picker-item={item.id} className={cn("flex min-h-[52px] items-center gap-1", isDragging && "relative z-10 opacity-70")}>
      {managing && reorderable ? (
        <button type="button" {...attributes} {...listeners} aria-label={`Reordenar ${item.label}`} className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <GripVerticalIcon aria-hidden strokeWidth={1.75} className="size-4" />
        </button>
      ) : null}
      {editing ? (
        <InlineInput initialValue={item.label} ariaLabel={`Nome: ${item.label}`} className="min-w-0 flex-1" onCommit={(name) => props.onRename(item.id, name)} onClose={() => setEditing(false)} />
      ) : (
        <button
          type="button"
          onClick={() => (managing ? setEditing(true) : props.onSelect(item.id))}
          className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-left text-[15px] outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {picked && !managing ? <CheckIcon aria-label="Selecionada" strokeWidth={1.75} className="size-4 shrink-0" /> : null}
        </button>
      )}
      {managing && !editing ? (
        <>
          <Button type="button" variant="ghost" size="icon" aria-label={`Renomear ${item.label}`} className="size-11 shrink-0 rounded-full" onClick={() => setEditing(true)}>
            <PencilIcon strokeWidth={1.75} />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label={`Excluir ${item.label}`} className="size-11 shrink-0 rounded-full" onClick={onAskDelete}>
            <Trash2Icon strokeWidth={1.75} />
          </Button>
        </>
      ) : null}
    </li>
  )
}

/**
 * ONE picker for priorities, tags and categories: search, selection, a "Criar “texto”" row when nothing matches exactly, and a
 * "Gerenciar" mode where each row has rename (pencil or a click on the name), delete (confirms with how many tasks use it) and,
 * when order matters, a drag handle. A popover on desktop, a bottom sheet on phones (the Property wrapper decides).
 */
export function ManageablePicker(props: ManageablePickerProps) {
  const { noun, items, selected, fixed, onCreate, onDelete, usage, onReorder } = props
  const [query, setQuery] = useState("")
  const [managing, setManaging] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<PickerItem | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const trimmed = query.trim()
  const shown = managing || !trimmed ? items : items.filter((i) => i.label.toLowerCase().includes(trimmed.toLowerCase()))
  const exact = items.some((i) => i.label.toLowerCase() === trimmed.toLowerCase())

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id || !onReorder) return
    const ids = items.map((i) => i.id)
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  async function create() {
    const name = trimmed.slice(0, 80)
    if (!name) return
    setQuery("")
    await onCreate(name)
  }

  return (
    <div className="flex flex-col gap-2" data-testid={`picker-${noun}`}>
      {managing ? null : (
        <Input
          value={query}
          maxLength={80}
          placeholder={`Buscar ou criar ${noun}`}
          aria-label={`Buscar ou criar ${noun}`}
          enterKeyHint="done"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && trimmed && !exact) {
              e.preventDefault()
              void create()
            }
          }}
          className="h-11 rounded-xl"
        />
      )}
      <ul className="flex flex-col">
        {fixed && !managing ? (
          <li className="flex min-h-[52px] items-center">
            <button type="button" onClick={() => props.onSelect(fixed.id)} className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-left text-[15px] outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
              <span className="min-w-0 flex-1 truncate">{fixed.label}</span>
              {selected.length === 0 ? <CheckIcon aria-label="Selecionada" strokeWidth={1.75} className="size-4 shrink-0" /> : null}
            </button>
          </li>
        ) : null}
        <DndContext id={`picker-dnd-${noun}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={shown.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {shown.map((item) => (
              <Row key={item.id} item={item} picked={selected.includes(item.id)} managing={managing} reorderable={Boolean(onReorder)} editing={editingId === item.id} setEditing={(v) => setEditingId(v ? item.id : null)} props={props} onAskDelete={() => setToDelete(item)} />
            ))}
          </SortableContext>
        </DndContext>
        {!managing && trimmed && !exact ? (
          <li>
            <button type="button" onClick={() => void create()} className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
              <PlusIcon aria-hidden strokeWidth={1.75} className="size-4" /> Criar “{trimmed}”
            </button>
          </li>
        ) : null}
        {shown.length === 0 && !trimmed ? <li className="px-3 py-3 text-[13px] leading-5 text-muted-foreground">Nenhuma {noun} ainda. Digite um nome para criar.</li> : null}
      </ul>
      <Button type="button" variant="ghost" className="h-11 justify-start rounded-full" aria-pressed={managing} onClick={() => (setManaging((v) => !v), setEditingId(null))}>
        <SettingsIcon strokeWidth={1.75} /> {managing ? "Concluir" : "Gerenciar"}
      </Button>
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Excluir ${noun}?`}
        description={toDelete ? (usage(toDelete.id) > 0 ? `“${toDelete.label}” está em ${usage(toDelete.id)} ${usage(toDelete.id) === 1 ? "tarefa" : "tarefas"}. Ela será removida delas.` : `“${toDelete.label}” não está em nenhuma tarefa.`) : ""}
        onConfirm={() => {
          if (toDelete) onDelete(toDelete.id)
          setToDelete(null)
        }}
      />
    </div>
  )
}
