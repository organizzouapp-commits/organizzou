"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckIcon, FolderIcon, ListChecksIcon, NotebookPenIcon, PinIcon, PlusIcon, SearchIcon, XIcon, type LucideIcon } from "lucide-react"

import { Collapse, GroupHeader } from "@/components/organizzou/Group"
import { NoteEditor } from "@/components/notes/note-editor"
import type { NotesController } from "@/components/notes/use-notes"
import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { PillTabs, dashedPillClass } from "@/components/tasks/pill-tabs"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { groupNotes, previewLines } from "@/features/notes/notes"
import type { NoteRow } from "@/features/notes/types"
import { useElementWidth } from "@/hooks/use-element-size"
import { useRestoreFocus } from "@/hooks/use-restore-focus"
import { splitColumns } from "@/lib/columns"
import { cn } from "@/lib/utils"

const chip = "tabular inline-flex h-6 max-w-32 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"
const LIMA = "bg-highlight text-highlight-foreground hover:bg-highlight/90"

// ------------------------------------------------------------------ the "Criar uma nota…" bar

/** The whole bar is a button: pressing it opens the note editor right away (no typing in the bar first). */
function CreateBar({ onCreate }: { onCreate: () => void }) {
  return (
    <button type="button" data-testid="create-note-bar" aria-haspopup="dialog" onClick={onCreate} className="mx-auto flex h-12 w-full max-w-[600px] items-center gap-3 rounded-[20px] border border-border bg-card px-4 text-left text-[15px] text-muted-foreground outline-none transition-colors duration-[400ms] hover:text-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none">
      <span className="min-w-0 flex-1 truncate">Criar uma nota…</span>
      <ListChecksIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
      <FolderIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
    </button>
  )
}

// ------------------------------------------------------------------ folders and search

/** The dashed "+ Nova pasta" pill that opens into a field: Enter creates, Esc (or leaving it empty) cancels. */
function NewFolder({ onCreate }: { onCreate: (name: string) => void }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const finish = () => {
    setAdding(false)
    setName("")
  }
  if (!adding) {
    return (
      <button type="button" data-testid="new-folder" onClick={() => setAdding(true)} className={cn(dashedPillClass, "shrink-0")}>
        <PlusIcon aria-hidden strokeWidth={1.75} className="size-3.5" /> Nova pasta
      </button>
    )
  }
  return (
    <form
      data-testid="new-folder-form"
      className="flex h-11 w-48 shrink-0 items-center gap-2 rounded-full border border-dashed border-border px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary"
      onSubmit={(e) => {
        e.preventDefault()
        const value = name.trim()
        if (!value) return
        onCreate(value)
        finish()
      }}
    >
      <PlusIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" />
      <input autoFocus aria-label="Nome da nova pasta" value={name} maxLength={60} placeholder="Nome da pasta" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Escape" && finish()} onBlur={() => !name.trim() && finish()} className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground" />
    </form>
  )
}

function SearchField({ c, mobile }: { c: NotesController; mobile: boolean }) {
  const [open, setOpen] = useState(false)
  const input = (
    <div className="relative min-w-0 flex-1">
      <SearchIcon aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
      <input type="search" data-testid="note-search" value={c.query} autoFocus={mobile} onChange={(e) => c.setQuery(e.target.value)} placeholder="Buscar notas" aria-label="Buscar notas" className="h-11 w-full rounded-full border border-input bg-transparent pr-4 pl-10 text-[15px] outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary" />
    </div>
  )
  if (!mobile) return <div className="w-72 shrink-0">{input}</div>
  // On phones the field collapses to an icon (it stays open while there is a search).
  if (open || c.query) {
    return (
      <div className="flex w-full items-center gap-2">
        {input}
        <Button type="button" variant="ghost" size="icon" aria-label="Fechar a busca" onClick={() => (c.setQuery(""), setOpen(false))} className="size-11 shrink-0 rounded-full">
          <XIcon strokeWidth={1.75} />
        </Button>
      </div>
    )
  }
  return (
    <Button type="button" variant="outline" size="icon" aria-label="Buscar notas" data-testid="note-search-toggle" onClick={() => setOpen(true)} className="size-11 shrink-0 rounded-full">
      <SearchIcon strokeWidth={1.75} />
    </Button>
  )
}

function FolderRow({ c, mobile }: { c: NotesController; mobile: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="folder-row">
      <div className="flex min-w-0 flex-1 items-center gap-2 basis-60">
        <PillTabs kind="tabs" ariaLabel="Pastas" items={c.entries.map((e) => ({ id: e.key, label: e.label, count: e.count }))} value={c.folder} onSelect={(item) => c.setFolder(item.id)} itemProps={(item) => ({ "data-folder": item.id })} className="min-w-0 flex-1" />
        <NewFolder onCreate={c.addFolder} />
      </div>
      <SearchField c={c} mobile={mobile} />
    </div>
  )
}

// ------------------------------------------------------------------ the masonry of cards

function PreviewBody({ body }: { body: string }) {
  const lines = previewLines(body, 6)
  if (lines.length === 0) return <p className="text-[13px] leading-5 text-muted-foreground">Nota vazia</p>
  return (
    <div className="flex flex-col gap-1 overflow-hidden text-[13px] leading-5 text-muted-foreground">
      {lines.map((line, i) =>
        line.kind === "todo" ? (
          <span key={i} className="flex items-start gap-2">
            <span aria-hidden className={cn("mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border", line.done ? "border-highlight bg-highlight text-highlight-foreground" : "border-foreground/40")}>
              {line.done ? <CheckIcon strokeWidth={3} className="size-2.5" /> : null}
            </span>
            <span className={cn("line-clamp-1 min-w-0", line.done && "line-through opacity-70")}>{line.text}</span>
          </span>
        ) : line.kind === "bullet" ? (
          <span key={i} className="flex items-start gap-2">
            <span aria-hidden>•</span>
            <span className="line-clamp-1 min-w-0">{line.text}</span>
          </span>
        ) : (
          <span key={i} className={cn("line-clamp-2", line.kind === "heading" && "font-semibold text-foreground")}>
            {line.text}
          </span>
        )
      )}
    </div>
  )
}

/** A note card. The whole card opens the editor (an overlay button); the pin sits above it and shows on hover or focus (always on touch). */
function NoteCard({ note, folderName, onOpen, onPin }: { note: NoteRow; folderName: string | null; onOpen: () => void; onPin: () => void }) {
  const title = note.title.trim() || "Sem título"
  return (
    <article role="listitem" data-note={note.id} className="group/card relative flex min-w-0 flex-col gap-2 rounded-[20px] border border-border bg-card p-4 transition-colors duration-[400ms] hover:bg-accent/40 motion-reduce:transition-none">
      <button type="button" aria-label={`Abrir nota ${title}`} onClick={onOpen} className="absolute inset-0 rounded-[20px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
      <div className="pointer-events-none relative flex items-start gap-2 pr-10">
        <h3 className="line-clamp-2 min-w-0 text-[15px] leading-6 font-semibold break-words">{title}</h3>
      </div>
      <div className="pointer-events-none relative">
        <PreviewBody body={note.body} />
      </div>
      <div className="pointer-events-none relative mt-1 flex flex-wrap items-center gap-1.5">
        {folderName ? (
          <span className={cn(chip, "gap-1")}>
            <FolderIcon aria-hidden strokeWidth={1.75} className="size-3 shrink-0" />
            <span className="truncate">{folderName}</span>
          </span>
        ) : null}
        <span className={chip}>{format(new Date(note.updated_at), "d 'de' MMM", { locale: ptBR })}</span>
      </div>
      <Button type="button" variant="ghost" size="icon" aria-label={note.pinned ? `Desafixar ${title}` : `Fixar ${title}`} aria-pressed={note.pinned} data-testid="card-pin" onClick={onPin} className={cn("absolute top-1 right-1 size-11 rounded-full transition-opacity duration-[400ms] motion-reduce:transition-none", note.pinned ? "text-foreground" : "text-muted-foreground [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/card:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100")}>
        <PinIcon strokeWidth={1.75} className={cn(note.pinned && "fill-current")} />
      </Button>
    </article>
  )
}

function Masonry({ c, notes, columns }: { c: NotesController; notes: NoteRow[]; columns: number }) {
  return (
    <div role="list" className="flex items-start gap-3">
      {splitColumns(notes, columns).map((column, index) => (
        <div key={index} className="flex min-w-0 flex-1 flex-col gap-3">
          {column.map((n) => (
            <NoteCard key={n.id} note={n} folderName={c.folderName(n.folder_id)} onOpen={() => c.select(n.id)} onPin={() => c.updateNote(n.id, { pinned: !n.pinned })} />
          ))}
        </div>
      ))}
    </div>
  )
}

function EmptyPane({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div data-testid="notes-empty" className="flex flex-col items-center justify-center gap-3 rounded-[20px] border border-border px-4 py-14 text-center">
      <span aria-hidden className="flex size-12 items-center justify-center rounded-full border border-border">
        <Icon strokeWidth={1.75} className="size-5" />
      </span>
      <p className="text-[16px] leading-6 font-semibold">{title}</p>
      {description ? <p className="max-w-64 text-[13px] leading-5 text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  )
}

/** Fixadas, then Outras: each a collapsible section with its count (the search and the folder chips filter both). */
function NotesBody({ c, columns }: { c: NotesController; columns: number }) {
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const groups = groupNotes(c.visible)
  const searching = c.query.trim() !== ""
  if (c.visible.length === 0) {
    if (searching) return <EmptyPane icon={SearchIcon} title={`Nada encontrado para “${c.query.trim()}”`} description="Tente outra palavra ou limpe a busca." />
    return (
      <EmptyPane
        icon={NotebookPenIcon}
        title="Nenhuma nota aqui"
        action={
          <Button type="button" onClick={c.createNote} className={cn("h-11 rounded-full px-5", LIMA)}>
            <PlusIcon strokeWidth={1.75} /> Criar nota
          </Button>
        }
      />
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => {
        const open = !closed[group.id]
        return (
          <section key={group.id} data-group={group.id} aria-label={group.id === "pinned" ? "Fixadas" : "Outras"} className="flex flex-col">
            <GroupHeader label={group.id === "pinned" ? "Fixadas" : "Outras"} count={group.items.length} open={open} onToggle={() => setClosed((s) => ({ ...s, [group.id]: open }))} />
            <Collapse open={open}>
              <div className="pb-3">
                <Masonry c={c} notes={group.items} columns={columns} />
              </div>
            </Collapse>
          </section>
        )
      })}
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
  const [rootRef, width] = useElementWidth<HTMLDivElement>()
  const columns = width >= 1000 ? 4 : width >= 720 ? 3 : 2
  // The editor opens from state (not from a Radix trigger): focus goes back to the card or the bar that opened it.
  useRestoreFocus(Boolean(note))
  // Ctrl/Cmd + N: a new note (the same draft rule as the buttons: an empty draft that already exists is focused, not duplicated).
  const { createNote } = c
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault()
        createNote()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [createNote])

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

  return (
    <div ref={rootRef} data-testid="notas-tab" className="flex min-w-0 flex-col gap-4">
      <CreateBar onCreate={c.createNote} />
      <FolderRow c={c} mobile={isMobile} />
      <NotesBody c={c} columns={columns} />

      {note && isMobile ? <FullScreenEditor>{editor}</FullScreenEditor> : null}
      {!isMobile ? (
        <Dialog open={Boolean(note)} onOpenChange={(open) => !open && c.close()}>
          <DialogContent showCloseButton={false} data-testid="note-dialog" className="flex h-[min(720px,80vh)] max-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px]">
            <DialogTitle className="sr-only">Editor de nota</DialogTitle>
            <DialogDescription className="sr-only">Escreva e edite a nota. As alterações são salvas sozinhas.</DialogDescription>
            <div className="flex shrink-0 items-center justify-between px-5 pt-3">
              <span className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">Nota</span>
              <Button type="button" variant="ghost" size="icon" aria-label="Fechar a nota" data-testid="note-close" onClick={c.close} className="-mr-2 size-11 rounded-full">
                <XIcon strokeWidth={1.75} />
              </Button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">{editor}</div>
          </DialogContent>
        </Dialog>
      ) : null}
      {dialogs}
    </div>
  )
}
