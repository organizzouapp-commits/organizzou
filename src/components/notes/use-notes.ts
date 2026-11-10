"use client"

import { useEffect, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { toast } from "sonner"

import { duplicateNote, exportMarkdown, filterNotes, folderEntries, shouldDiscardDraft, shouldPersistDraft, startDraft, type FolderKey } from "@/features/notes/notes"
import type { FolderDialogState } from "@/components/notes/folder-dialog"
import type { NoteFolderRow, NoteRow } from "@/features/notes/types"
import { newId } from "@/lib/sp-time"

const USER = "00000000-0000-4000-8000-000000000001"
/** Typing is saved by the persistence hook 800 ms after the last key; the footer says "Salvando…" a little longer than that. */
const SAVE_MS = 1100

type Setter<T> = Dispatch<SetStateAction<T[]>>

/**
 * The state and actions of the Notas tab. A new note is a draft that only lives in memory: it joins the saved notes when it gets a title
 * or some content, "Nova nota" focuses the empty draft that already exists instead of making another, and an empty draft is dropped as soon
 * as the person leaves it (another note, another folder, the list, another tab).
 */
export function useNotes({ notes, setNotes, folders, setFolders }: { notes: NoteRow[]; setNotes: Setter<NoteRow>; folders: NoteFolderRow[]; setFolders: Setter<NoteFolderRow> }) {
  const [folder, setFolderState] = useState<FolderKey>("all")
  const [query, setQuery] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<NoteRow | null>(null)
  const [toDelete, setToDelete] = useState<NoteRow | null>(null)
  const [moving, setMoving] = useState<NoteRow | null>(null)
  const [folderDialog, setFolderDialog] = useState<FolderDialogState | null>(null)
  const [pending, setPending] = useState(false)
  const [focusTick, setFocusTick] = useState(0)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const open = draft?.id === openId ? draft : (notes.find((n) => n.id === openId) ?? null)
  const visible = filterNotes(notes, folder, query)
  // The draft sits at the top of the list while it exists (in its own folder, and never in a search or in Fixadas).
  const draftShown = draft !== null && !query.trim() && folder !== "pinned" && (folder === "all" || folder === draft.folder_id)
  const entries = folderEntries(notes, folders)
  const folderName = (id: string | null) => folders.find((f) => f.id === id)?.name ?? null

  function discardDraft(keepId?: string) {
    if (!shouldDiscardDraft(draft) || draft?.id === keepId) return
    if (openId === draft?.id) setOpenId(null)
    setDraft(null)
  }

  function markSaving() {
    setPending(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setPending(false), SAVE_MS)
  }

  function updateNote(id: string, patch: Partial<NoteRow>) {
    markSaving()
    const stamp = new Date().toISOString()
    if (draft && draft.id === id) {
      const next = { ...draft, ...patch, updated_at: stamp }
      if (shouldPersistDraft(next)) {
        setNotes((current) => [next, ...current])
        setDraft(null)
      } else setDraft(next)
      return
    }
    setNotes((current) => current.map((n) => (n.id === id ? { ...n, ...patch, updated_at: stamp } : n)))
  }

  function createNote() {
    const stamp = new Date().toISOString()
    const { draft: next } = startDraft(draft, () => ({ id: newId(), user_id: USER, folder_id: folder !== "all" && folder !== "pinned" ? folder : null, title: "", body: "", pinned: false, tags: [], created_at: stamp, updated_at: stamp }))
    setQuery("")
    setDraft(next)
    setOpenId(next.id)
    setEditing(true)
    setFocusTick((t) => t + 1)
  }

  function select(id: string) {
    discardDraft(id)
    setOpenId(id)
    setEditing(false)
  }

  function setFolder(key: FolderKey) {
    discardDraft()
    setFolderState(key)
  }

  /** Leaves the open note (the back arrow on phones, a tab change). */
  function close() {
    discardDraft()
    setOpenId(null)
  }

  function addFolder(name: string) {
    setFolders((current) => [...current, { id: newId(), user_id: USER, name }])
    toast.success("Pasta criada.")
  }

  function renameFolder(id: string, name: string) {
    setFolders((current) => current.map((f) => (f.id === id ? { ...f, name } : f)))
    toast.success("Pasta renomeada.")
  }

  function duplicate(note: NoteRow) {
    const copy = duplicateNote(note, newId(), new Date().toISOString())
    setNotes((current) => [copy, ...current])
    setOpenId(copy.id)
    setEditing(false)
    toast.success("Nota duplicada.")
  }

  function exportNote(note: NoteRow) {
    const { filename, content } = exportMarkdown(note)
    const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast.success("Nota exportada.")
  }

  function confirmDelete() {
    const note = toDelete
    setToDelete(null)
    if (!note) return
    if (draft?.id === note.id) setDraft(null)
    else setNotes((current) => current.filter((n) => n.id !== note.id))
    setOpenId(null)
    toast("Nota excluída.")
  }

  function moveTo(note: NoteRow, folderId: string | null) {
    updateNote(note.id, { folder_id: folderId })
    toast(folderId ? `Movida para ${folderName(folderId)}.` : "Movida para fora das pastas.")
  }

  return {
    notes,
    folders,
    folder,
    setFolder,
    query,
    setQuery,
    openId,
    open,
    editing,
    setEditing,
    draft,
    draftShown,
    visible,
    entries,
    folderName,
    pending,
    focusTick,
    toDelete,
    setToDelete,
    moving,
    setMoving,
    updateNote,
    createNote,
    select,
    close,
    addFolder,
    renameFolder,
    folderDialog,
    setFolderDialog,
    duplicate,
    exportNote,
    confirmDelete,
    moveTo,
  }
}

export type NotesController = ReturnType<typeof useNotes>
