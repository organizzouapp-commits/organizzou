"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckIcon, FolderIcon, NotebookPenIcon, PinIcon, PlusIcon, SearchIcon, type LucideIcon } from "lucide-react"

import { AddPill, LIST_CARD } from "@/components/finance/parts"
import { Collapse, GroupHeader } from "@/components/organizzou/Group"
import { NoteEditor } from "@/components/notes/note-editor"
import type { NotesController } from "@/components/notes/use-notes"
import { PillTabs, dashedPillClass } from "@/components/tasks/pill-tabs"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { excerpt, groupNotes, type FolderEntry } from "@/features/notes/notes"
import type { NoteRow } from "@/features/notes/types"
import { cn } from "@/lib/utils"

const PANE = "flex min-h-0 flex-col rounded-[20px] border border-border bg-card"
const chip = "tabular inline-flex h-6 max-w-32 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"
const LIMA = "bg-highlight text-highlight-foreground hover:bg-highlight/90"

// ------------------------------------------------------------------ folders

const FOLDER_ICON = (key: string): LucideIcon => (key === "all" ? NotebookPenIcon : key === "pinned" ? PinIcon : FolderIcon)

/** The dashed "Nova pasta" pill that opens into a field: Enter creates, Esc (or leaving it empty) cancels. */
function NewFolder({ onCreate, variant = "pill" }: { onCreate: (name: string) => void; variant?: "pill" | "chip" }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const finish = () => {
    setAdding(false)
    setName("")
  }
  if (!adding) {
    return variant === "chip" ? (
      <button type="button" data-testid="new-folder" onClick={() => setAdding(true)} className={dashedPillClass}>
        <PlusIcon aria-hidden strokeWidth={1.75} className="size-3.5" /> Pasta
      </button>
    ) : (
      <AddPill label="Nova pasta" onClick={() => setAdding(true)} />
    )
  }
  return (
    <form
      data-testid="new-folder-form"
      className={cn("flex h-11 items-center gap-2 rounded-full border border-dashed border-border px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary", variant === "chip" ? "w-48 shrink-0" : "w-full")}
      onSubmit={(e) => {
        e.preventDefault()
        const value = name.trim()
        if (!value) return
        onCreate(value)
        finish()
      }}
    >
      <PlusIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" />
      <input
        autoFocus
        aria-label="Nome da nova pasta"
        value={name}
        maxLength={60}
        placeholder="Nome da pasta"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && finish()}
        onBlur={() => !name.trim() && finish()}
        className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
      />
    </form>
  )
}

function FolderPane({ c, className }: { c: NotesController; className?: string }) {
  return (
    <nav aria-label="Pastas" data-testid="folder-pane" className={cn(PANE, "gap-1 overflow-y-auto p-3", className)}>
      <p className="px-2 pt-1 pb-1 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">Pastas</p>
      {c.entries.map((entry: FolderEntry) => {
        const Icon = FOLDER_ICON(entry.key)
        const on = c.folder === entry.key
        return (
          <button
            key={entry.key}
            type="button"
            data-folder={entry.key}
            aria-current={on ? "true" : undefined}
            onClick={() => c.setFolder(entry.key)}
            className={cn("flex h-11 shrink-0 items-center gap-3 rounded-full px-3 text-left text-[14px] leading-5 outline-none transition-colors duration-[400ms] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none", on ? "bg-highlight font-semibold text-highlight-foreground" : "hover:bg-accent")}
          >
            <Icon aria-hidden strokeWidth={1.75} className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate whitespace-nowrap">{entry.label}</span>
            <span className={cn("tabular text-[13px]", on ? "opacity-75" : "text-muted-foreground")}>{entry.count}</span>
          </button>
        )
      })}
      <div className="mt-auto pt-3">
        <NewFolder onCreate={c.addFolder} />
      </div>
    </nav>
  )
}

/** The folders as a row of pills (phones and narrow layouts). */
function FolderChips({ c, className }: { c: NotesController; className?: string }) {
  return (
    <div className={cn("-mx-4 flex items-center gap-2 px-4 md:mx-0 md:px-0", className)}>
      <PillTabs
        kind="tabs"
        ariaLabel="Pastas"
        items={c.entries.map((e) => ({ id: e.key, label: e.label, count: e.count }))}
        value={c.folder}
        onSelect={(item) => c.setFolder(item.id)}
        itemProps={(item) => ({ "data-folder": item.id })}
        className="-mx-0 min-w-0 flex-1 px-0"
      />
      <NewFolder variant="chip" onCreate={c.addFolder} />
    </div>
  )
}

// ------------------------------------------------------------------ list

function NoteCard({ note, folderName, selected, onSelect }: { note: NoteRow; folderName: string | null; selected: boolean; onSelect: () => void }) {
  const preview = excerpt(note.body)
  return (
    <button type="button" data-note={note.id} data-selected={selected} aria-current={selected ? "true" : undefined} onClick={onSelect} className={cn(LIST_CARD, "flex w-full flex-col gap-1.5 p-3 text-left outline-none transition-colors duration-[400ms] hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none", selected && "ring-2 ring-primary ring-inset")}>
      <span className="flex items-center gap-2">
        {note.pinned ? <PinIcon aria-label="Fixada" strokeWidth={1.75} className="size-3.5 shrink-0" /> : null}
        <span className="truncate text-[15px] leading-6 font-semibold">{note.title.trim() || "Sem título"}</span>
      </span>
      <span className="line-clamp-2 min-h-10 text-[13px] leading-5 text-muted-foreground">{preview || "Nota vazia"}</span>
      <span className="flex flex-wrap items-center gap-1.5">
        <span className={chip}>{format(new Date(note.updated_at), "d 'de' MMM", { locale: ptBR })}</span>
        {folderName ? (
          <span className={cn(chip, "gap-1")}>
            <FolderIcon aria-hidden strokeWidth={1.75} className="size-3 shrink-0" />
            <span className="truncate">{folderName}</span>
          </span>
        ) : null}
      </span>
    </button>
  )
}

function EmptyPane({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div data-testid="notes-empty" className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <span aria-hidden className="flex size-12 items-center justify-center rounded-full border border-border">
        <Icon strokeWidth={1.75} className="size-5" />
      </span>
      <p className="text-[16px] leading-6 font-semibold">{title}</p>
      <p className="max-w-64 text-[13px] leading-5 text-muted-foreground">{description}</p>
      {action}
    </div>
  )
}

function ListBody({ c, mobile }: { c: NotesController; mobile: boolean }) {
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const list = c.draftShown && c.draft ? [c.draft, ...c.visible] : c.visible
  const groups = groupNotes(list)
  const searching = c.query.trim() !== ""
  const current = c.entries.find((e) => e.key === c.folder)

  if (list.length === 0) {
    if (searching) return <EmptyPane icon={SearchIcon} title={`Nada encontrado para “${c.query.trim()}”`} description="Tente outra palavra ou limpe a busca." />
    const title = c.folder === "all" ? "Nenhuma nota ainda" : c.folder === "pinned" ? "Nenhuma nota fixada" : `${current?.label ?? "Esta pasta"} está vazia`
    const description = c.folder === "pinned" ? "Fixe uma nota para tê-la sempre no topo." : "Crie a primeira nota e ela aparece aqui."
    return (
      <EmptyPane
        icon={c.folder === "pinned" ? PinIcon : FolderIcon}
        title={title}
        description={description}
        action={
          <Button type="button" onClick={c.createNote} className={cn("h-11 rounded-full px-5", LIMA)}>
            <PlusIcon strokeWidth={1.75} /> Nova nota
          </Button>
        }
      />
    )
  }
  return (
    <div className={cn("flex flex-col gap-1", !mobile && "no-scrollbar min-h-0 flex-1 overflow-y-auto")}>
      {groups.map((group) => {
        const open = !closed[group.id]
        return (
          <section key={group.id} data-group={group.id} aria-label={group.label} className="flex flex-col">
            <GroupHeader label={group.label} count={group.items.length} open={open} onToggle={() => setClosed((s) => ({ ...s, [group.id]: open }))} />
            <Collapse open={open}>
              <ul className="flex flex-col gap-2 pb-2">
                {group.items.map((n) => (
                  <li key={n.id}>
                    <NoteCard note={n} folderName={c.folderName(n.folder_id)} selected={c.openId === n.id} onSelect={() => c.select(n.id)} />
                  </li>
                ))}
              </ul>
            </Collapse>
          </section>
        )
      })}
    </div>
  )
}

function SearchRow({ c }: { c: NotesController }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <SearchIcon aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <input type="search" data-testid="note-search" value={c.query} onChange={(e) => c.setQuery(e.target.value)} placeholder="Buscar notas" aria-label="Buscar notas" className="h-11 w-full rounded-full border border-input bg-transparent pr-4 pl-10 text-[15px] outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary" />
      </div>
      <Button type="button" size="icon" aria-label="Nova nota" data-testid="note-plus" onClick={c.createNote} className={cn("size-11 shrink-0 rounded-full", LIMA)}>
        <PlusIcon strokeWidth={1.75} />
      </Button>
    </div>
  )
}

// ------------------------------------------------------------------ mobile full-screen editor

/** Follows the visible part of the screen, so the toolbar stays above the on-screen keyboard (iOS keeps the layout viewport and only shrinks the visual one). */
function useVisibleBox() {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setBox({ top: vv.offsetTop, height: vv.height })
    update()
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
    }
  }, [])
  return box
}

function FullScreenEditor({ children }: { children: React.ReactNode }) {
  const box = useVisibleBox()
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [])
  // Above the floating bottom nav (z-30): inside the editor the main navigation is out of the way.
  return (
    <div data-testid="note-fullscreen" role="dialog" aria-label="Editor de nota" className="fixed inset-x-0 z-50 flex flex-col bg-background" style={{ top: box?.top ?? 0, height: box ? box.height : "100dvh" }}>
      {children}
    </div>
  )
}

// ------------------------------------------------------------------ the tab

export function NotasTab({ c, isMobile }: { c: NotesController; isMobile: boolean }) {
  const note = c.open
  const editor = note ? (
    <NoteEditor
      note={note}
      folderName={c.folderName(note.folder_id)}
      mobile={isMobile}
      editing={c.editing}
      onEditing={c.setEditing}
      pending={c.pending}
      isDraft={c.draft?.id === note.id}
      focusTick={c.focusTick}
      onChange={(patch) => c.updateNote(note.id, patch)}
      onBack={c.close}
      onMove={() => c.setMoving(note)}
      onDuplicate={() => c.duplicate(note)}
      onExport={() => c.exportNote(note)}
      onDelete={() => c.setToDelete(note)}
    />
  ) : null

  const dialogs = (
    <>
      <ConfirmDialog
        open={Boolean(c.toDelete)}
        onOpenChange={(open) => !open && c.setToDelete(null)}
        title="Excluir esta nota?"
        description={c.toDelete ? `“${c.toDelete.title.trim() || "Sem título"}” será apagada. Essa ação não pode ser desfeita.` : ""}
        onConfirm={c.confirmDelete}
      />
      <ResponsiveSheet open={Boolean(c.moving)} onOpenChange={(open) => !open && c.setMoving(null)} title="Mover para pasta" description="Escolha onde a nota fica.">
        <ul className="flex flex-col pb-2">
          {[{ id: null as string | null, name: "Sem pasta" }, ...c.folders.map((f) => ({ id: f.id as string | null, name: f.name }))].map((f) => {
            const current = c.moving?.folder_id === f.id
            return (
              <li key={f.id ?? "none"}>
                <button
                  type="button"
                  data-move-to={f.id ?? "none"}
                  aria-current={current ? "true" : undefined}
                  onClick={() => {
                    if (c.moving) c.moveTo(c.moving, f.id)
                    c.setMoving(null)
                  }}
                  className="flex min-h-12 w-full items-center gap-3 rounded-[12px] px-3 text-left text-[15px] outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <FolderIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  {current ? <CheckIcon aria-hidden strokeWidth={2} className="size-4" /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      </ResponsiveSheet>
    </>
  )

  if (isMobile) {
    return (
      <div data-testid="notas-tab" className="flex min-w-0 flex-col gap-3">
        <SearchRow c={c} />
        <FolderChips c={c} />
        <ListBody c={c} mobile />
        {note ? <FullScreenEditor>{editor}</FullScreenEditor> : null}
        {dialogs}
      </div>
    )
  }

  return (
    <div data-testid="notas-tab" className="@container flex min-w-0 flex-col gap-4">
      <FolderChips c={c} className="@min-[1000px]:hidden" />
      <div className="grid h-[720px] max-h-[calc(100dvh-10rem)] min-h-[520px] grid-cols-12 gap-4">
        <FolderPane c={c} className="col-span-2 hidden @min-[1000px]:flex" />
        <section aria-label="Lista de notas" data-testid="note-list" className={cn(PANE, "col-span-5 gap-3 p-4 @min-[1000px]:col-span-4")}>
          <SearchRow c={c} />
          <ListBody c={c} mobile={false} />
        </section>
        <section aria-label="Editor" data-testid="note-editor" className={cn(PANE, "col-span-7 @min-[1000px]:col-span-6")}>
          {editor ?? <EmptyPane icon={NotebookPenIcon} title="Selecione uma nota" description="Escolha uma nota na lista ou crie uma nova." />}
        </section>
      </div>
      {dialogs}
    </div>
  )
}
