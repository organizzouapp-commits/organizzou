"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { addDays, format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisIcon,
  LayoutListIcon,
  ListIcon,
  PaperclipIcon,
  PencilIcon,
  PlusIcon,
  TagIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useMediaQuery } from "@/hooks/use-media-query"
import type { BoardApi } from "@/features/tasks/board-api"
import { ManageablePicker } from "./manageable-picker"
import { MAX_ATTACHMENT_BYTES } from "@/features/tasks/schemas"
import type { AttachmentRow, ChecklistItemRow, CommentRow, ListRow, TagRow, TaskView } from "@/features/tasks/types"
import { dayKey, splitDue, toDueIso } from "@/lib/dates"
import type { SwatchId } from "@/lib/swatches"
import { ColorPicker } from "@/components/organizzou/ColorPicker"
import { undoable } from "@/features/tasks/undo"
import { columnSwatchFor, resolveHex, taskColorOf, type ColorValue } from "@/features/tasks/colors"
import { cn } from "@/lib/utils"

import { useLabelColors } from "./label-colors-context"
import { ColorDot, LabelBadge, TagChip } from "./task-meta"

/** Everything the pickers manage: tags and categories. Implemented by the board. */
export type Taxonomy = {
  tags: { rename: (id: string, name: string) => Promise<boolean>; remove: (id: string) => void; usage: (id: string) => number }
  categories: { list: string[]; rename: (from: string, to: string) => void; remove: (name: string) => void; usage: (name: string) => number }
}

type TaskDetailProps = {
  /** Opens with the Tags picker already open (the "+N" chip of a card). */
  focusTags?: boolean
  api: BoardApi
  taxonomy: Taxonomy
  /** The open task, or null (closed). */
  task: TaskView | null
  boardName: string
  boardId: string
  boards: { id: string; name: string }[]
  onMoveToBoard: (task: TaskView, boardId: string) => void
  lists: ListRow[]
  tags: TagRow[]
  timeZone: string
  now: Date
  /** The tasks of the list on screen, in order: "Tarefa anterior" / "Próxima tarefa" walk through them. */
  siblings: string[]
  onNavigate: (id: string) => void
  onClose: () => void
  onTaskChange: (task: TaskView) => void
  onToggleComplete: (task: TaskView) => void
  onMove: (task: TaskView) => void
  onMoveToList: (task: TaskView, listId: string) => void
  onDuplicate: (task: TaskView) => void
  onTagCreated: (tag: TagRow) => void
  onDelete: (task: TaskView) => void
}

const overline = "text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase"

function formatSize(bytes: number | null) {
  if (bytes == null) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
}

type SaveState = "idle" | "saving" | "saved" | "error"

/** Save status for the header: "Salvando…" -> "Salvo" (a moment) -> "Não foi possível salvar · Tentar de novo". */
function useSaveStatus() {
  const [state, setState] = useState<SaveState>("idle")
  const pending = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const retry = useRef<(() => Promise<boolean>) | null>(null)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const track = useCallback(async (run: () => Promise<boolean>) => {
    pending.current += 1
    window.clearTimeout(timer.current)
    setState("saving")
    const ok = await run().catch(() => false)
    pending.current -= 1
    if (!ok) {
      retry.current = run
      setState("error")
    } else if (pending.current === 0) {
      retry.current = null
      setState("saved")
      timer.current = window.setTimeout(() => setState("idle"), 2200)
    }
    return ok
  }, [])
  const retryNow = useCallback(() => {
    const run = retry.current
    if (run) void track(run)
  }, [track])
  return { state, track, retryNow }
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  return (
    <span role="status" aria-live="polite" data-save={state} className="inline-flex min-h-5 items-center gap-1 text-[13px] leading-5 text-muted-foreground">
      {state === "saving" ? "Salvando…" : null}
      {state === "saved" ? (
        <>
          <CheckIcon aria-hidden strokeWidth={2} className="size-3.5" /> Salvo
        </>
      ) : null}
      {state === "error" ? (
        <>
          Não foi possível salvar ·{" "}
          <button type="button" onClick={onRetry} className="rounded-sm font-medium text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            Tentar de novo
          </button>
        </>
      ) : null}
    </span>
  )
}

/** A multi-line title that grows with its text: never truncated. */
function TitleField({ value, onChange, onCommit, className }: { value: string; onChange: (v: string) => void; onCommit: () => void; className?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      aria-label="Título da tarefa"
      value={value}
      maxLength={200}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      className={cn("w-full min-w-0 resize-none overflow-hidden border-0 bg-transparent p-0 font-semibold tracking-[-0.01em] outline-none focus-visible:ring-0", className)}
    />
  )
}

type OptionPickerProps<T extends string> = { options: { id: T; label: string }[]; value: T; onPick: (id: T) => void }

function OptionList<T extends string>({ options, value, onPick }: OptionPickerProps<T>) {
  return (
    <ul className="flex flex-col">
      {options.map((o) => (
        <li key={o.id}>
          <button type="button" onClick={() => onPick(o.id)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
            <span className="flex-1">{o.label}</span>
            {o.id === value ? <CheckIcon aria-label="Selecionado" strokeWidth={1.75} className="size-4" /> : null}
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * One property: desktop = overline label + a 40 px value button that opens a popover; phones = a 52 px row of the grouped list that
 * opens a bottom picker. `content` is written once and shown in either.
 */
function Property({
  label,
  icon: Icon,
  value,
  desktop,
  readOnly,
  wide,
  defaultOpen,
  children,
}: {
  /** Starts open (a card's "+N" chip lands on Tags). */
  defaultOpen?: boolean
  label: string
  icon: typeof ListIcon
  value: React.ReactNode
  desktop: boolean
  readOnly?: boolean
  /** The date picker: 320 px wide. */
  wide?: boolean
  children?: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  // A card's "+N" chip lands here: open after the panel has settled (opening during its focus handling would close it again).
  useEffect(() => {
    if (!defaultOpen) return
    const timer = window.setTimeout(() => setOpen(true), 450)
    return () => window.clearTimeout(timer)
  }, [defaultOpen])
  if (readOnly || !children) {
    return desktop ? (
      <div className="flex flex-col gap-1.5">
        <span className={overline}>{label}</span>
        <div className="flex h-10 items-center rounded-xl bg-foreground/4 px-3 text-[15px]">{value}</div>
      </div>
    ) : (
      <div className="flex min-h-[52px] items-center gap-3 px-4">
        <Icon aria-hidden strokeWidth={1.75} className="size-[18px] shrink-0 text-muted-foreground" />
        <span className="text-[15px] text-muted-foreground">{label}</span>
        <span className="ml-auto min-w-0 truncate text-[15px] font-medium">{value}</span>
      </div>
    )
  }
  if (desktop) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className={overline}>{label}</span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button type="button" data-pill-exempt aria-label={label} className="flex h-10 w-full min-w-0 items-center gap-2 rounded-xl bg-foreground/4 px-3 text-left text-[15px] outline-none hover:bg-foreground/8 focus-visible:ring-3 focus-visible:ring-ring/50">
              <span className="min-w-0 flex-1 truncate">{value}</span>
              <ChevronDownIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" collisionPadding={16} avoidCollisions sticky="always" className={cn("max-h-[var(--radix-popover-content-available-height)] scroll-soft overflow-y-auto p-2", wide ? "w-80" : "w-72")}>
            {children(close)}
          </PopoverContent>
        </Popover>
      </div>
    )
  }
  return (
    <>
      <button type="button" data-pill-exempt aria-label={label} onClick={() => setOpen(true)} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset">
        <Icon aria-hidden strokeWidth={1.75} className="size-[18px] shrink-0 text-muted-foreground" />
        <span className="text-[15px] text-muted-foreground">{label}</span>
        <span className="ml-auto flex min-w-0 items-center gap-1.5 text-[15px] font-medium">
          <span className="min-w-0 truncate">{value}</span>
        </span>
        <ChevronRightIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" />
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[80dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{label}</DrawerTitle>
            <DrawerDescription className="sr-only">Escolha uma opção.</DrawerDescription>
          </DrawerHeader>
          <div className="scroll-soft overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children(close)}</div>
        </DrawerContent>
      </Drawer>
    </>
  )
}

export function TaskDetail(props: TaskDetailProps) {
  const desktop = useMediaQuery("(min-width: 900px)")
  const { task, onClose } = props
  const lastOpened = useRef<string | null>(null)
  useEffect(() => {
    if (task) lastOpened.current = task.id
  }, [task])
  const open = Boolean(task)

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent
          showCloseButton={false}
          aria-describedby={undefined}
          // Focus goes back to the card the pop-up was opened from.
          onCloseAutoFocus={(event) => {
            const id = lastOpened.current
            const target = id ? document.querySelector<HTMLElement>(`[data-task-id="${id}"] [data-task-open]`) : null
            if (target) {
              event.preventDefault()
              target.focus()
            }
          }}
          className="flex max-h-[90dvh] w-[min(760px,calc(100vw-3rem))] max-w-none flex-col gap-0 overflow-hidden rounded-[20px] border border-border p-0 sm:max-w-none"
        >
          {task ? <DetailBody key={task.id} {...props} task={task} desktop /> : null}
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
      <DrawerContent aria-describedby={undefined} className="data-[vaul-drawer-direction=bottom]:max-h-[92dvh] data-[vaul-drawer-direction=bottom]:rounded-t-[20px] h-[92dvh] gap-0">
        {task ? <DetailBody key={task.id} {...props} task={task} desktop={false} /> : null}
      </DrawerContent>
    </Drawer>
  )
}

function DetailBody({
  api,
  taxonomy,
  task,
  boardName,
  boardId,
  boards,
  onMoveToBoard,
  lists,
  tags,
  timeZone,
  now,
  siblings,
  onNavigate,
  onClose,
  onTaskChange,
  onToggleComplete,
  onMove,
  onMoveToList,
  onDuplicate,
  onTagCreated,
  onDelete,
  desktop,
  focusTags,
}: TaskDetailProps & { task: TaskView; desktop: boolean }) {
  const save = useSaveStatus()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? "")
  const [category, setCategory] = useState(task.category ?? "")
  const [checklist, setChecklist] = useState<ChecklistItemRow[]>([])
  const [comments, setComments] = useState<CommentRow[]>([])
  const [attachments, setAttachments] = useState<AttachmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [newItem, setNewItem] = useState("")
  // The draft survives closing the pop-up and reloads until it is sent (comments are never posted on blur).
  const draftKey = `organizzou:tarefas-comment:${task.id}`
  const [newComment, setNewCommentState] = useState(() => {
    try {
      return typeof window === "undefined" ? "" : (window.localStorage.getItem(draftKey) ?? "")
    } catch {
      return ""
    }
  })
  function setNewComment(value: string) {
    setNewCommentState(value)
    try {
      if (value) window.localStorage.setItem(draftKey, value)
      else window.localStorage.removeItem(draftKey)
    } catch {
      // Private mode: the draft just does not survive.
    }
  }
  const [uploading, setUploading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [removeFile, setRemoveFile] = useState<AttachmentRow | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const taskRef = useRef(task)
  useEffect(() => {
    taskRef.current = task
  }, [task])
  const newItemRef = useRef<HTMLInputElement>(null)
  const done = Boolean(task.completed_at)
  const list = lists.find((l) => l.id === task.list_id)
  const due = task.due_at ? splitDue(task.due_at, task.due_has_time, timeZone) : null
  const selectedTags = task.tagIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is TagRow => Boolean(t))
  const index = siblings.indexOf(task.id)
  const prevId = index > 0 ? siblings[index - 1] : null
  const nextId = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null

  const loadDetail = useCallback(() => {
    let cancelled = false
    api.getTaskDetail(task.id).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (!result.ok) {
        setLoadError(true)
        return
      }
      setChecklist(result.data.checklist)
      setComments(result.data.comments)
      setAttachments(result.data.attachments)
    })
    return () => {
      cancelled = true
    }
  }, [api, task.id])
  useEffect(() => loadDetail(), [loadDetail])

  // J / K walk through the visible list (ignored while typing).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null
      if (el?.closest("input, textarea, select, [contenteditable=true], [role=menu], [role=listbox]") || event.metaKey || event.ctrlKey || event.altKey) return
      if ((event.key === "j" || event.key === "J") && nextId) onNavigate(nextId)
      if ((event.key === "k" || event.key === "K") && prevId) onNavigate(prevId)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [nextId, prevId, onNavigate])

  function patch(values: Parameters<BoardApi["updateTask"]>[0]["patch"]) {
    return save.track(async () => {
      const result = await api.updateTask({ id: task.id, patch: values })
      if (!result.ok) return false
      onTaskChange(result.data)
      return true
    })
  }

  // Autosave of the free-text fields: ~600 ms after the last keystroke, and on blur.
  const debounce = useRef<Record<string, number>>({})
  useEffect(() => {
    const timers = debounce.current
    return () => Object.values(timers).forEach((t) => window.clearTimeout(t))
  }, [])
  function later(key: string, run: () => void) {
    window.clearTimeout(debounce.current[key])
    debounce.current[key] = window.setTimeout(run, 600)
  }
  function commitTitle(value: string) {
    const v = value.trim()
    if (!v) return setTitle(taskRef.current.title)
    if (v !== taskRef.current.title) void patch({ title: v })
  }
  function commitDescription(value: string) {
    if (value !== (taskRef.current.description ?? "")) void patch({ description: value.trim() || null })
  }

  function syncCounters(next: { checklist?: ChecklistItemRow[]; comments?: CommentRow[]; attachments?: AttachmentRow[] }) {
    const c = next.checklist ?? checklist
    onTaskChange({
      ...taskRef.current,
      checklistTotal: c.length,
      checklistDone: c.filter((i) => i.done).length,
      commentCount: (next.comments ?? comments).length,
      attachmentCount: (next.attachments ?? attachments).length,
    })
  }

  // ----- due date -----
  function setDueDay(day: string | null, time: string | null = due?.time ?? null) {
    if (!day) return void patch({ dueAt: null, dueHasTime: false })
    void patch({ dueAt: toDueIso(day, time, timeZone), dueHasTime: Boolean(time) })
  }
  const today = dayKey(now, timeZone)
  const plusDays = (n: number) => format(addDays(new Date(`${today}T12:00:00`), n), "yyyy-MM-dd")
  const dueLabel = due ? `${format(new Date(`${due.day}T12:00:00`), "EEE, d MMM", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase())}${due.time ? ` · ${due.time}` : ""}` : "Sem prazo"

  // ----- tags -----
  async function toggleTag(tag: TagRow) {
    const before = task.tagIds
    const next = before.includes(tag.id) ? before.filter((id) => id !== tag.id) : [...before, tag.id]
    onTaskChange({ ...taskRef.current, tagIds: next })
    const ok = await save.track(async () => (await api.setTaskTags({ taskId: task.id, tagIds: next })).ok)
    if (!ok) onTaskChange({ ...taskRef.current, tagIds: before })
  }
  const labels = useLabelColors()
  const taskColor = taskColorOf(labels.state, task)
  /** Palette swatches go to the `tasks.swatch` column; "Cinza" and custom colors stay on this device (see colors.ts). */
  function setTaskColor(value: ColorValue) {
    labels.setColor("task", task.id, value && columnSwatchFor(value) === value ? null : value)
    void patch({ swatch: columnSwatchFor(value) as SwatchId })
  }
  async function makeTag(name: string) {
    const result = await api.createTag({ name })
    if (!result.ok) {
      toast.error(result.error)
      return false
    }
    onTagCreated(result.data)
    await toggleTag(result.data)
    return result.data.id
  }

  // ----- checklist -----
  async function addItem(text = newItem) {
    const value = text.trim()
    if (!value) return
    setNewItem("")
    const result = await save.track(async () => {
      const r = await api.addChecklistItem({ taskId: task.id, text: value })
      if (r.ok) {
        const next = [...checklistRef.current, r.data]
        setChecklist(next)
        syncCounters({ checklist: next })
      }
      return r.ok
    })
    if (!result) setNewItem(value)
    requestAnimationFrame(() => newItemRef.current?.focus())
  }
  const checklistRef = useRef(checklist)
  useEffect(() => {
    checklistRef.current = checklist
  }, [checklist])
  async function toggleItem(item: ChecklistItemRow) {
    const before = checklist
    const next = checklist.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i))
    setChecklist(next)
    syncCounters({ checklist: next })
    const ok = await save.track(async () => (await api.updateChecklistItem({ id: item.id, done: !item.done })).ok)
    if (!ok) {
      setChecklist(before)
      syncCounters({ checklist: before })
    }
  }
  async function renameItem(item: ChecklistItemRow, text: string) {
    const value = text.trim()
    if (!value || value === item.text) return
    setChecklist((c) => c.map((i) => (i.id === item.id ? { ...i, text: value } : i)))
    await save.track(async () => (await api.updateChecklistItem({ id: item.id, text: value })).ok)
  }
  function removeItem(item: ChecklistItemRow) {
    const before = checklistRef.current
    const next = before.filter((i) => i.id !== item.id)
    undoable({
      message: "Item excluído.",
      apply: () => {
        setChecklist(next)
        syncCounters({ checklist: next })
      },
      revert: () => {
        setChecklist(before)
        syncCounters({ checklist: before })
      },
      commit: async () => {
        const ok = await save.track(async () => (await api.deleteChecklistItem(item.id)).ok)
        if (!ok) {
          setChecklist(before)
          syncCounters({ checklist: before })
        }
      },
    })
  }

  // ----- comments -----
  async function sendComment() {
    const body = newComment.trim()
    if (!body) return
    setNewComment("")
    const ok = await save.track(async () => {
      const r = await api.addComment({ taskId: task.id, body })
      if (r.ok) {
        const next = [...commentsRef.current, r.data]
        setComments(next)
        syncCounters({ comments: next })
      }
      return r.ok
    })
    if (!ok) setNewComment(body)
  }
  const commentsRef = useRef(comments)
  useEffect(() => {
    commentsRef.current = comments
  }, [comments])
  function removeComment(comment: CommentRow) {
    const before = commentsRef.current
    const next = before.filter((c) => c.id !== comment.id)
    undoable({
      message: "Comentário excluído.",
      apply: () => {
        setComments(next)
        syncCounters({ comments: next })
      },
      revert: () => {
        setComments(before)
        syncCounters({ comments: before })
      },
      commit: async () => {
        const ok = await save.track(async () => (await api.deleteComment(comment.id)).ok)
        if (!ok) {
          setComments(before)
          syncCounters({ comments: before })
        }
      },
    })
  }

  // ----- attachments -----
  async function upload(files: FileList | File[] | null) {
    if (!files || files.length === 0) return
    setFileError(null)
    setUploading(true)
    let current = attachments
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setFileError(`${file.name} passa de 10 MB e não foi anexado.`)
        continue
      }
      const result = await api.uploadAttachment({ taskId: task.id, file })
      if (!result.ok) {
        setFileError(result.error)
        continue
      }
      current = [...current, result.data]
      setAttachments(current)
    }
    syncCounters({ attachments: current })
    setUploading(false)
  }
  async function download(file: AttachmentRow) {
    const result = await api.getAttachmentUrl(file.id)
    if (!result.ok) return void toast.error(result.error)
    window.open(result.data.url, "_blank", "noopener")
  }
  async function confirmRemoveFile() {
    const file = removeFile
    setRemoveFile(null)
    if (!file) return
    const before = attachments
    const next = before.filter((a) => a.id !== file.id)
    undoable({
      message: "Anexo removido.",
      apply: () => {
        setAttachments(next)
        syncCounters({ attachments: next })
      },
      revert: () => {
        setAttachments(before)
        syncCounters({ attachments: before })
      },
      commit: async () => {
        const ok = await save.track(async () => (await api.deleteAttachment(file.id)).ok)
        if (!ok) {
          setAttachments(before)
          syncCounters({ attachments: before })
        }
      },
    })
  }

  const checklistDone = checklist.filter((i) => i.done).length
  const initials = "VC"

  // ---------------------------------------------------------------- pieces
  const dueContent = (close: () => void) => (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Atalhos de prazo">
        {[
          { id: "hoje", label: "Hoje", on: due?.day === today },
          { id: "amanha", label: "Amanhã", on: due?.day === plusDays(1) },
          { id: "semana", label: "Próxima semana", on: due?.day === plusDays(7) },
          { id: "sem", label: "Sem data", on: !due },
        ].map((chip) => (
          <button
            key={chip.id}
            type="button"
            aria-pressed={chip.on}
            onClick={() => {
              setDueDay(chip.id === "hoje" ? today : chip.id === "amanha" ? plusDays(1) : chip.id === "semana" ? plusDays(7) : null)
              if (chip.id === "sem") close()
            }}
            className={cn("inline-flex h-9 items-center rounded-full border px-3 text-[14px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-md:h-11", chip.on ? "border-transparent bg-foreground/14 font-semibold" : "border-border hover:bg-accent")}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <Calendar mode="single" locale={ptBR} selected={due ? new Date(`${due.day}T12:00:00`) : undefined} onSelect={(date) => date && setDueDay(format(date, "yyyy-MM-dd"))} className="mx-auto w-full [--cell-size:--spacing(9)]" />
      <label className="flex min-h-11 items-center justify-between gap-3 px-1 text-[15px]">
        Hora
        <Input
          type="time"
          step={300}
          aria-label="Hora do prazo"
          disabled={!due}
          value={due?.time ?? ""}
          onChange={(e) => due && setDueDay(due.day, e.target.value || null)}
          className="h-10 w-32 rounded-xl"
        />
      </label>
      <Button type="button" variant="outline" className="h-11 rounded-full" onClick={close}>
        Pronto
      </Button>
    </div>
  )

  const tagsContent = (
    <ManageablePicker
      noun="tag"
      kind="tag"
      multiple
      items={tags.map((t) => ({ id: t.id, label: t.name }))}
      selected={task.tagIds}
      onSelect={(id) => {
        const tag = tags.find((t) => t.id === id)
        if (tag) void toggleTag(tag)
      }}
      onCreate={makeTag}
      onRename={(id, name) => taxonomy.tags.rename(id, name)}
      onDelete={taxonomy.tags.remove}
      usage={taxonomy.tags.usage}
    />
  )

  const categoriesWithCurrent = [...new Set([...taxonomy.categories.list, ...(category.trim() ? [category.trim()] : [])])]

  const properties = (
    <div className={cn(desktop ? "flex flex-col gap-4" : "divide-y divide-border overflow-hidden rounded-[14px] bg-foreground/4")} data-testid="properties">
      <Property label="Quadro" icon={ListIcon} value={boardName} desktop={desktop}>
        {(close) => (
          <OptionList
            options={boards.map((b) => ({ id: b.id, label: b.name }))}
            value={boardId}
            onPick={(id) => {
              if (id !== boardId) onMoveToBoard(task, id)
              close()
            }}
          />
        )}
      </Property>
      <Property label="Lista" icon={LayoutListIcon} value={list?.name ?? "—"} desktop={desktop}>
        {(close) => (
          <OptionList
            options={lists.map((l) => ({ id: l.id, label: l.name }))}
            value={task.list_id}
            onPick={(id) => {
              if (id !== task.list_id) onMoveToList(task, id)
              close()
            }}
          />
        )}
      </Property>
      <Property label="Prazo" icon={CalendarIcon} value={dueLabel} desktop={desktop} wide>
        {dueContent}
      </Property>
      <Property
        label="Tags"
        defaultOpen={focusTags}
        icon={TagIcon}
        value={
          selectedTags.length === 0 ? (
            <span className="text-muted-foreground">Sem tags</span>
          ) : (
            <span className="flex min-w-0 items-center gap-2">
              {selectedTags.slice(0, 2).map((t) => (
                <LabelBadge key={t.id} name={t.name} color={labels.colorOf("tag", t.id)} />
              ))}
              {selectedTags.length > 2 ? <span className="tabular">+{selectedTags.length - 2}</span> : null}
            </span>
          )
        }
        desktop={desktop}
      >
        {() => tagsContent}
      </Property>
      {selectedTags.length > 0 ? (
        <ul className={cn("flex flex-wrap gap-1.5", !desktop && "px-4 py-2")} aria-label="Tags da tarefa">
          {selectedTags.map((tag) => (
            <li key={tag.id} className="inline-flex h-8 max-w-full items-center gap-1 rounded-full bg-foreground/8 pr-1 pl-1 text-[13px]">
              <TagChip tag={tag} className="h-8 bg-transparent text-[13px]" />
              <button type="button" aria-label={`Remover tag ${tag.name}`} onClick={() => void toggleTag(tag)} className="relative flex size-6 items-center justify-center rounded-full outline-none after:absolute after:-inset-2 hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50">
                <XIcon aria-hidden strokeWidth={1.75} className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Property label="Categoria" icon={TagIcon} value={category.trim() || <span className="text-muted-foreground">Sem categoria</span>} desktop={desktop}>
        {(close) => (
          <ManageablePicker
            noun="categoria"
            kind="category"
            fixed={{ id: "none", label: "Sem categoria" }}
            items={categoriesWithCurrent.map((c) => ({ id: c, label: c }))}
            selected={category.trim() ? [category.trim()] : []}
            onSelect={(id) => {
              const next = id === "none" ? "" : id
              setCategory(next)
              void patch({ category: next || null })
              close()
            }}
            onCreate={(name) => {
              setCategory(name)
              void patch({ category: name })
              close()
              return name
            }}
            onRename={(from, to) => {
              if (category.trim() === from) setCategory(to)
              taxonomy.categories.rename(from, to)
            }}
            onDelete={(name) => {
              if (category.trim() === name) setCategory("")
              taxonomy.categories.remove(name)
            }}
            usage={taxonomy.categories.usage}
          />
        )}
      </Property>
      <div className={cn("flex flex-col gap-1.5", !desktop && "px-4 py-3")} data-testid="task-color-block">
        <span className={cn(overline, "flex items-center gap-2")}>
          Cor da tarefa
          {resolveHex(taskColor) ? <ColorDot color={taskColor} /> : null}
        </span>
        <ColorPicker label="Cor da tarefa" value={taskColor} onChange={setTaskColor} custom={labels.state.custom} onSaveCustom={labels.addCustom} onRemoveCustom={labels.removeCustom} />
        <p className="px-1 text-[12px] leading-4 text-muted-foreground">Aparece no cartão, na Agenda e no Calendário.</p>
      </div>
    </div>
  )

  const descriptionBlock = (
    <section className="flex flex-col gap-2" aria-label="Descrição">
      <h3 className={overline}>Descrição</h3>
      <Textarea
        value={description}
        placeholder="Acrescente detalhes"
        aria-label="Descrição"
        onChange={(e) => {
          setDescription(e.target.value)
          later("description", () => commitDescription(e.target.value))
        }}
        onBlur={() => commitDescription(description)}
        className="min-h-24 rounded-xl border-transparent bg-foreground/4 dark:bg-foreground/4"
      />
    </section>
  )

  const checklistBlock = (
    <section className="flex flex-col gap-2" aria-label="Checklist">
      <div className="flex items-center gap-3">
        <h3 className={overline}>Checklist</h3>
        {checklist.length > 0 ? (
          <span className="tabular text-[13px] leading-5 text-muted-foreground">
            {checklistDone}/{checklist.length}
          </span>
        ) : null}
      </div>
      {checklist.length > 0 ? <Progress value={(checklistDone / checklist.length) * 100} className="h-1" aria-label="Progresso do checklist" /> : null}
      {loading ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <ul className="flex flex-col">
          {checklist.map((item) => (
            <ChecklistRow key={item.id} item={item} onToggle={() => void toggleItem(item)} onRename={(text) => void renameItem(item, text)} onRemove={() => void removeItem(item)} onEnter={() => newItemRef.current?.focus()} />
          ))}
          <li>
            <form
              className="flex min-h-11 items-center gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                void addItem()
              }}
            >
              <PlusIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
              <input
                ref={newItemRef}
                value={newItem}
                aria-label="Adicionar item"
                placeholder="Adicionar item"
                maxLength={300}
                enterKeyHint="next"
                onChange={(e) => setNewItem(e.target.value)}
                // Auto-commit: leaving the field saves a non-empty text (not when the blur is a tap on the field own check button).
                onBlur={(e) => {
                  if (e.relatedTarget instanceof HTMLElement && e.relatedTarget.dataset.addItemConfirm !== undefined) return
                  if (newItem.trim()) void addItem()
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation()
                    setNewItem("")
                    e.currentTarget.blur()
                  }
                }}
                className="min-h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
              />
              {newItem.trim() ? (
                <Button type="submit" size="icon" data-add-item-confirm aria-label="Salvar item" className="size-11 shrink-0 rounded-full md:hidden" onMouseDown={(e) => e.preventDefault()}>
                  <CheckIcon strokeWidth={1.75} />
                </Button>
              ) : null}
            </form>
          </li>
        </ul>
      )}
    </section>
  )

  const attachmentsBlock = (
    <section className="flex flex-col gap-2" aria-label="Anexos">
      <h3 className={overline}>Anexos</h3>
      {attachments.length > 0 ? (
        <ul>
          {attachments.map((file) => (
            <li key={file.id} className="flex min-h-12 items-center gap-3 border-b border-border last:border-b-0">
              <PaperclipIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-[15px] leading-6">{file.file_name}</span>
              <span className="tabular text-[13px] leading-5 text-muted-foreground">{formatSize(file.size_bytes)}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-11 rounded-full md:size-9" aria-label={`Mais ações: ${file.file_name}`}>
                    <EllipsisIcon strokeWidth={1.75} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44 rounded-2xl p-2">
                  <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={() => void download(file)}>
                    <DownloadIcon strokeWidth={1.75} /> Baixar
                  </DropdownMenuItem>
                  <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={() => setRemoveFile(file)}>
                    <Trash2Icon strokeWidth={1.75} /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      ) : null}
      {desktop ? (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            void upload(e.dataTransfer.files)
          }}
          className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed border-border px-4 py-3 text-center text-[14px] text-muted-foreground hover:bg-foreground/4 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
        >
          <UploadIcon aria-hidden strokeWidth={1.75} className="size-5" />
          {uploading ? "Enviando…" : "Arraste arquivos ou anexe · até 10 MB"}
          <input type="file" multiple data-testid="attach-input" className="sr-only" disabled={uploading} onChange={(e) => { void upload(e.target.files); e.target.value = "" }} />
        </label>
      ) : (
        <label className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-border text-[15px] font-medium has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
          <PaperclipIcon strokeWidth={1.75} className="size-4" /> {uploading ? "Enviando…" : "Anexar arquivo · até 10 MB"}
          <input type="file" multiple data-testid="attach-input" className="sr-only" disabled={uploading} onChange={(e) => { void upload(e.target.files); e.target.value = "" }} />
        </label>
      )}
      {fileError ? (
        <p role="alert" className="text-[13px] leading-5 text-foreground">
          {fileError}
        </p>
      ) : null}
    </section>
  )

  const commentsBlock = (
    <section className="flex flex-col gap-3" aria-label="Comentários">
      <h3 className={overline}>Comentários</h3>
      <ul className="flex flex-col gap-3">
        {comments.map((comment) => (
          <li key={comment.id} className="flex items-start gap-3">
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-semibold">
              {initials}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[13px] leading-5">
                <span className="font-semibold">Você</span> <span className="tabular text-muted-foreground">· {format(new Date(comment.created_at), "d MMM, HH:mm", { locale: ptBR })}</span>
              </span>
              <span className="text-[15px] leading-6 break-words whitespace-pre-wrap">{comment.body}</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-11 shrink-0 rounded-full md:size-9" aria-label="Mais ações do comentário">
                  <EllipsisIcon strokeWidth={1.75} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px] rounded-2xl p-2">
                <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px] whitespace-nowrap" onSelect={() => void removeComment(comment)}>
                  <Trash2Icon strokeWidth={1.75} /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void sendComment()
        }}
      >
        <Textarea
          value={newComment}
          placeholder="Escreva um comentário"
          aria-label="Novo comentário"
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void sendComment()
            }
          }}
          className="min-h-20 rounded-xl border-transparent bg-foreground/4 dark:bg-foreground/4"
        />
        <Button type="submit" variant="outline" className="h-11 self-end rounded-full px-5" disabled={!newComment.trim()}>
          Comentar
        </Button>
      </form>
    </section>
  )

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 rounded-full md:size-9" aria-label="Mais ações">
          <EllipsisIcon strokeWidth={1.75} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52 rounded-2xl p-2">
        <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={() => onDuplicate(task)}>
          <CopyIcon strokeWidth={1.75} /> Duplicar
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={() => onMove(task)}>
          <ArrowRightIcon strokeWidth={1.75} /> Mover para…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={() => onDelete(task)}>
          <Trash2Icon strokeWidth={1.75} /> Excluir tarefa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const titleId = "task-detail-title"
  const checkbox = (
    <span className="flex size-11 shrink-0 items-center justify-center md:size-7">
      <Checkbox checked={done} onCheckedChange={() => onToggleComplete(task)} aria-label={done ? `Reabrir ${task.title}` : `Concluir ${task.title}`} className="size-5 after:-inset-3 [&_svg]:size-3" />
    </span>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="task-detail">
      {desktop ? <DialogTitle id={titleId} className="sr-only">{task.title}</DialogTitle> : <DrawerTitle id={titleId} className="sr-only">{task.title}</DrawerTitle>}
      {desktop ? <DialogDescription className="sr-only">Detalhes da tarefa.</DialogDescription> : <DrawerDescription className="sr-only">Detalhes da tarefa.</DrawerDescription>}
      {/* Top bar: breadcrumb (or the title once the body has scrolled past it on phones), save status, navigation, menu, close. */}
      <header className={cn("flex shrink-0 items-center gap-1 border-b px-3 transition-colors duration-[400ms] motion-reduce:transition-none", desktop ? "h-14 px-5" : "h-[52px]", scrolled ? "border-border" : "border-transparent")}>
        <div className="min-w-0 flex-1">
          {!desktop && scrolled ? (
            <p className="truncate text-[15px] font-semibold" data-testid="header-title">{task.title}</p>
          ) : (
            <p className="truncate text-[13px] text-muted-foreground">
              {boardName} <span aria-hidden>›</span> {list?.name}
            </p>
          )}
        </div>
        <SaveIndicator state={save.state} onRetry={save.retryNow} />
        {desktop ? (
          <>
            <Button variant="ghost" size="icon" className="size-9 rounded-full" aria-label="Tarefa anterior" disabled={!prevId} onClick={() => prevId && onNavigate(prevId)}>
              <ChevronLeftIcon strokeWidth={1.75} />
            </Button>
            <Button variant="ghost" size="icon" className="size-9 rounded-full" aria-label="Próxima tarefa" disabled={!nextId} onClick={() => nextId && onNavigate(nextId)}>
              <ChevronRightIcon strokeWidth={1.75} />
            </Button>
          </>
        ) : null}
        {menu}
        <Button variant="ghost" size="icon" className="size-11 rounded-full md:size-9" aria-label="Fechar" onClick={onClose}>
          <XIcon strokeWidth={1.75} />
        </Button>
      </header>

      <div
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > (desktop ? 0 : 56))}
        className={cn("min-h-0 flex-1 scroll-soft overflow-y-auto overscroll-contain", desktop ? "px-6 pb-6" : "px-4 pb-6")}
        data-testid="task-detail-body"
      >
        {loadError ? (
          <p role="alert" className="py-3 text-[14px]">
            Não consegui carregar os detalhes.{" "}
            <button type="button" className="font-medium underline underline-offset-4" onClick={() => {
                setLoading(true)
                setLoadError(false)
                loadDetail()
              }}>
              Tentar de novo
            </button>
          </p>
        ) : null}
        <div className="flex items-start gap-2 py-3">
          {checkbox}
          <TitleField value={title} onChange={(v) => { setTitle(v); later("title", () => commitTitle(v)) }} onCommit={() => commitTitle(title)} className={desktop ? "text-[24px] leading-8" : "text-[22px] leading-[30px]"} />
        </div>
        {desktop ? (
          <div className="grid grid-cols-[minmax(0,1fr)_288px] gap-6">
            <div className="flex min-w-0 flex-col gap-8">
              {descriptionBlock}
              {checklistBlock}
              {attachmentsBlock}
              {commentsBlock}
            </div>
            <aside aria-label="Propriedades" className="border-l border-border pl-6">
              {properties}
            </aside>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {properties}
            {descriptionBlock}
            {checklistBlock}
            {attachmentsBlock}
            {commentsBlock}
          </div>
        )}
      </div>

      {desktop ? null : (
        <div className="shrink-0 border-t border-border bg-popover px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <Button className="h-12 w-full rounded-full text-[16px] font-semibold" onClick={() => onToggleComplete(task)}>
            <CheckIcon strokeWidth={1.75} /> {done ? "Reabrir tarefa" : "Concluir tarefa"}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(removeFile)}
        onOpenChange={(next) => !next && setRemoveFile(null)}
        title="Remover este anexo?"
        description={removeFile ? `${removeFile.file_name} será apagado. Essa ação não pode ser desfeita.` : ""}
        confirmLabel="Remover"
        onConfirm={() => void confirmRemoveFile()}
      />
    </div>
  )
}

/** One checklist row (44 px): circular check, text edited in place, ⋯ menu (no always-visible X). */
function ChecklistRow({ item, onToggle, onRename, onRemove, onEnter }: { item: ChecklistItemRow; onToggle: () => void; onRename: (text: string) => void; onRemove: () => void; onEnter: () => void }) {
  const [text, setText] = useState(item.text)
  const input = useRef<HTMLInputElement>(null)
  return (
    <li className="flex min-h-11 items-center gap-3" data-testid="checklist-row">
      <span className="flex size-11 shrink-0 items-center justify-center md:size-7">
        <Checkbox checked={item.done} onCheckedChange={onToggle} aria-label={`Marcar ${item.text}`} className="size-5 after:-inset-3 [&_svg]:size-3" />
      </span>
      <input
        ref={input}
        value={text}
        aria-label={`Item: ${item.text}`}
        maxLength={300}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text.trim()) onRename(text)
          else setText(item.text)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            if (text.trim()) onRename(text)
            onEnter()
          }
          if (e.key === "Backspace" && text === "") {
            e.preventDefault()
            onRemove()
          }
        }}
        className={cn("min-h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none", item.done && "text-muted-foreground line-through")}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-11 rounded-full md:size-9" aria-label={`Mais ações: ${item.text}`}>
            <EllipsisIcon strokeWidth={1.75} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40 rounded-2xl p-2">
          <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={() => requestAnimationFrame(() => input.current?.focus())}>
            <PencilIcon strokeWidth={1.75} /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={onRemove}>
            <Trash2Icon strokeWidth={1.75} /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}
