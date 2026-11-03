"use client"

import { useState } from "react"
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowLeftIcon, GripVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PRIORITIES, PRIORITY_LABELS, type ListRow, type Priority, type TagRow } from "@/features/tasks/types"
import { EMPTY_CRITERIA, newShortcutId, type ShortcutCriteria, type ShortcutDef } from "@/features/tasks/shortcuts"
import type { DueFilter } from "@/features/tasks/filters"

import { InlineInput } from "./inline-input"
import { ResponsiveSheet } from "./responsive-sheet"

const DUE_OPTIONS: { value: DueFilter | "range"; label: string }[] = [
  { value: "all", label: "Qualquer prazo" },
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta semana" },
  { value: "overdue", label: "Atrasadas" },
  { value: "none", label: "Sem data" },
  { value: "range", label: "Intervalo de datas" },
]

type EditorProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  shortcuts: ShortcutDef[]
  onChange: (next: ShortcutDef[]) => void
  lists: ListRow[]
  tags: TagRow[]
  categories: string[]
  /** Opens straight on the builder with these criteria ("Salvar filtro atual como atalho"). */
  draft: ShortcutCriteria | null
}

function Row({ def, onToggle, onRename, onDelete, renaming, setRenaming }: { def: ShortcutDef; onToggle: (hidden: boolean) => void; onRename: (label: string) => Promise<void>; onDelete: () => void; renaming: boolean; setRenaming: (v: boolean) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: def.id })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} data-shortcut={def.id} className={isDragging ? "relative z-10 opacity-70" : undefined}>
      <div className="flex min-h-12 items-center gap-2 border-b border-border">
        <button type="button" {...attributes} {...listeners} aria-label={`Reordenar ${def.label}`} className="flex size-11 shrink-0 cursor-grab items-center justify-center rounded-lg text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <GripVerticalIcon aria-hidden strokeWidth={1.75} className="size-4" />
        </button>
        {renaming && !def.builtin ? (
          <InlineInput initialValue={def.label} ariaLabel={`Nome do atalho ${def.label}`} className="min-w-0 flex-1" onCommit={onRename} onClose={() => setRenaming(false)} />
        ) : def.builtin ? (
          <span className="min-w-0 flex-1 truncate text-[15px]">{def.label}</span>
        ) : (
          <button type="button" onClick={() => setRenaming(true)} className="min-w-0 flex-1 truncate rounded-md text-left text-[15px] outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
            {def.label}
          </button>
        )}
        {def.builtin ? null : (
          <Button type="button" variant="ghost" size="icon" aria-label={`Excluir o atalho ${def.label}`} className="size-11 rounded-full" onClick={onDelete}>
            <Trash2Icon strokeWidth={1.75} />
          </Button>
        )}
        <Switch checked={!def.hidden} onCheckedChange={(on) => onToggle(!on)} aria-label={`Mostrar ${def.label}`} disabled={def.id === "todas"} />
      </div>
    </li>
  )
}

function toggle<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
}

function Builder({ initial, lists, tags, categories, onCancel, onSave }: { initial: ShortcutCriteria; lists: ListRow[]; tags: TagRow[]; categories: string[]; onCancel: () => void; onSave: (name: string, criteria: ShortcutCriteria) => void }) {
  const [name, setName] = useState("")
  const [c, setC] = useState<ShortcutCriteria>(initial)
  const dueValue: DueFilter | "range" = c.range ? "range" : c.due
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) onSave(name.trim(), c)
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="shortcut-name">Nome do atalho</Label>
        <Input id="shortcut-name" value={name} maxLength={40} autoFocus onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="shortcut-due">Prazo</Label>
        <Select
          value={dueValue}
          onValueChange={(v) => setC(v === "range" ? { ...c, due: "all", range: { from: null, to: null } } : { ...c, due: v as DueFilter, range: null })}
        >
          <SelectTrigger id="shortcut-due" className="h-11 w-full rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DUE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {c.range ? (
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" aria-label="De" value={c.range.from ?? ""} onChange={(e) => setC({ ...c, range: { from: e.target.value || null, to: c.range?.to ?? null } })} className="h-11 rounded-xl" />
            <Input type="date" aria-label="Até" value={c.range.to ?? ""} onChange={(e) => setC({ ...c, range: { from: c.range?.from ?? null, to: e.target.value || null } })} className="h-11 rounded-xl" />
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label>Prioridades</Label>
        <ToggleGroup type="multiple" variant="outline" value={c.priorities} onValueChange={(v) => setC({ ...c, priorities: v as Priority[] })} className="flex-wrap justify-start">
          {PRIORITIES.filter((p) => p !== "none").map((p) => (
            <ToggleGroupItem key={p} value={p} className="h-11 md:h-9">
              {PRIORITY_LABELS[p]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {lists.length > 0 ? (
        <fieldset className="flex flex-col">
          <Label>Listas</Label>
          {lists.map((l) => (
            <label key={l.id} className="flex min-h-11 items-center gap-3 text-[15px]">
              <Checkbox checked={c.listIds.includes(l.id)} onCheckedChange={() => setC({ ...c, listIds: toggle(c.listIds, l.id) })} /> {l.name}
            </label>
          ))}
        </fieldset>
      ) : null}
      {tags.length > 0 ? (
        <fieldset className="flex flex-col">
          <Label>Tags</Label>
          {tags.map((t) => (
            <label key={t.id} className="flex min-h-11 items-center gap-3 text-[15px]">
              <Checkbox checked={c.tagIds.includes(t.id)} onCheckedChange={() => setC({ ...c, tagIds: toggle(c.tagIds, t.id) })} /> {t.name}
            </label>
          ))}
        </fieldset>
      ) : null}
      {categories.length > 0 ? (
        <fieldset className="flex flex-col">
          <Label>Categorias</Label>
          {categories.map((cat) => (
            <label key={cat} className="flex min-h-11 items-center gap-3 text-[15px]">
              <Checkbox checked={c.categories.includes(cat)} onCheckedChange={() => setC({ ...c, categories: toggle(c.categories, cat) })} /> {cat}
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="shortcut-text">Texto contém</Label>
        <Input id="shortcut-text" value={c.query} maxLength={80} onChange={(e) => setC({ ...c, query: e.target.value })} className="h-11 rounded-xl" />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1 rounded-full" onClick={onCancel}>
          <ArrowLeftIcon strokeWidth={1.75} /> Voltar
        </Button>
        <Button type="submit" className="h-11 flex-1 rounded-full" disabled={!name.trim()}>
          Salvar atalho
        </Button>
      </div>
    </form>
  )
}

/** "Editar atalhos": reorder (drag or keyboard), show/hide, rename and delete custom ones, and "+ Novo atalho" (the filter builder). */
export function ShortcutEditor({ open, onOpenChange, shortcuts, onChange, lists, tags, categories, draft }: EditorProps) {
  const [building, setBuilding] = useState<ShortcutCriteria | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const criteria = building ?? draft

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = shortcuts.findIndex((s) => s.id === active.id)
    const to = shortcuts.findIndex((s) => s.id === over.id)
    if (from >= 0 && to >= 0) onChange(arrayMove(shortcuts, from, to))
  }

  return (
    <ResponsiveSheet open={open} onOpenChange={(o) => (setBuilding(null), onOpenChange(o))} title={criteria ? "Novo atalho" : "Editar atalhos"} description={criteria ? "Dê um nome e escolha o que o atalho filtra." : "Reordene, mostre ou esconda os atalhos da barra."}>
      {criteria ? (
        <Builder
          initial={criteria}
          lists={lists}
          tags={tags}
          categories={categories}
          onCancel={() => (building ? setBuilding(null) : onOpenChange(false))}
          onSave={(label, c) => {
            onChange([...shortcuts, { id: newShortcutId(), label, builtin: false, hidden: false, pinned: false, criteria: c }])
            setBuilding(null)
            onOpenChange(false)
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <DndContext id="shortcut-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={shortcuts.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col">
                {shortcuts.map((def) => (
                  <Row
                    key={def.id}
                    def={def}
                    renaming={renamingId === def.id}
                    setRenaming={(v) => setRenamingId(v ? def.id : null)}
                    onToggle={(hidden) => onChange(shortcuts.map((s) => (s.id === def.id ? { ...s, hidden } : s)))}
                    onRename={async (label) => onChange(shortcuts.map((s) => (s.id === def.id ? { ...s, label } : s)))}
                    onDelete={() => onChange(shortcuts.filter((s) => s.id !== def.id))}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setBuilding(EMPTY_CRITERIA)}>
            <PlusIcon strokeWidth={1.75} /> Novo atalho
          </Button>
        </div>
      )}
    </ResponsiveSheet>
  )
}
