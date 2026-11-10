"use client"

import { useEffect, useRef, useState } from "react"
import { XIcon, BoldIcon, CheckIcon, CopyIcon, DownloadIcon, EllipsisIcon, FolderIcon, HeadingIcon, ItalicIcon, ListChecksIcon, ListIcon, PinIcon, Trash2Icon, type LucideIcon } from "lucide-react"

import { NotePreview } from "@/components/notes/note-preview"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { wordCount } from "@/features/notes/markdown"
import { applyMarkdown, toggleCheckbox, type MarkdownKind } from "@/features/notes/notes"
import type { NoteRow } from "@/features/notes/types"
import { cn } from "@/lib/utils"

const ICON_BUTTON = "size-11 shrink-0 rounded-full"
const chip = "tabular inline-flex h-6 max-w-40 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"

const TOOLS: { kind: MarkdownKind; label: string; icon: LucideIcon }[] = [
  { kind: "heading", label: "Título", icon: HeadingIcon },
  { kind: "bold", label: "Negrito", icon: BoldIcon },
  { kind: "italic", label: "Itálico", icon: ItalicIcon },
  { kind: "list", label: "Lista", icon: ListIcon },
  { kind: "checklist", label: "Lista de tarefas", icon: ListChecksIcon },
]

// ------------------------------------------------------------------ Ler / Editar

function ModeSwitch({ editing, onChange }: { editing: boolean; onChange: (editing: boolean) => void }) {
  return (
    <div role="tablist" aria-label="Modo da nota" data-testid="note-mode" className="inline-flex h-9 shrink-0 items-center gap-0.5 rounded-full bg-muted p-0.5">
      {[
        { id: false, label: "Ler" },
        { id: true, label: "Editar" },
      ].map((item) => {
        const on = item.id === editing
        return (
          <button
            key={item.label}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(item.id)}
            className={cn("relative inline-flex h-8 items-center justify-center rounded-full px-4 text-[13px] leading-5 outline-none transition-colors duration-[400ms] after:absolute after:inset-x-0 after:-inset-y-1.5 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none", on ? "bg-highlight font-semibold text-highlight-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------------ the "..." menu

type MenuProps = { note: NoteRow; mobile: boolean; onPin: () => void; onMove: () => void; onDuplicate: () => void; onExport: () => void; onDelete: () => void }

const ROW = "flex min-h-12 w-full items-center gap-3 rounded-[12px] px-3 text-left text-[15px] leading-6 outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"

export function NoteMenu({ note, mobile, onPin, onMove, onDuplicate, onExport, onDelete }: MenuProps) {
  const [sheet, setSheet] = useState(false)
  const items = [
    { label: note.pinned ? "Desafixar" : "Fixar nota", icon: PinIcon, run: onPin },
    { label: "Mover para pasta…", icon: FolderIcon, run: onMove },
    { label: "Duplicar", icon: CopyIcon, run: onDuplicate },
    { label: "Exportar como .md", icon: DownloadIcon, run: onExport },
  ]
  const trigger = (
    <Button type="button" variant="ghost" size="icon" aria-label="Mais opções" data-testid="note-menu" className={ICON_BUTTON} onClick={mobile ? () => setSheet(true) : undefined}>
      <EllipsisIcon strokeWidth={1.75} />
    </Button>
  )
  if (mobile) {
    return (
      <>
        {trigger}
        <ResponsiveSheet open={sheet} onOpenChange={setSheet} title="Opções da nota">
          <div className="flex flex-col pb-2">
            {items.map(({ label, icon: Icon, run }) => (
              <button
                key={label}
                type="button"
                className={ROW}
                onClick={() => {
                  setSheet(false)
                  run()
                }}
              >
                <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" /> {label}
              </button>
            ))}
            <hr className="my-1 border-border" />
            <button
              type="button"
              className={ROW}
              onClick={() => {
                setSheet(false)
                onDelete()
              }}
            >
              <Trash2Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" /> Excluir nota
            </button>
          </div>
        </ResponsiveSheet>
      </>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {items.map(({ label, icon: Icon, run }) => (
          <DropdownMenuItem key={label} className="min-h-11 px-3 text-[14px]" onSelect={run}>
            <Icon strokeWidth={1.75} /> {label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11 px-3 text-[14px]" onSelect={onDelete}>
          <Trash2Icon strokeWidth={1.75} /> Excluir nota
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ------------------------------------------------------------------ the editor

export type NoteEditorProps = {
  note: NoteRow
  folderName: string | null
  mobile: boolean
  editing: boolean
  onEditing: (editing: boolean) => void
  pending: boolean
  isDraft: boolean
  /** Changes every time "Nova nota" is pressed: the title takes the focus. */
  focusTick: number
  onChange: (patch: Partial<NoteRow>) => void
  onBack?: () => void
  onMove: () => void
  onDuplicate: () => void
  onExport: () => void
  onDelete: () => void
}

export function NoteEditor(props: NoteEditorProps) {
  const { note, folderName, mobile, editing, onEditing, pending, isDraft, focusTick, onChange } = props
  const title = useRef<HTMLInputElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const queued = useRef<MarkdownKind | null>(null)

  useEffect(() => {
    if (focusTick > 0) title.current?.focus()
  }, [focusTick])

  function run(kind: MarkdownKind) {
    const el = area.current
    if (!el) return
    const edit = applyMarkdown(el.value, el.selectionStart, el.selectionEnd, kind)
    onChange({ body: edit.text })
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(edit.start, edit.end)
    })
  }
  function apply(kind: MarkdownKind) {
    if (editing) return run(kind)
    // From the reading view: switch to editing, put the cursor at the end, then apply.
    queued.current = kind
    onEditing(true)
  }
  useEffect(() => {
    if (!editing || !queued.current) return
    const kind = queued.current
    queued.current = null
    const el = area.current
    if (el) el.setSelectionRange(el.value.length, el.value.length)
    run(kind)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const words = wordCount(note.body)
  const toolButton = (kind: MarkdownKind, label: string, Icon: LucideIcon, className: string) => (
    // Keep the selection of the text while the button is pressed.
    <Button key={kind} type="button" variant="ghost" size="icon" aria-label={label} data-tool={kind} className={className} onPointerDown={(e) => e.preventDefault()} onClick={() => apply(kind)}>
      <Icon strokeWidth={1.75} />
    </Button>
  )

  const pin = (
    <Button type="button" variant="ghost" size="icon" aria-label={note.pinned ? "Desafixar nota" : "Fixar nota"} aria-pressed={note.pinned} data-testid="note-pin" className={cn(ICON_BUTTON, note.pinned && "bg-highlight text-highlight-foreground hover:bg-highlight/90")} onClick={() => onChange({ pinned: !note.pinned })}>
      <PinIcon strokeWidth={1.75} className={cn(note.pinned && "fill-current")} />
    </Button>
  )
  const menu = <NoteMenu note={note} mobile={mobile} onPin={() => onChange({ pinned: !note.pinned })} onMove={props.onMove} onDuplicate={props.onDuplicate} onExport={props.onExport} onDelete={props.onDelete} />
  const titleInput = (
    <input
      ref={title}
      aria-label="Título da nota"
      data-testid="note-title"
      value={note.title}
      maxLength={120}
      placeholder="Sem título"
      onChange={(e) => onChange({ title: e.target.value })}
      className={cn("min-w-0 rounded-[12px] bg-transparent px-2 -mx-2 font-semibold tracking-[-0.01em] outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary", mobile ? "h-12 w-full shrink-0 text-[26px] leading-9" : "h-11 flex-1 text-[22px] leading-8")}
    />
  )
  const content = editing ? (
    <Textarea
      ref={area}
      aria-label="Texto da nota"
      data-testid="note-body"
      value={note.body}
      onChange={(e) => onChange({ body: e.target.value })}
      placeholder="Escreva aqui. Use # para títulos, - para listas, **negrito** e *itálico*."
      className="min-h-48 flex-1 resize-none rounded-[12px] px-3 py-2.5 font-mono text-[14px] leading-6 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary"
    />
  ) : note.body.trim() ? (
    <NotePreview source={note.body} onToggleLine={(line) => onChange({ body: toggleCheckbox(note.body, line) })} />
  ) : (
    <p className="text-[15px] leading-6 text-muted-foreground">Nota vazia. Toque em “Editar” para escrever.</p>
  )
  const footer = (
    <div className="flex items-center gap-2 text-[13px] leading-5 text-muted-foreground">
      <span className="tabular shrink-0">
        {words} {words === 1 ? "palavra" : "palavras"}
      </span>
      <span aria-hidden>·</span>
      <button type="button" data-testid="note-folder-chip" aria-label={`Pasta: ${folderName ?? "sem pasta"}. Mover para outra pasta`} onClick={props.onMove} className={cn(chip, "relative min-w-0 truncate outline-none after:absolute after:-inset-y-2.5 after:inset-x-0 focus-visible:ring-3 focus-visible:ring-ring/50")}>
        <span className="truncate">{folderName ?? "Sem pasta"}</span>
      </button>
      <span role="status" aria-live="polite" data-testid="note-status" className="tabular ml-auto flex shrink-0 items-center gap-1">
        {pending ? (
          "Salvando…"
        ) : isDraft ? (
          "Rascunho"
        ) : (
          <>
            <CheckIcon aria-hidden strokeWidth={2} className="size-3.5" /> Salvo
          </>
        )}
      </span>
    </div>
  )

  if (mobile) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-1 px-2 pt-1">
          <Button type="button" variant="ghost" size="icon" aria-label="Fechar a nota" data-testid="note-back" className={ICON_BUTTON} onClick={props.onBack}>
            <XIcon strokeWidth={1.75} />
          </Button>
          <button type="button" aria-label={`Pasta: ${folderName ?? "sem pasta"}. Mover para outra pasta`} onClick={props.onMove} className={cn(chip, "mr-auto h-8 gap-1.5 px-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50")}>
            <FolderIcon aria-hidden strokeWidth={1.75} className="size-3.5 shrink-0" />
            <span className="truncate">{folderName ?? "Sem pasta"}</span>
          </button>
          {pin}
          {menu}
        </div>
        <div data-vaul-no-drag className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-2">
          {titleInput}
          <div className="flex justify-start">
            <ModeSwitch editing={editing} onChange={onEditing} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{content}</div>
          <div className="pb-2">{footer}</div>
        </div>
        <div role="toolbar" data-vaul-no-drag aria-label="Formatação" data-testid="note-toolbar" className="flex h-16 shrink-0 items-center justify-around border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] box-content">
          {TOOLS.map((t) => toolButton(t.kind, t.label, t.icon, "size-12 rounded-full"))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        {titleInput}
        {pin}
        {menu}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div role="toolbar" aria-label="Formatação" className="flex items-center gap-1">
          {TOOLS.filter((t) => t.kind !== "checklist").map((t) => toolButton(t.kind, t.label, t.icon, ICON_BUTTON))}
        </div>
        <ModeSwitch editing={editing} onChange={onEditing} />
      </div>
      <hr className="border-border" />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{content}</div>
      {footer}
    </div>
  )
}
