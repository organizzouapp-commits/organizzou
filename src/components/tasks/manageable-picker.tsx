"use client"

import { useRef, useState } from "react"
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { CheckIcon, GripVerticalIcon, PlusIcon, SettingsIcon, Trash2Icon } from "lucide-react"

import { ColorPicker } from "@/components/organizzou/ColorPicker"
import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { colorLabel, resolveHex, type ColorValue, type LabelKind } from "@/features/tasks/colors"
import { cn } from "@/lib/utils"

import { InlineInput } from "./inline-input"
import { useLabelColors } from "./label-colors-context"
import { ColorDot } from "./task-meta"

export type PickerItem = { id: string; label: string }

type ManageablePickerProps = {
  /** What the thing is called, singular and lowercase: "prioridade", "tag", "categoria". */
  noun: string
  /** Which colors the rows use. */
  kind: Exclude<LabelKind, "task">
  items: PickerItem[]
  selected: string[]
  multiple?: boolean
  /** A fixed first row that can be picked but never edited ("Sem prioridade"). */
  fixed?: PickerItem
  onSelect: (id: string) => void
  /** Resolves to the id (the key colors are stored under) of the new item, or false/void when nothing was created. */
  onCreate: (name: string) => Promise<string | false | void> | string | false | void
  onRename: (id: string, name: string) => Promise<boolean | void> | boolean | void
  onDelete: (id: string) => void
  /** How many tasks use an item (shown in the delete confirmation). */
  usage: (id: string) => number
  /** Order matters (priorities): rows get a drag handle in manage mode. */
  onReorder?: (ids: string[]) => void
  /** Shown in the delete confirmation: what happens to the tasks that use the item. */
  deleteNote?: string
}

/** The color of a row as a 28 px circle (44 px hit area) that opens the shared ColorPicker. */
function ColorButton({ noun, name, value, onChange, onOpenChange }: { noun: string; name: string; value: ColorValue; onChange: (value: ColorValue) => void; onOpenChange?: (open: boolean) => void }) {
  const colors = useLabelColors()
  const hex = resolveHex(value)
  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Cor de ${name || noun}: ${colorLabel(value)}`}
          data-color-button
          className="relative flex size-7 shrink-0 items-center justify-center rounded-full outline-none after:absolute after:-inset-2 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span aria-hidden className={cn("size-6 rounded-full", hex ? "ring-1 ring-foreground/25" : "border-2 border-foreground/50")} style={hex ? { backgroundColor: hex } : undefined} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={16} className="w-72 rounded-2xl p-2" data-testid="row-color-picker">
        <ColorPicker label={`Cor de ${name || noun}`} value={value} onChange={onChange} custom={colors.state.custom} onSaveCustom={colors.addCustom} onRemoveCustom={colors.removeCustom} />
      </PopoverContent>
    </Popover>
  )
}

function Row({ item, kind, noun, picked, managing, reorderable, editing, setEditing, props, onAskDelete }: { item: PickerItem; kind: ManageablePickerProps["kind"]; noun: string; picked: boolean; managing: boolean; reorderable: boolean; editing: boolean; setEditing: (v: boolean) => void; props: ManageablePickerProps; onAskDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !reorderable || !managing })
  const colors = useLabelColors()
  const color = colors.colorOf(kind, item.id)
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} data-picker-item={item.id} className={cn("flex min-h-[52px] items-center gap-1", isDragging && "relative z-10 opacity-70")}>
      {managing && reorderable ? (
        <button type="button" {...attributes} {...listeners} aria-label={`Reordenar ${item.label}`} className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <GripVerticalIcon aria-hidden strokeWidth={1.75} className="size-4" />
        </button>
      ) : null}
      {managing ? <ColorButton noun={noun} name={item.label} value={color} onChange={(value) => colors.setColor(kind, item.id, value)} /> : null}
      {editing ? (
        <InlineInput initialValue={item.label} ariaLabel={`Nome: ${item.label}`} className="min-w-0 flex-1" onCommit={(name) => props.onRename(item.id, name)} onClose={() => setEditing(false)} />
      ) : (
        <button
          type="button"
          data-pill-exempt
          onClick={() => (managing ? setEditing(true) : props.onSelect(item.id))}
          className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-left text-[15px] outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {managing ? null : <ColorDot color={color} />}
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {picked && !managing ? <CheckIcon aria-label="Selecionada" strokeWidth={1.75} className="size-4 shrink-0" /> : null}
        </button>
      )}
      {managing && !editing ? (
        <Button type="button" variant="ghost" size="icon" aria-label={`Excluir ${item.label}`} className="size-11 shrink-0 rounded-full" onClick={onAskDelete}>
          <Trash2Icon strokeWidth={1.75} />
        </Button>
      ) : null}
    </li>
  )
}

/** "+ Adicionar": an inline row at the top of the list (color + name). Leaving it saves a non-empty name; Esc discards. */
function AddRow({ noun, onCommit, onClose }: { noun: string; onCommit: (name: string, color: ColorValue) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState("")
  const [color, setColor] = useState<ColorValue>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const settled = useRef(false)
  async function commit() {
    if (settled.current) return
    settled.current = true
    const text = name.trim()
    if (text) await onCommit(text, color)
    onClose()
  }
  return (
    <li
      data-add-row
      className="flex min-h-[52px] items-center gap-2 px-1"
      onBlur={(e) => {
        if (pickerOpen || e.currentTarget.contains(e.relatedTarget as Node | null)) return
        void commit()
      }}
    >
      <ColorButton noun={noun} name={name} value={color} onChange={setColor} onOpenChange={setPickerOpen} />
      <Input
        autoFocus
        value={name}
        maxLength={80}
        enterKeyHint="done"
        placeholder={`Nome da ${noun}`}
        aria-label={`Nome da nova ${noun}`}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === "Enter") {
            e.preventDefault()
            void commit()
          } else if (e.key === "Escape") {
            e.preventDefault()
            settled.current = true
            onClose()
          }
        }}
        className="h-11 min-w-0 flex-1 rounded-xl"
      />
    </li>
  )
}

/**
 * ONE picker for priorities, tags and categories. Search at the top ("Buscar ou criar…", with a "Criar “texto”" row when nothing
 * matches exactly), the scrolling list, and a footer that stays put outside the list: "Gerenciar" (rows get color, rename by click,
 * delete and, for priorities, a drag handle) and "+ Adicionar" (an inline row at the top). A popover on desktop, a sheet on phones.
 */
export function ManageablePicker(props: ManageablePickerProps) {
  const { noun, kind, items, selected, fixed, onCreate, onDelete, usage, onReorder } = props
  const colors = useLabelColors()
  const [query, setQuery] = useState("")
  const [managing, setManaging] = useState(false)
  const [adding, setAdding] = useState(false)
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

  async function create(name: string, color: ColorValue = null) {
    const text = name.trim().slice(0, 80)
    if (!text) return
    const key = await onCreate(text)
    if (key && color) colors.setColor(kind, key, color)
  }

  return (
    <div className="flex max-h-[min(64dvh,480px)] min-h-0 flex-col gap-2" data-testid={`picker-${noun}`}>
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
            setQuery("")
            void create(trimmed)
          }
        }}
        className="h-11 shrink-0 rounded-xl"
      />
      <ul data-picker-list className="flex min-h-0 flex-1 flex-col scroll-soft overflow-y-auto overscroll-contain">
        {adding ? <AddRow noun={noun} onCommit={(name, color) => create(name, color)} onClose={() => setAdding(false)} /> : null}
        {fixed && !managing ? (
          <li className="flex min-h-[52px] items-center">
            <button type="button" data-pill-exempt onClick={() => props.onSelect(fixed.id)} className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-left text-[15px] outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
              <span className="min-w-0 flex-1 truncate">{fixed.label}</span>
              {selected.length === 0 ? <CheckIcon aria-label="Selecionada" strokeWidth={1.75} className="size-4 shrink-0" /> : null}
            </button>
          </li>
        ) : null}
        <DndContext id={`picker-dnd-${noun}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={shown.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {shown.map((item) => (
              <Row key={item.id} item={item} kind={kind} noun={noun} picked={selected.includes(item.id)} managing={managing} reorderable={Boolean(onReorder)} editing={editingId === item.id} setEditing={(v) => setEditingId(v ? item.id : null)} props={props} onAskDelete={() => setToDelete(item)} />
            ))}
          </SortableContext>
        </DndContext>
        {!managing && trimmed && !exact ? (
          <li>
            <button
              type="button"
              data-pill-exempt
              onClick={() => {
                setQuery("")
                void create(trimmed)
              }}
              className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <PlusIcon aria-hidden strokeWidth={1.75} className="size-4" /> Criar “{trimmed}”
            </button>
          </li>
        ) : null}
        {shown.length === 0 && !trimmed && !adding ? <li className="px-3 py-3 text-[13px] leading-5 text-muted-foreground">Nenhuma {noun} ainda. Toque em Adicionar.</li> : null}
      </ul>
      <div data-picker-footer className="flex shrink-0 gap-2 border-t border-border bg-popover pt-2 pb-[max(0px,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1"
          aria-pressed={managing}
          onClick={() => {
            setManaging((v) => !v)
            setEditingId(null)
            setAdding(false)
          }}
        >
          <SettingsIcon strokeWidth={1.75} /> {managing ? "Concluir" : "Gerenciar"}
        </Button>
        <Button type="button" variant="secondary" className="h-11 flex-1" onClick={() => setAdding(true)}>
          <PlusIcon strokeWidth={1.75} /> Adicionar
        </Button>
      </div>
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Excluir ${noun}?`}
        description={toDelete ? (usage(toDelete.id) > 0 ? `“${toDelete.label}” está em ${usage(toDelete.id)} ${usage(toDelete.id) === 1 ? "tarefa" : "tarefas"}. ${props.deleteNote ?? "Ela será removida delas."}` : `“${toDelete.label}” não está em nenhuma tarefa.`) : ""}
        onConfirm={() => {
          if (toDelete) onDelete(toDelete.id)
          setToDelete(null)
        }}
      />
    </div>
  )
}
